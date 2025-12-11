# Zhilian2025 网络安全态势感知与主动防御平台

> **版本**: v1.2.1 (TransecGAN + Hyperledger Fabric + AI Report Engine)  
> **状态**: 🟢 生产就绪 (Production Ready) | ✨ Feature Updated  
> **文档日期**: 2025-12-12  
> **核心架构**: Spring Boot 微服务 + React 可视化 + TransecGAN 深度学习 + Hyperledger Fabric 区块链 + GenAI 决策支持

---

## 1. 项目概述 (Executive Summary)

**Zhilian2025** 是一款企业级下一代网络安全平台，致力于解决传统入侵检测系统 (IDS) 仅能“旁路告警”无法“实时阻断”的痛点。本项目构建了从**全流量感知**到**AI 智能研判**，再到**端点主动防御**与**区块链存证**的完整闭环体系。

### 1.1 核心价值
*   **零日威胁免疫**: 摒弃传统基于特征库的检测模式，采用 **TransecGAN** (Transformer-Encoder GAN) 模型，有效识别未知 Zero-day 攻击。
*   **智能决策辅助 (New)**: 集成生成式 AI 报告引擎，自动聚合分散的威胁数据，生成符合 CISO 决策标准的安全日报/周报，大幅降低人工分析成本。
*   **主动防御 (Active Response)**: HIDS 探针不仅仅是监控器，更是执行器。它能联动系统防火墙 (Windows Firewall/Iptables) 实现毫秒级自动封禁。
*   **司法级存证**: 引入 **Hyperledger Fabric** 联盟链，将关键威胁告警实时上链，确保数据不可篡改，满足等保 2.0 对安全审计的严苛要求。
*   **全景态势感知**: 玻璃拟态风格的 3D 可视化大屏，提供上帝视角的网络健康度监控与攻击溯源。

---

## 2. 系统架构 (System Architecture)

平台采用**端-边-云**协同的分布式架构，各组件通过标准 REST API、WebSocket 和 gRPC 进行高保真通信。

### 2.1 逻辑拓扑图
```mermaid
graph TD
    User[安全分析师] -->|HTTPS| Frontend[前端指挥舱 (React/Vite)]
    
    subgraph "业务中台 (Business Layer)"
        Frontend -->|REST API| Backend[业务后端 (Spring Boot)]
        Backend -->|WebSocket| Frontend
        Backend -->|MySQL| DB[(业务数据库)]
        Backend -->|Redis| Cache[(指令队列缓存)]
    end
    
    subgraph "智能分析层 (AI Analysis Layer)"
        Backend -->|JSON| LLM[大语言模型 (GenAI)]
        LLM -->|Markdown| Backend
    end

    subgraph "感知与响应层 (Sensor & Response Layer)"
        ML_IDS[Python AI 引擎 (TransecGAN)] -->|HTTP POST| Backend
        Rule_IDS[Snort 规则引擎] -->|HTTP POST| Backend
        HIDS_Agent[HIDS 主机探针] -->|HTTP POST (心跳)| Backend
        Backend -->|Command Queue| HIDS_Agent
        HIDS_Agent -->|Shell Exec| Firewall[系统防火墙 (Netsh/Iptables)]
    end
    
    subgraph "信任锚点 (Trust Layer)"
        Backend -->|Fabric Gateway SDK| Peer[Fabric Peer 节点]
        Peer -->|gRPC| Orderer[Ordering Service]
        Peer -->|Ledger| CouchDB[(世界状态库)]
    end
```

