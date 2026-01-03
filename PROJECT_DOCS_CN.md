# MNEE Hackathon AI Agent 支付框架 - 项目详解文档

本文档详细解析了基于 Node.js、LangGraph 和 Ethers.js 构建的 AI Agent 链上支付框架。该项目旨在演示 AI Agent 如何自主控制加密钱包，在 Ethereum Sepolia 测试网上使用 MNEE 代币（通过 WETH 模拟）完成"余额检查 -> 兑换 -> 授权 -> 支付 -> 获取服务"的完整闭环，并集成了**Human-in-the-Loop (HITL)** 安全审批机制。

## 1. 项目核心概念

本项目结合了 **Web3 区块链技术** 与 **LLM 大语言模型**，核心在于让 AI "理解" 链上交互的规则（如 ERC20 的 approve 机制）并自主执行，同时在关键时刻引入人工风控。

### 关键技术栈
- **DeepSeek V3 (via OpenAI SDK)**: Agent 的"大脑"，负责推理任务步骤和调用工具。
- **LangGraph**: 新一代 Agent 编排框架，通过状态图（StateGraph）管理复杂的异步流程和人工中断。
- **Ethers.js v6**: 区块链交互层，负责与 Ethereum 节点通信。
- **MNEE Token (Sepolia Simulation)**: 由于 MNEE 官方合约尚未在 Sepolia 部署，我们使用 **WETH (Wrapped Ether)** 合约来模拟 MNEE 的 ERC-20 行为。这确保了演示的 Approve/Transfer 逻辑与主网完全一致。
  - 合约地址: `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14` (Sepolia WETH)

---

## 2. 详细架构解析

项目结构模块化，核心代码位于 `sdk/src` 目录下：

### A. 区块链服务层 (`sdk/src/services/ethereum.ts`)
这是项目的"手脚"，负责实际的链上操作。

*   **EthereumService 类**: 封装了所有 Ethers.js 交互逻辑。
*   **ERC-20 标准支持**:
    *   `approve(spender, amount)`: 授权服务方扣款。
    *   `transfer(to, amount)`: 执行代币转账。
    *   `balanceOf(address)`: 查询余额。
*   **Swap 功能**: `wrapETH(amount)`，将 ETH 兑换为 WETH (模拟购买 MNEE)。

### B. AI Agent 逻辑核心 (`sdk/src/agent.ts`)
这是项目的"大脑"和"神经系统"。

*   **StateGraph**: 定义了 Agent 的生命周期。
    *   `agent`: 调用 LLM 进行思考。
    *   `tools`: 执行具体工具。
    *   `human_approval`: **(新功能)** 当检测到高风险操作时挂起，等待人工输入。
*   **工具集 (Tools)**:
    *   `get_eth_balance` / `get_mnee_balance`: 资产查询。
    *   `swap_eth_for_mnee`: 资产兑换。
    *   `approve_mnee_spend`: 资金授权。
    *   `transfer_mnee`: 支付结算。
    *   `get_weather_service`: 模拟付费服务。

### C. 交互层 (Server & Client)
*   **Server (`server_sdk.ts`)**: 提供 REST API，维护 Agent 状态及历史记录。
*   **Client (`client/`)**: React 前端，实时展示 Agent 的 ReAct (Reasoning+Acting) 日志，并提供审批 UI。

---

## 3. Agent 思考与执行流程

当 Agent 接收到指令 "Give me weather data, pay 0.0001 MNEE" 时：

1.  **思考 1**: "我需要支付 MNEE，先检查我有多少 MNEE。"
    *   **行动**: `get_mnee_balance`。
2.  **思考 2**: "余额不足（假设为 0）。但我有 ETH，我需要先兑换。"
    *   **行动**: `swap_eth_for_mnee` (0.0001)。
3.  **思考 3**: "现在有钱了。ERC20 支付需要先授权。"
    *   **行动**: `approve_mnee_spend`。
4.  **思考 4**: "授权完成，现在转账。"
    *   **中断**: 系统检测到 0.0001 超过了自动审批阈值 (0.00005)。
    *   **状态**: `APPROVAL_REQUIRED`。
5.  **人工介入**: 用户在前端点击 "Approve"。
6.  **思考 5**: "用户批准了，继续执行转账。"
    *   **行动**: `transfer_mnee`。
7.  **思考 6**: "钱付了，获取服务。"
    *   **行动**: `get_weather_service`。

---

## 4. 环境配置与运行指南

### 步骤 1: 安装依赖
```bash
npm install
cd client && npm install && cd ..
```

### 步骤 2: 配置文件 (.env)
复制 `.env.example` 为 `.env`：
```ini
PRIVATE_KEY=your_sepolia_private_key
DEEPSEEK_API_KEY=your_api_key
SEPOLIA_RPC_URL=https://1rpc.io/sepolia
# MNEE (WETH) Address on Sepolia
MNEE_TOKEN_ADDRESS=0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14
```

### 步骤 3: 启动服务
我们需要同时启动后端 API 和前端界面。

**后端 (Terminal 1):**
```bash
npx tsx server_sdk.ts
```

**前端 (Terminal 2):**
```bash
cd client
npm run dev
```

打开浏览器访问 `http://localhost:5173` 即可开始交互。

---

## 5. 安全特性详解 (Human-in-the-Loop)

为了防止 AI Agent 因幻觉或误操作导致资产损失，我们设计了双层防护：

1.  **工具级检查**: 在 `transfer` 和 `approve` 工具内部，会再次验证余额和参数格式。
2.  **流程级中断 (Graph Interrupt)**:
    *   在 `agent.ts` 中定义了 `shouldContinue` 函数。
    *   它会解析 Agent 即将调用的工具和参数。
    *   如果 `tool === 'transfer_mnee'` 且 `amount > 0.00005`，则返回 `human_approval` 节点。
    *   这使得 Agent 彻底暂停，直到 API 收到 `/api/approve` 请求。

---
*MNEE Hackathon Project - Built with ❤️ by QYJ*
