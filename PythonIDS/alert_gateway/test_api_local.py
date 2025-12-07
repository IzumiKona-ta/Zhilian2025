#!/usr/bin/env python3
"""
本地测试脚本 - 测试test_api接口
"""
import requests
import time

def test_test_api():
    """测试test_api接口"""
    
    print("="*70)
    print("🧪 开始测试 test_api 接口")
    print("="*70)
    
    base_url = "http://127.0.0.1:5001"
    gateway_url = "http://127.0.0.1:5000"
    
    # 1. 检查测试接口健康状态
    print("\n1️⃣ 检查测试接口健康状态...")
    try:
        response = requests.get(f"{base_url}/test/health", timeout=2)
        if response.status_code == 200:
            print("✅ 测试接口运行正常")
            print(f"   响应: {response.json()}")
        else:
            print(f"❌ 测试接口异常，状态码: {response.status_code}")
            return
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到测试接口，请确保 test_api.py 已启动（端口5001）")
        return
    except Exception as e:
        print(f"❌ 错误: {e}")
        return
    
    # 2. 生成单条告警（不发送）
    print("\n2️⃣ 生成单条告警数据（不发送到网关）...")
    try:
        response = requests.get(f"{base_url}/test/generate?is_known=true&severity=5", timeout=2)
        if response.status_code == 200:
            data = response.json()
            print("✅ 告警数据生成成功")
            print(f"   攻击类型: {data['alert']['attack_type']}")
            print(f"   严重度: {data['alert']['severity']}")
            print(f"   置信度: {data['alert']['confidence']}")
        else:
            print(f"❌ 生成失败，状态码: {response.status_code}")
    except Exception as e:
        print(f"❌ 错误: {e}")
    
    # 3. 发送单条告警到网关
    print("\n3️⃣ 发送单条告警到告警网关...")
    try:
        response = requests.post(
            f"{base_url}/test/send",
            json={"attack_type": "DDoS", "severity": 5, "confidence": 0.95},
            timeout=2
        )
        if response.status_code == 200:
            data = response.json()
            print("✅ 告警已发送到网关")
            print(f"   网关响应: {data.get('gateway_response', {})}")
        else:
            print(f"❌ 发送失败，状态码: {response.status_code}")
    except Exception as e:
        print(f"❌ 错误: {e}")
    
    # 4. 批量测试（发送10条告警）
    print("\n4️⃣ 批量测试（发送50条告警）...")
    try:
        response = requests.post(
            f"{base_url}/test/batch",
            json={"count": 50, "known_ratio": 0.6, "delay": 0.1},
            timeout=30
        )
        if response.status_code == 200:
            result = response.json()["results"]
            print("✅ 批量测试完成")
            print(f"   总数: {result['total']}")
            print(f"   成功: {result['success']} 条")
            print(f"   失败: {result['failed']} 条")
        else:
            print(f"❌ 批量测试失败，状态码: {response.status_code}")
    except Exception as e:
        print(f"❌ 错误: {e}")
    
    # 5. 检查告警网关的告警数量
    print("\n5️⃣ 检查告警网关的告警数量...")
    try:
        response = requests.get(f"{gateway_url}/alerts", timeout=2)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ 告警网关当前有 {data['total']} 条告警")
        else:
            print(f"❌ 查询失败，状态码: {response.status_code}")
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到告警网关，请确保 alert_api.py 已启动（端口5000）")
    except Exception as e:
        print(f"❌ 错误: {e}")
    
    # 6. 检查告警网关统计信息
    print("\n6️⃣ 检查告警网关统计信息...")
    try:
        response = requests.get(f"{gateway_url}/stats", timeout=2)
        if response.status_code == 200:
            stats = response.json()
            print("✅ 统计信息:")
            print(f"   总告警数: {stats['total']}")
            print(f"   异常检测: {stats['by_engine'].get('anomaly', 0)}")
            print(f"   规则检测: {stats['by_engine'].get('rule', 0)}")
            print(f"   严重度5: {stats['by_severity'].get(5, 0)}")
        else:
            print(f"❌ 查询失败，状态码: {response.status_code}")
    except Exception as e:
        print(f"❌ 错误: {e}")
    
    print("\n" + "="*70)
    print("✅ 测试完成！")
    print("="*70)
    print("\n📊 查看告警仪表板:")
    print(f"   {gateway_url}/dashboard")
    print("\n💡 提示:")
    print("   - 如果告警数量为0，请确保 alert_api.py 已启动")
    print("   - 如果测试接口无法连接，请确保 test_api.py 已启动")
    print("="*70)

if __name__ == "__main__":
    try:
        test_test_api()
    except KeyboardInterrupt:
        print("\n\n⏹️  测试已中断")
    except Exception as e:
        print(f"\n❌ 测试出错: {e}")
        import traceback
        traceback.print_exc()

