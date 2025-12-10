# Zhilian2025 项目核心模块差异报告 (report1210)

**报告日期**: 2025-12-10
**报告对象**: FrontCode, BackCode, PythonIDS
**对比基准**: 当前生产版本 (Current) vs 原始备份版本 (Old)

---

## 1. 总体概述 (Executive Summary)

经过多日的深度联调与功能扩展，项目已从最初的“基础演示版”进化为“生产就绪版”。本次更新重点解决了**安全性漏洞**、**数据真实性**以及**系统稳定性**三大核心问题。

**主要变更亮点**:
1.  **BackCode**: 新增 `DatabaseAutoUpdater` 实现数据库架构自愈，彻底解决因字段缺失导致的后端崩溃。
2.  **FrontCode**: 移除了登录页面的“后门”兜底逻辑，强制实施真实鉴权；主机监控页面接入真实数据。
3.  **PythonIDS**: 全新引入 `hids_agent` 模块，支持跨平台（Windows/Linux）的磁盘与文件完整性监控。

---

## 2. 模块详细差异分析 (Detailed Module Analysis)

### 2.1 后端模块 (BackCode)

**路径**: `BackCode` (Current) vs `BackCodeold` (Old)

#### 2.1.1 新增核心组件: 数据库自愈器
*   **文件**: `src/main/java/com/yukasl/backcode/config/DatabaseAutoUpdater.java`
*   **状态**: **NEW (新增)**
*   **Old版本**: 不存在。
*   **Current版本**: 
    *   实现了 `CommandLineRunner` 接口，随 Spring Boot 启动自动运行。
    *   **功能**: 自动检测并执行 SQL `ALTER TABLE` 语句，补充缺失的 `disk_usage`, `disk_info`, `file_status` 字段。
    *   **意义**: 实现了“零运维”部署，用户无需手动执行 SQL 脚本即可适配新功能，解决了 `Unknown column` 导致的 500 错误。

#### 2.1.2 实体类扩展: 主机监控
*   **文件**: `src/main/java/com/yukasl/backcode/pojo/entity/hostStatusMonitor.java`
*   **状态**: **MODIFIED (修改)**
*   **Old版本**: 仅包含 `cpuUsage`, `memoryUsage`, `networkConn`。
*   **Current版本**: 新增了以下字段：
    ```java
    private Double diskUsage;   // 磁盘使用率
    private String diskInfo;    // 磁盘详情 (e.g., "50GB / 100GB")
    private String fileStatus;  // 核心文件状态 (JSON字符串)
    ```
*   **解析**: 为 HIDS 的全方位监控提供了数据模型支持。

#### 2.1.3 数据持久层升级
*   **文件**: `MonitorMapper.xml` & `MonitorMapper.java`
*   **状态**: **MODIFIED (修改)**
*   **Old版本**: SQL 语句仅插入/查询 CPU 和内存数据。
*   **Current版本**: 
    *   `INSERT` 语句增加了对磁盘和文件状态字段的支持。
    *   `SELECT` 语句映射了新增的数据库列。
*   **解析**: 确保了 Agent 上报的丰富数据能够被正确写入 MySQL 并在前端查询。

---

### 2.2 前端模块 (FrontCode)

**路径**: `FrontCode` (Current) vs `frontcodeold` (Old)

#### 2.2.1 安全性修复: 登录逻辑
*   **文件**: `src/pages/Login.tsx`
*   **状态**: **CRITICAL FIX (重大修复)**
*   **Old版本**: 
    *   存在严重安全隐患。当后端报错或请求失败时，`catch` 块会执行“兜底逻辑”，设置 `emergency-token` 并**强制允许用户登录**。
    *   代码片段: `localStorage.setItem('auth_token', 'emergency-token'); onLogin();`
*   **Current版本**: 
    *   **彻底移除**了兜底逻辑。
    *   现在仅在 `AuthService.login` 明确返回成功时才允许进入系统。
    *   增加了错误提示 UI，明确告知用户“认证失败”。

#### 2.2.2 功能增强: 主机监控大屏
*   **文件**: `src/pages/HostMonitoring.tsx`
*   **状态**: **ENHANCED (增强)**
*   **Old版本**: 仅展示 CPU/内存波形图，底部数据区域可能为空或仅显示模拟占位符。
*   **Current版本**: 
    *   **真实数据渲染**: 接入了后端返回的 `diskUsage` 和 `fileStatus`。
    *   **动态 UI**: 
        *   增加了磁盘使用率的进度条组件。
        *   增加了文件完整性监控列表，实时显示 `/etc/passwd` 或 `C:\Windows\System32\drivers\etc\hosts` 的修改状态。

---

### 2.3 入侵检测模块 (PythonIDS)

**路径**: `PythonIDS` (Current) vs `PythonIDSold` (Old)

#### 2.3.1 全新子模块: HIDS Agent
*   **目录**: `hids_agent/`
*   **状态**: **NEW MODULE (新模块)**
*   **Current版本**: 包含 `agent.py` 核心探针脚本。
    *   **功能**:
        *   **跨平台适配**: 自动识别 Windows (`C:\`) 和 Linux (`/`) 环境。
        *   **磁盘监控**: 使用 `psutil` 获取根分区使用率。
        *   **文件完整性 (FIM)**: 监控关键系统文件（如 `hosts`, `win.ini`, `/etc/passwd`）的修改时间。
        *   **数据上报**: 每 3 秒向后端发送一次包含完整系统状态的 JSON 数据包。
*   **解析**: 这是实现主机层防御的核心组件，Old 版本缺失此功能意味着无法进行主机监控。

---
