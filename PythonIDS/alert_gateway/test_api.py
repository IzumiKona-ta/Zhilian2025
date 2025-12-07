#!/usr/bin/env python3
"""
测试接口 - 用于后端测试
提供模拟告警数据生成和批量测试功能
"""
import json
import random
import time
from datetime import datetime, timedelta
import requests
from flask import Flask, jsonify, request

app = Flask(__name__)

# 告警网关地址（默认）
ALERT_GATEWAY_URL = "http://127.0.0.1:5000/alerts"

# 攻击类型模板
ATTACK_TYPES = {
    "known": ["DDoS", "SYN Flood", "UDP Flood", "PortScan", "ICMP Flood"],
    "unknown": ["Unknown Attack (UA)", "Suspicious Traffic", "Anomalous Pattern"]
}

# IP地址池
SOURCE_IPS = ["192.168.31.41", "192.168.1.100", "10.0.0.50", "172.16.0.20"]
DEST_IPS = ["192.168.109.151", "192.168.1.1", "10.0.0.1", "172.16.0.1"]

# 端口池
KNOWN_PORTS = [80, 443, 22, 21, 25, 53, 3306, 3389]
UNKNOWN_PORTS = [45000, 45001, 45018, 56000, 57000]

PROTOCOLS = ["TCP", "UDP", "ICMP"]


def generate_test_alert(attack_type=None, is_known=True, severity=None, confidence=None):
    """生成一条测试告警数据"""
    if attack_type is None:
        attack_type = random.choice(ATTACK_TYPES["known" if is_known else "unknown"])
    
    if severity is None:
        severity = random.choice([3, 4, 5])
    
    if confidence is None:
        confidence = round(random.uniform(0.75, 0.98), 2)
    
    src_ip = random.choice(SOURCE_IPS)
    dst_ip = random.choice(DEST_IPS)
    
    if is_known:
        src_port = random.choice([50000, 50001, 50010])
        dst_port = random.choice(KNOWN_PORTS)
    else:
        src_port = random.choice([56000, 57000])
        dst_port = random.choice(UNKNOWN_PORTS)
    
    protocol = random.choice(PROTOCOLS)
    
    # 生成消息
    if is_known:
        message = f"高危告警 - 已知攻击: {attack_type}"
    else:
        real_score = round(random.uniform(-10000, -5000), 2)
        message = f"高危告警 - 未知攻击 (OOD检测, real_score={real_score})"
    
    alert = {
        "engine": "anomaly",
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "attack_type": attack_type,
        "severity": severity,
        "confidence": confidence,
        "message": message,
        "session": f"{src_ip}:{src_port} -> {dst_ip}:{dst_port}",
        "src_ip": src_ip,
        "dst_ip": dst_ip,
        "src_port": src_port,
        "dst_port": dst_port,
        "protocol": protocol
    }
    
    return alert


@app.route("/test/generate", methods=["GET"])
def generate_single_alert():
    """生成单条测试告警（返回JSON，不发送到网关）"""
    attack_type = request.args.get("attack_type")
    is_known = request.args.get("is_known", "true").lower() == "true"
    severity = request.args.get("severity", type=int)
    confidence = request.args.get("confidence", type=float)
    
    alert = generate_test_alert(
        attack_type=attack_type,
        is_known=is_known,
        severity=severity,
        confidence=confidence
    )
    
    return jsonify({
        "status": "success",
        "alert": alert,
        "message": "测试告警数据已生成"
    }), 200


@app.route("/test/send", methods=["POST"])
def send_test_alert():
    """生成并发送单条测试告警到告警网关"""
    try:
        # 从请求中获取参数，如果没有则使用默认值
        data = request.get_json() or {}
        
        attack_type = data.get("attack_type")
        is_known = data.get("is_known", True)
        severity = data.get("severity")
        confidence = data.get("confidence")
        
        alert = generate_test_alert(
            attack_type=attack_type,
            is_known=is_known,
            severity=severity,
            confidence=confidence
        )
        
        # 发送到告警网关
        gateway_url = data.get("gateway_url", ALERT_GATEWAY_URL)
        response = requests.post(
            gateway_url,
            json=alert,
            headers={"Content-Type": "application/json"},
            timeout=2
        )
        
        return jsonify({
            "status": "success",
            "alert": alert,
            "gateway_response": response.json() if response.status_code == 202 else None,
            "gateway_status": response.status_code,
            "message": "测试告警已发送到网关"
        }), 200
        
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


