import logging
import os
import torch
import torch.nn as nn
import numpy as np
import warnings
import joblib
from scapy.layers.inet import IP, TCP, UDP
from collections import defaultdict, deque
import time
from dataclasses import dataclass
from typing import Protocol, Union

# ========== 全局配置（与训练/检测对齐） ==========
SEQ_LEN = 32  # 时序窗口长度
PCA_DIM = 12  # PCA降维维度
FEATURE_DIM = 16  # 原始特征维度
FLOW_TIMEOUT = 60

ANOMALY_THRESHOLD = 0.7  # OOD检测阈值
NUM_CLASSES = 6  # 攻击类型数（0=正常，1-5=攻击）
LATENT_DIM = 128  # 生成器噪声维度

# 路径配置（基于当前文件位置，确保无论从哪里运行都能找到文件）
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(_BASE_DIR, "transec_gan_model")
PREPROCESS_DIR = os.path.join(_BASE_DIR, "preprocessed_data")
MODEL_PATH = os.path.join(MODEL_DIR, "best_model_4x5880_max.pth")
SCALER_PATH = os.path.join(PREPROCESS_DIR, "scaler.pkl")
PCA_PATH = os.path.join(PREPROCESS_DIR, "pca.pkl")
LOG_FILE = os.path.join(_BASE_DIR, "ids_detection.log")

# 颜色常量
COLORS = {
    "green": "\033[32m",    # 正常流量
    "red": "\033[31m",      # 已知攻击
    "yellow": "\033[33m",   # 未知攻击
    "reset": "\033[0m",     # 重置颜色
    "default": "\033[0m"
}

# 日志过滤器
class LogFilter:
    def __init__(self):
        self.normal_count = 0
        self.known_anomaly_count = 0
        self.unknown_anomaly_count = 0

    def filter(self, record):
        msg = record.getMessage()
        # 【关键修复】匹配更灵活的格式，支持"【🔴 高危告警 - 已知攻击】"等格式
        # 使用更宽松的匹配，只要包含关键字符串就计数
        if "已知攻击" in msg or "【🔴 高危告警 - 已知攻击】" in msg:
            self.known_anomaly_count += 1
        elif "未知攻击" in msg or "【🔴 高危告警 - 未知攻击】" in msg or "Unknown Attack" in msg:
            self.unknown_anomaly_count += 1
        elif "【正常流量】" in msg or "正常流量" in msg:
            self.normal_count += 1
        elif "【模拟攻击】" in msg or "模拟攻击" in msg:
            self.known_anomaly_count += 1
        elif "📊 最终统计：" in msg:
            record.msg = record.msg.replace("正常流量总数=", f"正常流量总数={self.normal_count}")
            record.msg = record.msg.replace("已知异常流量数=", f"已知异常流量数={self.known_anomaly_count}")
            record.msg = record.msg.replace("未知异常流量数=", f"未知异常流量数={self.unknown_anomaly_count}")
        return True

# 日志初始化
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
logger.handlers.clear()
file_handler = logging.FileHandler(LOG_FILE, encoding="utf-8", mode="a")
file_handler.setLevel(logging.INFO)
log_filter = LogFilter()
file_handler.addFilter(log_filter)
file_formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
file_handler.setFormatter(file_formatter)
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
console_formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
console_handler.setFormatter(console_formatter)
logger.addHandler(file_handler)
logger.addHandler(console_handler)
logger.log_filter = log_filter

warnings.filterwarnings("ignore")

# 硬件适配
DEVICE = "cuda" if (torch.cuda.is_available() and os.environ.get("USE_CUDA", "1") == "1") else "cpu"
logger.info(f"{COLORS['default']}🖥️  运行设备：{DEVICE}{COLORS['reset']}")

# 全局流量存储
def get_flow_key(src_ip, dst_ip, src_port, dst_port, proto):
    if (src_ip, src_port) > (dst_ip, dst_port):
        return (dst_ip, src_ip, dst_port, src_port, proto)
    return (src_ip, dst_ip, src_port, dst_port, proto)

