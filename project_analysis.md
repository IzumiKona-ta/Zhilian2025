# Zhilian2025 网络安全平台 - 项目深度分析报告
> **版本**: v7.5 (威胁响应与稳定性增强版)
> **日期**: 2025-12-11
> **架构**: 微服务 + 区块链 + 人工智能
> **状态**: 🟢 生产就绪 (全模块实装，威胁响应闭环)

---

## 1. 项目概述 (Executive Summary)

**Zhilian2025** 是下一代**网络态势感知与威胁检测平台**。它深度融合了**机器学习 (AI)** 异常检测、**基于规则的入侵检测 (IDS)**、**主机入侵检测 (HIDS)** 以及**区块链**存证技术。

系统为安全分析师提供了一个统一的**玻璃拟态 (Glassmorphism) UI**，用于实时监控网络流量、可视化攻击路径、管理数据采集节点以及审计安全事件。所有核心数据均来自真实的探测引擎，并由区块链保障数据的不可篡改性。

**最新亮点 (v7.5)**: 实现了从威胁检测、自动/手动封禁到**一键解封**的完整闭环，并大幅增强了系统的鲁棒性（防误报、防自封、自动编码适配）。

---

## 2. 系统架构 (System Architecture)

平台采用分布式微服务架构，确保了系统的可扩展性与职责分离。

### 2.1 高层拓扑图
```mermaid
graph TD
    User[安全分析师] -->|HTTPS| Frontend[前端大屏 (React/Vite)]
    
    subgraph "核心业务层"
        Frontend -->|REST API| Backend[业务后端 (Spring Boot)]
        Backend -->|MySQL| DB[(数据库)]
        Backend -->|Redis| Cache[(缓存 - 仅后端使用)]
    end
    
    subgraph "安全引擎层"
        ML_IDS[Python AI 检测引擎] -->|HTTP POST| Backend
        HIDS_Agent[主机监控探针] -->|HTTP POST| Backend
        Rule_IDS[Snort 规则引擎] -->|HTTP POST| Backend
        Backend -->|Command Queue| HIDS_Agent
    end
    
    subgraph "区块链层"
        Backend -->|REST API| Middleware[区块链中间件]
        Middleware -->|SDK| Chain[FISCO BCOS / Fabric 联盟链]
    end
```

### 2.2 服务端口映射表

| 服务组件 | 角色 | 端口 | 技术栈 | 关键配置文件 |
| :--- | :--- | :--- | :--- | :--- |
| **FrontCode** | 可视化大屏 | **5173** (开发) | React 18, Vite, TypeScript, Tailwind | `vite.config.ts` |
| **BackCode** | 业务逻辑中枢 | **8081** | Spring Boot 3, MyBatis, JWT | `application.yml` |
| **Middleware** | 区块链网关 | **8080** | Java, Web3SDK | `application.properties` |
| **ML IDS** | AI 威胁检测 | **动态** | Python, PyTorch, Scapy | `realtime_detection_fixed.py` |
| **Rule IDS** | 规则检测 | **动态** | Python, Scapy, Regex | `mini_snort_pro.py` |
| **HIDS Agent** | 主机监控探针 | **动态** | Python, Psutil, Subprocess | `agent.py` |

---

## 3. 组件深度解析 (Detailed Component Analysis)

### 3.1 前端 (FrontCode)
现代化、高性能的单页应用 (SPA)。
*   **技术栈**: React 18, TypeScript, Vite 5, Recharts, ECharts, Tailwind CSS (玻璃拟态风格)。
*   **核心模块**:
    *   **仪表盘 (`Home.tsx`)**: 实时安全评分、今日攻击统计、快捷操作入口。
    *   **威胁分析 (`ThreatAlerts.tsx`)**: 
        *   实时展示告警列表。
        *   **新增功能**: 威胁响应操作中心，支持对恶意 IP 进行**一键解封** (`Unblock`) 操作。
    *   **攻击溯源 (`ThreatTracing.tsx`)**: 基于 ECharts 的 3D 地理飞线图，追踪攻击源头与路径。
    *   **主机监控 (`HostMonitoring.tsx`)**: 实时展示已注册主机的资源状态及文件完整性。
    *   **采集管理 (`DataCollection.tsx`)**: HIDS 探针节点的配置与管理界面。

### 3.2 后端 (BackCode)
系统的中枢大脑，负责业务逻辑、数据持久化与安全控制。
*   **技术栈**: Spring Boot 3.5.7, JDK 17/23, MySQL, MyBatis Plus, PageHelper。
*   **核心服务**:
    *   `ThreatController`: **(v7.5 增强)** 新增 IP 解封接口，支持 UUID/ID 兼容查询，联动 HIDS Agent 执行解封命令。
    *   `AnalysisService`: 处理来自 IDS 引擎的威胁告警，负责数据清洗与入库。
    *   `MonitorService`: 处理 HIDS 探针的心跳包与状态上报，维护主机健康状态。
    *   **DatabaseAutoUpdater**: 启动时自动检查并修复数据库表结构。