@app.route("/test/batch", methods=["POST"])
def send_batch_alerts():
    """批量生成并发送测试告警"""
    try:
        data = request.get_json() or {}
        
        count = data.get("count", 10)  # 默认10条
        known_ratio = data.get("known_ratio", 0.6)  # 已知攻击比例，默认60%
        gateway_url = data.get("gateway_url", ALERT_GATEWAY_URL)
        delay = data.get("delay", 0.1)  # 每条告警之间的延迟（秒）
        
        results = {
            "total": count,
            "success": 0,
            "failed": 0,
            "alerts": []
        }
        
        for i in range(count):
            is_known = random.random() < known_ratio
            alert = generate_test_alert(is_known=is_known)
            
            try:
                response = requests.post(
                    gateway_url,
                    json=alert,
                    headers={"Content-Type": "application/json"},
                    timeout=2
                )
                
                if response.status_code == 202:
                    results["success"] += 1
                    results["alerts"].append({
                        "index": i + 1,
                        "status": "success",
                        "alert": alert
                    })
                else:
                    results["failed"] += 1
                    results["alerts"].append({
                        "index": i + 1,
                        "status": "failed",
                        "alert": alert,
                        "error": f"Gateway returned {response.status_code}"
                    })
            except Exception as e:
                results["failed"] += 1
                results["alerts"].append({
                    "index": i + 1,
                    "status": "failed",
                    "alert": alert,
                    "error": str(e)
                })
            
            # 延迟
            if delay > 0 and i < count - 1:
                time.sleep(delay)
        
        return jsonify({
            "status": "completed",
            "results": results,
            "message": f"批量测试完成：成功 {results['success']} 条，失败 {results['failed']} 条"
        }), 200
        
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


@app.route("/test/scenarios", methods=["GET"])
def get_test_scenarios():
    """获取测试场景列表"""
    scenarios = {
        "known_attacks": {
            "description": "已知攻击测试",
            "examples": [
                {"attack_type": "DDoS", "severity": 5, "confidence": 0.95},
                {"attack_type": "SYN Flood", "severity": 4, "confidence": 0.90},
                {"attack_type": "PortScan", "severity": 3, "confidence": 0.85}
            ]
        },
        "unknown_attacks": {
            "description": "未知攻击测试",
            "examples": [
                {"attack_type": "Unknown Attack (UA)", "severity": 5, "confidence": 0.90},
                {"attack_type": "Suspicious Traffic", "severity": 4, "confidence": 0.86}
            ]
        },
        "mixed": {
            "description": "混合攻击测试",
            "examples": "生成已知和未知攻击的混合数据"
        }
    }
    
    return jsonify({
        "status": "success",
        "scenarios": scenarios,
        "usage": {
            "generate_single": "GET /test/generate?is_known=true&severity=5",
            "send_single": "POST /test/send with JSON body",
            "send_batch": "POST /test/batch with JSON body: {count: 10, known_ratio: 0.6}"
        }
    }), 200


@app.route("/test/health", methods=["GET"])
def test_health():
    """测试接口健康检查"""
    try:
        # 检查告警网关是否可用
        gateway_url = request.args.get("gateway_url", ALERT_GATEWAY_URL.replace("/alerts", "/health"))
        response = requests.get(gateway_url, timeout=2)
        
        return jsonify({
            "status": "ok",
            "test_api": "running",
            "gateway_status": "connected" if response.status_code == 200 else "disconnected",
            "gateway_info": response.json() if response.status_code == 200 else None
        }), 200
    except Exception as e:
        return jsonify({
            "status": "ok",
            "test_api": "running",
            "gateway_status": "disconnected",
            "error": str(e)
        }), 200


if __name__ == "__main__":
    import os
    
    host = os.environ.get("TEST_API_HOST", "0.0.0.0")
    port = int(os.environ.get("TEST_API_PORT", 5001))
    
    print("="*70)
    print("🧪 测试接口服务启动")
    print("="*70)
    print(f"📍 监听地址: http://{host}:{port}")
    print(f"📋 测试场景: http://127.0.0.1:{port}/test/scenarios")
    print(f"🔍 健康检查: http://127.0.0.1:{port}/test/health")
    print(f"📤 生成告警: GET http://127.0.0.1:{port}/test/generate")
    print(f"📤 发送告警: POST http://127.0.0.1:{port}/test/send")
    print(f"📤 批量测试: POST http://127.0.0.1:{port}/test/batch")
    print("="*70)
    
    try:
        app.run(host=host, port=port, debug=False, threaded=True)
    except KeyboardInterrupt:
        print("\n⏹️  服务已停止")
    except Exception as e:
        print(f"❌ 服务启动失败: {str(e)}")
        import traceback
        traceback.print_exc()