@dataclass
class FlowStats:
    src_ip: str
    src_port: int
    dst_ip: str
    dst_port: int
    proto: int
    start_time: float
    last_time: float
    fwd_packets: int = 0
    bwd_packets: int = 0
    fwd_bytes: float = 0.0
    bwd_bytes: float = 0.0
    fwd_len_max: float = 0.0
    fwd_len_min: float = float("inf")
    fwd_len_sum: float = 0.0
    bwd_len_max: float = 0.0
    bwd_len_min: float = float("inf")
    bwd_len_sum: float = 0.0
    fwd_prev_time: float = None
    bwd_prev_time: float = None
    fwd_iat_sum: float = 0.0
    bwd_iat_sum: float = 0.0

    def update(self, src_ip, src_port, dst_ip, dst_port, pkt_len, timestamp):
        direction_forward = (src_ip == self.src_ip and src_port == self.src_port and
                             dst_ip == self.dst_ip and dst_port == self.dst_port)
        if self.start_time is None:
            self.start_time = timestamp
        self.last_time = timestamp

        if direction_forward:
            self._update_direction(True, pkt_len, timestamp)
        else:
            self._update_direction(False, pkt_len, timestamp)
        return self.to_feature_vector()

    def _update_direction(self, is_forward: bool, pkt_len: float, timestamp: float):
        if is_forward:
            self.fwd_packets += 1
            self.fwd_bytes += pkt_len
            self.fwd_len_max = max(self.fwd_len_max, pkt_len)
            self.fwd_len_min = min(self.fwd_len_min, pkt_len)
            self.fwd_len_sum += pkt_len
            if self.fwd_prev_time is not None:
                self.fwd_iat_sum += timestamp - self.fwd_prev_time
            self.fwd_prev_time = timestamp
        else:
            self.bwd_packets += 1
            self.bwd_bytes += pkt_len
            self.bwd_len_max = max(self.bwd_len_max, pkt_len)
            self.bwd_len_min = min(self.bwd_len_min, pkt_len)
            self.bwd_len_sum += pkt_len
            if self.bwd_prev_time is not None:
                self.bwd_iat_sum += timestamp - self.bwd_prev_time
            self.bwd_prev_time = timestamp

    def to_feature_vector(self):
        duration = max((self.last_time - self.start_time) if self.start_time else 0.0, 1e-6)
        total_packets = self.fwd_packets + self.bwd_packets
        total_bytes = self.fwd_bytes + self.bwd_bytes

        def safe_mean(sum_val, count):
            return float(sum_val) / count if count > 0 else 0.0

        def safe_min(val):
            return 0.0 if val == float("inf") else val

        fwd_iat_mean = safe_mean(self.fwd_iat_sum, max(self.fwd_packets - 1, 1)) if self.fwd_packets > 1 else 0.0
        bwd_iat_mean = safe_mean(self.bwd_iat_sum, max(self.bwd_packets - 1, 1)) if self.bwd_packets > 1 else 0.0

        return np.array([
            self.dst_port,
            duration * 1e6,  # convert to microseconds to match CICIDS scale
            float(self.fwd_packets),
            float(self.bwd_packets),
            float(self.fwd_bytes),
            float(self.bwd_bytes),
            self.fwd_len_max,
            safe_min(self.fwd_len_min),
            safe_mean(self.fwd_len_sum, self.fwd_packets if self.fwd_packets else 1),
            self.bwd_len_max,
            safe_min(self.bwd_len_min),
            safe_mean(self.bwd_len_sum, self.bwd_packets if self.bwd_packets else 1),
            float(total_bytes) / duration,
            float(total_packets) / duration,
            fwd_iat_mean * 1e6,
            bwd_iat_mean * 1e6
        ], dtype=np.float32)


