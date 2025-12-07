@echo off
chcp 65001 >nul
echo ========================================
echo 🚀 快速启动告警网关
echo ========================================
echo.

REM 停止可能存在的旧进程
echo 🔍 检查端口占用...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do (
    echo    发现进程 %%a，正在停止...
    taskkill /F /PID %%a >nul 2>&1
)

timeout /t 2 /nobreak >nul

REM 启动网关（切换至5000端口）
set ALERT_GATEWAY_PORT=5000
echo.
echo ✅ 启动网关服务...
echo.
REM 获取脚本所在目录的父目录（项目根目录）
cd /d "%~dp0\.."
python alert_gateway\alert_api.py

pause

