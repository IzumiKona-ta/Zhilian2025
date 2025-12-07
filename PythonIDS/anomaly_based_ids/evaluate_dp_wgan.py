#!/usr/bin/env python3
"""
DP-WGAN 模型离线评估脚本

功能：
- 加载预处理好的测试数据
- 加载模型和预处理组件
- 计算分类性能指标 (Precision, Recall, F1)
- 计算 ROC 曲线和 AUC
- 生成混淆矩阵可视化
- 生成评估报告 (JSON 和 Markdown 格式)
"""

import argparse
import json
import logging
import os
from datetime import datetime
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import torch
from sklearn.metrics import (classification_report, confusion_matrix,
                             roc_auc_score, roc_curve)
from torch.utils.data import DataLoader
from tqdm import tqdm

from ids_common import (DEVICE, PREPROCESS_DIR, MODEL_DIR, load_model, logger, SEQ_LEN)

# 全局变量：标签列表（在 load_evaluation_data 中加载）
_labels_cache = None

def get_label_name(idx: int) -> str:
    """根据索引获取标签名称"""
    global _labels_cache
    if _labels_cache is None:
        try:
            _labels_cache = np.load(os.path.join(PREPROCESS_DIR, "label_encoder.npy"), allow_pickle=True)
        except:
            _labels_cache = np.array(["Benign", "DoS_Hulk", "PortScan", "DDoS", "BruteForce", "Unknown"])
    if isinstance(_labels_cache, np.ndarray):
        labels = _labels_cache.tolist()
    else:
        labels = _labels_cache
    if 0 <= idx < len(labels):
        return str(labels[idx])
    return f"Class_{idx}"

def resolve_normal_label(label_list):
    """解析正常流量标签名称"""
    # 处理numpy数组：先转换为列表
    if isinstance(label_list, np.ndarray):
        label_list = label_list.tolist()
    
    # 检查是否为空（转换为列表后检查）
    if not label_list or len(label_list) == 0:
        return "Benign"
    
    # 查找正常标签
    candidates = ["benign", "normal", "benign traffic", "normal traffic", "正常", "0"]
    for cand in candidates:
        for label in label_list:
            label_str = label if isinstance(label, str) else str(label)
            if label_str.lower() == cand:
                return label
    
    # 如果没找到，返回第一个标签
    return label_list[0] if len(label_list) > 0 else "Benign"

# 尝试导入 seaborn（可选，用于美观的热力图）
try:
    import seaborn as sns
    HAS_SEABORN = True
except ImportError:
    HAS_SEABORN = False
    logger.warning("⚠️ seaborn 未安装，将使用 matplotlib 基本图表")

# 定义 TrafficDataset（避免导入 train_model，因为 train_model 在模块级别会检测GPU）
# 这个类与训练时使用的 TrafficDataset 完全一致
class TrafficDataset:
    """数据集类，用于加载时序数据（与 train_model.py 中的 TrafficDataset 一致）"""
    def __init__(self, X, y, seq_len=SEQ_LEN):
        self.X = torch.tensor(X, dtype=torch.float32)
        self.y = torch.tensor(y, dtype=torch.long)
        self.seq_len = seq_len

    def __len__(self):
        return len(self.X) - self.seq_len + 1

    def __getitem__(self, idx):
        x_seq = self.X[idx:idx + self.seq_len]
        y_label = self.y[idx + self.seq_len - 1]
        return x_seq, y_label

# 配置日志
logging.basicConfig(level=logging.INFO, format="%(asctime)s - [评估日志] - %(message)s")
logger = logging.getLogger(__name__)

def load_evaluation_data(data_dir=PREPROCESS_DIR):
    """加载评估所需的数据文件"""
    global _labels_cache
    data_dir = Path(data_dir)
    try:
        X_test = np.load(data_dir / "X_test.npy")
        y_test = np.load(data_dir / "y_test.npy")
        labels = np.load(data_dir / "label_encoder.npy", allow_pickle=True)
        _labels_cache = labels  # 缓存标签供 get_label_name 使用
        normal_label = resolve_normal_label(labels)
        logger.info(f"✅ 加载测试数据：X_test.shape={X_test.shape}, y_test.shape={y_test.shape}")
        logger.info(f"   支持的标签：{list(labels)}")
        return X_test, y_test, labels
    except FileNotFoundError as e:
        logger.error(f"❌ 测试数据文件不存在：{e}")
        raise SystemExit(1)

