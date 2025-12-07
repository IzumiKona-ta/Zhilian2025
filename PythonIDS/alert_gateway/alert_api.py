#!/usr/bin/env python3
"""
统一告警网关 API - 重构版
接收来自异常检测和规则检测的告警，提供查看接口
"""
import json
import os
import time
from pathlib import Path
from threading import Lock
from flask import Flask, jsonify, request, render_template_string

# 尝试导入CORS（可选）
try:
    from flask_cors import CORS
    HAS_CORS = True
except ImportError:
    HAS_CORS = False
    print("[提示] flask-cors未安装，跨域请求可能受限（通常不影响本地使用）")

# ========== 配置 ==========
# 移除告警数量限制，使用列表存储所有告警
LOG_DIR = Path(os.environ.get("ALERT_GATEWAY_LOG_DIR", "alert_gateway"))
LOG_FILE = LOG_DIR / "alerts.log"
LOG_DIR.mkdir(parents=True, exist_ok=True)

# ========== 全局存储 ==========
# 使用列表而不是deque，不限制告警数量
alerts = []
lock = Lock()

# ========== Flask应用 ==========
app = Flask(__name__)
if HAS_CORS:
    CORS(app)  # 允许跨域请求

def save_alert(alert_data: dict):
    """保存告警到内存和日志文件"""
    try:
        with lock:
            alerts.append(alert_data)
            alert_count = len(alerts)
        
        # 异步写入日志（不阻塞）
        try:
            with LOG_FILE.open("a", encoding="utf-8") as f:
                f.write(json.dumps(alert_data, ensure_ascii=False) + "\n")
        except Exception as e:
            print(f"[警告] 日志写入失败: {e}")
        
        return alert_count
    except Exception as e:
        print(f"[错误] 保存告警失败: {e}")
        raise

@app.route("/", methods=["GET"])
def index():
    """首页 - 重定向到告警页面"""
    return f"""
    <html>
    <head><meta charset="utf-8"><title>IDS告警网关</title></head>
    <body style="font-family: Arial; margin: 40px;">
        <h1>🚨 IDS告警网关</h1>
        <p><a href="/alerts">查看告警列表 (JSON)</a></p>
        <p><a href="/dashboard">告警仪表板 (可视化)</a></p>
        <p><a href="/health">健康检查</a></p>
    </body>
    </html>
    """

@app.route("/health", methods=["GET"])
def health():
    """健康检查"""
    return jsonify({
        "status": "ok",
        "alerts_count": len(alerts),
        "max_alerts": "无限制",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
    }), 200

