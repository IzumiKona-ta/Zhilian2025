#!/bin/bash

# ==============================================================================
# Zhilian2025 Unified Launcher for Linux
# ==============================================================================

# Ensure script is run from its directory
cd "$(dirname "$0")"
PROJECT_ROOT=$(pwd)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}==============================================================================${NC}"
echo -e "${BLUE}"
echo "    YY   YY  UU   UU  LL      II   AA    NN   NN   2222   0000   2222   55555"
echo "     YY YY   UU   UU  LL      II  AAAA   NNN  NN  2    2 0    0 2    2  5"
echo "      YYY    UU   UU  LL      II AA  AA  NN N NN      2  0    0     2   5555"
echo "       Y     UU   UU  LL      II AAAAAA  NN  NNN    2    0    0   2        5 "
echo "       Y      UUUUU   LLLLLL  II AA  AA  NN   NN  22222   0000  22222  55555"
echo -e "${BLUE}"
echo "                          Cyber Security Platform 2025"
echo "                             Linux Deployment Script"
echo -e "${BLUE}"
echo -e "${BLUE}==============================================================================${NC}"
echo ""

# Create logs directory
mkdir -p logs

# ==============================================================================
# 0. Environment Check
# ==============================================================================
echo -e "${YELLOW}[INFO] Checking Environment Prerequisites...${NC}"

check_cmd() {
    if ! command -v "$1" &> /dev/null; then
        echo -e "${RED}[ERROR] $1 is not installed or not in PATH.${NC}"
        return 1
    else
        echo -e "${GREEN}[OK] $1 found.${NC}"
        return 0
    fi
}

EXIT_FLAG=0
check_cmd java || EXIT_FLAG=1
check_cmd mvn || EXIT_FLAG=1
check_cmd npm || EXIT_FLAG=1
check_cmd python3 || EXIT_FLAG=1
check_cmd docker || EXIT_FLAG=1
check_cmd docker-compose || echo -e "${YELLOW}[WARN] docker-compose not found (might be needed for Fabric).${NC}"

if [ $EXIT_FLAG -eq 1 ]; then
    echo -e "${RED}Please install missing dependencies and try again.${NC}"
    exit 1
fi

# ==============================================================================
# 1. Start Blockchain Infrastructure
# ==============================================================================
echo ""
echo -e "${YELLOW}[1/5] Blockchain Infrastructure Setup${NC}"
echo -e "${RED}[WARNING] Deploying the blockchain network will RESET the ledger data!${NC}"
read -p "Do you want to (re)deploy the Hyperledger Fabric Network? (y/N): " DEPLOY_CHAIN

if [[ "$DEPLOY_CHAIN" =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}[INFO] Starting Hyperledger Fabric Network...${NC}"
    
    # Ensure scripts have execution permissions
    chmod +x Zhilian_Install_Package/scripts/*.sh
    chmod +x Zhilian_Install_Package/fabric-network/*.sh
    chmod +x Zhilian_Install_Package/fabric-network/scripts/*.sh
    
    # Run infrastructure script
    ./Zhilian_Install_Package/scripts/start_infra.sh
else
    echo -e "${BLUE}[INFO] Skipping blockchain network deployment.${NC}"
fi

# ==============================================================================
# 2. Start Blockchain Middleware (Java)
# ==============================================================================
echo ""
echo -e "${YELLOW}[2/5] Launching Blockchain Middleware (Port: 8080)...${NC}"
cd backend
nohup mvn spring-boot:run > ../logs/middleware.log 2>&1 &
MIDDLEWARE_PID=$!
echo -e "${GREEN}Middleware started with PID $MIDDLEWARE_PID. Logs: logs/middleware.log${NC}"
cd "$PROJECT_ROOT"

# ==============================================================================
# 3. Start Backend Application (Java)
# ==============================================================================
echo ""
echo -e "${YELLOW}[3/5] Launching Backend Application (Port: 8081)...${NC}"
cd BackCode
nohup mvn spring-boot:run > ../logs/backcode.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}Backend started with PID $BACKEND_PID. Logs: logs/backcode.log${NC}"
cd "$PROJECT_ROOT"

# ==============================================================================
# 4. Start Frontend Dashboard
# ==============================================================================
echo ""
echo -e "${YELLOW}[4/5] Launching Frontend Dashboard (Port: 5173)...${NC}"
cd FrontCode
echo "Installing frontend dependencies..."
npm install > ../logs/frontend_install.log 2>&1
nohup npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}Frontend started with PID $FRONTEND_PID. Logs: logs/frontend.log${NC}"
cd "$PROJECT_ROOT"

# ==============================================================================
# 5. Start IDS Engines & Agents
# ==============================================================================
echo ""
echo -e "${YELLOW}[5/5] Launching Security Engines...${NC}"

# Install Python dependencies
echo "Installing Python dependencies..."
pip3 install -r PythonIDS/requirements.txt > logs/python_deps.log 2>&1

# ML IDS Engine
echo -e "${YELLOW}Starting ML IDS Engine...${NC}"
nohup python3 PythonIDS/anomaly_based_ids/realtime_detection_fixed.py > logs/ml_ids.log 2>&1 &
IDS_PID=$!
echo -e "${GREEN}ML IDS Engine started with PID $IDS_PID. Logs: logs/ml_ids.log${NC}"

# HIDS Agent (needs root)
echo -e "${YELLOW}Starting HIDS Agent...${NC}"
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[WARN] HIDS Agent usually requires root privileges to manipulate iptables.${NC}"
  echo -e "${RED}       Please run: sudo python3 PythonIDS/hids_agent/agent.py manually if needed.${NC}"
else
  nohup python3 PythonIDS/hids_agent/agent.py > logs/hids_agent.log 2>&1 &
  HIDS_PID=$!
  echo -e "${GREEN}HIDS Agent started with PID $HIDS_PID. Logs: logs/hids_agent.log${NC}"
fi


# ==============================================================================
# Summary
# ==============================================================================
echo ""
echo -e "${BLUE}==============================================================================${NC}"
echo -e "${GREEN}All Services Launched!${NC}"
echo -e "Service Dashboard:"
echo -e " - Frontend:   http://localhost:5173"
echo -e " - Backend:    http://localhost:8081"
echo -e " - Middleware: http://localhost:8080"
echo ""
echo -e "Logs are available in the ${YELLOW}logs/${NC} directory."
echo -e "To stop all services, run: ${YELLOW}./stop_project.sh${NC} (You need to create this or kill PIDs manually)"
echo -e "${BLUE}==============================================================================${NC}"

# Save PIDs to file for stopping later
echo "MIDDLEWARE_PID=$MIDDLEWARE_PID" > .run.pids
echo "BACKEND_PID=$BACKEND_PID" >> .run.pids
echo "FRONTEND_PID=$FRONTEND_PID" >> .run.pids
echo "IDS_PID=$IDS_PID" >> .run.pids
if [ ! -z "$HIDS_PID" ]; then
    echo "HIDS_PID=$HIDS_PID" >> .run.pids
fi