*   **数据存储**: 
    *   MySQL: 存储结构化业务数据。
    *   Redis: 仅用于后端缓存与 Session 管理（Python 脚本不再依赖）。

### 3.3 安全引擎 (PythonIDS)
平台的“眼睛”与“手”，负责检测与响应。

#### 3.3.1 AI 异常检测 (`realtime_detection_fixed.py`)
*   **核心算法**: Autoencoder/GAN 深度学习模型。
*   **关键改进 (v7.5)**:
    *   **白名单机制**: 引入 `trusted_ips.json` 自动重载机制。
    *   **协同防御**: 同步读取 `blocked_ips.json`，对于 Agent 已封禁的 IP，直接在检测层忽略，彻底消除“封禁后仍告警”的误报。
    *   **智能避让**: 自动检测本机所有网卡 IP，防止将本机发出的正常流量（如上传数据）误报为攻击。

#### 3.3.2 规则检测引擎 (`mini_snort_pro.py`)
*   **核心机制**: 基于签名的流量匹配（类 Snort）。
*   **关键改进 (v7.5)**:
    *   **协同防御**: 自动读取 `blocked_ips.json`，对于已封禁的 IP 不再重复检测与告警。
    *   **白名单支持**: 同样支持自动检测本机 IP 并加入信任列表。

#### 3.3.3 HIDS 探针 (`hids_agent/agent.py`)
*   **角色**: 运行在目标主机上的执行者。
*   **功能**:
    *   **监控**: CPU/内存/磁盘/网络/文件完整性。
    *   **响应 (v7.5 重构)**: 
        *   支持 `BLOCK_IP` (封禁) 和 `UNBLOCK_IP` (解封) 命令。
        *   **安全熔断**: 执行封禁前，**强制检查**目标 IP 是否为本机 IP、网关或回环地址 (`127.0.0.1`)，防止“自杀式”封禁。
        *   **兼容性**: 自动处理 Windows (`netsh`, GBK编码) 和 Linux (`iptables`, UTF-8编码) 的差异。

---

## 4. 威胁响应工作流 (Threat Response Workflow)

### 4.1 自动/手动 封禁流程
1.  **检测**: IDS (AI/Rule) 发现异常流量。
2.  **上报**: 告警发送至后端并存储。
3.  **决策**: 
    *   自动模式: 达到阈值自动下发封禁指令。
    *   手动模式: 管理员在前端点击“封禁”。
4.  **执行**: 
    *   后端将 `BLOCK_IP` 指令推入命令队列。
    *   HIDS Agent 获取指令 -> **安全检查(非本机)** -> 调用防火墙 (`netsh`/`iptables`)。
5.  **同步**: Agent 更新本地 `blocked_ips.json`，IDS 引擎读取该文件以停止对该 IP 的后续检测。

### 4.2 解封流程 (v7.5 新增)
1.  **操作**: 管理员在“威胁分析”页面点击“解除封禁”。
2.  **下发**: 后端发送 `UNBLOCK_IP` 指令。
3.  **执行**: HIDS Agent 调用防火墙删除规则。
4.  **恢复**: Agent 从 `blocked_ips.json` 移除该 IP，IDS 恢复对其的正常监控。

---

## 5. 最新工作汇报 (Work Summary v7.5 - COMPLETED)

### 5.1 核心功能交付 (Feature Delivery)
1.  **IP 解封功能**: 
    *   完成了从前端按钮到后端接口，再到底层防火墙命令的**全链路开发**。
    *   支持 Windows (netsh) 和 Linux (iptables) 双平台。
2.  **智能白名单 (Smart Whitelist)**:
    *   解决了“本机流量被误报为攻击”的痛点。
    *   实现了**零配置**：IDS 和 Agent 会自动通过 socket 探测和网卡遍历获取本机所有 IP，无需人工维护 `trusted_ips.json`。

### 5.2 稳定性与工程化修复 (Stability & Engineering)
1.  **Redis 依赖解耦**:
    *   响应用户需求，移除了 Python 脚本对 Redis 的直接依赖，回退为更轻量的 JSON 文件同步机制 (`blocked_ips.json`)，降低了部署复杂度。
2.  **编码适配 (Encoding)**:
    *   修复了 Windows 下中文环境 (`GBK`) 导致的 `UnicodeDecodeError`，现在 Agent 能正确处理中文报错信息。
3.  **权限管控**:
    *   Agent 启动时自动检查管理员权限，若无权限会发出醒目警告（防火墙操作必须）。
4.  **端口冲突解决**:
    *   解决了 `8081` 端口占用导致的后端启动失败问题。

### 5.3 当前系统状态
*   **整体健康度**: 🟢 极佳
*   **误报率**: 大幅降低 (得益于本地 IP 自动白名单)。
*   **可用性**: 支持完整的攻击阻断与恢复流程。

---

## 6. 部署建议
*   **启动**: 继续使用 `start_project.bat`。
*   **权限**: 务必以**管理员身份**运行终端，以确保 HIDS Agent 能操作防火墙。
