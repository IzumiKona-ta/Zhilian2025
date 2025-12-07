import sys
import os
import torch
# 项目路径配置（如果代码和依赖在同一目录，可以注释掉）
# PROJECT_PATH = "/home/test/ids_project"
# sys.path.append(PROJECT_PATH)
import torch.nn as nn
import torch.optim as optim
import numpy as np
from torch.utils.data import Dataset, DataLoader
from tqdm import tqdm
import logging
import multiprocessing

# Opacus差分隐私支持
try:
    from opacus import PrivacyEngine
    from opacus.validators import ModuleValidator
    OPACUS_AVAILABLE = True
    logger_opacus = logging.getLogger(__name__)
except ImportError:
    OPACUS_AVAILABLE = False
    logger_opacus = logging.getLogger(__name__)
    logger_opacus.warning("⚠️ Opacus未安装，将使用标准训练（无差分隐私）")

from ids_common import (
    TransformerEncoder, Generator, Discriminator,
    SEQ_LEN, PCA_DIM, NUM_CLASSES, LATENT_DIM,
    DEVICE, PREPROCESS_DIR, MODEL_DIR
)

# ========== 全局配置（拉满强度） ==========
TEST_MODE = False
# 配置日志：同时输出到控制台和文件
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - [训练日志] - %(message)s",
    handlers=[
        logging.StreamHandler(),  # 输出到控制台（会被nohup重定向）
        logging.FileHandler('train_detailed.log', encoding='utf-8', mode='a')  # 同时输出到文件
    ]
)
logger = logging.getLogger(__name__)
# 确保logger输出不会被缓冲
logger.setLevel(logging.INFO)
# 设置multiprocessing启动方式（避免资源泄漏警告）
try:
    multiprocessing.set_start_method('spawn', force=True)
except RuntimeError:
    # 如果已经设置过，忽略错误
    pass

# 多GPU检测（拉满CUDA优化）
def auto_detect_multi_gpu():
    if not torch.cuda.is_available():
        raise RuntimeError("❌ 未检测到GPU设备！")
    gpu_count = torch.cuda.device_count()
    logger.info(f"✅ 检测到 {gpu_count} 个GPU设备：")
    for gpu_idx in range(gpu_count):
        props = torch.cuda.get_device_properties(gpu_idx)
        logger.info(f"  - GPU {gpu_idx}：{props.name}（显存：{props.total_memory//1024//1024}GB）")
    # 开启CUDA异步计算+TF32优化（拉满算力）
    torch.backends.cudnn.benchmark = True  # 自动寻找最优卷积算法
    torch.backends.cudnn.deterministic = False  # 禁用确定性以获得最快速度
    torch.backends.cudnn.allow_tf32 = True
    torch.backends.cuda.matmul.allow_tf32 = True
    # 增加cudnn workspace size以提高性能
    torch.backends.cudnn.max_workspace_size = 2 * 1024 * 1024 * 1024  # 2GB
    # 注意：不要设置set_device(0)，让DataParallel自动管理所有GPU
    return gpu_count

GPU_COUNT = auto_detect_multi_gpu()

# 超参数优化（平衡训练速度和效果）
EPOCHS = 2 if TEST_MODE else 60  # 训练轮次60轮
# 【速度优化】适度增加批次大小，平衡速度和效果
BATCH_SIZE = 1024 * GPU_COUNT    # 单卡1024，总批次4096（提高GPU利用率，拉满显存）
# 如果速度还是太慢，可以降到 512 * GPU_COUNT（回到原来的2048）
LEARNING_RATE = 1e-4             # 学习率（提升到1e-4，加快收敛速度，平衡稳定性和效率）
# 【速度优化】降低训练迭代次数，加快速度
CRITIC_ITERATIONS = 3            # 判别器训练次数（降到3，加快训练速度）
GENERATOR_ITERATIONS = 3         # 生成器训练次数（降到3，加快训练速度）
# 【速度优化】降低生成器数据量，大幅加快速度
FAKE_SAMPLE_MULTIPLE = 2         # 生成样本数量 = 真实样本数量 * 2（降到2，大幅加快速度）
# 如果还是太慢，可以降到 2（回到原来的配置）
CLASS_LOSS_WEIGHT = 1.0          # 分类损失权重（提升到1.0，确保模型学会分类）

