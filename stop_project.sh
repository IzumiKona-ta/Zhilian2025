#!/bin/bash

# ==============================================================================
# Zhilian2025 Shutdown Script for Linux
# ==============================================================================

cd "$(dirname "$0")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Stopping Zhilian2025 Services...${NC}"

if [ -f .run.pids ]; then
    while IFS='=' read -r name pid; do
        if [ ! -z "$pid" ] && kill -0 $pid 2>/dev/null; then
            echo -e "Killing $name (PID: $pid)..."
            kill $pid
        else
            echo -e "$name (PID: $pid) is not running."
        fi
    done < .run.pids
    rm .run.pids
    echo -e "${GREEN}All recorded services stopped.${NC}"
else
    echo -e "${RED}No .run.pids file found. Please kill processes manually.${NC}"
    echo "Hint: Try 'pkill -f spring-boot' or 'pkill -f vite'"
fi