### 2.2 技术栈概览 (Tech Stack)
| 模块 | 技术组件 | 版本 | 说明 |
| :--- | :--- | :--- | :--- |
| **后端 (Backend)** | Java, Spring Boot | 2.7.x / JDK 17 | 核心业务逻辑，集成 Fabric SDK，新增 AI 报告模块 |
| **前端 (Frontend)** | React, TypeScript, Vite | 18.x | 现代化 SPA，集成 ECharts/Recharts，支持 PDF 导出 |
| **人工智能 (AI)** | Python, PyTorch | 3.8+ | TransecGAN 模型训练与推理 |
| **区块链 (Blockchain)** | Hyperledger Fabric | 2.4 | 联盟链架构，Docker 容器化部署 |
| **智能合约 (Chaincode)** | Java | 1.0 | 存证合约 `EvidenceContract` |
| **端点 (Agent)** | Python, Psutil | 3.8+ | 跨平台主机监控与命令执行 |

---

## 3. 组件深度解析 (Detailed Component Analysis)

### 3.1 感知层：TransecGAN 异常检测引擎
位于 `PythonIDS/anomaly_based_ids/`，是系统的“眼睛”。

*   **模型架构**: **TransecGAN (Transformer-Encoder GAN)**
    *   **生成器 (Generator)**: 采用 Transformer Encoder 结构，利用 Self-Attention 机制捕捉流量包序列的长距离依赖关系，学习正常流量的时序分布。
    *   **判别器 (Discriminator)**: 同样基于 Transformer，负责区分真实流量与生成流量，并计算异常分数。
    *   **优势**: 相比传统 LSTM/Autoencoder，TransecGAN 在处理高并发、长序列流量数据时具有更高的准确率和更低的误报率。
*   **特征工程**: 基于 **CICFlowMeter** 提取 79 维统计特征（如流持续时间、包长方差、标志位计数等），完全兼容 CICIDS2017 数据集标准。
*   **智能特性**:
    *   **自适应白名单**: 启动时自动扫描本机网卡 IP，防止将出站流量误报为攻击。
    *   **协同过滤**: 实时读取 `blocked_ips.json`，自动忽略已封禁 IP 的流量，节省计算资源。

### 3.2 响应层：HIDS 主机探针
位于 `PythonIDS/hids_agent/`，是系统的“手臂”。

*   **双向通信**: 采用**心跳轮询 (Heartbeat)** 机制（默认 3-5秒）向后端上报状态，并拉取待执行指令。
*   **主动防御能力**:
    *   **Windows**: 调用 `netsh advfirewall firewall` 动态添加入站拦截规则。
    *   **Linux**: 调用 `iptables -I INPUT -j DROP` 插入高优先级丢弃规则。
*   **安全熔断机制 (Safety Circuit)**:
    *   在执行 `BLOCK_IP` 前，强制检查目标 IP 是否为本机 IP、网关或 `127.0.0.1`。
    *   **坚决防止“自杀式”封禁**导致管理员失去对服务器的控制权。

### 3.3 信任层：Hyperledger Fabric 联盟链
位于 `Zhilian_Install_Package/fabric-network/`，是系统的“黑匣子”。

*   **网络拓扑**:
    *   **Org1**: 单组织架构，包含 1 个 Peer 节点 (Peer0) 和 1 个 CA 节点。
    *   **Orderer**: Raft 共识排序节点，确保交易顺序一致性。
    *   **CouchDB**: 作为状态数据库，支持富查询 (Rich Query)。
*   **链码 (Smart Contract)**:
    *   **语言**: Java
    *   **功能**: 定义了 `Evidence` 资产，包含 `threatId`, `sourceIp`, `timestamp`, `signature` 等字段。
    *   **背书策略**: 默认 `AND('Org1MSP.member')`，确保每笔存证都经过组织签名。

### 3.4 决策层：智能报告与归档引擎 (New)
位于前端 `ReportGeneration.tsx` 与后端 `AiReportController`，是系统的“大脑皮层”。

*   **生成式报告**: 利用 LLM 分析最近 24 小时或 7 天的威胁数据，自动生成包含攻击趋势、高危事件溯源、防御建议的专业 Markdown 报告。
*   **全生命周期管理**:
    *   **归档**: 自动保存每一次生成的报告历史。
    *   **管理**: 支持对历史报告进行**重命名**与**删除**操作，方便知识库维护。
    *   **预览**: 支持 Markdown 渲染与沉浸式**全屏预览**模式。
