# 区块链安全存证系统 - 功能交付清单

**交付人**：[胡景山]
**交付日期**：2025-11-28
**项目定位**：基于联盟链的高并发、高安全业务数据存证中间件

---

## 1. 核心架构与基础设施 (Infrastructure)

| 模块 | 功能描述 | 技术实现/状态 |
| :--- | :--- | :--- |
| **底层网络** | Fabric test-network 接入 | 后端对接 Org1 的 Connection Profile（`src/main/resources/application.yml:4-17`）。拓扑支持 2 Org + 2 Peer + 1 Orderer（网络侧），本仓库仅交付后端中间件。 |
| **共识机制** | Raft 共识 | 由网络侧 Orderer 集群提供，随 test-network 配置。 |
| **状态数据库** | LevelDB/CouchDB 兼容 | 中间件的批量查询依赖合约范围查询（`queryEvidenceByType`），兼容两种状态库；不强依赖 CouchDB Selector。 |
| **运行环境** | WSL/Docker 适配 | 要求在 WSL2 中部署 Fabric 网络与证书（`application.yml:4-13`），后端端口 `8080`（`application.yml:1-3`）。 |

## 2. 中间件核心能力（backend 工程）

| 模块 | 功能点 | 说明/代码索引 |
| :--- | :--- | :--- |
| **高性能引擎** | 异步削峰队列 | 内存队列解耦请求与链上写入（`src/main/java/com/example/blockchain/service/AsyncService.java:33-40`）。 |
|  | 批量上链（Batching） | 自动聚合打包提交合约 `submitEvidenceBatch`，显著提升吞吐（实际提升以压测为准）（`AsyncService.java:69-90`）。 |
|  | 熔断与重试 | 失败触发打散重试，超过最大重试将记录并告警（`AsyncService.java:91-124`）。 |
| **安全体系** | API Key 鉴权 | 统一拦截 `/api/**`，强制 `X-API-KEY` 请求头（`src/main/java/com/example/blockchain/config/WebConfig.java:16-29`、`src/main/java/com/example/blockchain/interceptor/AuthInterceptor.java:12-32`）。 |
|  | 隐私数据加密 | AES/Base64 对敏感字段加密存储（`src/main/java/com/example/blockchain/util/AESUtil.java:7-32`；使用见控制器）。 |
|  | 审计日志 | AOP 切面记录请求与响应（`src/main/java/com/example/blockchain/aspect/AuditLogAspect.java:23-43`）。 |
|  | RBAC/ACL（合约侧） | 支持基于 MSP 的访问控制需在合约实现并升级，本仓库未包含合约代码。 |
| **实时交互** | WebSocket 推送 | 端点 `/ws`，主题 `/topic/alerts`，推送批量成功/失败事件（`src/main/java/com/example/blockchain/config/WebSocketConfig.java:9-23`、`AsyncService.java:69-90,91-124`）。 |

## 3. 业务对接与接口（POST 上链）

| 业务模块 | 接口地址 | DTO | 代码索引 |
| :--- | :--- | :--- | :--- |
| 组织管理 | `/api/chain/org` | `OrgInfoDTO` | `src/main/java/com/example/blockchain/BlockchainController.java:91-104` |
| 威胁告警 | `/api/chain/alert` | `ThreatAlertDTO` | `src/main/java/com/example/blockchain/BlockchainController.java:105-118` |
| 流量统计 | `/api/chain/traffic` | `TrafficStatDTO` | `src/main/java/com/example/blockchain/BlockchainController.java:119-123` |
| 溯源报告 | `/api/chain/trace` | `SourceTracingDTO` | `src/main/java/com/example/blockchain/BlockchainController.java:139-143` |
| 报告配置 | `/api/chain/report` | `ReportConfigDTO` | `src/main/java/com/example/blockchain/BlockchainController.java:125-137` |

统一入队批处理：`AsyncService.addToQueue`（`src/main/java/com/example/blockchain/BlockchainController.java:181`）。

## 4. 查询与校验（GET/POST）

- 按类型批量查询：`GET /api/chain/list/{type}`（依赖合约 `queryEvidenceByType`，`src/main/java/com/example/blockchain/BlockchainController.java:145-165`）
- 单条查询：`GET /api/evidence/{id}`（`src/main/java/com/example/blockchain/BlockchainController.java:40-56`）
- 防篡改校验：`POST /api/verify`（`src/main/java/com/example/blockchain/BlockchainController.java:58-87`）

## 5. 前端与实时监控

- 单页调试与监控：`src/main/resources/static/index.html`
- 功能：数据模拟、一键“连发10条”、实时日志看板、按类型查询（`index.html:309-347,409-482,176-206,486-514`）

## 6. 运维与健康

- Actuator：`GET /actuator/health|info|metrics`、`POST /actuator/shutdown`（`src/main/resources/application.yml:19-28`）
- 端口：`8080`（`src/main/resources/application.yml:1-3`）

## 7. 约束与边界

- 加密字段在链上以 Base64 文本存储；当前前端不自动解密（遵循回退后的行为）返回业务后端的时候会解密
- TPS 提升为批量/异步机制的工程收益，具体数值以压测报告为准

## 8. 交付总结

本项目已完成从后端中间件到接口对接的闭环。通过异步批量、鉴权加密、审计与实时监控，满足任务书功能要求并具备工程落地可用性；环境侧（多组织、ACL、压测报告）可按需扩充与升级。

下一步任务：将项目部署到真机环境，为服务器配置运行环境，配置 Fabric 网络。
当前状态：在单机模拟环境开发好了区块链中间件 
目标状态：在生产级分布式环境部署运行区块链网络/

还需要做大量的运维配置工作：
服务器：至少 2 台 Linux。
搭环境：每台装 Docker、K8s以及若干必须的运行环境。
改配置：把 localhost 全部换成真实 IP。
换证书：搭建 Fabric CA发证系统，给每个节点发证。
