#!/usr/bin/env python3
"""
mini_snort_pro.py - 专业一点的微型入侵检测（签名式）Demo

功能：
- 从 JSON 加载规则：
  {
    "sid": 100001,
    "msg": "HTTP 可疑关键字",
    "protocol": "tcp",        # tcp / udp / ip / any
    "src_ip": "any",          # any / 单IP / CIDR 如 192.168.1.0/24
    "src_port": "any",        # any / 单端口 / 区间 "1000-2000"
    "dst_ip": "any",
    "dst_port": "80",
    "content": "malicious",   # 正则表达式（按 bytes 匹配）
    "severity": 3,            # 1-5，数字越大越严重
    "enabled": true,          # 是否启用
    "tags": ["http", "demo"]  # 任意字符串标签
  }

运行模式：
- 实时抓包（需管理员权限）： --mode live -i eth0 -R rules.json
- 回放 pcap：           --mode pcap -r sample.pcap -R rules.json
- 可选开启 REST API：   --api --api-port 5001 （依赖 Flask）

注意：本项目为教学/演示用途，不用于生产环境替代 Snort/Suricata。
"""

import argparse
import json
import logging
import os
import re
import struct
import time
import ipaddress
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

# -------------------------
# scapy 用于抓包/解析
# -------------------------
from scapy.config import conf as scapy_conf  # 预留高级配置使用
from scapy.layers.inet import IP, TCP, UDP
from scapy.layers.inet6 import IPv6
from scapy.layers.l2 import Ether
from scapy.packet import Raw
from scapy.sendrecv import sniff
from scapy.utils import rdpcap

import requests

# -------------------------
# flask（可选）用于 REST API
# -------------------------
try:
    from flask import Flask, request, jsonify
    _HAS_FLASK = True
except Exception:
    _HAS_FLASK = False