flows = defaultdict(lambda: {
    "feature_window": deque(maxlen=SEQ_LEN),
    "last_packet_time": time.time(),
    "is_anomaly": False,
    "stats": None
})

# ========== 模型定义（TransEC-GAN核心） ==========
class TransformerEncoder(nn.Module):
    def __init__(self, input_dim, d_model=128, nhead=8, num_layers=4):
        super().__init__()
        self.linear = nn.Linear(input_dim, d_model)
        self.pos_encoder = nn.Embedding(SEQ_LEN, d_model)
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=nhead, dim_feedforward=256,
            activation="gelu", batch_first=True, norm_first=True
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)

    def forward(self, x):
        batch_size, seq_len = x.shape[0], x.shape[1]
        x = self.linear(x)
        pos = torch.arange(seq_len, device=x.device).repeat(batch_size, 1)
        x = x + self.pos_encoder(pos)
        return self.transformer(x).mean(dim=1)

class Generator(nn.Module):
    def __init__(self):
        super().__init__()
        self.noise_linear = nn.Linear(LATENT_DIM + NUM_CLASSES, 128)
        self.transformer = TransformerEncoder(input_dim=128, d_model=128)
        self.fc = nn.Sequential(nn.Linear(128, 256), nn.GELU(), nn.Linear(256, PCA_DIM))

    def forward(self, z, labels):
        x = torch.cat([z, labels], dim=1)
        x = self.noise_linear(x).unsqueeze(1).repeat(1, SEQ_LEN, 1)
        x = self.transformer(x)
        x = self.fc(x).unsqueeze(1).repeat(1, SEQ_LEN, 1)
        return x

class Discriminator(nn.Module):
    def __init__(self):
        super().__init__()
        self.transformer = TransformerEncoder(input_dim=PCA_DIM, d_model=128)
        self.real_fc = nn.Linear(128, 1)
        self.class_fc = nn.Linear(128, NUM_CLASSES)

    def forward(self, x):
        x = self.transformer(x)
        real_pred = self.real_fc(x)
        class_pred = self.class_fc(x)
        return real_pred, class_pred

# ========== 工具函数 ==========
def get_wlan_interface():
    try:
        from scapy.arch.windows import get_windows_if_list
        scapy_ifaces = get_windows_if_list()
        for iface in scapy_ifaces:
            if iface.get("name", "").lower() == "wlan":
                logger.info(f"{COLORS['green']}✅ 选中WLAN网卡：{iface['name']}（{iface.get('description', '未知型号')}）{COLORS['reset']}")
                return iface["name"]
        for iface in scapy_ifaces:
            if iface.get("name", "").lower() in ["以太网", "ethernet"]:
                logger.info(f"{COLORS['green']}✅ 选中有线网卡：{iface['name']}（{iface.get('description', '未知型号')}）{COLORS['reset']}")
                return iface["name"]
        logger.warning(f"{COLORS['yellow']}⚠️ 未自动识别网卡，请手动输入（常见：WLAN/以太网）{COLORS['reset']}")
        return input().strip() or "WLAN"
    except Exception as e:
        logger.error(f"{COLORS['red']}❌ 网卡识别失败：{str(e)}{COLORS['reset']}")
        raise SystemExit(1)

