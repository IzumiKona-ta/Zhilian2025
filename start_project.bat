@echo off
cd /d "%~dp0"
chcp 65001 >nul
title Zhilian2025 Unified Launcher
color 0B

echo ==============================================================================
echo.
echo     YY   YY  UU   UU  LL      II   AA    NN   NN   2222   0000   2222   55555
echo      YY YY   UU   UU  LL      II  AAAA   NNN  NN  2    2 0    0 2    2  5
echo       YYY    UU   UU  LL      II AA  AA  NN N NN      2  0    0     2   5555
echo        Y     UU   UU  LL      II AAAAAA  NN  NNN    2    0    0   2        5 
echo        Y      UUUUU   LLLLLL  II AA  AA  NN   NN  22222   0000  22222  55555
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
echo [1/5] Blockchain Infrastructure Setup
echo.
echo [WARNING] Deploying the blockchain network will RESET the ledger data!
echo.
set /p DEPLOY_CHAIN="Do you want to (re)deploy the Hyperledger Fabric Network? (Y/N): "
if /i "%DEPLOY_CHAIN%"=="Y" (
    echo [INFO] Starting Hyperledger Fabric Network via WSL...
    echo        Please ensure Docker Desktop is running.
    wsl -e bash ./Zhilian_Install_Package/scripts/start_infra.sh
) else (
    echo [INFO] Skipping blockchain network deployment.
)

:: ==============================================================================
:: 2. Start Blockchain Middleware (Java)
:: ==============================================================================
echo [2/5] Launching Blockchain Middleware...
echo       - Port: 8080
echo       - Service: Smart Contract Interface
start "Backend Blockchain" /min /D "%~dp0\backend" cmd /k "mvn spring-boot:run && echo 'Middleware stopped. Press Enter to exit...' && pause"

:: ==============================================================================
:: 3. Start Backend Application (Java)
:: ==============================================================================
echo [3/5] Launching Backend Application...
echo       - Port: 8081
echo       - Service: Threat Analysis & API
start "BackCode" /min /D "%~dp0\BackCode" cmd /k "mvn spring-boot:run && echo 'Backend stopped. Press Enter to exit...' && pause"

:: ==============================================================================
:: 4. Start Frontend Dashboard (Vue/React + Vite)
:: ==============================================================================
echo [4/5] Launching Frontend Dashboard...
echo       - Port: 5173
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
start /wait /min /D "%~dp0" cmd /c "pip install -r PythonIDS/requirements.txt"

echo       - Starting Anomaly Detection Engine (ML IDS)...
start "ML IDS Engine" /D "%~dp0" cmd /k "title ML IDS Engine && python PythonIDS/anomaly_based_ids/realtime_detection_fixed.py"

echo       - Starting HIDS Agent (Host Monitor) [Requesting Admin Privileges]...
powershell -Command "Start-Process cmd -ArgumentList '/k chcp 65001 && title HIDS Agent && cd /d \"%~dp0.\" && python PythonIDS/hids_agent/agent.py' -Verb RunAs"

:: Optional Rule Based IDS
:: start "Rule IDS" /D "%~dp0" cmd /k "title Rule Based IDS && python RuleBasedIDS/mini_snort_pro.py"

echo.
echo ==============================================================================
echo.

echo.
echo Service Dashboard:
echo  - Frontend:   http://localhost:5173 (or as shown in Frontend window)
echo  - Backend:    http://localhost:8081
echo  - Middleware: http://localhost:8080 (Verify port in application.yml)
echo.
echo Please check each terminal window for specific logs or errors.
echo DO NOT CLOSE this window unless you want to stop the orchestration context.
echo.
echo ==============================================================================
pause
