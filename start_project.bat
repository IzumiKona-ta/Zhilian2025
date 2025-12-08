@echo off
chcp 65001
echo ========================================================
echo        Zhilian2025 One-Click Start Script
echo ========================================================
echo.

:: 1. Start Blockchain Infrastructure
echo [1/4] Starting Blockchain Infrastructure (Backen)...
start "Backen Infra" /D "%~dp0\backend\script" wsl bash start_infra.sh
timeout /t 10

echo [1/4] Starting Blockchain Middleware (Spring Boot)...
start "Backen App" /D "%~dp0\backend" wsl mvn spring-boot:run

:: 2. Start Business Backend
echo [2/4] Starting Business Backend (BackCode)...
start "Backnode App" /D "%~dp0\BackCode" mvn spring-boot:run

:: 3. Start Frontend
echo [3/4] Starting Frontend (FrontCode)...
start "Frontend App" /D "%~dp0\FrontCode" cmd /c "npm install && npm run dev"

:: 4. Start IDS Engines (Optional, manual start recommended for observation)
echo [4/4] IDS Engines are ready.
echo To start ML IDS:    python PythonIDS/anomaly_based_ids/realtime_detection_fixed.py
echo To start Rule IDS:  python RuleBasedIDS/mini_snort_pro.py
echo.
echo ========================================================
echo All services are launching in separate windows.
echo Please check individual windows for logs/errors.
echo ========================================================
pause