def evaluate_model(model, X_test, y_test, labels, normal_label, scaler=None, pca=None):
    """使用测试数据评估模型性能"""
    logger.info("开始模型评估...")
    logger.info(f"   输入数据形状：X_test.shape={X_test.shape}")
    
    # 自动检测数据维度：如果X_test是16维，需要预处理；如果是12维，已经是PCA降维后的数据
    if X_test.shape[1] == 16 and scaler is not None and pca is not None:
        logger.info("   检测到16维原始特征，使用scaler和pca进行预处理...")
        X_test_scaled = scaler.transform(X_test)
        X_test_pca = pca.transform(X_test_scaled)
        logger.info(f"   预处理后数据形状：X_test_pca.shape={X_test_pca.shape}")
        X_test = X_test_pca
    elif X_test.shape[1] == 12:
        logger.info("   检测到12维PCA降维数据，跳过预处理步骤")
    else:
        logger.warning(f"   数据维度异常：X_test.shape={X_test.shape}，期望12维（PCA后）或16维（原始特征）")
    
    model.eval()
    
    # 构建测试数据集（与训练时一致）
    test_dataset = TrafficDataset(X_test, y_test)
    test_loader = DataLoader(test_dataset, batch_size=256, shuffle=False, pin_memory=True)
    
    all_predictions = []
    all_probabilities = []
    all_true_labels = []
    
    # 添加调试信息：检查第一个batch的数据格式
    first_batch_checked = False
    
    with torch.no_grad():
        for batch_x, batch_y in tqdm(test_loader, desc="评估中"):
            batch_x = batch_x.to(DEVICE)
            
            # 调试：检查第一个batch的数据格式
            if not first_batch_checked:
                logger.info(f"   第一个batch数据形状：batch_x.shape={batch_x.shape}")
                logger.info(f"   第一个batch标签分布：{np.bincount(batch_y.cpu().numpy())}")
                first_batch_checked = True
            
            # model 就是 discriminator 本身，直接调用
            _, class_pred = model(batch_x)
            batch_pred = class_pred.argmax(1).cpu().numpy()
            batch_probs = torch.softmax(class_pred, dim=1).cpu().numpy()
            
            all_predictions.extend(batch_pred)
            all_probabilities.extend(batch_probs)
            all_true_labels.extend(batch_y.cpu().numpy())
    
    y_pred = np.array(all_predictions)
    y_true = np.array(all_true_labels)
    all_probabilities = np.array(all_probabilities)
    
    logger.info("模型预测完成，开始计算指标...")
    logger.info(f"   预测结果分布：{np.bincount(y_pred)}")
    logger.info(f"   真实标签分布：{np.bincount(y_true)}")
    logger.info(f"   预测概率统计：min={all_probabilities.min():.4f}, max={all_probabilities.max():.4f}, mean={all_probabilities.mean():.4f}")
    
    # 1. 分类性能指标 (Precision, Recall, F1)
    # 获取所有实际出现的类别（包括预测和真实标签）
    all_unique_labels = np.unique(np.concatenate([y_true, y_pred]))
    max_class_idx = max(all_unique_labels.max(), len(labels) - 1) if len(labels) > 0 else all_unique_labels.max()
    num_classes_actual = len(all_unique_labels)
    num_classes_model = len(labels)
    
    logger.info(f"   实际出现的类别数：{num_classes_actual}，最大类别索引：{max_class_idx}，模型标签数：{num_classes_model}")
    
    # 构建完整的标签名称列表（覆盖所有可能出现的类别索引）
    default_labels = ["Benign", "DoS_Hulk", "DoS_GoldenEye", "PortScan", "DDoS", "BruteForce"]
    
    # 扩展标签列表以覆盖所有实际出现的类别
    extended_labels = list(labels) if isinstance(labels, (list, np.ndarray)) else []
    
    # 如果标签列表不够长，使用默认标签补充
    while len(extended_labels) <= max_class_idx:
        if len(extended_labels) < len(default_labels):
            extended_labels.append(default_labels[len(extended_labels)])
        else:
            extended_labels.append(f"Class_{len(extended_labels)}")
    
    # 确保标签列表长度足够
    target_names = [str(extended_labels[i]) if i < len(extended_labels) else f"Class_{i}" for i in range(max_class_idx + 1)]
    
    # 使用 labels 参数明确指定所有实际出现的类别，避免类别数不匹配错误
    classification_rep = classification_report(
        y_true, y_pred, 
        labels=list(all_unique_labels),  # 只使用实际出现的类别
        target_names=[target_names[i] for i in all_unique_labels],
        output_dict=True,
        zero_division=0
    )
    
    # 2. ROC曲线和AUC（二分类：攻击 vs 正常）
    # 查找 normal_label 的索引（通常在索引0，即"Benign"）
    normal_idx = 0  # 默认使用索引0作为正常标签
    for idx, name in enumerate(target_names):
        if str(name).lower() == str(normal_label).lower() or "benign" in str(name).lower():
            normal_idx = idx
            break
    logger.info(f"   正常标签索引：{normal_idx}（{target_names[normal_idx] if normal_idx < len(target_names) else 'Unknown'}）")
    y_true_binary = (y_true != normal_idx).astype(int)
    
    # 计算 y_scores：对于每个样本，使用预测为攻击类别的最大概率
    y_scores = []
    for i in range(len(y_pred)):
        if y_pred[i] != normal_idx:
            # 预测为攻击，使用其置信度
            y_scores.append(all_probabilities[i][y_pred[i]])
        else:
            # 预测为正常，使用1减去正常类别的概率（作为"异常分数"）
            y_scores.append(1.0 - all_probabilities[i][normal_idx])
    y_scores = np.array(y_scores)
    
    fpr, tpr, _ = roc_curve(y_true_binary, y_scores)
    roc_auc = roc_auc_score(y_true_binary, y_scores)
    
    # 3. 混淆矩阵
    cm = confusion_matrix(y_true, y_pred)
    
    return {
        "classification_report": classification_rep,
        "roc_auc": roc_auc,
        "fpr": fpr,
        "tpr": tpr,
        "confusion_matrix": cm,
        "labels": target_names,
        "normal_label": normal_label,
        "y_true": y_true,
        "y_pred": y_pred,
        "y_scores": y_scores
    }

