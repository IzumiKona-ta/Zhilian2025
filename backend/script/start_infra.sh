#!/bin/bash
# ==============================================================================
# 区块链基础设施启动脚本 (CouchDB版)
# 功能：自动修复、启动网络(带Web界面)、生成配置文件、部署合约
# ==============================================================================

# 1. 环境变量
export PATH=$HOME/hyperledger/fabric-samples/bin:$PATH
export FABRIC_CFG_PATH=$HOME/hyperledger/fabric-samples/config/

# 2. 修复 Fabric 打包脚本
PACKAGE_SCRIPT="../test-network/scripts/packageCC.sh"
if [ -f "$PACKAGE_SCRIPT" ]; then
    cat << 'SCRIPT_EOF' > "$PACKAGE_SCRIPT"
#!/bin/bash
source scripts/utils.sh
CC_NAME=${1}; CC_SRC_PATH=${2}; CC_SRC_LANGUAGE=${3}; CC_VERSION=${4}
CC_PACKAGE_PATH=${5:-"${CC_NAME}.tar.gz"}
println "Packaging chaincode..."
peer lifecycle chaincode package ${CC_PACKAGE_PATH} --path ${CC_SRC_PATH} --lang java --label ${CC_NAME}_${CC_VERSION} >&log.txt
res=$?
cat log.txt
verifyResult $res "Chaincode packaging has failed"
successln "Chaincode is packaged"
SCRIPT_EOF
    chmod +x "$PACKAGE_SCRIPT"
fi

echo "🚀 [1/3] 重置并启动 Fabric 网络 (CouchDB Mode)..."
cd ../test-network

# 清理环境
./network.sh down

# 启动网络 (关键修改：加上 -s couchdb)
./network.sh up createChannel -c mychannel -s couchdb

# 自动生成 connection-org1.yaml
echo "   -> 正在生成 Connection Profile..."
./organizations/ccp-generate.sh

# ==============================================================================

echo "🚀 [2/3] 部署 Java 智能合约..."
# 既然重置了网络，版本号回归 1.0, 序列号 1
./network.sh deployCC -ccn evidence -ccp ../chaincode/evidence/java -ccl java -c mychannel -ccv 1.0 -ccs 1

# ==============================================================================

echo ""
echo "✅ 基础设施全部就绪！"
echo "📊 CouchDB 管理界面: http://localhost:5984/_utils"
echo "👉 请转到 Windows Trae 启动后端 (mvn spring-boot:run)。"