def load_model():
    try:
        # 加载模型权重
        checkpoint = torch.load(MODEL_PATH, map_location=DEVICE, weights_only=False)

        # 初始化判别器（实时检测用）
        disc_state_dict = checkpoint["discriminator_state_dict"]
        # 处理DataParallel的module前缀
        if next(iter(disc_state_dict.keys())).startswith("module."):
            disc_state_dict = {k.replace("module.", ""): v for k, v in disc_state_dict.items()}
        
        # 检查是否为Opacus训练的模型（通过检查state_dict中的键）
        has_opacus_keys = any("qlinear" in k or "klinear" in k or "vlinear" in k for k in disc_state_dict.keys())
        
        if has_opacus_keys:
            # 如果是Opacus模型，需要先应用ModuleValidator.fix()来匹配模型结构
            try:
                from opacus.validators import ModuleValidator
                discriminator = Discriminator().to(DEVICE)
                discriminator = ModuleValidator.fix(discriminator)
                discriminator = discriminator.to(DEVICE)
                logger.info("🔧 检测到 Opacus DP 模型，已应用 ModuleValidator.fix()")
            except ImportError:
                logger.warning("⚠️  检测到 Opacus 模型但无法导入 opacus，尝试直接加载...")
                discriminator = Discriminator().to(DEVICE)
        else:
            # 标准PyTorch模型
            discriminator = Discriminator().to(DEVICE)
        
        discriminator.load_state_dict(disc_state_dict, strict=True)

        # 初始化生成器（可选，训练/模拟用）
        generator = Generator().to(DEVICE)
        gen_state_dict = checkpoint["generator_state_dict"]
        if next(iter(gen_state_dict.keys())).startswith("module."):
            gen_state_dict = {k.replace("module.", ""): v for k, v in gen_state_dict.items()}
        generator.load_state_dict(gen_state_dict, strict=True)

        # 加载预处理组件
        scaler = joblib.load(SCALER_PATH)
        pca = joblib.load(PCA_PATH)
        labels = checkpoint["label_classes"]

        logger.info(f"{COLORS['green']}✅ 成功加载TransEC-GAN模型（支持检测：{', '.join(labels)}）{COLORS['reset']}")
        return discriminator.eval(), generator.eval(), scaler, pca, labels
    except Exception as e:
        logger.error(f"{COLORS['red']}❌ 模型加载失败：{str(e)}{COLORS['reset']}")
        raise SystemExit(1)

def extract_features(packet) -> Union[tuple[tuple, np.ndarray], None]:
    try:
        if not packet.haslayer(IP):
            return None

        ip = packet[IP]
        src_ip, dst_ip = str(ip.src), str(ip.dst)
        proto = int(ip.proto)
        src_port = 0
        dst_port = 0

        if proto == 6 and packet.haslayer(TCP):
            tcp = packet[TCP]
            src_port = int(tcp.sport) if tcp.sport else 0
            dst_port = int(tcp.dport) if tcp.dport else 0
        elif proto == 17 and packet.haslayer(UDP):
            udp = packet[UDP]
            src_port = int(udp.sport) if udp.sport else 0
            dst_port = int(udp.dport) if udp.dport else 0
        else:
            return None

        flow_key = get_flow_key(src_ip, dst_ip, src_port, dst_port, proto)
        flow = flows[flow_key]
        flow["last_packet_time"] = time.time()

        if flow["stats"] is None:
            now = time.time()
            flow["stats"] = FlowStats(
                src_ip=src_ip,
                src_port=src_port,
                dst_ip=dst_ip,
                dst_port=dst_port,
                proto=proto,
                start_time=now,
                last_time=now
            )

        pkt_len = len(packet)
        features = flow["stats"].update(
            src_ip=src_ip,
            src_port=src_port,
            dst_ip=dst_ip,
            dst_port=dst_port,
            pkt_len=pkt_len,
            timestamp=time.time()
        )

        flow["feature_window"].append(features)
        return flow_key, features
    except Exception as e:
        logger.debug(f"特征提取警告：{str(e)}（包摘要：{packet.summary()}）")
        return None

def clean_timeout_flows():
    now = time.time()
    timeout_count = 0
    for key, flow in list(flows.items()):
        if now - flow["last_packet_time"] > FLOW_TIMEOUT:
            del flows[key]
            timeout_count += 1
    if timeout_count > 0:
        logger.debug(f"清理超时会话：{timeout_count} 个")

if __name__ == "__main__":
    logger.info(f"{COLORS['green']}✅ ids_common.py 核心模块加载成功{COLORS['reset']}")