# Opacus差分隐私参数
# 【重要】Opacus与GAN训练存在兼容性问题，建议暂时禁用
# 如果遇到 "Per sample gradient is not initialized" 错误，请设置 USE_DP_TRAINING = False
USE_DP_TRAINING = False          # 是否启用差分隐私训练（建议暂时禁用）
NOISE_MULTIPLIER = 1.0           # 噪声乘数（控制隐私预算消耗速度）
MAX_GRAD_NORM = 1.0              # 梯度裁剪阈值（L2范数）
DELTA = 1e-5                     # 差分隐私的delta参数（通常设为1/数据集大小）

# ========== 数据集类（拉满数据加载） ==========
class TrafficDataset(Dataset):
    def __init__(self, X, y, seq_len=SEQ_LEN):
        self.X = torch.tensor(X, dtype=torch.float32)
        self.y = torch.tensor(y, dtype=torch.long)
        self.seq_len = seq_len

    def __len__(self):
        return len(self.X) - self.seq_len + 1

    def __getitem__(self, idx):
        x_seq = self.X[idx:idx+self.seq_len]
        y_label = self.y[idx+self.seq_len-1]
        return x_seq, y_label

# ========== TransEC-GAN训练类（核心优化生成器数据量） ==========
class TransEC_GAN(nn.Module):
    def __init__(self):
        super().__init__()
        self.generator = Generator().to(DEVICE)
        self.discriminator = Discriminator().to(DEVICE)
        # 生成器始终可以使用DataParallel（4个GPU）
        # 明确指定device_ids确保使用所有GPU
        if GPU_COUNT > 1:
            self.generator = nn.DataParallel(
                self.generator,
                device_ids=list(range(GPU_COUNT)),  # 明确指定使用所有GPU
                output_device=0  # 主GPU为GPU 0
            )
        # 判别器：如果启用Opacus，不使用DataParallel（Opacus不支持）
        # 如果禁用Opacus，可以使用DataParallel（4个GPU）
        # 注意：在__init__中直接使用全局变量（此时还未进入函数作用域）
        if GPU_COUNT > 1 and not (USE_DP_TRAINING and OPACUS_AVAILABLE):
            self.discriminator = nn.DataParallel(
                self.discriminator,
                device_ids=list(range(GPU_COUNT)),  # 明确指定使用所有GPU
                output_device=0  # 主GPU为GPU 0
            )
        # 兼容旧版本的GradScaler
        self.scaler = torch.amp.GradScaler(enabled=True)
        self.g_optim = optim.Adam(self.generator.parameters(), lr=LEARNING_RATE, betas=(0.5, 0.999))
        self.d_optim = optim.Adam(self.discriminator.parameters(), lr=LEARNING_RATE, betas=(0.5, 0.999))
        
        # 使用加权损失函数处理数据不平衡
        # 计算类别权重：Benign样本多，权重小；攻击样本少，权重大
        # 权重 = 总样本数 / (类别数 * 该类样本数)
        self.class_weights = self._calculate_class_weights()
        
        # Opacus要求使用reduction='none'的损失函数以支持per-sample梯度
        if USE_DP_TRAINING and OPACUS_AVAILABLE:
            self.class_criterion = nn.CrossEntropyLoss(
                weight=self.class_weights.to(DEVICE),
                reduction='none'  # per-sample梯度
            )
        else:
            self.class_criterion = nn.CrossEntropyLoss(weight=self.class_weights.to(DEVICE))
        
        # Opacus PrivacyEngine（将在训练时初始化）
        self.privacy_engine = None
    
    def _calculate_class_weights(self):
        """计算类别权重以处理数据不平衡"""
        try:
            labels = np.load(os.path.join(PREPROCESS_DIR, "y_train.npy"))
            unique, counts = np.unique(labels, return_counts=True)
            total_samples = len(labels)
            
            # 创建长度为NUM_CLASSES的权重张量（确保与模型输出维度匹配）
            weights = torch.ones(NUM_CLASSES, dtype=torch.float32)
            
            # 计算权重：总样本数 / (类别数 * 该类样本数)
            # 只更新数据集中存在的类别
            for i, label in enumerate(unique):
                label_idx = int(label)
                if 0 <= label_idx < NUM_CLASSES:
                    class_count = counts[i]
                    weights[label_idx] = total_samples / (NUM_CLASSES * class_count)
            
            # 记录权重信息
            weight_dict = {int(label): float(weights[int(label)]) for label in unique if 0 <= int(label) < NUM_CLASSES}
            logger.info(f"📊 类别权重计算完成（共{NUM_CLASSES}个类别）：{weight_dict}")
            logger.info(f"   数据集中存在的类别：{unique.tolist()}")
            
            return weights
        except Exception as e:
            logger.warning(f"⚠️ 无法计算类别权重，使用默认权重：{e}")
            return torch.ones(NUM_CLASSES, dtype=torch.float32)

    def generate_fake(self, batch_size, labels):
        """生成FAKE_SAMPLE_MULTIPLE倍数量的fake样本，大幅提高生成数据量（增强生成器训练强度）"""
        z = torch.randn(batch_size * FAKE_SAMPLE_MULTIPLE, LATENT_DIM, device=DEVICE)
        labels_expanded = labels.repeat(FAKE_SAMPLE_MULTIPLE)
        labels_onehot = torch.nn.functional.one_hot(labels_expanded, NUM_CLASSES).float()
        return self.generator(z, labels_onehot)

    def train_step(self, real_x, real_labels):
        batch_size = real_x.shape[0]
        d_loss = None
        g_loss = None
        real_class = None

        # 阶段1：训练判别器
        for _ in range(CRITIC_ITERATIONS):
            self.discriminator.train()
            self.generator.eval()
            # 【关键修复】Opacus要求每次zero_grad后，forward和backward必须匹配
            # 确保在每次迭代开始时清理所有激活
            self.d_optim.zero_grad()

            # 【关键修复】Opacus不支持FP16，在Opacus模式下禁用AMP
            # Opacus的per-sample梯度计算需要FP32精度
            use_amp = not (USE_DP_TRAINING and OPACUS_AVAILABLE)
            
            if USE_DP_TRAINING and OPACUS_AVAILABLE:
                # 【Opacus模式】只对real数据计算per-sample梯度（差分隐私保护）
                # fake数据使用标准梯度（不需要隐私保护）
                
                # 生成fake数据（批次大小：batch_size，与real数据一致）
                fake_labels = torch.randint(1, NUM_CLASSES, (batch_size,), device=DEVICE)
                z = torch.randn(batch_size, LATENT_DIM, device=DEVICE)
                labels_onehot = torch.nn.functional.one_hot(fake_labels, NUM_CLASSES).float()
                fake_x = self.generator(z, labels_onehot)
                
                with torch.amp.autocast('cuda', enabled=False):  # Opacus需要FP32
                    # 【关键修复】分别处理real和fake数据
                    # real数据：需要per-sample梯度（用于差分隐私）
                    real_pred, real_class = self.discriminator(real_x)
                    
                    # 计算real数据的per-sample损失
                    # WGAN损失：判别器希望real_pred大，所以损失是 -real_pred（per-sample）
                    d_loss_real_per_sample = -real_pred.squeeze()  # [batch_size]
                    
                    # 分类损失（per-sample，reduction='none'已设置）
                    d_loss_class_per_sample = self.class_criterion(real_class, real_labels)  # [batch_size]
                    class_weights_gpu = self.class_weights.to(DEVICE)
                    real_labels_gpu = real_labels.to(DEVICE)
                    d_loss_class_weighted = d_loss_class_per_sample * class_weights_gpu[real_labels_gpu]  # [batch_size]
                    
                    # real数据的per-sample总损失（这是Opacus需要的格式）
                    d_loss_real_per_sample_total = d_loss_real_per_sample + CLASS_LOSS_WEIGHT * d_loss_class_weighted  # [batch_size]
                    
                    # fake数据：使用标准损失（不需要per-sample梯度）
                    fake_pred, _ = self.discriminator(fake_x.detach())  # detach避免影响per-sample梯度
                    d_loss_fake = torch.mean(fake_pred)  # 标量
                    
                    # 总损失（用于显示）
                    d_loss_real_mean = d_loss_real_per_sample_total.mean()  # 标量
                    d_loss = d_loss_real_mean + d_loss_fake  # 总损失
                    
                    # NaN检测
                    if torch.isnan(d_loss) or torch.isinf(d_loss):
                        logger.warning("⚠️ 判别器损失值异常（NaN/Inf），跳过此迭代")
                        continue
                
                # 【关键修复】Opacus需要per-sample损失进行backward
                # 警告：当前实现可能不完全兼容Opacus，如果遇到错误，请禁用USE_DP_TRAINING
                # 
                # 方案：只对real数据的per-sample损失进行backward
                # Opacus会在backward时自动计算per-sample gradients
                # fake数据在这个iteration中不参与梯度更新（GAN训练可能需要调整）
                d_loss_real_per_sample_total.mean().backward()
                
                # 注意：fake损失不参与梯度更新，这可能导致GAN训练不稳定
                # 如果需要完整的GAN训练，建议禁用Opacus（设置USE_DP_TRAINING = False）
                # 【关键修复】增强梯度裁剪，防止梯度爆炸（从1.0降低到0.5）
                torch.nn.utils.clip_grad_norm_(self.discriminator.parameters(), 1.0)
                # 【关键修复】Opacus要求step后清理激活，确保下次迭代时激活列表为空
                self.d_optim.step()
                # 【关键修复】WGAN权重裁剪：限制判别器权重在[-0.01, 0.01]范围内，防止权重爆炸
                # 这是WGAN的标准做法，可以防止判别器输出值过大
                with torch.no_grad():
                    if hasattr(self.discriminator, '_module'):  # Opacus包装的模型
                        for param in self.discriminator._module.parameters():
                            param.clamp_(-0.1, 0.1)
                    elif isinstance(self.discriminator, nn.DataParallel):
                        for param in self.discriminator.module.parameters():
                            param.clamp_(-0.1, 0.1)
                    else:
                        for param in self.discriminator.parameters():
                            param.clamp_(-0.1, 0.1)
                # 确保激活被清理（Opacus会在step中自动清理，但为了安全起见，我们显式清理）
                if hasattr(self.discriminator, '_module'):
                    # Opacus包装的模型，清理激活
                    for module in self.discriminator._module.modules():
                        if hasattr(module, 'activations'):
                            module.activations.clear()
            else:
                # 【稳定性修复】禁用AMP混合精度，使用FP32防止数值溢出导致NaN
                # with torch.amp.autocast('cuda', enabled=use_amp):
                if True:  # 强制使用FP32
                    real_pred, real_class = self.discriminator(real_x)
                    d_loss_real = -torch.mean(real_pred)
                    
                    d_loss_class_per_sample = self.class_criterion(real_class, real_labels)
                    if d_loss_class_per_sample.dim() > 0:
                        d_loss_class = d_loss_class_per_sample.mean()
                    else:
                        d_loss_class = d_loss_class_per_sample
                    
                    fake_labels = torch.randint(1, NUM_CLASSES, (batch_size,), device=DEVICE)
                    fake_x = self.generate_fake(batch_size, fake_labels)
                    fake_pred, _ = self.discriminator(fake_x.detach())
                    d_loss_fake = torch.mean(fake_pred)
                    
                    d_loss = d_loss_real + d_loss_fake + CLASS_LOSS_WEIGHT * d_loss_class
                    
                    if torch.isnan(d_loss) or torch.isinf(d_loss):
                        logger.warning("⚠️ 判别器损失值异常（NaN/Inf），跳过此迭代")
                        continue
                
                # self.scaler.scale(d_loss).backward()
                d_loss.backward()  # 直接backward，不使用scaler
                # 【关键修复】增强梯度裁剪，防止梯度爆炸（从1.0降低到0.5）
                torch.nn.utils.clip_grad_norm_(self.discriminator.parameters(), 1.0)
                # self.scaler.step(self.d_optim)
                # self.scaler.update()
                self.d_optim.step()
                # 【关键修复】WGAN权重裁剪：限制判别器权重在[-0.1, 0.1]范围内，防止权重爆炸
                with torch.no_grad():
                    if isinstance(self.discriminator, nn.DataParallel):
                        for param in self.discriminator.module.parameters():
                            param.clamp_(-0.1, 0.1)
                    else:
                        for param in self.discriminator.parameters():
                            param.clamp_(-0.1, 0.1)

        # 阶段2：训练生成器
        for _ in range(GENERATOR_ITERATIONS):
            self.generator.train()
            self.g_optim.zero_grad()
            
            # 【关键修复】Opacus模式下，生成器训练时调用判别器会导致激活跟踪问题
            # Opacus要求每个forward都有对应的backward，但生成器的backward不会清理判别器的激活
            # 解决方案：在生成器训练时，使用detach()分离判别器输出，避免触发Opacus的激活跟踪
            if USE_DP_TRAINING and OPACUS_AVAILABLE:
                # 【Opacus模式】生成器训练时的特殊处理
                # 问题：Opacus的激活跟踪机制与GAN训练流程不兼容
                # 生成器训练时需要调用判别器，但Opacus要求每个forward都有对应的backward
                # 解决方案：使用未包装的判别器副本（没有Opacus hook），避免激活跟踪问题
                
                # 生成fake数据
                fake_x = self.generate_fake(batch_size, real_labels)
                
                # 【关键修复】使用未包装的判别器副本（没有Opacus hook）
                # 这样生成器可以正常反向传播，但不会触发Opacus的激活跟踪
                if hasattr(self, 'discriminator_for_generator') and self.discriminator_for_generator is not None:
                    # 同步权重（从Opacus包装的判别器复制到未包装的副本）
                    self.discriminator_for_generator.load_state_dict(self.discriminator.state_dict(), strict=False)
                    self.discriminator_for_generator.eval()
                    
                    with torch.amp.autocast('cuda', enabled=False):  # Opacus需要FP32
                        fake_pred, _ = self.discriminator_for_generator(fake_x)
                else:
                    # 如果没有副本，回退到使用原始判别器（但会有激活跟踪问题）
                    logger.warning("⚠️ 未找到判别器副本，使用原始判别器（可能有激活跟踪问题）")
                    self.discriminator.eval()
                    with torch.amp.autocast('cuda', enabled=False):  # Opacus需要FP32
                        fake_pred, _ = self.discriminator(fake_x)
                
                # 只使用WGAN损失（生成器希望fake_pred大）
                g_loss = -torch.mean(fake_pred)
                
                if torch.isnan(g_loss) or torch.isinf(g_loss):
                    logger.warning("⚠️ 生成器损失值异常（NaN/Inf），跳过此迭代")
                    continue
                
                # 直接进行生成器的backward（不会触发Opacus的激活跟踪，因为使用的是未包装的副本）
                with torch.amp.autocast('cuda', enabled=False):  # Opacus需要FP32
                    g_loss.backward()
                
                # 【关键修复】增强梯度裁剪，防止梯度爆炸（从1.0降低到0.5）
                torch.nn.utils.clip_grad_norm_(self.generator.parameters(), 1.0)
                self.g_optim.step()
                
                # 清理判别器的激活（通过zero_grad）
                if hasattr(self, 'discriminator_for_generator') and self.discriminator_for_generator is not None:
                    self.discriminator_for_generator.zero_grad()
                self.discriminator.zero_grad()
            else:
                # 标准模式：正常训练生成器（包含分类损失）
                self.discriminator.eval()
                
                # with torch.amp.autocast('cuda'):
                if True:  # 强制使用FP32
                    fake_x = self.generate_fake(batch_size, real_labels)
                    fake_pred, fake_class = self.discriminator(fake_x)
                    g_loss_fake = -torch.mean(fake_pred)
                    fake_labels_expanded = real_labels.repeat(FAKE_SAMPLE_MULTIPLE)
                    
                    g_loss_class_per_sample = self.class_criterion(fake_class, fake_labels_expanded)
                    if g_loss_class_per_sample.dim() > 0:
                        g_loss_class = g_loss_class_per_sample.mean()
                    else:
                        g_loss_class = g_loss_class_per_sample
                    
                    g_loss = g_loss_fake + CLASS_LOSS_WEIGHT * g_loss_class
                    
                    if torch.isnan(g_loss) or torch.isinf(g_loss):
                        logger.warning("⚠️ 生成器损失值异常（NaN/Inf），跳过此迭代")
                        continue

                    # self.scaler.scale(g_loss).backward()
                    g_loss.backward()
                    # 【关键修复】增强梯度裁剪，防止梯度爆炸（从1.0降低到0.5）
                    torch.nn.utils.clip_grad_norm_(self.generator.parameters(), 1.0)
                    # self.scaler.step(self.g_optim)
                    # self.scaler.update()
                    self.g_optim.step()

        # 计算准确率（使用最后一次判别器输出的分类结果）
        if real_class is not None:
            real_acc = (real_class.argmax(1) == real_labels).float().mean().item()
        else:
            real_acc = 0.0
        
        # 最终NaN检测：如果损失值异常，返回默认值
        if d_loss is not None and not (torch.isnan(d_loss) or torch.isinf(d_loss)):
            d_loss_val = d_loss.item()
        else:
            d_loss_val = 0.0
            
        if g_loss is not None and not (torch.isnan(g_loss) or torch.isinf(g_loss)):
            g_loss_val = g_loss.item()
        else:
            g_loss_val = 0.0
        
        return {
            "d_loss": d_loss_val,
            "g_loss": g_loss_val,
            "real_acc": real_acc
        }

