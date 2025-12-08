# Zhilian2025 项目深度分析与变更报告

> **版本**: v4.0 (最终联调版)
> **日期**: 2025-12-08
> **状态**: 已准备好部署

---

## 1. 系统架构与端口配置

### 1.1 服务拓扑图
| 模块 (Module) | 角色 (Role) | 技术栈 (Stack) | 端口 (Port) | 访问地址 |
| :--- | :--- | :--- | :--- | :--- |
| **BackCode** | **业务核心后端** | Java (Spring Boot) | **8081** | `http://localhost:8081` |
| **Backen** | **区块链中间件** | Java (Fabric SDK) | **8080** | `http://localhost:8080` |
| **FrontCode**| **前端可视化大屏** | React (Vite) | **3000** | `http://localhost:3000` |
| **PythonIDS**| **ML 机器学习检测** | Python (PyTorch) | N/A | 发送数据至 `localhost:8081` |
| **RuleBasedIDS**| **规则检测 (Snort)** | Python (Scapy) | N/A | 发送数据至 `localhost:8081` |

*(注：为避免与区块链中间件的默认端口冲突，业务后端 BackCode 已迁移至 8081 端口，前端代理配置已同步更新。)*

---

## 2. 模块详细信息与变更日志

### 2.1 BackCode (业务后端)
#### 📘 基础信息
*   **功能**: 系统的中央枢纽。负责用户认证、接收 IDS 告警、数据持久化到 MySQL，并协调区块链中间件进行数据存证。
*   **关键路径**: `c:\Users\35742\Desktop\Zhilian2025\BackCode`
*   **核心控制器**: `AnalysisController.java` (负责接收告警)

#### 📝 新增与修改
*   **[修改] 端口重分配**: 在 `application.yml` 中将 `server.port` 从默认的 `8080` 改为 **`8081`**，以解决与 Backen 的端口冲突。
*   **[新增] 双写逻辑**: 修改了 `AnalysisServiceImpl.java`，实现了告警数据的“双路存储”——既写入 MySQL 数据库 (`potential_threat_alert` 表)，又通过异步调用 Backen 接口上链。
*   **[新增] API 接口**: 恢复了 `AnalysisController.java` 中的 `POST /api/analysis/alert` 接口，用于接收来自 IDS 的 JSON 数据。
*   **[修复] Git 清理**: 移除了嵌套的 `.git` 目录，确保根目录版本控制正常。

---

### 2.2 Backen (区块链中间件)
#### 📘 基础信息
*   **功能**: 作为 Hyperledger Fabric 网络的网关。它封装了底层的链码调用细节，向业务后端暴露简单的 REST API。
*   **关键路径**: `c:\Users\35742\Desktop\Zhilian2025\backend` (文件夹名为 `backend`，逻辑名为 `Backen`)
*   **核心合约**: `EvidenceContract.java`

#### 📝 新增与修改
*   **[信息] 端口确认**: 确认运行在 **`8080`** 端口。
*   **[新增] 链码逻辑**: 在 `EvidenceContract.java` 中实现了 `queryEvidenceByType` 富查询功能。
*   **[修复] 启动脚本**: 修正了 `start_project.bat`，在启动命令前添加了 `wsl` 前缀，以适配 WSL 环境下的证书路径。

---

### 2.3 FrontCode (前端大屏)
#### 📘 基础信息
*   **功能**: 实时的态势感知大屏。可视化展示威胁数据，提供统计报表，并允许管理员进行交互。
*   **关键路径**: `c:\Users\35742\Desktop\Zhilian2025\FrontCode`
*   **技术栈**: React 18, TypeScript, Tailwind CSS.

#### 📝 新增与修改
*   **[修改] 代理配置**: 更新了 `vite.config.ts`，将 `/api` 请求代理到 **`http://localhost:8081`** (BackCode)，与新端口分配保持一致。
*   **[修改] 真实 API 集成**: 修改了 `connector.ts`，移除了 Mock 模拟数据，改为真实调用 `/api/analysis/alert` 接口。
*   **[新增] Payload 解析**: 在 `connector.ts` 中添加了针对 `impactScope` 字段的特殊解析逻辑 (格式: `源IP->目的IP | 攻击类型`)，确保 UI 能正确提取并显示 IP 和攻击类型。

---

### 2.4 PythonIDS (机器学习检测引擎)
#### 📘 基础信息
*   **功能**: 基于深度学习模型 (CICIDS2017 数据集) 的异常检测系统。通过分析流量统计特征来发现未知攻击。
*   **关键路径**: `c:\Users\35742\Desktop\Zhilian2025\PythonIDS`

#### 📝 新增与修改
*   **[修改] 目标 URL**: 更新 `realtime_detection_fixed.py`，将告警发送地址指向 **`http://localhost:8081/api/analysis/alert`**。
*   **[修改] Payload 适配**: 修改了告警生成逻辑，将 `session` 和 `attack_type` 拼接到 `impactScope` 字段中，以兼容当前 Backnode 的数据库结构。
*   **[修复] Git LFS 策略**: 配置 `.gitignore`，允许提交运行时必需的小型模型文件 (`.pth`)，但排除了大型训练数据集 (`.npy`)，解决了 Git 推送失败的问题。

---

### 2.5 RuleBasedIDS (规则检测引擎)
#### 📘 基础信息
*   **功能**: 轻量级的签名式 IDS (类似 Snort)。通过匹配预定义的规则 (JSON 格式) 来检测已知威胁。
*   **关键路径**: `c:\Users\35742\Desktop\Zhilian2025\RuleBasedIDS` (原名为 `untitled`)

#### 📝 新增与修改
*   **[新增] 模块集成**: 识别并重命名了 `untitled` 目录为 `RuleBasedIDS`。
*   **[新增] Backnode 集成**: 在 `mini_snort_pro.py` 中添加了 HTTP 客户端逻辑 (`requests`)。
*   **[新增] 数据标准化**: 实现了数据格式化逻辑 (UUID 生成、时间戳格式化、`impactScope` 拼接)，使其输出与 `PythonIDS` 保持一致。
*   **[配置] 目标 URL**: 配置发送告警至 **`http://localhost:8081/api/analysis/alert`**。

---

## 3. 快速启动指南

根目录下已创建 **一键启动脚本** (`start_project.bat`)。

1.  **运行脚本**: 双击 `start_project.bat`。
2.  **验证服务**:
    *   **Backen**: 检查 "Backen Infra" 和 "Backen App" 窗口 (端口 8080)。
    *   **BackCode**: 检查 "Backnode App" 窗口 (端口 8081)。
    *   **FrontCode**: 检查 "Frontend App" 窗口 (端口 3000) 或浏览器。
3.  **启动检测**:
    *   根据脚本提示，在单独的终端中手动运行 Python 脚本以观察实时日志。
