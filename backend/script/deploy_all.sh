#!/bin/bash
# ==============================================================================
# 区块链安全存证系统 - 一键部署脚本 (Day 7 交付物)
# 功能：自动修复环境、启动网络、部署合约、启动后端
# ==============================================================================

echo "🚀 [1/4] 初始化环境检查 & 脚本修复..."

# --- 自动修复官方 packageCC.sh 的 Java 识别 Bug (防止它去找 Gradle) ---
PACKAGE_SCRIPT="../test-network/scripts/packageCC.sh"
if [ -f "$PACKAGE_SCRIPT" ]; then
    echo "   -> 正在修正 Fabric 打包脚本..."
    cat << 'SCRIPT_EOF' > "$PACKAGE_SCRIPT"
#!/bin/bash
source scripts/utils.sh
CC_NAME=${1}
CC_SRC_PATH=${2}
CC_SRC_LANGUAGE=${3}
CC_VERSION=${4}
CC_PACKAGE_PATH=${5}

println "Packaging chaincode..."
if [ "$CC_SRC_LANGUAGE" = "java" ]; then
    CC_RUNTIME_LANGUAGE=java
    println "Java source path: $CC_SRC_PATH"
    # 关键修改：直接打包源码，不依赖本地 Gradle/Maven
else
    CC_RUNTIME_LANGUAGE=$CC_SRC_LANGUAGE
fi

peer lifecycle chaincode package ${CC_PACKAGE_PATH} --path ${CC_SRC_PATH} --lang ${CC_RUNTIME_LANGUAGE} --label ${CC_NAME}_${CC_VERSION} >&log.txt
res=$?
{ set +x; } 2>/dev/null
cat log.txt
verifyResult $res "Chaincode packaging has failed"
successln "Chaincode is packaged"
SCRIPT_EOF
else
    echo "⚠️  警告：未找到 test-network 目录，请确认路径！"
fi

# ==============================================================================

echo "🚀 [2/4] 启动区块链底层网络..."
cd ../test-network

# 检查网络是否已经启动
if [ ! -d "organizations/peerOrganizations" ]; then
    echo "   -> 网络未启动，正在创建通道 'mychannel'..."
    # 启动网络，创建通道，不使用 CA (用 cryptogen 更快)
    ./network.sh up createChannel -c mychannel
else
    echo "   -> ✅ 网络已在运行中，跳过启动步骤。"
fi

# ==============================================================================

echo "🚀 [3/4] 部署/升级 Java 智能合约..."

# 为了演示方便，我们每次运行都部署一个新的 Sequence，确保代码生效
# 这里默认使用 v1.0, sequence 1 (适合全新环境)
# 如果是升级，你可以手动改为 -ccv 1.1 -ccs 2
./network.sh deployCC \
-ccn evidence \
-ccp ../chaincode/evidence/java \
-ccl java \
-c mychannel \
-ccv 1.0 \
-ccs 1

# ==============================================================================

echo "🚀 [4/4] 启动 Spring Boot 后端服务..."
cd ../backend

# 检查 Maven 是否安装
if ! command -v mvn &> /dev/null; then
    echo "❌ 错误：未找到 'mvn' 命令。请先安装 Maven (sudo apt install maven)。"
    exit 1
fi

echo "   -> 正在编译并启动后端 (Logs will appear below)..."
# 使用 clean 确保每次都是最新代码
mvn clean spring-boot:run