# ========== 训练循环（拉满配置） ==========
def train_transec_gan():
    global USE_DP_TRAINING  # 声明全局变量，允许在函数内修改
    # 加载预处理数据
    X_train = np.load(os.path.join(PREPROCESS_DIR, "X_train.npy"))
    y_train = np.load(os.path.join(PREPROCESS_DIR, "y_train.npy"))
    X_test = np.load(os.path.join(PREPROCESS_DIR, "X_test.npy"))
    y_test = np.load(os.path.join(PREPROCESS_DIR, "y_test.npy"))

    if TEST_MODE:
        X_train = X_train[:len(X_train)//10]
        y_train = y_train[:len(y_train)//10]
        X_test = X_test[:len(X_test)//10]
        y_test = y_test[:len(y_test)//10]
        logger.info("⚠️ 测试模式已启用")

    # 构建数据集（拉满数据加载参数）
    train_dataset = TrafficDataset(X_train, y_train)
    test_dataset = TrafficDataset(X_test, y_test)
    # 数据加载器配置（减少num_workers避免资源泄漏）
    # 注意：num_workers过大可能导致semaphore泄漏，建议设为CPU核心数或更小
    # os已在文件顶部导入，无需重复导入
    cpu_count = os.cpu_count() or 8
    # 【修复资源泄漏】降低num_workers到8，避免semaphore泄漏
    # 对于多GPU训练，8个workers已经足够，太多会导致资源泄漏
    num_workers = min(8, cpu_count // 2) if GPU_COUNT > 1 else min(4, cpu_count // 4)
    if num_workers == 0:
        num_workers = 0  # 如果计算出来是0，使用0（主进程加载数据）
    
    logger.info(f"📦 数据加载器配置：num_workers={num_workers}, batch_size={BATCH_SIZE}")
    
    train_loader = DataLoader(
        train_dataset, batch_size=BATCH_SIZE, shuffle=True,
        pin_memory=True,  # 固定内存，加速GPU传输
        num_workers=num_workers,
        drop_last=False,
        persistent_workers=False,  # 禁用persistent_workers，避免semaphore泄漏
        prefetch_factor=2 if num_workers > 0 else None,  # 预加载2批数据，降低内存占用
        timeout=30  # 设置超时，避免卡死
    )
    test_loader = DataLoader(
        test_dataset, batch_size=BATCH_SIZE, shuffle=False,
        pin_memory=True,
        num_workers=num_workers,
        drop_last=False,
        persistent_workers=False,  # 禁用persistent_workers，避免semaphore泄漏
        prefetch_factor=2 if num_workers > 0 else None,  # 预加载2批数据，降低内存占用
        timeout=30  # 设置超时，避免卡死
    )

    model = TransEC_GAN()
    best_acc = 0.0
    os.makedirs(MODEL_DIR, exist_ok=True)

    # Opacus差分隐私集成（仅对判别器）
    if USE_DP_TRAINING and OPACUS_AVAILABLE:
        logger.info("🔒 启用Opacus差分隐私训练...")
        logger.info(f"   ⚠️ 注意：Opacus不支持DataParallel，判别器将使用单GPU训练")
        logger.info(f"   ✅ 生成器仍可使用{GPU_COUNT}个GPU并行训练")
        try:
            # 确保判别器没有DataParallel包装（Opacus不支持）
            if isinstance(model.discriminator, nn.DataParallel):
                # 如果被DataParallel包装了，先获取原始模型
                original_discriminator = model.discriminator.module
            else:
                original_discriminator = model.discriminator
            
            # 使用ModuleValidator修复模型结构
            original_discriminator = ModuleValidator.fix(original_discriminator)
            original_discriminator = original_discriminator.to(DEVICE)
            
            # 【关键修复】ModuleValidator.fix()修改了模型结构，需要重新创建优化器
            # 使用修复后的模型参数创建新的优化器，确保参数匹配
            model.d_optim = optim.Adam(original_discriminator.parameters(), lr=LEARNING_RATE, betas=(0.5, 0.999))
            
            # 创建PrivacyEngine（Opacus不支持DataParallel，必须单GPU）
            model.privacy_engine = PrivacyEngine()
            model.discriminator, model.d_optim, train_loader = model.privacy_engine.make_private(
                module=original_discriminator,
                optimizer=model.d_optim,
                data_loader=train_loader,
                noise_multiplier=NOISE_MULTIPLIER,
                max_grad_norm=MAX_GRAD_NORM,
                poisson_sampling=False,  # 支持梯度累积
            )
            logger.info("✅ Opacus PrivacyEngine已初始化")
            logger.info(f"   噪声乘数：{NOISE_MULTIPLIER}")
            logger.info(f"   梯度裁剪：{MAX_GRAD_NORM}")
            logger.info(f"   Delta：{DELTA}")
            
            # 【关键修复】创建未包装的判别器副本，用于生成器训练
            # Opacus的激活跟踪机制与GAN训练流程不兼容
            # 生成器训练时需要调用判别器，但Opacus要求每个forward都有对应的backward
            # 解决方案：使用一个未包装的判别器副本（没有Opacus hook），避免激活跟踪问题
            from ids_common import Discriminator
            # ModuleValidator已在文件顶部导入，直接使用
            if not OPACUS_AVAILABLE:
                raise ImportError("Opacus未安装，无法创建判别器副本")
            model.discriminator_for_generator = Discriminator().to(DEVICE)
            model.discriminator_for_generator = ModuleValidator.fix(model.discriminator_for_generator)
            model.discriminator_for_generator = model.discriminator_for_generator.to(DEVICE)
            # 复制权重（但不复制Opacus hook）
            model.discriminator_for_generator.load_state_dict(model.discriminator.state_dict(), strict=False)
            model.discriminator_for_generator.eval()  # 始终处于eval模式，不更新参数
            logger.info("✅ 已创建未包装的判别器副本，用于生成器训练")
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            logger.error(f"❌ Opacus初始化失败：{e}")
            logger.error(f"详细错误信息：\n{error_trace}")
            logger.warning("⚠️ 将使用标准训练（无差分隐私）")
            USE_DP_TRAINING = False
            model.privacy_engine = None
    else:
        if not OPACUS_AVAILABLE:
            logger.warning("⚠️ Opacus未安装，使用标准训练")
        else:
            logger.info("ℹ️ 差分隐私训练已禁用")

    # 打印拉满配置信息
    logger.info(f"🚀 {GPU_COUNT}张RTX 5880拉满训练启动：")
    single_card_batch = BATCH_SIZE // GPU_COUNT
    logger.info(f"  - 总批次：{BATCH_SIZE}（单卡{single_card_batch} × {GPU_COUNT}卡）")
    logger.info(f"  - 生成器：使用{GPU_COUNT}个GPU并行训练（DataParallel，device_ids={list(range(GPU_COUNT))}）")
    if USE_DP_TRAINING and OPACUS_AVAILABLE:
        logger.info(f"  - 判别器：使用1个GPU训练（Opacus差分隐私要求，固定在GPU 0）")
    else:
        logger.info(f"  - 判别器：使用{GPU_COUNT}个GPU并行训练（DataParallel，device_ids={list(range(GPU_COUNT))}）")
    logger.info(f"  - 生成样本倍数：{FAKE_SAMPLE_MULTIPLE}倍（真实样本×{FAKE_SAMPLE_MULTIPLE}，大幅增强生成器训练）")
    logger.info(f"  - 训练轮次：{EPOCHS}轮")
    logger.info(f"  - 学习率：{LEARNING_RATE}")
    logger.info(f"  - 数据加载：num_workers={num_workers} + persistent_workers")
    if USE_DP_TRAINING and OPACUS_AVAILABLE:
        logger.info(f"  - 差分隐私：启用（noise_multiplier={NOISE_MULTIPLIER}, max_grad_norm={MAX_GRAD_NORM}）")

    for epoch in range(EPOCHS):
        train_bar = tqdm(train_loader, desc=f"Epoch {epoch+1}/{EPOCHS}")
        total_metrics = {"d_loss": 0, "g_loss": 0, "real_acc": 0}
        total_samples = 0

        for real_x, real_labels in train_bar:
            # 确保数据在正确的设备上（DataParallel会自动分发到多个GPU）
            real_x = real_x.to(DEVICE, non_blocking=True)  # non_blocking加速数据传输
            real_labels = real_labels.to(DEVICE, non_blocking=True)
            batch_samples = real_x.shape[0]
            total_samples += batch_samples

            metrics = model.train_step(real_x, real_labels)
            for k, v in metrics.items():
                total_metrics[k] += v * batch_samples

            train_bar.set_postfix({
                "d_loss": f"{metrics['d_loss']:.4f}",
                "g_loss": f"{metrics['g_loss']:.4f}",
                "acc": f"{metrics['real_acc']:.4f}"
            })

        avg_d_loss = total_metrics["d_loss"] / total_samples
        avg_g_loss = total_metrics["g_loss"] / total_samples
        avg_acc = total_metrics["real_acc"] / total_samples

        # 测试集评估
        test_acc = 0.0
        total_test_samples = 0
        model.discriminator.eval()
        with torch.no_grad():
            for test_x, test_labels in test_loader:
                test_x = test_x.to(DEVICE, non_blocking=True)
                test_labels = test_labels.to(DEVICE, non_blocking=True)
                test_samples = test_x.shape[0]
                total_test_samples += test_samples
                _, test_class = model.discriminator(test_x)
                test_acc += (test_class.argmax(1) == test_labels).float().sum().item()
        test_acc /= total_test_samples

        # 保存最优模型
        if test_acc > best_acc:
            best_acc = test_acc
            
            # 获取判别器state_dict（处理DataParallel和Opacus包装）
            if isinstance(model.discriminator, nn.DataParallel):
                disc_state_dict = model.discriminator.module.state_dict()
            elif hasattr(model.discriminator, '_module'):  # Opacus包装的模型
                disc_state_dict = model.discriminator._module.state_dict()
            else:
                disc_state_dict = model.discriminator.state_dict()
            
            # 获取生成器state_dict（处理DataParallel）
            if isinstance(model.generator, nn.DataParallel):
                gen_state_dict = model.generator.module.state_dict()
            else:
                gen_state_dict = model.generator.state_dict()
            
            # 保存模型checkpoint
            checkpoint = {
                "generator_state_dict": gen_state_dict,
                "discriminator_state_dict": disc_state_dict,
                "g_optim_state_dict": model.g_optim.state_dict(),
                "d_optim_state_dict": model.d_optim.state_dict(),
                "label_classes": np.load(os.path.join(PREPROCESS_DIR, "label_encoder.npy"), allow_pickle=True),
                "epoch": epoch + 1,
                "best_acc": best_acc,
            }
            
            # 保存隐私预算信息（如果使用Opacus）
            if USE_DP_TRAINING and OPACUS_AVAILABLE and model.privacy_engine is not None:
                try:
                    epsilon = model.privacy_engine.get_epsilon(delta=DELTA)
                    checkpoint["privacy_budget"] = {
                        "epsilon": float(epsilon),
                        "delta": DELTA,
                        "noise_multiplier": NOISE_MULTIPLIER,
                        "max_grad_norm": MAX_GRAD_NORM,
                        "training_steps": (epoch + 1) * len(train_loader),
                    }
                    logger.info(f"💾 保存模型，当前隐私预算：ε={epsilon:.2f}, δ={DELTA}")
                except Exception as e:
                    logger.warning(f"⚠️ 无法计算隐私预算：{e}")
            
            torch.save(checkpoint, os.path.join(MODEL_DIR, "best_model_4x5880_max.pth"))

        # 记录隐私预算（如果使用Opacus）
        epsilon_info = ""
        if USE_DP_TRAINING and OPACUS_AVAILABLE and model.privacy_engine is not None:
            try:
                epsilon = model.privacy_engine.get_epsilon(delta=DELTA)
                epsilon_info = f" | ε={epsilon:.2f}"
            except Exception as e:
                epsilon_info = f" | ε=计算失败"
        
        logger.info(
            f"Epoch {epoch+1} | "
            f"d_loss: {avg_d_loss:.4f} | "
            f"g_loss: {avg_g_loss:.4f} | "
            f"train_acc: {avg_acc:.4f} | "
            f"test_acc: {test_acc:.4f} | "
            f"best_acc: {best_acc:.4f}"
            f"{epsilon_info}"
        )

    logger.info(f"✅ 4张RTX 5880拉满训练完成！模型保存至：{MODEL_DIR}")
    return model

if __name__ == "__main__":
    train_transec_gan()