def generate_reports(metrics, model_name="WGAN_v1.0", eval_date=None):
    """生成评估报告（JSON 和 Markdown 格式）"""
    if eval_date is None:
        eval_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    report_data = {
        "model_version": model_name,
        "evaluation_date": eval_date,
        "dataset": "CICIDS2017 Test Set",
        "test_samples": len(metrics["y_true"]),
        "metrics": {
            "classification": metrics["classification_report"],
            "roc_auc": float(metrics["roc_auc"])
        },
        "privacy_budget": {
            "epsilon": None,
            "delta": None,
            "noise_multiplier": None,
            "training_steps": None,
            "note": "当前模型为标准WGAN，未使用Opacus训练"
        }
    }
    
    # 保存JSON报告
    with open("evaluation_report.json", "w", encoding="utf-8") as f:
        json.dump(report_data, f, ensure_ascii=False, indent=2)
    logger.info("✅ 生成评估报告：evaluation_report.json")
    
    # 生成Markdown报告
    macro_avg = metrics["classification_report"].get("macro avg", {})
    precision = macro_avg.get("precision", 0.0)
    recall = macro_avg.get("recall", 0.0)
    f1_score = macro_avg.get("f1-score", 0.0)
    
    markdown_content = f"""# DP-WGAN 模型评估报告

**评估时间：** {eval_date}
**模型版本：** {model_name}
**数据集：** CICIDS2017 测试集
**测试样本数：** {len(metrics["y_true"])}
**正常标签：** {metrics["normal_label"]}

## 📊 性能指标

### 分类性能（macro-average）
- **Precision（精确率）：** {precision:.4f}
- **Recall（召回率）：** {recall:.4f}
- **F1-Score：** {f1_score:.4f}

### ROC曲线和AUC
- **AUC值：** {metrics["roc_auc"]:.4f}

### 详细分类报告
```
{json.dumps(metrics["classification_report"], indent=2, ensure_ascii=False)}
```

## 📈 可视化结果

### ROC曲线
![ROC Curve](roc_curve.png)

### 混淆矩阵
![Confusion Matrix](confusion_matrix.png)

## 🔒 隐私预算

当前模型为标准WGAN，未使用Opacus训练，因此无法计算隐私预算（ε, δ）。

## 📝 模型版本信息

- **模型文件：** `best_model_4x5880_max.pth`
- **训练配置：** 见 `train_model.py`
- **评估脚本：** `evaluate_dp_wgan.py`

**注意：** 如需差分隐私评估，请先完成训练阶段Opacus集成后再运行评估脚本。

---

**最后更新：** {eval_date}
**项目文档：** 《智链分析溯源平台》概要介绍文档 v4.0
"""
    
    with open("evaluation_report.md", "w", encoding="utf-8") as f:
        f.write(markdown_content)
    logger.info("✅ 生成Markdown报告：evaluation_report.md")

