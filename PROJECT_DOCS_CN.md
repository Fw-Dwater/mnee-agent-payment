# MNEE Hackathon AI Agent 支付框架 - 项目详解文档

本文档详细解析了基于 Node.js、LangGraph、Ethers.js 和 Solidity 构建的 AI Agent 链上支付与金融框架。该项目旨在演示 AI Agent 如何自主控制加密钱包，在 Ethereum Sepolia 测试网上使用 MNEE 代币完成"支付 -> 质押 -> 获取服务"的完整闭环，并集成了**Human-in-the-Loop (HITL)** 安全审批机制。

## 1. 项目核心概念

本项目结合了 **Web3 区块链技术** 与 **LLM 大语言模型**，不仅实现了基础支付，还扩展到了**DeFi (去中心化金融)** 领域。核心在于让 AI "理解" 复杂的链上业务逻辑（如 ERC20 授权、质押合约交互）并自主执行，同时在关键时刻引入人工风控。

### 关键技术栈
- **DeepSeek V3 (via OpenAI SDK)**: Agent 的"大脑"，负责推理任务步骤和调用工具。
- **LangGraph**: 新一代 Agent 编排框架，通过状态图（StateGraph）管理复杂的异步流程和人工中断。
- **Ethers.js v6 & Hardhat**: 区块链交互与开发框架。
- **Solidity (Smart Contracts)**: 自研 `MNEEStaking` 合约，实现代币质押业务。
- **MNEE Token (Sepolia Simulation)**: 使用 WETH (Wrapped Ether) 模拟 MNEE 的 ERC-20 行为。
  - 代币地址: `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14`
- **MNEE Staking Contract**: 部署在 Sepolia 上的质押合约。
  - 合约地址: `0xB0d7BF5Cc1C82e55063BD677B8d8C42209A34a1E`
- **RainbowKit & Wagmi**: 前端 Web3 钱包连接库。

---

## 2. 详细架构解析

项目结构模块化，涵盖了从合约层到前端交互层的完整链路：

### A. 智能合约层 (`contracts/`)
这是项目的业务基石，采用 Solidity 编写。
*   **MNEEStaking.sol**: 
    *   实现了标准的质押 (`stake`) 和赎回 (`withdraw`) 逻辑。
    *   用户质押 MNEE 代币以展示忠诚度或获取权益。
    *   继承自 OpenZeppelin 的 `ReentrancyGuard` 和 `Ownable` 确保安全性。

### B. 区块链服务层 (`sdk/src/services/ethereum.ts`)
这是项目的"手脚"，负责实际的链上操作。

*   **EthereumService 类**: 封装了所有 Ethers.js 交互逻辑。
*   **基础 ERC-20 能力**: `approve`, `transfer`, `balanceOf`.
*   **DeFi 业务能力**: 
    *   `stakeMNEE(amount)`: 处理“授权 + 质押”的复合操作。
    *   `unstakeMNEE(amount)`: 从合约赎回资产。
*   **Swap 功能**: `wrapETH(amount)`，将 ETH 兑换为 MNEE。

### C. AI Agent 逻辑核心 (`sdk/src/agent.ts`)
这是项目的"大脑"和"神经系统"。

*   **StateGraph**: 定义了 Agent 的生命周期。
    *   `agent`: 调用 LLM 进行思考。
    *   `tools`: 执行具体工具。
    *   `human_approval`: **(核心风控)** 当检测到高风险操作（转账、质押、大额授权）时挂起。
*   **工具集 (Tools)**:
    *   **资产类**: `get_eth_balance`, `get_mnee_balance`, `swap_eth_for_mnee`.
    *   **支付类**: `approve_mnee_spend`, `transfer_mnee`.
    *   **业务类**: `stake_mnee` (质押), `unstake_mnee` (赎回).
    *   **服务类**: `get_weather_service`.

### D. 交互层 (Server & Client)
*   **Server (`server_sdk.ts`)**: 
    *   基于 Express 提供 REST API。
    *   使用 **SSE (Server-Sent Events)** 技术实现 Agent 思考过程的实时流式传输，解决前端响应延迟问题。
*   **Client (`client/`)**: 
    *   React 前端，全屏模态框 (Modal) 处理审批请求，防止界面遮挡。
    *   实时展示 ReAct 思维链。
    *   **Wallet Connect**: 用户可连接 MetaMask 钱包。

---

## 3. Agent 思考与执行流程

### 场景：用户请求 "质押 100 MNEE"

1.  **思考 1**: "用户想质押 MNEE。我需要先检查余额。"
    *   **行动**: `get_mnee_balance`。
2.  **思考 2**: "余额充足。质押需要与合约交互，首先需要授权合约花费我的代币。"
    *   **行动**: `approve_mnee_spend` (对象：Staking合约地址)。
3.  **中断**: 系统检测到 `approve_mnee_spend` 是敏感操作。
    *   **状态**: `APPROVAL_REQUIRED`。
4.  **人工介入**: 前端弹出全屏审批卡片，用户点击 "Approve"。
5.  **思考 3**: "授权已获批。现在执行质押。"
    *   **行动**: `stake_mnee` (100)。
6.  **中断**: 系统检测到 `stake_mnee` 涉及资金流出。
    *   **状态**: `APPROVAL_REQUIRED`。
7.  **人工介入**: 用户再次确认。
8.  **思考 4**: "质押成功。任务完成。"

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

# 自动注入的合约地址 (无需手动修改)
MNEE_TOKEN_ADDRESS=0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14
MNEE_STAKING_CONTRACT_ADDRESS=0xB0d7BF5Cc1C82e55063BD677B8d8C42209A34a1E
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

为了防止 AI Agent 因幻觉或误操作导致资产损失，我们设计了多层防护：

1.  **工具级检查**: 在 `transfer` 和 `approve` 工具内部，会再次验证余额和参数格式。
2.  **Gas 费保护**: 自动估算 Gas，防止因 Gas 不足导致交易失败或钱包被掏空。
3.  **流程级中断 (Graph Interrupt)**:
    *   在 `agent.ts` 中定义了 `shouldContinue` 守卫逻辑。
    *   **监控列表**: `transfer_mnee`, `transfer_eth`, `swap_eth_for_mnee`, `approve_mnee_spend`, `stake_mnee`, `unstake_mnee`。
    *   **阈值控制**: 任何涉及资金变动的操作（或超过阈值的操作）都会强制触发 `human_approval` 节点。
    *   这使得 Agent 彻底暂停，直到 API 收到 `/api/approve` 请求。

---
*MNEE Hackathon Project - Built with ❤️ by QYJ*