@app.route("/alerts", methods=["POST"])
def receive_alert():
    """接收告警（异常检测和规则检测都会调用）"""
    try:
        # 解析JSON数据
        if request.is_json:
            data = request.get_json() or {}
        else:
            try:
                data = json.loads(request.data.decode('utf-8')) if request.data else {}
            except (json.JSONDecodeError, UnicodeDecodeError):
                data = {}
        
        # 安全地转换类型
        try:
            severity = int(data.get("severity", 1))
        except (ValueError, TypeError):
            severity = 1
        
        try:
            confidence = float(data.get("confidence", 0.0))
        except (ValueError, TypeError):
            confidence = 0.0
        
        try:
            src_port = int(data.get("src_port", 0))
        except (ValueError, TypeError):
            src_port = 0
        
        try:
            dst_port = int(data.get("dst_port", 0))
        except (ValueError, TypeError):
            dst_port = 0
        
        # 处理时间戳
        timestamp = data.get("timestamp")
        if not timestamp or not timestamp.strip():
            timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        
        # 设置默认值
        alert = {
            "engine": str(data.get("engine", "unknown")),
            "timestamp": str(timestamp),
            "attack_type": str(data.get("attack_type", "Unknown")),
            "severity": severity,
            "confidence": confidence,
            "message": str(data.get("message", "")),
            "session": str(data.get("session", "-")),
            "src_ip": str(data.get("src_ip", "")),
            "dst_ip": str(data.get("dst_ip", "")),
            "src_port": src_port,
            "dst_port": dst_port,
            "protocol": str(data.get("protocol", "")),
        }
        
        # 保存告警
        alert_id = save_alert(alert)
        
        print(f"[网关] ✅ 告警 #{alert_id}: {alert['engine']} - {alert['attack_type']} - {alert['message']}")
        
        return jsonify({
            "status": "accepted",
            "alert_id": alert_id,
            "message": "告警已接收"
        }), 202
        
    except Exception as e:
        print(f"[网关] ❌ 处理告警失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 202  # 返回202避免客户端重试

@app.route("/alerts", methods=["GET"])
def get_alerts():
    """获取告警列表（JSON格式）"""
    # 移除limit限制，显示所有告警
    try:
        limit = int(request.args.get("limit", 0))  # 默认0表示无限制
        if limit <= 0:
            limit = None
    except (ValueError, TypeError):
        limit = None
    
    engine_filter = request.args.get("engine", "").lower()
    
    with lock:
        if limit:
            recent = list(alerts)[-limit:]
        else:
            recent = list(alerts)
    
    # 按时间倒序
    recent = list(reversed(recent))
    
    # 过滤引擎类型
    if engine_filter:
        recent = [a for a in recent if a.get("engine", "").lower() == engine_filter]
    
    return jsonify({
        "total": len(recent),
        "alerts": recent
    }), 200

@app.route("/attack-details", methods=["GET"])
def attack_details():
    """攻击详情页面 - 显示各种攻击类型的详细统计"""
    with lock:
        all_alerts = list(alerts)
    
    # 按攻击类型分组统计
    attack_stats = {}
    for alert in all_alerts:
        attack_type = alert.get("attack_type", "Unknown")
        if attack_type not in attack_stats:
            attack_stats[attack_type] = {
                "count": 0,
                "severity_levels": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
                "avg_confidence": [],
                "sources": set(),
                "targets": set(),
                "protocols": {},
            }
        
        stats = attack_stats[attack_type]
        stats["count"] += 1
        stats["severity_levels"][alert.get("severity", 1)] += 1
        if alert.get("confidence"):
            stats["avg_confidence"].append(alert.get("confidence"))
        stats["sources"].add(f"{alert.get('src_ip', '-')}:{alert.get('src_port', '-')}")
        stats["targets"].add(f"{alert.get('dst_ip', '-')}:{alert.get('dst_port', '-')}")
        
        protocol = alert.get("protocol", "Unknown")
        stats["protocols"][protocol] = stats["protocols"].get(protocol, 0) + 1
    
    # 计算平均置信度
    for attack_type, stats in attack_stats.items():
        if stats["avg_confidence"]:
            stats["avg_confidence"] = sum(stats["avg_confidence"]) / len(stats["avg_confidence"])
        else:
            stats["avg_confidence"] = 0
        stats["sources"] = len(stats["sources"])
        stats["targets"] = len(stats["targets"])
    
    # 按数量排序
    sorted_attacks = sorted(attack_stats.items(), key=lambda x: x[1]["count"], reverse=True)
    
    # 攻击类型中文描述
    attack_descriptions = {
        "DDoS": "分布式拒绝服务",
        "DoS_Hulk": "Hulk拒绝服务攻击",
        "DoS_GoldenEye": "GoldenEye拒绝服务",
        "PortScan": "端口扫描",
        "WebAttack": "Web应用攻击",
        "BruteForce": "暴力破解",
        "Infiltration": "渗透攻击",
        "Bot": "僵尸网络",
        "Unknown Attack (UA)": "未知异常流量",
        "Benign": "正常流量"
    }
    
    html_template = """
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>攻击详情分析</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');

            :root {
                --neon-blue: #00f3ff;
                --neon-pink: #ff00ff;
                --neon-yellow: #f3ff00;
                --neon-red: #ff003c;
                --bg-color: #0a0e27;
                --card-bg: rgba(15, 20, 45, 0.85);
            }

            * { margin: 0; padding: 0; box-sizing: border-box; }

            body {
                font-family: 'Share Tech Mono', 'Courier New', monospace;
                background: linear-gradient(135deg, #0a0e27 0%, #1a1535 50%, #0f1b3d 100%);
                color: var(--neon-blue);
                padding: 20px;
                min-height: 100vh;
            }

            .header {
                border: 2px solid var(--neon-blue);
                background: rgba(10, 20, 50, 0.9);
                padding: 25px;
                margin-bottom: 30px;
                box-shadow: 0 0 20px rgba(0, 243, 255, 0.3);
            }

            .header h1 {
                font-size: 42px;
                letter-spacing: 3px;
                text-shadow: 3px 3px 0px var(--neon-pink), 0 0 15px var(--neon-blue);
            }

            .back-btn {
                display: inline-block;
                margin-top: 15px;
                padding: 10px 20px;
                background: transparent;
                color: var(--neon-blue);
                border: 2px solid var(--neon-blue);
                text-decoration: none;
                transition: all 0.3s;
            }

            .back-btn:hover {
                background: var(--neon-blue);
                color: #000;
                box-shadow: 0 0 20px var(--neon-blue);
            }

            .attack-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }

            .attack-card {
                background: var(--card-bg);
                border: 2px solid rgba(255, 255, 255, 0.15);
                padding: 20px;
                transition: all 0.3s;
            }

            .attack-card:hover {
                transform: translateY(-3px);
                box-shadow: 0 0 30px rgba(0, 243, 255, 0.4);
                border-color: var(--neon-blue);
            }

            .attack-card h2 {
                color: var(--neon-pink);
                font-size: 24px;
                margin-bottom: 15px;
                text-shadow: 0 0 10px var(--neon-pink);
            }

            .stat-row {
                display: flex;
                justify-content: space-between;
                padding: 10px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }

            .stat-label {
                color: rgba(255, 255, 255, 0.6);
            }

            .stat-value {
                color: #fff;
                font-weight: bold;
            }

            .severity-bar {
                display: flex;
                gap: 5px;
                margin-top: 10px;
            }

            .severity-segment {
                height: 20px;
                transition: all 0.3s;
            }

            .detail-btn {
                display: block;
                width: 100%;
                margin-top: 20px;
                padding: 10px;
                background: transparent;
                color: var(--neon-blue);
                border: 2px solid var(--neon-blue);
                font-family: inherit;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.3s;
                text-decoration: none;
                text-align: center;
            }

            .detail-btn:hover {
                background: var(--neon-blue);
                color: #000;
                box-shadow: 0 0 15px var(--neon-blue);
            }

            .severity-segment:hover {
                opacity: 0.8;
            }

            .sev-1 { background: #0f0; }
            .sev-2 { background: #9f0; }
            .sev-3 { background: var(--neon-yellow); }
            .sev-4 { background: #ff9900; }
            .sev-5 { background: var(--neon-red); }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>攻击详情分析</h1>
            <a href="/dashboard" class="back-btn">← 返回仪表板</a>
        </div>

        <div class="attack-grid">
            {% for attack_type, stats in attacks %}
            <div class="attack-card">
                <h2>
                    {{ attack_type }}
                    <span style="font-size: 16px; color: rgba(255,255,255,0.6); margin-left: 10px; font-weight: normal;">
                        ({{ descriptions.get(attack_type, "未知类型") }})
                    </span>
                </h2>
                
                <div class="stat-row">
                    <span class="stat-label">总数量</span>
                    <span class="stat-value">{{ stats.count }}</span>
                </div>
                
                <div class="stat-row">
                    <span class="stat-label">平均置信度</span>
                    <span class="stat-value">{{ "%.2f"|format(stats.avg_confidence) }}</span>
                </div>
                
                <div class="stat-row">
                    <span class="stat-label">源地址数</span>
                    <span class="stat-value">{{ stats.sources }}</span>
                </div>
                
                <div class="stat-row">
                    <span class="stat-label">目标地址数</span>
                    <span class="stat-value">{{ stats.targets }}</span>
                </div>
                
                <div class="stat-row">
                    <span class="stat-label">主要协议</span>
                    <span class="stat-value">
                        {% for proto, count in stats.protocols.items() %}
                            {{ proto }}({{ count }}){% if not loop.last %}, {% endif %}
                        {% endfor %}
                    </span>
                </div>
                
                <div style="margin-top: 15px;">
                    <div class="stat-label">严重度分布</div>
                    <div class="severity-bar">
                        {% for level in [1, 2, 3, 4, 5] %}
                            {% set count = stats.severity_levels[level] %}
                            {% if count > 0 %}
                                <div class="severity-segment sev-{{ level }}" 
                                     style="flex: {{ count }};" 
                                     title="等级{{ level }}: {{ count }}次">
                                </div>
                            {% endif %}
                        {% endfor %}
                    </div>
                </div>
                
                <a href="/attack-type/{{ attack_type }}" class="detail-btn">[ 查看详细 ]</a>
            </div>
            {% endfor %}
        </div>
    </body>
    </html>
    """
    
    return render_template_string(html_template, attacks=sorted_attacks, descriptions=attack_descriptions)

@app.route("/attack-type/<attack_type>", methods=["GET"])
def attack_type_detail(attack_type):
    """显示特定攻击类型的详细告警记录"""
    with lock:
        all_alerts = list(alerts)
    
    # 过滤出指定攻击类型的告警
    filtered_alerts = [a for a in all_alerts if a.get("attack_type") == attack_type]
    filtered_alerts = list(reversed(filtered_alerts))  # 最新的在前
    
    html_template = """
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>{{ attack_type }} - 详细记录</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');

            :root {
                --neon-blue: #00f3ff;
                --neon-pink: #ff00ff;
                --neon-yellow: #f3ff00;
                --neon-red: #ff003c;
            }

            * { margin: 0; padding: 0; box-sizing: border-box; }

            body {
                font-family: 'Share Tech Mono', 'Courier New', monospace;
                background: linear-gradient(135deg, #0a0e27 0%, #1a1535 50%, #0f1b3d 100%);
                color: var(--neon-blue);
                padding: 20px;
                min-height: 100vh;
            }

            .header {
                border: 2px solid var(--neon-blue);
                background: rgba(10, 20, 50, 0.9);
                padding: 25px;
                margin-bottom: 30px;
                box-shadow: 0 0 20px rgba(0, 243, 255, 0.3);
            }

            .header h1 {
                font-size: 36px;
                color: var(--neon-pink);
                text-shadow: 3px 3px 0px var(--neon-blue), 0 0 15px var(--neon-pink);
                margin-bottom: 10px;
            }

            .back-btn {
                display: inline-block;
                margin-top: 15px;
                padding: 10px 20px;
                background: transparent;
                color: var(--neon-blue);
                border: 2px solid var(--neon-blue);
                text-decoration: none;
                transition: all 0.3s;
            }

            .back-btn:hover {
                background: var(--neon-blue);
                color: #000;
                box-shadow: 0 0 20px var(--neon-blue);
            }

            table {
                width: 100%;
                border-collapse: collapse;
                background: rgba(10, 15, 35, 0.8);
                border: 2px solid rgba(0, 243, 255, 0.4);
            }

            th {
                background: rgba(0, 243, 255, 0.1);
                color: #00f3ff;
                padding: 16px;
                text-align: left;
                font-size: 17px;
                font-weight: 600;
                border-bottom: 2px solid var(--neon-blue);
            }

            td {
                padding: 12px 15px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                color: #fff;
                font-size: 14px;
            }

            tr:hover td {
                background: rgba(0, 243, 255, 0.05);
                color: var(--neon-blue);
            }

            .badge {
                padding: 5px 12px;
                font-size: 12px;
                border: 1px solid currentColor;
            }

            .badge-anomaly { color: var(--neon-pink); }
            .badge-rule { color: var(--neon-blue); }

            .severity-1, .severity-2 { color: #0f0; }
            .severity-3 { color: var(--neon-yellow); }
            .severity-4, .severity-5 { color: var(--neon-red); font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>{{ attack_type }}</h1>
            <p>共 {{ total }} 条告警记录</p>
            <a href="/attack-details" class="back-btn">← 返回攻击详情</a>
        </div>

        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>来源</th>
                    <th>时间</th>
                    <th>源地址</th>
                    <th>目标地址</th>
                    <th>协议</th>
                    <th>等级</th>
                    <th>置信度</th>
                    <th>详细信息</th>
                </tr>
            </thead>
            <tbody>
                {% if filtered_alerts %}
                    {% for alert in filtered_alerts %}
                    <tr>
                        <td style="color: rgba(255,255,255,0.3)">#{{ loop.index }}</td>
                        <td>
                            <span class="badge {% if alert.get('engine') == 'anomaly' %}badge-anomaly{% else %}badge-rule{% endif %}">
                                {% if alert.get('engine') == 'anomaly' %}AI模型{% else %}规则库{% endif %}
                            </span>
                        </td>
                        <td>{{ alert.get('timestamp', '-') }}</td>
                        <td>{{ alert.get('src_ip', '-') }}:{{ alert.get('src_port', '-') }}</td>
                        <td>{{ alert.get('dst_ip', '-') }}:{{ alert.get('dst_port', '-') }}</td>
                        <td>{{ alert.get('protocol', '-') }}</td>
                        <td class="severity-{{ alert.get('severity', 1) }}">LV.{{ alert.get('severity', 1) }}</td>
                        <td>{{ "%.2f"|format(alert.get('confidence', 0)) }}</td>
                        <td>{{ alert.get('message', '-') }}</td>
                    </tr>
                    {% endfor %}
                {% else %}
                    <tr>
                        <td colspan="9" style="text-align: center; padding: 40px; color: rgba(255,255,255,0.3);">暂无数据</td>
                    </tr>
                {% endif %}
            </tbody>
        </table>
    </body>
    </html>
    """
    
    return render_template_string(html_template, attack_type=attack_type, filtered_alerts=filtered_alerts, total=len(filtered_alerts))

@app.route("/dashboard", methods=["GET"])
def dashboard():
    """告警仪表板（可视化界面）"""
    # 移除limit限制，显示所有告警
    try:
        limit = int(request.args.get("limit", 0))  # 默认0表示无限制
        if limit <= 0:
            limit = None
    except (ValueError, TypeError):
        limit = None
    
    with lock:
        if limit:
            recent = list(alerts)[-limit:]
        else:
            recent = list(alerts)
    
    recent = list(reversed(recent))
    
    # 统计信息 - 使用所有告警进行统计
    with lock:
        all_alerts = list(alerts)
    
    stats = {
        "total": len(all_alerts),
        # 异常匹配：统计所有由基于异常IDS（AI模型）检测到的告警
        "anomaly": sum(1 for a in all_alerts if a.get("engine") == "anomaly"),
        # 规则匹配：统计所有由基于规则IDS检测到的告警（目前为0）
        "rule": sum(1 for a in all_alerts if a.get("engine") == "rule"),
        # 高危威胁：仅统计最高等级（Lv.5）的威胁
        "severity_high": sum(1 for a in all_alerts if a.get("severity", 0) >= 5),
    }
    
    html_template = """
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>IDS // CYBER_WATCH</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');

            :root {
                --neon-blue: #00f3ff;
                --neon-pink: #ff00ff;
                --neon-yellow: #f3ff00;
                --neon-red: #ff003c;
                --bg-color: #0a0e27;
                --card-bg: rgba(15, 20, 45, 0.85);
                --grid-color: rgba(0, 243, 255, 0.15);
            }

            * { margin: 0; padding: 0; box-sizing: border-box; }

            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', Arial, sans-serif;
                background: linear-gradient(135deg, #0a0e27 0%, #1a1535 50%, #0f1b3d 100%);
                color: #00f3ff;
                padding: 20px;
                background-attachment: fixed;
                min-height: 100vh;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
                font-size: 16px;
            }

            /* 网格背景 */
            body::after {
                content: "";
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-image: 
                    linear-gradient(var(--grid-color) 1px, transparent 1px),
                    linear-gradient(90deg, var(--grid-color) 1px, transparent 1px);
                background-size: 40px 40px;
                pointer-events: none;
                z-index: 0;
            }

            /* 扫描线效果 */
            body::before {
                content: "";
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.15) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03));
                z-index: 999;
                background-size: 100% 2px, 3px 100%;
                pointer-events: none;
            }

            .header {
                border: 2px solid var(--neon-blue);
                background: rgba(10, 20, 50, 0.9);
                padding: 25px;
                margin-bottom: 30px;
                position: relative;
                box-shadow: 0 0 20px rgba(0, 243, 255, 0.3), inset 0 0 20px rgba(0, 243, 255, 0.1);
                display: flex;
                justify-content: space-between;
                align-items: center;
                z-index: 1;
            }

            .header::before {
                content: "系统状态: 在线";
                position: absolute;
                top: -10px;
                right: 20px;
                background: var(--bg-color);
                padding: 0 10px;
                font-size: 12px;
                color: var(--neon-pink);
                border: 1px solid var(--neon-pink);
            }

            .header h1 {
                font-size: 48px;
                font-weight: 700;
                letter-spacing: 2px;
                margin: 0;
                text-shadow: 2px 2px 0px rgba(255, 0, 255, 0.8);
                color: #00f3ff;
            }

            .header p {
                color: rgba(255, 255, 255, 0.9);
                font-size: 16px;
                margin-top: 8px;
                font-weight: 400;
            }

            .stats {
                display: flex;
                gap: 25px;
                margin-bottom: 30px;
                flex-wrap: wrap;
                z-index: 1;
                position: relative;
            }

            .stat-card {
                background: var(--card-bg);
                border: 2px solid rgba(255, 255, 255, 0.15);
                padding: 25px;
                flex: 1;
                min-width: 220px;
                position: relative;
                overflow: hidden;
                transition: all 0.3s ease;
                box-shadow: 0 0 15px rgba(0, 0, 0, 0.5);
            }

            .stat-card:hover {
                transform: translateY(-3px);
                box-shadow: 0 0 30px rgba(0, 243, 255, 0.4);
                border-color: var(--neon-blue);
            }

            .stat-card::after {
                content: "";
                position: absolute;
                top: 0;
                right: 0;
                width: 20px;
                height: 20px;
                background: linear-gradient(135deg, transparent 50%, var(--neon-blue) 50%);
                opacity: 0.5;
            }

            .stat-card h3 {
                color: rgba(255, 255, 255, 0.85);
                font-size: 15px;
                font-weight: 600;
                margin-bottom: 15px;
                text-transform: uppercase;
                letter-spacing: 1.5px;
            }
            
            .stat-card .value {
                font-size: 56px;
                font-weight: 700;
                color: #ffffff;
                text-shadow: 0 0 8px rgba(0, 243, 255, 0.6);
                line-height: 1.2;
            }

            .stat-card.anomaly { border-left: 4px solid var(--neon-pink); }
            .stat-card.anomaly .value { color: var(--neon-pink); text-shadow: 0 0 10px var(--neon-pink); }
            
            .stat-card.rule { border-left: 4px solid var(--neon-yellow); }
            .stat-card.rule .value { color: var(--neon-yellow); text-shadow: 0 0 10px var(--neon-yellow); }
            
            .stat-card.severity { border-left: 4px solid var(--neon-red); }
            .stat-card.severity .value { color: var(--neon-red); text-shadow: 0 0 10px var(--neon-red); }

            .refresh-btn {
                background: transparent;
                color: #00f3ff;
                border: 2px solid #00f3ff;
                padding: 16px 45px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                font-size: 18px;
                font-weight: 600;
                cursor: pointer;
                text-transform: uppercase;
                letter-spacing: 3px;
                transition: all 0.3s;
                margin-bottom: 25px;
                position: relative;
                overflow: hidden;
                z-index: 1;
            }

            .refresh-btn:hover {
                background: var(--neon-blue);
                color: #000;
                box-shadow: 0 0 20px var(--neon-blue);
            }
            
            .refresh-btn[style*="neon-pink"]:hover {
                background: var(--neon-pink) !important;
                color: #000 !important;
                box-shadow: 0 0 20px var(--neon-pink) !important;
            }

            .table-container {
                border: 2px solid rgba(0, 243, 255, 0.4);
                background: rgba(10, 15, 35, 0.8);
                position: relative;
                z-index: 1;
                box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
            }

            .table-container::before {
                content: "实时数据流";
                position: absolute;
                top: -10px;
                left: 20px;
                background: var(--bg-color);
                padding: 0 10px;
                font-size: 12px;
                color: rgba(255, 255, 255, 0.5);
            }

            table {
                width: 100%;
                border-collapse: collapse;
                font-size: 16px;
                table-layout: fixed;
            }

            th {
                text-align: left;
                padding: 18px 12px;
                color: rgba(255, 255, 255, 0.6);
                border-bottom: 2px solid var(--neon-blue);
                text-transform: uppercase;
                font-size: 15px;
                letter-spacing: 1px;
                white-space: nowrap;
            }

            /* 列宽控制 */
            th:nth-child(1), td:nth-child(1) { width: 5%; }  /* 编号 */
            th:nth-child(2), td:nth-child(2) { width: 8%; }  /* 来源 */
            th:nth-child(3), td:nth-child(3) { width: 8%; }  /* 时间 */
            th:nth-child(4), td:nth-child(4) { width: 12%; } /* 攻击类型 */
            th:nth-child(5), td:nth-child(5) { width: 14%; } /* 源地址 */
            th:nth-child(6), td:nth-child(6) { width: 14%; } /* 目标地址 */
            th:nth-child(7), td:nth-child(7) { width: 6%; }  /* 协议 */
            th:nth-child(8), td:nth-child(8) { width: 6%; }  /* 等级 */
            th:nth-child(9), td:nth-child(9) { width: 7%; }  /* 置信度 */
            th:nth-child(10), td:nth-child(10) { width: 20%; } /* 详细信息 */

            td {
                padding: 14px 16px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                color: #ffffff;
                font-size: 15px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            tr:hover td {
                background: rgba(0, 243, 255, 0.05);
                color: var(--neon-blue);
            }

            .badge {
                padding: 6px 14px;
                font-size: 13px;
                font-weight: 600;
                text-transform: uppercase;
                border: 1px solid currentColor;
                letter-spacing: 1px;
            }

            .badge-anomaly { color: var(--neon-pink); box-shadow: 0 0 5px var(--neon-pink); }
            .badge-rule { color: var(--neon-blue); box-shadow: 0 0 5px var(--neon-blue); }

            .severity-1, .severity-2 { color: #0f0; }
            .severity-3 { color: var(--neon-yellow); }
            .severity-4, .severity-5 { 
                color: var(--neon-red); 
                font-weight: bold;
                animation: blink 1s infinite;
            }

            @keyframes blink {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
            }

            .empty {
                text-align: center;
                padding: 50px;
                color: rgba(255, 255, 255, 0.3);
                font-style: italic;
            }
            
            /* 滚动条样式 */
            ::-webkit-scrollbar { width: 8px; }
            ::-webkit-scrollbar-track { background: #000; }
            ::-webkit-scrollbar-thumb { background: var(--neon-blue); }
        </style>
    </head>
    <body>
        <div class="header">
            <div>
                <h1>入侵检测系统 // 网络监控</h1>
                <p>网络安全协议 V2.0 // 运行中</p>
            </div>
            <div style="text-align: right; font-size: 12px; color: var(--neon-yellow);">
                <p>系统时间: <span id="clock">--:--:--</span></p>
                <p>CPU负载: 正常</p>
            </div>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <h3>总事件数</h3>
                <div class="value">{{ stats.total }}</div>
            </div>
            <div class="stat-card anomaly">
                <h3>异常匹配</h3>
                <div class="value">{{ stats.anomaly }}</div>
            </div>
            <div class="stat-card rule">
                <h3>规则匹配</h3>
                <div class="value">{{ stats.rule }}</div>
            </div>
            <div class="stat-card severity">
                <h3>高危威胁</h3>
                <div class="value">{{ stats.severity_high }}</div>
            </div>
        </div>
        
        <div style="display: flex; gap: 15px; margin-bottom: 20px;">
            <button class="refresh-btn" onclick="location.reload()">[ 刷新数据 ]</button>
            <button class="refresh-btn" onclick="location.href='/attack-details'" style="background: rgba(255, 0, 255, 0.1); border-color: var(--neon-pink); color: var(--neon-pink);">[ 攻击详情分析 ]</button>
        </div>
        
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>编号</th>
                        <th>来源</th>
                        <th>时间</th>
                        <th>攻击类型</th>
                        <th>源地址</th>
                        <th>目标地址</th>
                        <th>协议</th>
                        <th>等级</th>
                        <th>置信度</th>
                        <th>详细信息</th>
                    </tr>
                </thead>
                <tbody>
                    {% if recent %}
                        {% for alert in recent %}
                        <tr>
                            <td style="color: rgba(255,255,255,0.3)">#{{ loop.index }}</td>
                            <td>
                                <span class="badge {% if alert.get('engine') == 'anomaly' %}badge-anomaly{% else %}badge-rule{% endif %}">
                                    {% if alert.get('engine') == 'anomaly' %}AI模型{% else %}规则库{% endif %}
                                </span>
                            </td>
                            <td style="font-size: 14px">{{ alert.get('timestamp', '-').split(' ')[1] }}</td>
                            <td><strong style="color: #fff">{% if alert.get('attack_type') == 'Unknown Attack (UA)' %}未知攻击{% else %}{{ alert.get('attack_type', 'Unknown') }}{% endif %}</strong></td>
                            <td>{{ alert.get('src_ip', '-') }}:{{ alert.get('src_port', '-') }}</td>
                            <td>{{ alert.get('dst_ip', '-') }}:{{ alert.get('dst_port', '-') }}</td>
                            <td>{{ alert.get('protocol', '-') }}</td>
                            <td class="severity-{{ alert.get('severity', 1) }}">LV.{{ alert.get('severity', 1) }}</td>
                            <td>{{ "%.2f"|format(alert.get('confidence', 0)) if alert.get('confidence') else "-" }}</td>
                            <td>{{ alert.get('message', '') }}</td>
                        </tr>
                        {% endfor %}
                    {% else %}
                        <tr>
                            <td colspan="10" class="empty">未检测到威胁 // 系统安全</td>
                        </tr>
                    {% endif %}
                </tbody>
            </table>
        </div>
        
        <script>
            // 时钟更新
            function updateClock() {
                const now = new Date();
                document.getElementById('clock').innerText = now.toLocaleTimeString();
            }
            setInterval(updateClock, 1000);
            updateClock();

            // 自动刷新
            setTimeout(function() {
                location.reload();
            }, 5000);
        </script>
    </body>
    </html>
    """
    
    return render_template_string(html_template, recent=recent, stats=stats)

@app.route("/stats", methods=["GET"])
def get_stats():
    """获取统计信息"""
    with lock:
        all_alerts = list(alerts)
    
    stats = {
        "total": len(all_alerts),
        "by_engine": {},
        "by_severity": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
        "recent_24h": 0,
    }
    
    current_time = time.time()
    for alert in all_alerts:
        # 按引擎统计
        engine = alert.get("engine", "unknown")
        stats["by_engine"][engine] = stats["by_engine"].get(engine, 0) + 1
        
        # 按严重度统计
        severity = alert.get("severity", 1)
        if severity in stats["by_severity"]:
            stats["by_severity"][severity] += 1
    
    return jsonify(stats), 200

if __name__ == "__main__":
    host = os.environ.get("ALERT_GATEWAY_HOST", "0.0.0.0")
    port = int(os.environ.get("ALERT_GATEWAY_PORT", 5000))
    
    print("="*70)
    print("🚀 IDS告警网关服务启动")
    print("="*70)
    print(f"📍 监听地址: http://{host}:{port}")
    print(f"📊 告警仪表板: http://127.0.0.1:{port}/dashboard")
    print(f"📋 告警列表(JSON): http://127.0.0.1:{port}/alerts")
    print(f"❤️  健康检查: http://127.0.0.1:{port}/health")
    print(f"📤 接收告警: POST http://127.0.0.1:{port}/alerts")
    print("="*70)
    
    try:
        app.run(host=host, port=port, debug=False, threaded=True)
    except KeyboardInterrupt:
        print("\n⏹️  服务已停止")
    except Exception as e:
        print(f"❌ 服务启动失败: {str(e)}")
        import traceback
        traceback.print_exc()