*   **格式化输出**:
    *   **PDF 导出**: 内置 `html2canvas` + `jspdf` 引擎，支持将网页报告一键导出为高保真 PDF 文档，保留 Cyberpunk 视觉风格，便于打印与汇报。
    *   **时间标准化**: 前后端统一采用 `yyyy-MM-dd HH:mm:ss` 标准时间格式，杜绝时间戳乱码。

---

## 4. API 接口文档 (API Reference)

后端采用标准的 RESTful 风格设计，所有接口均统一返回 `Result<T>` 结构。

### 4.1 认证模块 (Auth)
| 接口地址 | 方法 | 功能描述 | 参数说明 |
| :--- | :--- | :--- | :--- |
| `/api/auth/login` | POST | 用户登录 | `username`, `password` |

### 4.2 威胁分析模块 (Analysis)
| 接口地址 | 方法 | 功能描述 | 参数说明 |
| :--- | :--- | :--- | :--- |
| `/api/analysis/traffic` | GET | 查询流量统计数据 | `startTime`, `endTime` |
| `/api/analysis/alert` | GET | 查询潜在威胁预警列表 | `pageNum`, `pageSize`, `level` |
| `/api/analysis/alert` | POST | 接收 IDS 实时告警 | `potentialThreatAlert` (JSON) |
| `/api/analysis/alert/{id}` | GET | 查看威胁详情 | `id` (主键) |
| `/api/analysis/trend` | GET | 攻击趋势统计 | `range` (如 "24h", "7d") |

### 4.3 威胁响应模块 (Threat Response)
| 接口地址 | 方法 | 功能描述 | 参数说明 |
| :--- | :--- | :--- | :--- |
| `/api/threats/{id}/block` | POST | 下发 IP 阻断指令 | `id` (threatId 或主键) |
| `/api/threats/{id}/unblock` | POST | 下发 IP 解封指令 | `id` (threatId 或主键) |
| `/api/threats/{id}/resolve` | POST | 标记误报/已解决 | `id` (threatId) |
| `/api/threats/manual-block` | POST | 手动封禁 IP | `ip`, `hostIp` (可选) |
| `/api/threats/manual-unblock` | POST | 手动解封 IP | `ip`, `hostIp` (可选) |
| `/api/threats/blocked-ips` | GET | 获取当前封禁列表 | 无 |

### 4.4 智能报告模块 (AI Report)
| 接口地址 | 方法 | 功能描述 | 参数说明 |
| :--- | :--- | :--- | :--- |
| `/api/report/generate` | POST | 生成 AI 安全报告 | `type` ("Daily", "Weekly", "Custom") |
| `/api/report/history` | GET | 获取历史报告列表 | 无 |
| `/api/report/history/{id}` | PUT | 重命名历史报告 | `title` (JSON) |
| `/api/report/history/{id}` | DELETE | 删除历史报告 | 无 |

### 4.5 监控与主机模块 (Monitor & Host)
| 接口地址 | 方法 | 功能描述 | 参数说明 |
| :--- | :--- | :--- | :--- |
| `/api/host/monitor` | GET | 查询主机状态列表 | `hostName`, `status` |
| `/api/host/monitor/realtime/{hostId}` | GET | 查询单机实时状态 | `hostId` |
| `/api/host/monitor/report` | POST | 主机 Agent 心跳上报 | `hostStatusMonitor` (JSON) |
| `/api/process/monitor` | GET | 查询进程监控列表 | `processName` |
| `/api/process/monitor/{id}` | PUT | 处理异常进程 | `ProcessMonitorDTO` |

### 4.6 数据采集配置 (Collection Config)
| 接口地址 | 方法 | 功能描述 | 参数说明 |
| :--- | :--- | :--- | :--- |
| `/api/collection/host` | GET | 查询云外主机配置 | `pageDTO` |
| `/api/collection/host` | POST | 新增主机配置 | `collectionHostDTO` |
| `/api/collection/host/{id}` | PUT | 修改主机配置 | `id`, `collectionHostDTO` |
| `/api/collection/host/{id}` | DELETE | 删除主机配置 | `id` |
| `/api/collection/api` | GET | 查询 API 配置 | `id` |
| `/api/collection/api` | PUT | 修改 API 配置 | `collectionApiDTO` |

