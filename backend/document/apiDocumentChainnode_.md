# 区块链中间件接口文档 (API Documentation)

本文档详细描述了区块链中间件 (`backend`) 提供的所有 HTTP 接口。

**基础信息：**
*   **Base URL**: `http://localhost:8080/api`
*   **Content-Type**: `application/json`
*   **Headers**: 需在所有请求中加入 `X-API-KEY: secret-api-key`

---

## 项目解析 (Overview)

- 架构组成：Spring Boot 后端 + Fabric Gateway 合约调用 + 异步批处理队列 + WebSocket 实时通知 + Actuator 运维端点 + AOP 审计日志 + 拦截器 API Key 鉴权 + 前端单页 `index.html`。
- 关键依赖：`spring-boot-starter-web`、`spring-boot-starter-websocket`、`spring-boot-starter-aop`、`spring-boot-starter-actuator`、`fabric-gateway-java`、`fastjson`、`lombok`（见 `pom.xml`）。
- 目录结构：
  - 后端入口与配置：`src/main/java/com/example/blockchain/Application.java`、`FabricConfig.java:31-47`、`config/WebSocketConfig.java`、`config/WebConfig.java`
  - 业务接口：`BlockchainController.java`（提交/查询/富查询）
  - 队列与批处理：`service/AsyncService.java:33-40、41-67、69-104`
  - 安全与审计：`interceptor/AuthInterceptor.java`、`aspect/AuditLogAspect.java`
  - 前端页面：`src/main/resources/static/index.html`
- 业务流程：
  - 上链提交：`/api/chain/*` 接口接收 DTO → 统一生成 `TYPE_id` 前缀键 → 计算 `metadata` 哈希 → 入队（`AsyncService.addToQueue`）→ 后台批量调用合约 `submitEvidenceBatch`。
  - 查询与校验：`/api/evidence/{id}` 查询单条；`/api/verify` 比对哈希；`/api/chain/list/{type}` 通过合约 `queryEvidenceByType` 范围查询（`EvidenceContract`）。
  - 通知与监控：批量成功后通过 WebSocket 推送到 `/topic/alerts`；Actuator 提供健康与停机接口。
- 安全与合规：
  - API Key 鉴权：`X-API-KEY` 头部在前端统一设置（`index.html`）；后端拦截器校验。
  - 数据加密：对 `OrgInfo.orgName`、`ThreatAlert.impactScope`、`ReportConfig.reportUrl` 进行 AES 加密（`BlockchainController.java:92-104、106-118、126-137`）。
  - 审计日志：AOP 记录请求/响应（`aspect/AuditLogAspect.java`）。
- 运维：
  - Actuator 端点：`/actuator/health`、`/actuator/info`、`/actuator/metrics`、`/actuator/shutdown`（需要在 `application.yml:19-28` 开启）。
- 启动与联调：
  - 启动：`mvn spring-boot:run` 或打包运行；确保 WSL 网络与证书路径配置正确（`application.yml:4-17`）。
  - 联调：打开 `index.html`，先在“数据模拟器”页提交，再在“实时监控看板”查看推送与在“链上存证查询”按类型查询。

---

## 1. 业务数据上链接口 (New)

以下接口用于将业务系统 (`backcode`) 的实体数据上传至区块链。
所有接口均采用 **异步队列机制**，返回成功仅代表“已入队”，实际存证结果需通过查询接口确认。
另：后端会对部分敏感字段进行加密存储（AES/Base64），包括：`OrgInfo.orgName`、`ThreatAlert.impactScope`、`ReportConfig.reportUrl`。

### 1.1 提交组织信息
*   **URL**: `/chain/org`
*   **Method**: `POST`
*   **描述**: 上传组织机构基本信息。
*   **EventID 生成规则**: `ORG_{orgId}` (若 `orgId` 为空则使用 `id`)
*   **请求体 (Request Body)**:
    ```json
    {
      "id": 1,
      "orgId": "ORG001",
      "orgName": "研发部",
      "memberCount": 50,
      "adminPermission": 1,
      "createTime": "2023-10-01 10:00:00",
      "updateTime": "2023-10-02 10:00:00"
    }
    ```
*   **响应示例 (Response)**:
    ```json
    {
      "status": "success",
      "message": "组织信息已入队",
      "txId": "ORG_ORG001"
    }
    ```

### 1.2 提交威胁告警
*   **URL**: `/chain/alert`
*   **Method**: `POST`
*   **描述**: 上传潜在威胁告警信息。
*   **EventID 生成规则**: `ALERT_{threatId}` (若 `threatId` 为空则使用 `id`)
*   **请求体 (Request Body)**:
    ```json
    {
      "id": 101,
      "threatId": "THREAT-2023-001",
      "threatLevel": 3,
      "impactScope": "Database",
      "occurTime": "2023-11-27 14:00:00",
      "createTime": "2023-11-27 14:05:00"
    }
    ```
*   **响应示例**:
    ```json
    {
      "status": "success",
      "message": "威胁告警已入队",
      "txId": "ALERT_THREAT-2023-001"
    }
    ```

