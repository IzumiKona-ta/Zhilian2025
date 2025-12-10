import time
import psutil
import requests
import json
import socket
import os
import platform

# Configuration
BACKEND_URL = "http://127.0.0.1:8081/api/host/monitor/report"
REPORT_INTERVAL = 3  # seconds

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

HOST_ID = os.environ.get("HOST_IP", get_local_ip())

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
            
            if platform.system() == "Windows":
                # Windows Firewall Block
                rule_name = f"Block_{ip}"
                # Use subprocess to hide output or handle errors better
                subprocess.run(f'netsh advfirewall firewall add rule name="{rule_name}" dir=in action=block remoteip={ip}', shell=True)
                print(f"[+] Firewall rule added for {ip}")
            else:
                # Linux iptables Block
                subprocess.run(f"iptables -A INPUT -s {ip} -j DROP", shell=True)
                print(f"[+] iptables rule added for {ip}")
        
        elif cmd.startswith("UNBLOCK_IP"):
            ip = cmd.split()[1]
            print(f"[!] UNBLOCKING IP: {ip}")

            if platform.system() == "Windows":
                # Windows Firewall Unblock
                rule_name = f"Block_{ip}"
                subprocess.run(f'netsh advfirewall firewall delete rule name="{rule_name}"', shell=True)
                print(f"[+] Firewall rule removed for {ip}")
            else:
                # Linux iptables Unblock
                subprocess.run(f"iptables -D INPUT -s {ip} -j DROP", shell=True)
                print(f"[+] iptables rule removed for {ip}")
                
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
