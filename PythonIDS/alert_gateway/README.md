# IDS告警网关 API

统一接收和展示来自异常检测和规则检测的告警信息。

## 功能特性

- ✅ 接收来自异常检测和规则检测的告警
- ✅ 实时告警仪表板（可视化界面）
- ✅ JSON格式的告警列表
- ✅ 统计信息
- ✅ 自动刷新（每5秒）
- ✅ 支持跨域请求（CORS）

## 快速开始

### 1. 安装依赖

```bash
pip install flask flask-cors
```

### 2. 启动网关

```bash
# Windows PowerShell
python alert_gateway/alert_api.py

# 或 Linux/Mac
python3 alert_gateway/alert_api.py
```

### 3. 访问界面

- **告警仪表板**（推荐）: http://127.0.0.1:5000/dashboard
- **告警列表(JSON)**: http://127.0.0.1:5000/alerts
- **健康检查**: http://127.0.0.1:5000/health
- **统计信息**: http://127.0.0.1:5000/stats

## 配置

通过环境变量配置：

```bash
# Windows PowerShell
$env:ALERT_GATEWAY_HOST = "0.0.0.0"
$env:ALERT_GATEWAY_PORT = "5000"
$env:ALERT_GATEWAY_MAX_ALERTS = "1000"

# Linux/Mac
export ALERT_GATEWAY_HOST=0.0.0.0
export ALERT_GATEWAY_PORT=5000
export ALERT_GATEWAY_MAX_ALERTS=1000
```

## API接口

### 接收告警（POST）

```bash
POST http://127.0.0.1:5000/alerts
Content-Type: application/json

{
  "engine": "anomaly",  # 或 "rule"
  "timestamp": "2024-01-01 12:00:00",
  "attack_type": "SYN Flood",
  "severity": 4,
  "confidence": 0.95,
  "message": "检测到SYN Flood攻击",
  "session": "192.168.1.100:12345 -> 192.168.1.1:80",
  "src_ip": "192.168.1.100",
  "dst_ip": "192.168.1.1",
  "src_port": 12345,
  "dst_port": 80,
  "protocol": "TCP"
}
```

### 获取告警列表（GET）

```bash
GET http://127.0.0.1:5000/alerts?limit=100&engine=anomaly
```

参数：
- `limit`: 返回的告警数量（默认100，最大1000）
- `engine`: 过滤引擎类型（`anomaly` 或 `rule`）

### 获取统计信息（GET）

```bash
GET http://127.0.0.1:5000/stats
```

## 使用流程

1. **启动告警网关**：
   ```bash
   python alert_gateway/alert_api.py
   ```

2. **启动异常检测**（另一个终端）：
   ```bash
   python anomaly_based_ids/realtime_detection_fixed.py
   ```

3. **启动规则检测**（可选，另一个终端）：
   ```bash
   python Snort/mini_snort_pro.py --mode live -i eth0 -R rules.json
   ```

4. **查看告警**：
   打开浏览器访问 http://127.0.0.1:5000/dashboard

## 告警数据格式

告警数据会自动保存到 `alert_gateway/alerts.log` 文件中（JSON格式，每行一条）。

## 注意事项

- 告警数据存储在内存中，重启服务后数据会丢失
- 最大告警数量可通过 `ALERT_GATEWAY_MAX_ALERTS` 环境变量配置
- 告警日志文件会自动创建在 `alert_gateway/alerts.log`


