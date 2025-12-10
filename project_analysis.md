# Zhilian2025 网络安全平台 - 项目深度分析报告
> **版本**: v7.6 (防火墙管理与全链路增强版)
> **日期**: 2025-12-11
> **架构**: 微服务 (Spring Boot) + 区块链 (FISCO BCOS) + 人工智能 (PyTorch)
> **状态**: 🟢 生产就绪 (全功能实装，闭环防御体系)

---

## 1. 项目概述 (Executive Summary)

**Zhilian2025** 是一款企业级**网络态势感知与主动防御平台**。它突破了传统 IDS 仅能“旁路告警”的局限，构建了从**流量感知**到**AI 研判**，再到**端点阻断**的完整闭环。

系统深度融合了以下核心技术：
*   **AI 深度学习**: 利用 Autoencoder/GAN 模型检测零日 (Zero-day) 未知威胁。
*   **端点防御 (EDR)**: HIDS 探针不仅采集数据，更能执行防火墙策略，实现毫秒级威胁封禁。
*   **区块链存证**: 关键告警上链存储，确保数据不可篡改，满足等保审计要求。
*   **可视化指挥**: 玻璃拟态风格的态势大屏，提供上帝视角的网络监控能力。

**核心价值**: 变“被动防御”为“主动响应”，实现对网络攻击的秒级发现与自动/手动阻断。

---

## 2. 系统架构 (System Architecture)

平台采用**分布式微服务架构**，各组件松耦合，通过标准 REST API 和 WebSocket 进行通信。

### 2.1 逻辑拓扑图
```mermaid
graph TD
    User[安全分析师] -->|HTTPS| Frontend[前端指挥大屏 (React/Vite)]
    
    subgraph "业务中台 (Business Layer)"
        Frontend -->|REST API| Backend[业务后端 (Spring Boot)]
        Backend -->|WebSocket| Frontend
        Backend -->|MySQL| DB[(业务数据库)]
        Backend -->|Redis| Cache[(会话缓存)]
    end
    
    subgraph "感知与响应层 (Sensor & Response Layer)"
        ML_IDS[Python AI 检测引擎] -->|HTTP POST| Backend
        Rule_IDS[Snort 规则引擎] -->|HTTP POST| Backend
        HIDS_Agent[HIDS 主机探针] -->|HTTP POST (心跳)| Backend
        Backend -->|Command Queue| HIDS_Agent
        HIDS_Agent -->|Shell Exec| Firewall[系统防火墙 (Netsh/Iptables)]
    end
    
    subgraph "信任锚点 (Trust Layer)"
        Backend -->|REST API| Middleware[区块链中间件]
        Middleware -->|SDK| Chain[FISCO BCOS 联盟链]
    end
```

### 2.2 核心服务端口映射
| 服务组件 | 关键职责 | 端口 | 技术栈 | 配置文件 |
| :--- | :--- | :--- | :--- | :--- |
| **FrontCode** | 用户交互、数据可视化 | **5173** | React 18, Vite, Tailwind | `vite.config.ts` |
| **BackCode** | 业务逻辑、指令调度 | **8081** | Spring Boot 3, MyBatis | `application.yml` |
| **Middleware** | 区块链交互网关 | **8080** | Java Spring Boot | `application.properties` |
| **ML IDS** | 异常流量检测 (AI) | N/A | Python, PyTorch, Scapy | `realtime_detection_fixed.py` |
| **HIDS Agent** | 主机监控、命令执行 | N/A | Python, Psutil | `agent.py` |

---

## 3. 组件深度解析 (Detailed Component Analysis)

### 3.1 前端交互层 (FrontCode)
基于 React 18 构建的现代化 SPA，实现了极佳的交互体验。
*   **技术栈**: React, TypeScript, Vite, Recharts, ECharts, Lucide Icons, Axios。
*   **关键模块**:
    *   **实时威胁预警 (`ThreatAlerts.tsx`)**: 
        *   **核心功能**: 实时展示 IDS 告警流。
        *   **v7.6 更新**: 集成**防火墙黑名单管理面板**。支持查看当前封禁 IP 列表、手动添加封禁 IP、一键解封。
    *   **攻击溯源 (`ThreatTracing.tsx`)**: 3D 地球飞线图，展示攻击源地理位置。
    *   **主机监控 (`HostMonitoring.tsx`)**: 实时渲染 HIDS 上报的 CPU/内存/磁盘波形图。
    *   **服务通信 (`connector.ts`)**: 封装了所有后端 API 调用，新增 `getBlockedIps`, `manualBlock`, `manualUnblock` 等防火墙管理接口。

### 3.2 业务逻辑层 (BackCode)
系统的中枢神经，负责数据流转与决策下发。
*   **技术栈**: Spring Boot 3.5.7, JDK 17, MySQL 8.0。
*   **核心控制器**:
    *   **`ThreatController`**: 
        *   处理威胁相关的业务逻辑。
        *   **v7.6 增强**: 新增防火墙管理 API，支持通过 UUID 或 ID 查询威胁并下发指令。
    *   **`MonitorController`**: 
        *   接收 HIDS 心跳包 (`/api/host/monitor/report`)。
        *   **v7.6 增强**: 实现了**指令通道回退机制**。当 Agent 自身 IP 的指令队列为空时，自动检查 `127.0.0.1` 默认通道，确保局域网/NAT 环境下的指令必达。
*   **核心服务**:
    *   **`CommandQueueService`**: 基于内存的指令队列，暂存待下发给 HIDS 的 `BLOCK_IP` / `UNBLOCK_IP` 指令。
    *   **`DatabaseAutoUpdater`**: 启动时自动扫描并修复数据库表结构，确保 `disk_usage` 等新字段存在，防止 500 错误。

