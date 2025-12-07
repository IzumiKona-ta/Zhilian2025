import pandas as pd
import numpy as np
import joblib
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.decomposition import PCA
from sklearn.preprocessing import LabelEncoder
import warnings
warnings.filterwarnings("ignore")

# 全局常量（适配你的数据集：移除Protocol，用16维特征）
FEATURE_DIM = 16  # 原17维去掉Protocol，改为16维
PCA_DIM = 12      # PCA降维后维度
ATTACK_TYPES = [
    "Benign", "DoS_Hulk", "DoS_GoldenEye",
    "PortScan", "DDoS", "BruteForce"  # 多攻击类型支持
]

def load_cicids2017(data_path):
    """加载CICIDS2017数据集（适配你的列名）"""
    import os
    csv_files = [f for f in os.listdir(data_path) if f.endswith(".csv")]
    df_list = []
    total_raw_rows = 0  # 新增：统计原始数据总行数
    for csv in csv_files:
        df = pd.read_csv(os.path.join(data_path, csv), low_memory=False)
        total_raw_rows += len(df)  # 累加每个CSV的行数
        df_list.append(df)
    df = pd.concat(df_list, ignore_index=True)

    # 1. 数据清洗
    clean_before_rows = len(df)  # 清洗前总行数
    df = df.dropna()
    df = df.replace([np.inf, -np.inf], np.nan).dropna()
    clean_after_rows = len(df)  # 清洗后总行数

    # 2. 匹配标签列（你的列名是' Label'）
    df.rename(columns={' Label': "Label"}, inplace=True)

    # 3. 标签映射
    df["Label"] = df["Label"].str.strip()
    df["Label"] = df["Label"].str.replace("BENIGN", "Benign")
    df["Label"] = df["Label"].str.replace("DoS Hulk", "DoS_Hulk")
    df["Label"] = df["Label"].str.replace("DoS GoldenEye", "DoS_GoldenEye")
    df["Label"] = df["Label"].str.replace("Portscan", "PortScan")
    df["Label"] = df["Label"].str.replace("DDOS", "DDoS")
    label_filtered_rows = len(df)  # 标签过滤前行数
    df = df[df["Label"].isin(ATTACK_TYPES)]
    final_rows = len(df)  # 最终用于训练的数据行数

    # 4. 特征选择（适配你的列名，移除Protocol）
    core_features_mapping = {
        "Dst Port": [" Destination Port"],
        "Flow Duration": [" Flow Duration"],
        "Total Fwd Packets": [" Total Fwd Packets"],
        "Total Backward Packets": [" Total Backward Packets"],
        "Total Length of Fwd Packets": ["Total Length of Fwd Packets"],
        "Total Length of Bwd Packets": [" Total Length of Bwd Packets"],
        "Fwd Packet Length Max": [" Fwd Packet Length Max"],
        "Fwd Packet Length Min": [" Fwd Packet Length Min"],
        "Fwd Packet Length Mean": [" Fwd Packet Length Mean"],
        "Bwd Packet Length Max": ["Bwd Packet Length Max"],
        "Bwd Packet Length Min": [" Bwd Packet Length Min"],
        "Bwd Packet Length Mean": [" Bwd Packet Length Mean"],
        "Flow Bytes/s": ["Flow Bytes/s"],
        "Flow Packets/s": [" Flow Packets/s"],
        "Fwd IAT Mean": [" Fwd IAT Mean"],
        "Bwd IAT Mean": [" Bwd IAT Mean"]
    }

    # 匹配特征列
    actual_features = []
    for target, possible_names in core_features_mapping.items():
        for name in possible_names:
            if name in df.columns:
                actual_features.append(name)
                print(f"✅ 匹配特征：目标'{target}' → 实际列名'{name}'")
                break

    # 选择特征列+标签列
    df = df[actual_features + ["Label"]]
    df.columns = list(core_features_mapping.keys()) + ["Label"]

    # 5. 标签编码
    le = LabelEncoder()
    df["Label_Enc"] = le.fit_transform(df["Label"])

    # 新增：返回数据集统计信息
    data_stats = {
        "原始数据总行数": total_raw_rows,
        "合并后未清洗行数": clean_before_rows,
        "清洗后行数（去空/去无穷）": clean_after_rows,
        "标签过滤前行数": label_filtered_rows,
        "最终有效行数（含目标攻击类型）": final_rows,
        "特征维度": len(actual_features)
    }
    return df, le, data_stats  # 新增返回统计信息

def add_differential_privacy(features, epsilon=1.0, delta=1e-5):
    """添加差分隐私保护"""
    sensitivity = np.max(np.linalg.norm(features, axis=1))
    sigma = sensitivity * np.sqrt(2 * np.log(1.25 / delta)) / epsilon
    noise = np.random.normal(0, sigma, features.shape)
    return features + noise

def preprocess_pipeline(data_path, save_path="./preprocessed_data/"):
    """完整预处理流水线"""
    # 1. 加载数据（接收统计信息）
    df, le, data_stats = load_cicids2017(data_path)
    X = df.drop(["Label", "Label_Enc"], axis=1).values
    y = df["Label_Enc"].values

    # 2. 标准化
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # 3. PCA降维
    pca = PCA(n_components=PCA_DIM)
    X_pca = pca.fit_transform(X_scaled)

    # 4. 差分隐私保护
    X_dp = add_differential_privacy(X_pca)

    # 5. 划分数据集
    X_train, X_test, y_train, y_test = train_test_split(
        X_dp, y, test_size=0.3, random_state=42, stratify=y
    )

    # 6. 保存结果
    import os
    os.makedirs(save_path, exist_ok=True)
    np.save(os.path.join(save_path, "X_train.npy"), X_train)
    np.save(os.path.join(save_path, "X_test.npy"), X_test)
    np.save(os.path.join(save_path, "y_train.npy"), y_train)
    np.save(os.path.join(save_path, "y_test.npy"), y_test)
    np.save(os.path.join(save_path, "label_encoder.npy"), le.classes_)

    joblib.dump(scaler, os.path.join(save_path, "scaler.pkl"))
    joblib.dump(pca, os.path.join(save_path, "pca.pkl"))

    # 新增：打印数据集统计信息
    print(f"\n📊 数据集总量统计：")
    for key, value in data_stats.items():
        print(f"  - {key}：{value:,}")  # 千分位格式化，便于阅读

    # 新增：打印各攻击类型的数量分布
    print(f"\n📈 各攻击类型数量分布：")
    label_count = df["Label"].value_counts()
    for label, count in label_count.items():
        percentage = (count / len(df)) * 100
        print(f"  - {label}：{count:,} 条（{percentage:.2f}%）")

    print(f"\n✅ 数据预处理完成：")
    print(f"  - 训练集：{X_train.shape} | 测试集：{X_test.shape}")
    print(f"  - 攻击类型：{le.classes_}")
    print(f"  - 保存路径：{save_path}")
    return X_train, X_test, y_train, y_test, scaler, pca, le

if __name__ == "__main__":
    preprocess_pipeline(
        data_path=r"E:\IntelliJ IDEA 2024.2.4\Network Security\PythonIDS - 副本\CICIDS2017",
        save_path="./preprocessed_data/"
    )