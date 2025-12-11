import time
import psutil
import requests
import json
import socket
import os
import platform
import os
import json

# Configuration
BACKEND_URL = "http://127.0.0.1:8081/api/host/monitor/report"
REPORT_INTERVAL = 3  # seconds
BLOCKED_IPS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../blocked_ips.json")

def update_blocked_ips(ip, action):
    """
    Update the blocked IPs list in a JSON file.
    action: "add" or "remove"
    """
    try:
        blocked_ips = []
        if os.path.exists(BLOCKED_IPS_FILE):
            with open(BLOCKED_IPS_FILE, "r", encoding="utf-8") as f:
                try:
                    blocked_ips = json.load(f)
                except json.JSONDecodeError:
                    blocked_ips = []
        
        if action == "add":
            if ip not in blocked_ips:
                blocked_ips.append(ip)
        elif action == "remove":
            if ip in blocked_ips:
                blocked_ips.remove(ip)
        
        with open(BLOCKED_IPS_FILE, "w", encoding="utf-8") as f:
            json.dump(blocked_ips, f, indent=4)
            
    except Exception as e:
        print(f"[!] Failed to update blocked IPs file: {e}")


# Get local IP or use a fixed one
def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

def get_all_local_ips():
    ips = set()
    ips.add("127.0.0.1")
    ips.add("localhost")
    ips.add("0.0.0.0")
    ips.add("::1")
    
    try:
        # Use psutil since it's already imported
        for interface, snics in psutil.net_if_addrs().items():
            for snic in snics:
                if snic.family == socket.AF_INET:
                    ips.add(snic.address)
    except:
        pass
        
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ips.add(s.getsockname()[0])
        s.close()
    except:
        pass
    return ips

import ctypes
import sys

def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except:
        return False

HOST_ID = os.environ.get("HOST_IP", get_local_ip())

if platform.system() == "Windows" and not is_admin():
    print("[-] WARNING: This script is NOT running with Administrator privileges!")
    print("[-] Blocking commands (netsh) will likely FAIL.")
    print("[-] Please restart the terminal/CMD as Administrator.")
    time.sleep(3) # Give user time to read

print(f"[*] HIDS Agent started for Host: {HOST_ID}")
print(f"[*] Reporting to: {BACKEND_URL}")

def get_disk_info():
    try:
        # Monitor Root/C: drive
        path = '/' if platform.system() != 'Windows' else 'C:\\'
        usage = psutil.disk_usage(path)
        # Return percentage and detailed string
        return usage.percent, f"{usage.used / (1024**3):.1f} GB / {usage.total / (1024**3):.1f} GB"
    except Exception as e:
        return 0.0, "N/A"

def get_file_status():
    # Simple File Integrity Monitoring (FIM)
    files_to_watch = []
    if platform.system() == "Windows":
        files_to_watch = [
            r"C:\Windows\System32\drivers\etc\hosts",
            r"C:\Windows\win.ini",
            r"C:\Windows\System32\license.rtf" # Usually static
        ]
    else:
        files_to_watch = ["/etc/passwd", "/etc/group", "/usr/bin/sshd"]
    
    status_list = []
    for fpath in files_to_watch:
        try:
            if os.path.exists(fpath):
                mtime = os.path.getmtime(fpath)
                # If modified in last 10 minutes, mark as Modified
                is_modified = (time.time() - mtime) < 600
                status_list.append({
                    "path": fpath,
                    "status": "Modified" if is_modified else "Normal",
                    "lastMod": time.strftime('%Y-%m-%d %H:%M', time.localtime(mtime))
                })
            else:
                status_list.append({"path": fpath, "status": "Missing", "lastMod": "-"})
        except:
            status_list.append({"path": fpath, "status": "Access Denied", "lastMod": "-"})
            
    return json.dumps(status_list)

def collect_metrics():
    # CPU
    cpu_usage = psutil.cpu_percent(interval=1)
    
    # Memory
    mem = psutil.virtual_memory()
    mem_usage = mem.percent
    
    # Network Connections (Count established)
    try:
        net_connections = len(psutil.net_connections(kind='inet'))
    except:
        net_connections = 0
        
    # Disk & Files
    disk_usage, disk_info = get_disk_info()
    file_status = get_file_status()

    return {
        "hostId": HOST_ID,
        "cpuUsage": cpu_usage,
        "memoryUsage": mem_usage,
        "networkConn": net_connections,
        "diskUsage": disk_usage,
        "diskInfo": disk_info,
        "fileStatus": file_status
    }

import subprocess