### 4.7 组织与共享模块 (Org & Share)
| 接口地址 | 方法 | 功能描述 | 参数说明 |
| :--- | :--- | :--- | :--- |
| `/api/org/info` | GET | 查询组织列表 | `OrgInfoDTO` |
| `/api/org/info` | POST | 新增组织 | `OrgInfoDTO` |
| `/api/org/info/{id}` | PUT | 修改组织信息 | `id`, `OrgInfoDTO` |
| `/api/org/info/{id}` | DELETE | 删除组织 | `id` |
| `/api/report/share` | GET | 查询共享记录 | `ReportShareDTO` |
| `/api/report/share` | POST | 发起报告共享 | `ReportShareDTO` |
| `/api/report/share/{id}` | PUT | 更新共享状态 | `id`, `ReportShareDTO` |

### 4.8 溯源与仪表盘 (Tracing & Dashboard)
| 接口地址 | 方法 | 功能描述 | 参数说明 |
| :--- | :--- | :--- | :--- |
| `/api/tracing/result` | GET | 溯源结果列表 | `tracingPageDTO` |
| `/api/tracing/result/{id}` | GET | 溯源详情 | `id` |
| `/api/dashboard/summary` | GET | 仪表盘聚合摘要 | 无 |

### 4.9 数据上传 (Upload)
| 接口地址 | 方法 | 功能描述 | 参数说明 |
| :--- | :--- | :--- | :--- |
| `/api/upload/data` | POST | 上传威胁数据文件 | `reportFile`, `collectedDataId` |
| `/api/upload/data/{id}` | GET | 查询上传进度 | `id` |

---

## 5. 关键业务流程 (Key Workflows)

### 5.1 全生命周期威胁封禁 (Full Lifecycle Blocking)
1.  **检测**: TransecGAN 模型从实时流量中识别出恶意 IP `X.X.X.X`。
2.  **上报**: 告警数据通过 REST API 推送至后端 `ThreatController`。
3.  **存证**: 后端异步调用 Fabric SDK，将告警哈希值与元数据上链，生成唯一交易 ID (TxID)。
4.  **决策**:
    *   **自动模式**: 系统直接生成 `BLOCK_IP` 指令。
    *   **手动模式**: 待管理员在前端点击“封禁”按钮。
5.  **下发**: 指令进入 Redis/内存队列 `CommandQueue`。
6.  **执行**: HIDS Agent 心跳拉取指令 -> 执行防火墙命令 -> 更新本地 `blocked_ips.json`。
7.  **闭环**: 流量被网卡层丢弃，攻击彻底终止。

### 5.2 黑名单管理与误报回滚
1.  **查看**: 前端“防火墙状态”面板实时展示当前所有被封禁 IP。
2.  **解封**: 管理员点击“解封”图标 -> 后端生成 `UNBLOCK_IP` 指令。
3.  **恢复**: Agent 收到指令 -> 删除防火墙规则 -> 流量恢复正常。

---

## 6. 安装与部署指南 (Installation Guide)

本项目提供两种部署模式：**生产环境交付模式 (Pack-and-Go)** 和 **开发调试模式**。

### 6.1 生产环境部署 (推荐)
适用于最终交付，无需安装 Java/Maven 环境，仅需 Docker。

1.  **进入安装包**:
    ```bash
    cd Zhilian_Install_Package
    ```
2.  **一键启动**:
    ```bash
    # Linux/WSL/Git Bash
    ./install.sh
    ```
    *脚本会自动清理旧容器、启动 Fabric 网络、部署链码、生成证书，并启动内置的后端 JAR 包。*
