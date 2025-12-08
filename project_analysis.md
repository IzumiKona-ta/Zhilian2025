# Zhilian2025 项目深度分析与变更报告

> **版本**: v5.0 (完全交付版 - All Systems Go)
> **日期**: 2025-12-08
> **状态**: 🟢 已完成联调 | 🟢 真实攻击验证通过 | 🟢 区块链上链成功

---

## 1. 系统全景图 (System Overview)

本项目已完成从底层流量捕获到顶层可视化的全链路打通。系统由五个核心模块组成，通过 REST API、WebSocket 和 gRPC (Fabric) 紧密协作。

### 1.1 服务拓扑与端口映射
| 模块 | 角色 | 端口 | 技术栈 | 部署状态 | 关键配置路径 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FrontCode** | 态势感知大屏 | **3000** | React + Vite + TS | 🟢 运行中 | `vite.config.ts` (Proxy -> 8081) |
| **BackCode** | 业务控制中枢 | **8081** | Spring Boot 3.x | 🟢 运行中 | `application.yml` (Port: 8081) |
| **Backen** | 区块链网关 | **8080** | Java + Fabric SDK | 🟢 运行中 | `backend/src/.../EvidenceContract.java` |
| **IDS (Rule)** | 规则检测引擎 | N/A | Python + Scapy | 🟢 运行中 | `RuleBasedIDS/mini_snort_pro.py` |
| **IDS (ML)** | AI 检测引擎 | N/A | PyTorch | 🟢 运行中 | `PythonIDS/.../realtime_detection_fixed.py` |

---

## 2. 核心模块详细变更日志 (Technical Changelog)

### 2.1 FrontCode (前端大屏)
> **核心修复**: 解决了“黑屏崩溃”、“历史数据为空”和“404 接口不通”三大阻断性问题。

*   **[网络层] 代理配置修正 (`vite.config.ts`)**:
    *   目标端口从 `8080` 修正为 **`8081`** (指向业务后端)。
    *   **移除 Rewrite**: 注释掉了 `rewrite: (path) => path.replace(/^\/api/, '')`，保留 `/api` 前缀，与后端 `@RequestMapping("/api/...")` 完美匹配。
*   **[数据层] 历史数据适配 (`connector.ts`)**:
    *   **分页字段兼容**: 修复了 `getHistory` 方法，从 `response.data.data.records` 读取数据，解决了 PageHelper 分页结构导致的历史记录为空问题。
    *   **类型安全**: 强制将 `id` 字段转换为 `String` 类型，防止 React 在渲染数字 ID 时调用字符串方法导致页面崩溃 (黑屏)。
    *   **Payload 解析**: 增加了对 `impactScope` 字段的智能解析逻辑，自动提取 `源IP`、`目标IP` 和 `攻击类型`。
*   **[交互层] 登录体验**:
    *   `Login.tsx`: 将默认填充密码修正为 **`123456`**，与数据库一致。

### 2.2 BackCode (业务后端)
> **核心修复**: 解决了“Bean 注入失败”、“区块链连接拒绝”和“JSON 序列化异常”。

*   **[架构] 包名规范化 (Critical)**:
    *   批量重命名了 `service/Impl` 目录为 `service/impl`。
    *   修改了所有 `ServiceImpl` 类的 `package` 声明，解决了 Maven 构建时因大小写敏感导致的 `Consider defining a bean...` 启动失败问题。
*   **[通信] 区块链连接适配 (`AnalysisServiceImpl.java`)**:
    *   将上链目标地址从 `http://localhost:8080` 修改为 **`http://[::1]:8080`**。
    *   **原因**: WSL 环境下端口转发有时仅绑定 IPv6 Loopback，使用 IPv4 `127.0.0.1` 会导致 `Connection Refused`。
*   **[序列化] JSON 格式修正 (`potentialThreatAlert.java`)**:
    *   为 `occurTime` 和 `createTime` 添加了 `@JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")` 注解。
    *   **原因**: 解决了发送给 Backen (8080) 时，时间字段被默认序列化为数组 `[2025, 12, 8...]` 导致接收端反序列化报错的问题。
*   **[WebSocket] 依赖升级**:
    *   修复了 `WebSocketServer.java` 中使用旧版 `javax.websocket` 的问题，全面迁移至 Spring Boot 3 要求的 **`jakarta.websocket`** 包。

### 2.3 Backen (区块链中间件)
> **状态**: 稳定运行，作为存证黑盒。

*   **[接口]**: 提供 `/api/chain/alert` 接口，接收来自 BackCode 的清洗后数据。
*   **[兼容]**: 配合 BackCode 的 DTO 修正，现在能正确解析并上链时间戳字段。

### 2.4 IDS 引擎 (入侵检测)
> **状态**: 真实流量检测就绪。

*   **[环境] 依赖补全**:
    *   安装了 `numpy`, `scapy`, `torch`, `requests`, `pandas`, `scikit-learn`，确保两个 IDS 脚本均可直接运行。
*   **[规则] 规则集优化 (`rules.json`)**:
    *   将目标端口从固定 `80` 修改为 `any`，扩大了检测范围。
*   **[工具] 真实攻击生成器 (`trigger_real_attack.py`)**:
    *   新增脚本，用于发送真实的 HTTP 恶意 Payload (SQLi, XSS, Path Traversal)。
    *   **作用**: 替代了单纯的 API 模拟，实现了“真实流量 -> 抓包检测 -> 告警”的完整闭环。

---

## 3. 全链路验证通过 (Verification Passed)

我们已成功验证了以下完整流程：

1.  **攻击发起**: 运行 `trigger_real_attack.py` 发送 `UNION SELECT` 请求。
2.  **流量捕获**: `mini_snort_pro.py` 在本地网卡抓取到 HTTP 包，匹配 `sid:100001` 规则。
3.  **告警上报**: IDS 自动 POST 数据到 `http://localhost:8081/api/analysis/alert`。
4.  **业务处理**:
    *   BackCode 将告警存入 MySQL `sys_user` 库。
    *   BackCode 通过 WebSocket 广播消息。
    *   BackCode 异步调用 `[::1]:8080` 将哈希存入区块链。
5.  **前端响应**:
    *   浏览器实时弹出红色告警卡片（包含正确的 IP 和攻击类型）。
    *   刷新页面后，历史记录能够从数据库正确加载并显示。

---

## 4. 下一步建议 (Next Steps)

*   **生产部署**: 目前运行在 Dev 模式，生产环境建议使用 Nginx 反向代理统一端口。
*   **HTTPS**: 建议为 FrontCode 和 BackCode 启用 HTTPS，以保证 Token 传输安全。
*   **模型训练**: PythonIDS 目前使用预训练权重，后续可收集现网流量进行增量训练 (`train_model.py`)。

---
**项目已交付，所有关键路径均已打通。**