def execute_command(cmd):
    try:
        print(f"[*] Received command: {cmd}")
        if cmd.startswith("BLOCK_IP"):
            ip = cmd.split()[1]
            print(f"[!] BLOCKING IP: {ip}")
            
            # --- SAFETY CHECK: Whitelist Critical IPs ---
            local_ips = get_all_local_ips()
            
            if ip in local_ips:
                print(f"[-] SAFETY TRIGGERED: Cannot block critical/local IP {ip}!")
                print("[-] This would disconnect the Agent from the Backend and break system services.")
                return
            # --------------------------------------------

            if platform.system() == "Windows":
                # Windows Firewall Block
                rule_name = f"Block_{ip}"
                # netsh advfirewall firewall add rule name="Block_1.2.3.4" dir=in action=block remoteip=1.2.3.4 profile=any
                full_cmd = f'netsh advfirewall firewall add rule name="{rule_name}" dir=in action=block remoteip={ip} profile=any'
                
                # Using text=False (default) to avoid UnicodeDecodeError on Windows with GBK/CP936 output
                res = subprocess.run(full_cmd, shell=True, capture_output=True)
                
                # Manual decoding
                try:
                    stdout = res.stdout.decode('gbk', errors='replace')
                    stderr = res.stderr.decode('gbk', errors='replace')
                except:
                    stdout = res.stdout.decode('utf-8', errors='replace')
                    stderr = res.stderr.decode('utf-8', errors='replace')

                if res.returncode == 0:
                    print(f"[+] Firewall rule added successfully: {stdout.strip()}")
                    update_blocked_ips(ip, "add")
                else:
                    print(f"[-] FAILED to add firewall rule: {stderr.strip()}")

            else:
                # Linux iptables Block
                full_cmd = f"iptables -A INPUT -s {ip} -j DROP"
                res = subprocess.run(full_cmd, shell=True, capture_output=True, text=True)
                if res.returncode == 0:
                    print(f"[+] iptables rule added successfully")
                    update_blocked_ips(ip, "add")
                else:
                    print(f"[-] FAILED to add iptables rule: {res.stderr.strip()}")
        
        elif cmd.startswith("UNBLOCK_IP"):
            ip = cmd.split()[1]
            print(f"[!] UNBLOCKING IP: {ip}")

            if platform.system() == "Windows":
                # Windows Firewall Unblock
                # Method 1: Try deleting by name "Block_{ip}"
                rule_name = f"Block_{ip}"
                cmd1 = f'netsh advfirewall firewall delete rule name="{rule_name}"'
                
                # Method 2: Force delete ALL rules for this RemoteIP (Fix for stuck rules)
                # This ensures that even if the rule name is different, the IP is unblocked.
                cmd2 = f'netsh advfirewall firewall delete rule name=all remoteip={ip}'

                print(f"[*] Executing unblock commands for {ip}...")
                
                # Execute Method 1
                subprocess.run(cmd1, shell=True, capture_output=True)
                
                # Execute Method 2 (Stronger guarantee)
                res = subprocess.run(cmd2, shell=True, capture_output=True)
                
                # Check result of Method 2 as primary indicator
                try:
                    stdout = res.stdout.decode('gbk', errors='replace')
                    stderr = res.stderr.decode('gbk', errors='replace')
                except:
                    stdout = res.stdout.decode('utf-8', errors='replace')
                    stderr = res.stderr.decode('utf-8', errors='replace')

                if res.returncode == 0 or "没有" in stdout or "No rules" in stdout:
                    # Success or already gone
                    print(f"[+] Firewall rule removed successfully: {stdout.strip()}")
                    update_blocked_ips(ip, "remove")
                else:
                    print(f"[-] FAILED to remove firewall rule: {stderr.strip()}")

            else:
                # Linux iptables Unblock
                full_cmd = f"iptables -D INPUT -s {ip} -j DROP"
                res = subprocess.run(full_cmd, shell=True, capture_output=True, text=True)
                if res.returncode == 0:
                     print(f"[+] iptables rule removed successfully")
                     update_blocked_ips(ip, "remove")
                else:
                     print(f"[-] FAILED to remove iptables rule: {res.stderr.strip()}")
                
    except Exception as e:
        print(f"[!] Command execution failed: {e}")

def main():
    print(f"[*] Waiting for backend at {BACKEND_URL}...")
    while True:
        try:
            metrics = collect_metrics()
            headers = {'Content-Type': 'application/json'}
            response = requests.post(BACKEND_URL, data=json.dumps(metrics), headers=headers, timeout=5)
            
            if response.status_code == 200:
                print(f"[+] Reported: CPU={metrics['cpuUsage']}% MEM={metrics['memoryUsage']}% NET={metrics['networkConn']}")
                
                # Check for commands
                try:
                    data = response.json()
                    if isinstance(data, dict) and data.get("data") and isinstance(data["data"], dict):
                         # Result<Map> format: {code:1, data: {status:..., commands: [...]}}
                         inner_data = data["data"]
                         if "commands" in inner_data:
                             for cmd in inner_data["commands"]:
                                 execute_command(cmd)
                except Exception as json_err:
                    pass # Not a JSON response or invalid format
                    
            else:
                print(f"[-] Failed to report: {response.status_code} - {response.text}")
                
        except requests.exceptions.ConnectionError:
            print(f"[*] Backend not ready. Retrying in {REPORT_INTERVAL}s...")
        except Exception as e:
            print(f"[!] Error: {e}")
            
        time.sleep(REPORT_INTERVAL)

if __name__ == "__main__":
    main()