3.  **验证**:
    *   后端接口: `http://localhost:8080/api/health`
    *   区块链浏览器: `http://localhost:5984/_utils` (CouchDB)

### 6.2 开发调试模式 (Hybrid Mode)
适用于开发者需要修改后端代码，同时复用 Docker 中的区块链网络。

1.  **启动基础设施**: 仅运行区块链网络，不启动内置后端。
    ```bash
    cd Zhilian_Install_Package
    ./start_backend_only.sh  # 实际上这个脚本主要用于辅助重启，建议先用 install.sh 跑通一次网络
    ```
2.  **配置后端**:
    修改 `backend/src/main/resources/application.yml`，确保 `networkConfigPath` 等路径指向 `../Zhilian_Install_Package/...` (v1.2.0 已默认配置相对路径)。
3.  **启动后端**:
    ```bash
    cd backend
    mvn spring-boot:run
    ```
    *注意：后端已禁用 gRPC 服务发现 (`discovery: false`)，以解决本地开发时的 Docker NAT 问题。*

---

## 7. 前端使用手册 (User Manual)

### 7.1 实时威胁大屏 (Home)
*   **流量波形**: 实时展示网络吞吐量。
*   **威胁地图**: 3D 地球展示攻击源地理分布。
*   **实时告警流**: 滚动显示最新的威胁检测日志。

### 7.2 防火墙管理 (Firewall Panel)
*   **入口**: 点击大屏右上角或侧边栏的“防火墙状态”。
*   **功能**:
    *   **列表**: 查看 IP、封禁时间、封禁原因。
    *   **搜索**: 支持按 IP 模糊搜索。
    *   **手动封禁**: 输入 IP 和理由，强制下发封禁指令。
    *   **一键解封**: 撤销指定 IP 的封禁规则。

### 7.3 智能报告中心 (Report Center) (New)
*   **入口**: 侧边栏“安全报告生成”。
*   **功能**:
    *   **报告生成**: 选择“日报/周报/专项”，点击“启动 AI 生成”，系统将自动分析数据并产出报告。
    *   **历史管理**: 左侧列表查看过往报告，点击铅笔图标可**重命名**，点击垃圾桶图标可**删除**。
    *   **导出/预览**: 支持全屏阅读 Markdown 格式报告，并提供**导出 PDF** 功能，生成专业级安全文档。

---

## 8. 常见问题 (FAQ)

### Q1: 启动脚本提示 "Peer binary not found"?
**A**: 这是因为 `install.sh` 依赖 Fabric 二进制文件。请确保 `Zhilian_Install_Package/bin` 目录存在且具有执行权限。v1.2.0 安装包已内置这些文件。

### Q2: 后端报错 "ServiceDiscoveryException"?
**A**: 这是由于 Docker 容器内的主机名无法在宿主机解析。我们已在代码中通过 `gateway.discovery(false)` 禁用了服务发现，并配置了 `localhost` 映射。请确保使用最新的 `backend` 代码。

### Q3: WSL 下运行内存溢出 (OOM)?
**A**: Hyperledger Fabric 组件较为耗费内存。建议在 `.wslconfig` 中将 WSL2 的内存限制调整为 4GB 或以上。

### Q4: 为什么手动封禁后 Ping 还能通？
**A**: 
1. 检查 HIDS Agent 是否运行 (`python agent.py`)。
2. 检查 Agent 日志是否有 `[SUCCESS] Blocked IP ...`。
3. Windows 防火墙规则可能有延迟，或存在更高优先级的允许规则。

### Q5: 导出 PDF 时排版错乱？
**A**: PDF 导出依赖浏览器渲染引擎。请确保使用 Chrome/Edge 最新版，并保持窗口最大化以获得最佳截图效果。如果遇到截断，尝试在“全屏预览”模式下截图。

---

## 9. 联系方式与许可证

*   **许可证**: MIT License
*   **维护团队**: Zhilian Security Team
*   **反馈邮箱**: support@zhilian.com

*Copyright © 2025 Zhilian Security. All Rights Reserved.*
