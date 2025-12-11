
import socket

def is_private_ip(ip_str):
    try:
        from ipaddress import ip_address, IPv4Address
        ip = ip_address(ip_str)
        if not isinstance(ip, IPv4Address):
            return False
        
        if ip.is_private or ip.is_loopback:
            return True
        
        parts = ip_str.split('.')
        if len(parts) != 4:
            return False
        
        first = int(parts[0])
        second = int(parts[1])
        
        if first == 10:
            return True
        if first == 172 and 16 <= second <= 31:
            return True
        if first == 192 and second == 168:
            return True
        if first == 127:
            return True
        
        return False
    except:
        return False

print(f"192.168.31.88 private? {is_private_ip('192.168.31.88')}")
print(f"192.168.31.87 private? {is_private_ip('192.168.31.87')}")