def plot_roc_curve(fpr, tpr, roc_auc):
    """绘制ROC曲线"""
    plt.figure(figsize=(8, 6))
    plt.plot(fpr, tpr, color='darkorange', lw=2, label=f'ROC curve (AUC = {roc_auc:.2f})')
    plt.plot([0, 1], [0, 1], color='navy', lw=2, linestyle='--', alpha=0.5)
    plt.xlim([0.0, 1.0])
    plt.ylim([0.0, 1.0])
    plt.xlabel('False Positive Rate')
    plt.ylabel('True Positive Rate')
    plt.title('Receiver Operating Characteristic (ROC)')
    plt.legend(loc="lower right")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig("roc_curve.png", dpi=150, bbox_inches='tight')
    plt.close()
    logger.info("✅ 生成ROC曲线：roc_curve.png")

def plot_confusion_matrix(cm, labels):
    """绘制混淆矩阵热力图"""
    plt.figure(figsize=(10, 8))
    if HAS_SEABORN:
        sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                    xticklabels=labels, yticklabels=labels,
                    annot_kws={'size': 10})
    else:
        # 使用 matplotlib 基本图表
        plt.imshow(cm, interpolation='nearest', cmap='Blues')
        plt.colorbar()
        tick_marks = np.arange(len(labels))
        plt.xticks(tick_marks, labels, rotation=45)
        plt.yticks(tick_marks, labels)
        # 添加数值标注
        thresh = cm.max() / 2.
        for i in range(cm.shape[0]):
            for j in range(cm.shape[1]):
                plt.text(j, i, format(cm[i, j], 'd'),
                        horizontalalignment="center",
                        color="white" if cm[i, j] > thresh else "black")
    plt.title('Confusion Matrix')
    plt.ylabel('True Label')
    plt.xlabel('Predicted Label')
    plt.tight_layout()
    plt.savefig("confusion_matrix.png", dpi=150, bbox_inches='tight')
    plt.close()
    logger.info("✅ 生成混淆矩阵：confusion_matrix.png")

def main():
    """主函数 - 模型离线评估"""
    parser = argparse.ArgumentParser(description="DP-WGAN 模型离线评估")
    parser.add_argument("--model_path", default=os.path.join(MODEL_DIR, "best_model_4x5880_max.pth"),
                        help="模型权重文件路径")
    parser.add_argument("--data_dir", default=PREPROCESS_DIR,
                        help="预处理数据目录路径")
    parser.add_argument("--output_dir", default="./evaluation_results/",
                        help="评估结果输出目录")
    
    args = parser.parse_args()
    
    # 创建输出目录
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    os.chdir(output_dir)
    
    logger.info(f"📊 开始模型评估")
    logger.info(f"📁 数据目录：{args.data_dir}")
    logger.info(f"📁 模型路径：{args.model_path}")
    logger.info(f"📁 输出目录：{output_dir}")
    
    # 1. 加载数据
    X_test, y_test, labels = load_evaluation_data(args.data_dir)
    normal_label = resolve_normal_label(labels)
    
    # 2. 加载模型
    try:
        discriminator, generator, scaler, pca, model_labels = load_model()
        logger.info("✅ 模型加载成功")
        logger.info(f"   模型支持的标签：{list(model_labels)}")
    except Exception as e:
        logger.error(f"❌ 模型加载失败：{e}")
        import traceback
        traceback.print_exc()
        return
    
    # 3. 进行预测和评估（使用 discriminator）
    # 注意：X_test.npy 应该已经是预处理后的数据（PCA降维后的12维）
    # evaluate_model 会自动检测数据维度，决定是否需要预处理
    # 使用模型标签（model_labels）而不是数据标签，因为模型输出可能包含更多类别
    metrics = evaluate_model(discriminator, X_test, y_test, model_labels, normal_label, scaler, pca)
    
    # 4. 生成报告和可视化
    eval_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    generate_reports(metrics, "WGAN_v1.0", eval_date)
    plot_roc_curve(metrics["fpr"], metrics["tpr"], metrics["roc_auc"])
    plot_confusion_matrix(metrics["confusion_matrix"], metrics["labels"])
    
    logger.info("✅ 评估完成！报告已保存到当前目录")
    logger.info(f"📊 报告文件：evaluation_report.json, evaluation_report.md")
    logger.info(f"📊 可视化文件：roc_curve.png, confusion_matrix.png")

if __name__ == "__main__":
    main()