# -------------------------
# 日志配置
# -------------------------
ALERT_LOGFILE = "alerts.log"
ALERT_API_URL = os.environ.get("ALERT_API_URL", "http://127.0.0.1:5000/alerts")
ALERT_API_TIMEOUT = float(os.environ.get("ALERT_API_TIMEOUT", "2.5"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("mini_snort_pro")
def 推送统一告警(payload: Dict[str, Any]):
    if not ALERT_API_URL:
        return
    try:
        resp = requests.post(ALERT_API_URL, json=payload, timeout=ALERT_API_TIMEOUT)
        resp.raise_for_status()
    except Exception as exc:
        logger.debug(f"推送统一告警失败：{exc}")



# -------------------------
# PCAP 构造函数
# -------------------------
def make_pcap(payload: bytes, fname="test_lfi.pcap"):
    # 以太网头
    eth = (
            b'\xaa\xbb\xcc\xdd\xee\xff' +      # 目的MAC
            b'\x11\x22\x33\x44\x55\x66' +      # 源MAC
            struct.pack('!H', 0x0800)          # IPv4 类型
    )

    # IP头
    version_ihl = (4 << 4) + 5
    total_length = 20 + 20 + len(payload)
    ip_header = struct.pack(
        "!BBHHHBBH4s4s",
        version_ihl, 0, total_length,
        1234, 0, 64, 6, 0,
        struct.pack("!4B", 192, 168, 1, 10),
        struct.pack("!4B", 192, 168, 1, 100)
    )

    # TCP头
    tcp_header = struct.pack(
        "!HHLLBBHHH",
        12345, 80, 0, 0,
        (5 << 4), 2, 8192, 0, 0
    )

    # 完整帧
    frame = eth + ip_header + tcp_header + payload

    # PCAP全局头
    gh = struct.pack(
        "IHHIIII",
        0xa1b2c3d4, 2, 4, 0, 0, 65535, 1
    )

    # 数据包头
    ts = int(time.time())
    ph = struct.pack("IIII", ts, 0, len(frame), len(frame))

    with open(fname, "wb") as f:
        f.write(gh + ph + frame)

    print(f"[OK] 已生成PCAP → {fname}")

# -------------------------
# 规则与统计数据结构
# -------------------------
@dataclass
class Rule:
    sid: int
    msg: str
    protocol: str            # 'tcp'/'udp'/'ip'/'any'
    src_ip: str
    src_port: str
    dst_ip: str
    dst_port: str
    content_regex: Optional[re.Pattern] = None
    severity: int = 1        # 1-5
    enabled: bool = True
    tags: List[str] = field(default_factory=list)


@dataclass
class Stats:
    总数据包数: int = 0
    命中告警数: int = 0
    规则命中次数: Dict[int, int] = field(default_factory=dict)

    def 记录命中(self, 命中列表: List[Dict[str, Any]]):
        if not 命中列表:
            return
        self.命中告警数 += 1
        for 命中 in 命中列表:
            sid = 命中["sid"]
            self.规则命中次数[sid] = self.规则命中次数.get(sid, 0) + 1


# -------------------------
# 规则加载
# -------------------------
def 从JSON加载规则(路径: str) -> List[Rule]:
    with open(路径, "r", encoding="utf-8") as f:
        数据 = json.load(f)

    规则列表: List[Rule] = []
    for 规则项 in 数据:
        if not 规则项.get("enabled", True):
            continue

        正则 = None
        内容 = 规则项.get("content")
        if 内容:
            if isinstance(内容, str):
                正则 = re.compile(内容.encode(), re.DOTALL)
            else:
                正则 = re.compile(内容, re.DOTALL)

        规则 = Rule(
            sid=int(规则项.get("sid", 0)),
            msg=规则项.get("msg", ""),
            protocol=规则项.get("protocol", "any").lower(),
            src_ip=规则项.get("src_ip", "any"),
            src_port=str(规则项.get("src_port", "any")),
            dst_ip=规则项.get("dst_ip", "any"),
            dst_port=str(规则项.get("dst_port", "any")),
            content_regex=正则,
            severity=int(规则项.get("severity", 1)),
            enabled=bool(规则项.get("enabled", True)),
            tags=规则项.get("tags", []),
        )
        规则列表.append(规则)

    logger.info(f"从{路径}加载了{len(规则列表)}条有效规则")
    return 规则列表


# -------------------------
# 匹配辅助函数：IP / 端口 / payload
# -------------------------
def 端口匹配(规则端口: str, 数据包端口: Optional[int]) -> bool:
    if 规则端口 == "any":
        return True
    if 数据包端口 is None:
        return False

    try:
        if "-" in 规则端口:
            起始, 结束 = 规则端口.split("-", 1)
            return int(起始) <= 数据包端口 <= int(结束)
        return int(规则端口) == 数据包端口
    except ValueError:
        return False


def IP匹配(规则IP: str, 数据包IP: Optional[str]) -> bool:
    if 规则IP == "any":
        return True
    if 数据包IP is None:
        return False

    try:
        if "/" in 规则IP:
            网络 = ipaddress.ip_network(规则IP, strict=False)
            return ipaddress.ip_address(数据包IP) in 网络
        else:
            return 规则IP == 数据包IP
    except ValueError:
        return 规则IP == 数据包IP


def 提取载荷(数据包) -> bytes:
    try:
        if Raw in 数据包:
            原始载荷 = 数据包[Raw].load
            if isinstance(原始载荷, bytes):
                return 原始载荷
            return str(原始载荷).encode(errors="ignore")
        return b""
    except Exception:
        return b""


# -------------------------
# 核心匹配引擎（纯函数）
# -------------------------
def 匹配数据包(数据包, 规则列表: List[Rule]) -> List[Dict[str, Any]]:
    命中列表: List[Dict[str, Any]] = []

    IP层 = None
    协议 = None
    源IP = 目的IP = None
    源端口 = 目的端口 = None

    if IP in 数据包:
        IP层 = 数据包[IP]
        协议 = "ip"
        源IP = IP层.src
        目的IP = IP层.dst
    elif IPv6 in 数据包:
        IP层 = 数据包[IPv6]
        协议 = "ip"
        源IP = IP层.src
        目的IP = IP层.dst
    else:
        return 命中列表

    if TCP in 数据包:
        协议 = "tcp"
        源端口 = int(数据包[TCP].sport)
        目的端口 = int(数据包[TCP].dport)
    elif UDP in 数据包:
        协议 = "udp"
        源端口 = int(数据包[UDP].sport)
        目的端口 = int(数据包[UDP].dport)

    载荷 = 提取载荷(数据包)

    for 规则 in 规则列表:
        if 规则.protocol != "any" and 规则.protocol != 协议 and not (
                规则.protocol == "ip" and 协议 in ("tcp", "udp", "ip")
        ):
            continue

        if not IP匹配(规则.src_ip, 源IP):
            continue
        if not IP匹配(规则.dst_ip, 目的IP):
            continue
        if not 端口匹配(规则.src_port, 源端口):
            continue
        if not 端口匹配(规则.dst_port, 目的端口):
            continue

        if 规则.content_regex:
            try:
                if not 规则.content_regex.search(载荷):
                    continue
            except re.error:
                try:
                    正则模式 = (
                        规则.content_regex.pattern.decode(errors="ignore")
                        if isinstance(规则.content_regex.pattern, (bytes, bytearray))
                        else str(规则.content_regex.pattern)
                    )
                    if 正则模式.encode() not in 载荷:
                        continue
                except Exception:
                    continue

        命中列表.append(
            {
                "sid": 规则.sid,
                "msg": 规则.msg,
                "规则": 规则,
                "协议": 协议,
                "源IP": 源IP,
                "目的IP": 目的IP,
                "源端口": 源端口,
                "目的端口": 目的端口,
                "载荷": 载荷[:512],
            }
        )

    return 命中列表


# -------------------------
# 告警记录
# -------------------------
def 记录告警(命中: Dict[str, Any], 数据包时间, 日志文件: str = ALERT_LOGFILE):
    try:
        时间戳 = float(数据包时间)
    except Exception:
        时间戳 = time.time()

    时间字符串 = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(时间戳))
    规则: Rule = 命中["规则"]

    告警条目 = {
        "时间戳": 时间字符串,
        "sid": 命中["sid"],
        "告警信息": 命中["msg"],
        "严重程度": 规则.severity,
        "标签": 规则.tags,
        "协议": 命中["协议"],
        "源地址": f"{命中['源IP']}:{命中['源端口']}",
        "目的地址": f"{命中['目的IP']}:{命中['目的端口']}",
        "载荷预览(十六进制)": 命中["载荷"].hex()[:200],
    }

    with open(日志文件, "a", encoding="utf-8") as f:
        f.write(json.dumps(告警条目, ensure_ascii=False) + "\n")

    logger.warning(
        f"[告警][严重程度={告警条目['严重程度']}][规则ID={告警条目['sid']}] "
        f"{告警条目['告警信息']} | {告警条目['源地址']} -> {告警条目['目的地址']} | "
        f"时间={告警条目['时间戳']} | 标签={','.join(告警条目['标签'])}"
    )
    logger.info(f"载荷预览(十六进制)={告警条目['载荷预览(十六进制)']}")

    alert_payload = {
        "engine": "rule",
        "timestamp": 告警条目["时间戳"],
        "attack_type": 告警条目["告警信息"],
        "severity": 告警条目["严重程度"],
        "message": 告警条目["告警信息"],
        "session": 告警条目["源地址"] + " -> " + 告警条目["目的地址"],
        "src_ip": 命中["源IP"],
        "dst_ip": 命中["目的IP"],
        "src_port": 命中["源端口"],
        "dst_port": 命中["目的端口"],
        "protocol": 命中["协议"],
        "tags": 告警条目["标签"],
        "payload_preview": 告警条目["载荷预览(十六进制)"]
    }
    推送统一告警(alert_payload)


# -------------------------
# 引擎类：封装数据包回调 + 统计
# -------------------------
class MiniSnort引擎:
    def __init__(self, 规则列表: List[Rule], 告警日志文件: str = ALERT_LOGFILE):
        self.规则列表 = 规则列表
        self.告警日志文件 = 告警日志文件
        self.统计 = Stats()

    def 处理数据包(self, 数据包):
        self.统计.总数据包数 += 1
        命中列表 = 匹配数据包(数据包, self.规则列表)
        if 命中列表:
            self.统计.记录命中(命中列表)
            数据包时间 = getattr(数据包, "time", time.time())
            for 命中 in 命中列表:
                记录告警(命中, 数据包时间, self.告警日志文件)


# -------------------------
# 运行函数（live / pcap）
# -------------------------
def 运行实时抓包(网卡: str, 规则路径: str, 抓包数量: int = 0, BPF过滤: Optional[str] = None) -> Stats:
    规则列表 = 从JSON加载规则(规则路径)
    引擎 = MiniSnort引擎(规则列表)

    logger.info(
        f"开始在{网卡}上实时抓包 "
        f"(抓包数量={抓包数量 if 抓包数量 else '无限'}, 过滤规则={BPF过滤!r})"
    )

    try:
        sniff(
            iface=网卡,
            prn=引擎.处理数据包,
            store=False,
            count=抓包数量,
            filter=BPF过滤,
        )
    except KeyboardInterrupt:
        logger.info("用户按下Ctrl+C，抓包中断。")

    return 引擎.统计


def 运行PCAP回放(PCAP路径: str, 规则路径: str, 回放延迟: float = 0.0) -> Stats:
    规则列表 = 从JSON加载规则(规则路径)
    引擎 = MiniSnort引擎(规则列表)

    logger.info(f"正在读取PCAP文件 {PCAP路径} ...")
    数据包列表 = rdpcap(PCAP路径)
    logger.info(f"PCAP中共有{len(数据包列表)}个数据包")

    try:
        for 数据包 in 数据包列表:
            引擎.处理数据包(数据包)
            if 回放延迟 > 0:
                time.sleep(回放延迟)
    except KeyboardInterrupt:
        logger.info("用户按下Ctrl+C，PCAP回放中断。")

    return 引擎.统计


# -------------------------
# 简单 Flask API（可选）
# -------------------------
def 启动API(规则路径: str, 主机: str = "0.0.0.0", 端口: int = 5001):
    if not _HAS_FLASK:
        logger.error("未安装Flask，请执行`pip install flask`以使用API功能。")
        return

    app = Flask("mini_snort_api")
    规则列表 = 从JSON加载规则(规则路径)

    @app.route("/规则", methods=["GET"])
    def 获取规则列表():
        return jsonify(
            [
                {
                    "sid": 规则.sid,
                    "告警信息": 规则.msg,
                    "协议": 规则.protocol,
                    "源IP规则": 规则.src_ip,
                    "源端口规则": 规则.src_port,
                    "目的IP规则": 规则.dst_ip,
                    "目的端口规则": 规则.dst_port,
                    "严重程度": 规则.severity,
                    "是否启用": 规则.enabled,
                    "标签": 规则.tags,
                    "内容正则": (
                        规则.content_regex.pattern.decode()
                        if 规则.content_regex
                           and isinstance(规则.content_regex.pattern, (bytes, bytearray))
                        else (规则.content_regex.pattern if 规则.content_regex else "")
                    ),
                }
                for 规则 in 规则列表
            ]
        )

    @app.route("/评分", methods=["POST"])
    def 数据包评分():
        数据包 = request.json or {}
        协议 = 数据包.get("协议", "tcp")
        源IP = 数据包.get("源IP", "0.0.0.0")
        目的IP = 数据包.get("目的IP", "0.0.0.0")
        源端口 = int(数据包.get("源端口") or 0)
        目的端口 = int(数据包.get("目的端口") or 0)
        载荷 = 数据包.get("载荷", "")

        if isinstance(载荷, str):
            载荷 = 载荷.encode(errors="ignore")

        scapy数据包 = IP(src=源IP, dst=目的IP) / TCP(sport=源端口, dport=目的端口) / Raw(load=载荷)
        命中列表 = 匹配数据包(scapy数据包, 规则列表)

        return jsonify(
            {
                "命中数量": len(命中列表),
                "命中详情": [
                    {
                        "sid": 命中["sid"],
                        "告警信息": 命中["msg"],
                        "严重程度": 命中["规则"].severity,
                        "标签": 命中["规则"].tags,
                    }
                    for 命中 in 命中列表
                ],
            }
        )

    @app.route("/告警记录", methods=["GET"])
    def 获取告警记录():
        try:
            with open(ALERT_LOGFILE, "r", encoding="utf-8") as f:
                条目 = f.readlines()[-200:]
            return jsonify([json.loads(行) for 行 in 条目])
        except FileNotFoundError:
            return jsonify([])

    logger.info(f"API服务启动于 {主机}:{端口}")
    app.run(host=主机, port=端口, debug=False)


# -------------------------
# 运行统计打印
# -------------------------
def 打印统计(统计: Stats):
    logger.info("========= mini_snort_pro 检测统计 =========")
    logger.info(f"总数据包数: {统计.总数据包数}")
    logger.info(f"命中告警数:    {统计.命中告警数}")
    if not 统计.规则命中次数:
        logger.info("未生成任何告警。")
        return

    logger.info("各规则命中次数:")
    for sid, 次数 in sorted(统计.规则命中次数.items()):
        logger.info(f"  规则ID {sid}: {次数} 次命中")


# -------------------------
# CLI 入口
# -------------------------
def main():
    解析器 = argparse.ArgumentParser(description="mini_snort_pro - 微型签名式入侵检测演示")
    解析器.add_argument("--mode", choices=["live", "pcap"], default="pcap", help="运行模式: live 或 pcap")
    解析器.add_argument("--interface", "-i", help="网卡 (live 模式需要)")
    解析器.add_argument("--pcap", "-r", help="pcap 文件 (pcap 模式需要)")
    解析器.add_argument("--rules", "-R", required=True, help="规则 JSON 文件路径")
    解析器.add_argument("--count", type=int, default=0, help="抓包数量，0 表示无限 (live 模式)")
    解析器.add_argument("--replay-delay", type=float, default=0.0, help="回放 pcap 时每包延迟 (秒)")
    解析器.add_argument("--bpf", help="BPF 抓包过滤表达式（如 'tcp port 80'）", default=None)
    解析器.add_argument("--api", action="store_true", help="仅开启 REST API (需要 flask)")
    解析器.add_argument("--api-port", type=int, default=5001, help="API 端口")

    参数 = 解析器.parse_args()

    open(ALERT_LOGFILE, "w", encoding="utf-8").close()

    if 参数.api:
        启动API(参数.rules, port=参数.api_port)
        return

    if 参数.mode == "live":
        if not 参数.interface:
            解析器.error("live模式需要指定--interface参数")
        统计 = 运行实时抓包(参数.interface, 参数.rules, 抓包数量=参数.count, BPF过滤=参数.bpf)
    else:
        if not 参数.pcap:
            解析器.error("pcap模式需要指定--pcap参数")
        统计 = 运行PCAP回放(参数.pcap, 参数.rules, 回放延迟=参数.replay_delay)

    打印统计(统计)


if __name__ == "__main__":
    载荷 = b"GET /etc/passwd HTTP/1.1\r\nHost: test\r\n\r\n"
    make_pcap(载荷, fname="test_lfi.pcap")
    main()