### 3.3 感知与响应层 (PythonIDS)
分布式的安全触手，负责“看”和“动”。

#### 3.3.1 AI 异常检测引擎 (`realtime_detection_fixed.py`)
*   **原理**: 使用 Scapy 捕获流量 -> 提取 79 维统计特征 -> 输入 Autoencoder 模型 -> 计算重构误差 (Reconstruction Error)。
*   **智能特性**:
    *   **自动白名单**: 启动时自动探测本机所有网卡 IP (包括虚拟网卡)，加入信任列表，防止将本机外发流量误报为攻击。
    *   **协同防御**: 实时读取 `blocked_ips.json`，对于已封禁 IP 自动停止检测，节省算力并消除重复告警。

#### 3.3.2 HIDS 主机探针 (`hids_agent/agent.py`)
*   **职责**: 驻留在目标主机，负责监控与执行。
*   **监控能力**: 
    *   系统资源: CPU, 内存, 磁盘 (Root/C:), 网络连接数。
    *   文件完整性 (FIM): 监控 `/etc/passwd`, `hosts`, `C:\Windows\System32\drivers\etc\hosts` 等关键文件。
*   **响应能力 (Active Response)**:
    *   **跨平台防火墙**: 
        *   **Windows**: 调用 `netsh advfirewall firewall` 添加/删除入站规则。
        *   **Linux**: 调用 `iptables -I INPUT` 添加/删除丢弃规则。
    *   **安全熔断机制 (Safety Circuit)**: 在执行 `BLOCK_IP` 前，强制调用 `get_all_local_ips()` 检查目标 IP 是否为本机、网关或回环地址。**坚决防止“自杀式”封禁导致系统失联。**
    *   **编码自适应**: 自动处理 Windows GBK 和 Linux UTF-8 编码，彻底解决 `UnicodeDecodeError`。

---

## 4. 关键业务流程 (Key Workflows)

### 4.1 全生命周期威胁封禁 (Full Lifecycle Blocking)
1.  **检测**: AI/规则引擎发现恶意 IP `1.2.3.4`。
2.  **上报**: 告警数据 POST 至后端，前端大屏弹出红色警报。
3.  **指令生成**: 
    *   **自动**: 若配置了自动响应，后端直接生成 `BLOCK_IP 1.2.3.4`。
    *   **手动**: 管理员在前端点击“封禁”，后端生成指令。
4.  **指令下发**: 指令被推入 `CommandQueue`。
5.  **执行**: 
    *   HIDS Agent 发送心跳包。
    *   后端在响应中携带指令。
    *   Agent 收到指令 -> **安全检查** -> **执行系统命令** -> **更新本地 blocked_ips.json**。
6.  **闭环**: IDS 引擎读取 `blocked_ips.json`，停止对该 IP 的告警。

### 4.2 一键解封与黑名单管理 (Unblock & Management)
1.  **管理**: 管理员打开前端“防火墙黑名单”面板。
2.  **操作**: 点击“删除”图标或手动输入 IP 添加。
3.  **流转**: 前端调用 `/manual-unblock` -> 后端推入指令队列 -> Agent 获取指令。
4.  **恢复**: Agent 调用防火墙删除规则 -> 移除本地 JSON 记录 -> 流量恢复。

---

## 5. 部署与运维指南 (Deployment & Operations)

### 5.1 环境依赖
*   **OS**: Windows 10/11 (推荐) 或 Linux。
*   **Runtime**: Java 17+, Python 3.8+, Node.js 18+。
*   **Middleware**: MySQL 8.0, Redis (可选)。

### 5.2 启动方式
使用项目根目录下的 **`start_project.bat`** 脚本。
> **v7.6 脚本优化**:
> *   **目录修正**: 强制使用 `cd /d "%~dp0"` 确保所有子进程在项目根目录运行，解决“找不到文件”错误。
> *   **权限提升**: HIDS Agent 自动请求管理员权限启动，确保有权操作防火墙。

### 5.3 常见问题排查
*   **Q: 为什么手动封禁后没有立即生效？**
    *   A: HIDS Agent 是轮询机制 (默认 3-5秒)，指令会在下一次心跳时被获取执行。
*   **Q: 启动脚本报错 "Python not found"?**
    *   A: 请确保 Python 已加入系统环境变量 PATH。
*   **Q: 8081 端口被占用？**
    *   A: 脚本会自动尝试清理，若失败请手动运行 `netstat -ano | findstr :8081` 并杀掉对应进程。

---

## 6. 版本更新记录 (Changelog - v7.6)

### ✨ 新增功能 (New Features)
1.  **前端防火墙管理面板**: 实现了可视化的黑名单增删改查，不再依赖命令行。
2.  **手动黑/白名单接口**: 后端新增 `/api/threats/manual-block` 等接口，支持任意 IP 的管控。

### 🛠️ 核心修复 (Critical Fixes)
1.  **指令通道回退 (Command Fallback)**: 修复了 Agent 使用局域网 IP (如 `192.168.x.x`) 注册时无法收到默认发给 `127.0.0.1` 指令的问题。
2.  **启动路径修正**: 修复了 `start_project.bat` 在管理员模式下工作目录漂移到 `System32` 的问题。
3.  **智能白名单 (Smart Whitelist)**: IDS 和 Agent 现已支持自动识别本机所有 IP，彻底解决了本机流量误报问题。
4.  **编码健壮性**: Agent 增加了对子进程输出的编码容错处理，消除了中文环境下的崩溃风险。

---
> **总结**: v7.6 版本标志着 Zhilian2025 从一个“监控平台”进化为一个具备完整**感知-决策-响应**能力的**主动防御系统**。