### 1.3 提交流量统计
*   **URL**: `/chain/traffic`
*   **Method**: `POST`
*   **描述**: 上传异常流量统计数据。
*   **EventID 生成规则**: `TRAFFIC_{id}`
*   **请求体 (Request Body)**:
    ```json
    {
      "id": 500,
      "attackType": "DDoS",
      "sourceIp": "192.168.1.100",
      "targetIp": "10.0.0.5",
      "statTime": "2023-11-27 15:00:00",
      "attackCount": 1000,
      "createTime": "2023-11-27 15:05:00"
    }
    ```
*   **响应示例**:
    ```json
    {
      "status": "success",
      "message": "流量统计已入队",
      "txId": "TRAFFIC_500"
    }
    ```

### 1.4 提交报表配置
*   **URL**: `/chain/report`
*   **Method**: `POST`
*   **描述**: 上传威胁报表配置信息。
*   **EventID 生成规则**: `REPORT_{id}`
*   **请求体 (Request Body)**:
    ```json
    {
      "id": 88,
      "reportType": "Weekly",
      "startTime": "2023-11-20",
      "endTime": "2023-11-26",
      "reportStatus": 1,
      "reportUrl": "http://oss.example.com/report/88.pdf",
      "createTime": "2023-11-27 09:00:00",
      "updateTime": "2023-11-27 09:00:00"
    }
    ```
*   **响应示例**:
    ```json
    {
      "status": "success",
      "message": "报表配置已入队",
      "txId": "REPORT_88"
    }
    ```

---

## 2. 链上存证查询 (Rich Query)

### 2.1 按类型批量查询
*   **URL**: `/chain/list/{type}`
*   **Method**: `GET`
*   **描述**: 根据类型前缀范围查询链上存证（合约需支持 `queryEvidenceByType`）。
*   **路径参数**: `type` ∈ `ORG | ALERT | TRAFFIC | REPORT | TRACE`
*   **响应示例**:
    ```json
    {
      "status": "success",
      "data": [
        { "eventID": "ORG_001", "dataHash": "...", "metadata": "..." },
        { "eventID": "ORG_002", "dataHash": "...", "metadata": "..." }
      ]
    }
    ```

### 1.5 提交溯源信息
*   **URL**: `/chain/trace`
*   **Method**: `POST`
*   **描述**: 上传威胁溯源分析结果。
*   **EventID 生成规则**: `TRACE_{id}`
*   **请求体 (Request Body)**:
    ```json
    {
      "id": 202,
      "threatSource": "APT Group X",
      "maliciousIp": "45.33.22.11",
      "attackCmd": "rm -rf /",
      "malwareOrigin": "Unknown",
      "attackPath": "Firewall -> Web Server -> DB",
      "flowCharm": "Signature_XYZ",
      "createTime": "2023-11-27 16:00:00"
    }
    ```
*   **响应示例**:
    ```json
    {
      "status": "success",
      "message": "溯源信息已入队",
      "txId": "TRACE_202"
    }
    ```

---

## 3. 通用基础接口 (Legacy)

以下接口为系统基础功能，支持任意格式数据的存证与查询。

### 3.1 通用存证提交
*   **URL**: `/evidence`
*   **Method**: `POST`
*   **描述**: 手动提交任意数据上链。
*   **请求体 (Request Body)**:
    ```json
    {
      "eventID": "custom-001",
      "dataHash": "a1b2c3d4...",
      "metadata": "{\"any\": \"json\"}"
    }
    ```

### 3.2 存证查询
*   **URL**: `/evidence/{id}`
*   **Method**: `GET`
*   **描述**: 根据 EventID 查询链上存证数据。
*   **URL 参数**: `id` (例如 `ORG_ORG001` 或 `custom-001`)
*   **响应示例**:
    ```json
    {
      "status": "success",
      "data": {
        "eventID": "ORG_ORG001",
        "dataHash": "123456...",
        "metadata": "{\"orgName\": \"研发部\"...}",
        "timestamp": "2023-11-27T10:00:00Z"
      }
    }
    ```

### 3.3 存证校验

---

## 4. 运维与监控 (Ops)

### 4.1 健康检查与优雅停机
*   **URL**: `/actuator/health`, `/actuator/info`, `/actuator/metrics`, `/actuator/shutdown`
*   **Method**: `GET` (shutdown 为 `POST`)
*   **说明**: 需在 `application.yml` 开启相关端点；`shutdown` 用于优雅停机。

### 4.2 实时通知 (WebSocket)
*   **Connect**: `ws` 端点为 `/ws`（SockJS/STOMP）
*   **Subscribe**: 订阅主题 `/topic/alerts`
*   **消息示例**:
    ```json
    {
      "type": "BATCH_SUCCESS",
      "txId": "...",
      "count": 100,
      "timestamp": 1700000000000
    }
    ```
*   **URL**: `/verify`
*   **Method**: `POST`
*   **描述**: 校验前端/业务端计算的哈希与链上是否一致。
*   **请求体 (Request Body)**:
    ```json
    {
      "eventID": "ORG_ORG001",
      "dataHash": "123456..."  // 业务端计算出的哈希
    }
    ```
*   **响应示例**:
    ```json
    {
      "status": "success",
      "isMatch": true,
      "chainHash": "123456...",
      "localHash": "123456..."
    }
    ```
