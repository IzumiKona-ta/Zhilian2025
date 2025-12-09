@echo off
chcp 65001 >nul
title Zhilian2025 Unified Launcher
color 0B

echo ==============================================================================
echo.
echo      ZZZZZZ  HH   HH  II  LL      II   AA    NN   NN   2222   0000   2222   55555
echo         ZZ   HH   HH  II  LL      II  AAAA   NNN  NN  2    2 0    0 2    2  5    
echo       ZZ     HHHHHHH  II  LL      II AA  AA  NN N NN      2  0    0     2   5555 
echo      ZZ      HH   HH  II  LL      II AAAAAA  NN  NNN    2    0    0   2        5 
echo      ZZZZZZ  HH   HH  II  LLLLLL  II AA  AA  NN   NN  22222   0000  22222  55555 
echo.
echo                          Cyber Security Platform 2025
echo                             One-Click Deployment
echo.
echo ==============================================================================
echo.

:: ==============================================================================
:: 0. Environment Check
:: ==============================================================================
echo [INFO] Checking Environment Prerequisites...

where wsl >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] WSL ^(Windows Subsystem for Linux^) is not found in PATH.
    echo         Please install WSL to run the Blockchain infrastructure.
    pause
    exit /b 1
) else (
    echo [OK] WSL found.
)

where java >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Java ^(JDK^) is not found in PATH.
    echo         Please install JDK 17+ and add it to PATH.
    pause
    exit /b 1
) else (
    echo [OK] Java found.
)

where mvn >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Maven is not found in PATH.
    echo         Please install Maven and add it to PATH.
    pause
    exit /b 1
) else (
    echo [OK] Maven found.
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js ^(npm^) is not found in PATH.
    echo         Please install Node.js LTS and add it to PATH.
    pause
    exit /b 1
) else (
    echo [OK] Node.js ^(npm^) found.
)

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not found in PATH.
    echo         Please install Python 3.8+ and add it to PATH.
    pause
    exit /b 1
) else (
    echo [OK] Python found.
)

echo.
echo [INFO] All prerequisites checked. Starting deployment sequence...
echo.

:: ==============================================================================
:: 1. Start Blockchain Infrastructure (WSL)
:: ==============================================================================
echo [1/5] Launching Blockchain Infrastructure (WSL)...
echo       - FISCO BCOS Node (start_infra.sh)
echo       - WeBASE Front (start_webase.sh if applicable)
@REM 测试环境先不进行区块链网络启动，因为会导致重置
@REM start "Blockchain Infra (WSL)" /D "%~dp0\backend\script" wsl bash -c "./start_infra.sh; ./start_webase.sh; read -p 'Press Enter to close...' "

:: Wait for blockchain to initialize (approx 10s)
echo       Waiting for blockchain to initialize (10s)...
timeout /t 5 /nobreak >nul

:: ==============================================================================
:: 2. Start Blockchain Middleware (Java Spring Boot)
:: ==============================================================================
echo [2/5] Launching Blockchain Middleware...
echo       - Connects to FISCO BCOS
echo       - Provides REST API for Chain Data
start "Blockchain Middleware" /min /D "%~dp0\backend" wsl bash -c "mvn spring-boot:run; echo 'Middleware stopped. Press Enter to exit...'; read"

:: ==============================================================================
:: 3. Start Business Backend (Java Spring Boot)
:: ==============================================================================
echo [3/5] Launching Business Backend (BackCode)...
echo       - Core Business Logic
echo       - Database Connection (MySQL/Redis)
start "Business Backend" /min /D "%~dp0\BackCode" cmd /k "title Business Backend && mvn spring-boot:run"

:: ==============================================================================
:: 4. Start Frontend (Vite + React)
:: ==============================================================================
echo [4/5] Launching Frontend Dashboard...
echo       - Installing dependencies (if needed)...
echo       - Starting Dev Server...
start "Frontend Dashboard" /D "%~dp0\FrontCode" cmd /k "title Frontend Dashboard && echo Installing dependencies... && npm install && echo Starting Vite Server... && npm run dev"

:: ==============================================================================
:: 5. Start IDS Engines & Agents (Python)
:: ==============================================================================
echo [5/5] Launching Security Engines...
echo       - Installing Python dependencies...

:: Install Python deps globally (or create venv if preferred, but keeping it simple for now)
echo       (Installing requirements.txt in background...)
start /wait /min cmd /c "pip install -r PythonIDS/requirements.txt"

echo       - Starting Anomaly Detection Engine (ML IDS)...
start "ML IDS Engine" /D "%~dp0" cmd /k "title ML IDS Engine && python PythonIDS/anomaly_based_ids/realtime_detection_fixed.py"

echo       - Starting HIDS Agent (Host Monitor)...
start "HIDS Agent" /D "%~dp0" cmd /k "title HIDS Agent && python PythonIDS/hids_agent/agent.py"

:: Optional Rule Based IDS
:: start "Rule IDS" /D "%~dp0" cmd /k "title Rule Based IDS && python RuleBasedIDS/mini_snort_pro.py"

echo.
echo ==============================================================================
echo.
echo [SUCCESS] All systems have been commanded to start.
echo.
echo Service Dashboard:
echo  - Frontend:   http://localhost:5173 (or as shown in Frontend window)
echo  - Backend:    http://localhost:8080
echo  - Middleware: http://localhost:8081 (Verify port in application.yml)
echo.
echo Please check each terminal window for specific logs or errors.
echo DO NOT CLOSE this window unless you want to stop the orchestration context.
echo.
echo ==============================================================================
pause
