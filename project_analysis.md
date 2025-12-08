# Zhilian2025 项目深度分析与变更报告

> **版本**: v6.0 (最终完善版 - 包含组织管理修复)
> **日期**: 2025-12-08
> **状态**: 🟢 全模块联调通过

---

## 1. 系统全景图 (System Overview)

本项目已完成从底层流量捕获到顶层可视化的全链路打通，并修复了所有已知的前后端交互问题。

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
> **核心修复**: 解决了“黑屏崩溃”、“历史数据为空”、“404 接口不通”以及**“组织管理功能不可用”**。

*   **[功能] 组织管理模块修复 (`connector.ts` & `OrgManagement.tsx`)**:
    *   **接口纠正**: 将组织管理相关接口从 Mock 的 `/organizations` 修正为真实的后端接口 `/api/org/info`。
    *   **数据适配**: 增加了中间层逻辑，将后端返回的 `orgName`/`adminPermission` 等数据库字段自动映射为前端组件需要的 `name`/`adminPermission` (boolean) 格式。
    *   **列表加载**: 修复了 `getAll` 方法，正确解析后端 PageHelper 返回的 `{ data: { records: [...] } }` 结构。
    *   **交互优化**: `create` 和 `update` 操作现在会返回完整的组织对象，确保前端列表能即时刷新，无需重新加载页面。
*   **[网络层] 代理配置修正 (`vite.config.ts`)**:
    *   目标端口从 `8080` 修正为 **`8081`** (指向业务后端)。
    *   **移除 Rewrite**: 注释掉了 `rewrite` 规则，保留 `/api` 前缀，与后端 Controller 路径匹配。
*   **[数据层] 历史数据适配 (`connector.ts`)**:
    *   修复了 `getHistory` 方法，从 `response.data.data.records` 读取数据。
    *   强制将 `id` 字段转换为 `String` 类型，防止 React 渲染崩溃。
    *   增加了对 `impactScope` 字段的智能解析逻辑。

### 2.2 BackCode (业务后端)
> **核心修复**: 解决了“Bean 注入失败”、“区块链连接拒绝”、“JSON 序列化异常”以及**“组织管理接口不规范”**。

*   **[API] 组织管理接口重构 (`OrgInfoController.java` & `OrgInfoService`)**:
    *   修改了 `insertOrgInfo` 和 `updateOrgInfo` 的返回值类型，从 `void` 改为 `orgInfo` 实体。现在它们在操作成功后会返回最新的数据库记录，方便前端回显。
    *   **Mapper 增强**: 在 `OrgInfoMapper` 中新增了 `getById` 方法，支持通过 ID 精确查询组织信息。
*   **[架构] 包名规范化 (Critical)**:
    *   批量重命名了 `service/Impl` 目录为 `service/impl`，解决了 Maven 构建时的 Bean 注入错误。
*   **[通信] 区块链连接适配 (`AnalysisServiceImpl.java`)**:
    *   将上链目标地址从 `http://localhost:8080` 修改为 **`http://[::1]:8080`**，解决了 WSL 环境下的 IPv6 连接拒绝问题。
*   **[序列化] JSON 格式修正 (`potentialThreatAlert.java`)**:
    *   为时间字段添加了 `@JsonFormat` 注解，解决了跨服务调用的序列化错误。

### 2.3 Backen (区块链中间件)
> **状态**: 稳定运行。

*   **[接口]**: 提供 `/api/chain/alert` 接口，接收来自 BackCode 的数据并存入 Hyperledger Fabric。

### 2.4 IDS 引擎 (入侵检测)
> **状态**: 真实流量检测就绪。

*   **[环境]**: 补全了 `scapy`, `torch` 等依赖。
*   **[规则]**: 优化了 `rules.json`，监听所有端口 (`dst_port: any`)。
*   **[工具]**: 新增 `trigger_real_attack.py`，实现了真实攻击流量的生成与闭环验证。

---

## 3. 全链路验证通过 (Verification Passed)

1.  **真实攻击闭环**:
    *   `trigger_real_attack.py` 发起攻击 -> IDS 捕获 -> BackCode 接收 -> 前端实时告警 -> 区块链存证。
    *   验证结果：✅ **成功**。前端无黑屏，告警信息准确。
2.  **组织管理功能**:
    *   **列表**: 进入页面自动加载数据库中的组织列表。
    *   **新增**: 点击“添加组织”，填写表单后提交，列表立即更新。
    *   **编辑**: 修改组织权限或名称，提交后列表立即更新。
    *   **删除**: 点击删除按钮，确认后数据从数据库移除。
    *   验证结果：✅ **成功**。前后端数据完全同步。
3.  **历史数据回溯**:
    *   刷新页面后，之前的威胁记录能正确加载并显示。
    *   验证结果：✅ **成功**。

---

## 4. 交付总结

本项目的所有核心功能模块（态势感知、威胁检测、区块链存证、系统管理）均已开发完成并经过严格联调。代码库结构清晰，配置规范，可以直接用于演示或进一步的生产部署。
