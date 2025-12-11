import os
import sys
import subprocess
import ctypes

def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except:
        return False

def add_allow_rule(ip):
    rule_name = f"Allow_Test_Attacker_{ip}"
    
    print(f"[*] Cleaning up ALL existing rules for {ip} (to remove potential blocks)...")
    
    # 1. 关键步骤：强制删除针对该 IP 的所有规则（无论 Allow 还是 Block）
    # 这能解决“阻止规则优先级高于允许规则”导致的问题
    del_all_cmd = f'netsh advfirewall firewall delete rule name=all remoteip={ip}'
    res_del = subprocess.run(del_all_cmd, shell=True, capture_output=True)
    
    # 打印清理结果
    try:
        stdout_del = res_del.stdout.decode('gbk', errors='replace')
        if "已删除" in stdout_del or "Deleted" in stdout_del:
            print(f"    [+] Cleaned up old rules: {stdout_del.strip()}")
        else:
            print(f"    [-] No old rules found or cleanup silent.")
    except:
        pass
    
    # 2. 添加新的允许规则
    # protocol=any ensures ping (ICMP) and all TCP/UDP attacks work
    cmd = f'netsh advfirewall firewall add rule name="{rule_name}" dir=in action=allow remoteip={ip} protocol=any profile=any'
    
    print(f"[*] Executing: {cmd}")
    res = subprocess.run(cmd, shell=True, capture_output=True)
    
    try:
        stdout = res.stdout.decode('gbk', errors='replace')
    except:
        stdout = res.stdout.decode('utf-8', errors='replace')
        
    if res.returncode == 0:
        print(f"[+] Successfully allowed IP {ip} in Windows Firewall.")
        print(f"    Your roommate ({ip}) should now be able to ping and attack you.")
        print(f"    NOTE: If still failing, check if your router has 'AP Isolation' enabled.")
    else:
        print(f"[-] Failed to add rule: {stdout}")

if __name__ == "__main__":
    if not is_admin():
        print("[-] This script requires Administrator privileges to modify Firewall rules.")
        # Re-run with admin
        ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, " ".join(sys.argv), None, 1)
        sys.exit()
        
    if len(sys.argv) > 1:
        ip = sys.argv[1]
    else:
        print("Please enter your roommate's IP address (the attacker's IP).")
        ip = input("Attacker IP: ").strip()
        
    if not ip:
        print("[-] IP cannot be empty.")
    else:
        add_allow_rule(ip)
        input("\nPress Enter to exit...")
