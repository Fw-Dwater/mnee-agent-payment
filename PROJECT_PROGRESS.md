# MNEE Hackathon AI Agent 支付项目进展总结

## 1. 项目概述
本项目旨在构建一个基于区块链（Ethereum Sepolia 测试网）的 AI Agent 支付框架。用户可以通过自然语言与 Agent 交互，指示 Agent 管理资产、兑换代币 (Swap) 以及使用 MNEE 代币（ERC-20 标准）购买服务。

**核心技术栈：**
- **后端**: Node.js, Express
- **AI 框架**: LangChain.js (LangGraph StateMachine)
- **大模型**: DeepSeek-V3 (兼容 OpenAI SDK)
- **区块链**: Ethers.js v6, Sepolia Testnet, ERC-20 标准 (WETH 模拟 MNEE)
- **智能合约**: Solidity (MNEEStaking.sol)
- **前端**: React (Vite), Axios, **RainbowKit (Wallet Connect)**
- **安全机制**: Human-in-the-Loop (HITL) 交易审批

---

## 2. 核心功能实现
1.  **AI Agent 智能决策**：
    -   基于 ReAct 模式（Reasoning + Acting）的思维链。
    -   自动规划：检查余额 -> (不足则) 兑换 -> 授权 (Approve) -> 支付/质押。
2.  **区块链交互 (ERC-20 & DeFi)**：
    -   完全遵循 Ethereum ERC-20 标准。
    -   实现了 `swap_eth_for_mnee` (ETH -> MNEE 兑换/铸造)。
    -   **新增**：`MNEEStaking.sol` 智能合约集成，支持 `stake` (质押) 和 `withdraw` (赎回)。
    -   **新增**：意图理解与批处理能力，支持 `batch_transfer_mnee`、`batch_transfer_eth`、`schedule_batch_transfer_mnee`。
3.  **安全审批机制 (Human-in-the-Loop)**：
    -   引入 LangGraph `interruptBefore` 机制。
    -   **全面监控**：覆盖转账、质押、赎回、授权等所有资金敏感操作。
    -   **阈值控制**：当交易金额超过预设阈值（如 0.00005 ETH/MNEE）时，Agent 自动暂停并请求人工审批。
    -   前端实时弹出全屏审批 Modal (Approve/Reject)。
4.  **Web3 钱包集成 (Wallet Connect)**：
    -   集成 **RainbowKit + Wagmi**。
    -   支持 MetaMask 等主流钱包登录。
    -   自动识别并切换网络 (Mainnet/Sepolia)。
5.  **前端体验优化**：
    -   **SSE 流式传输**：实时推送 Agent 思考过程，消除等待焦虑。
    -   **交互式 UI**：清晰的审批卡片，防止界面元素重叠。
    -   **动画效果**：添加了 Loading 动画和状态徽章。

---

## 3. 开发历程与关键问题解决 (Troubleshooting)

### 阶段一至四：基础框架与 API 攻坚
*(见历史记录：依赖配置、DeepSeek SSL 问题解决、工具参数优化)*

### 阶段五：SDK 重构与 LangGraph 迁移
-   **LangGraph 引入**：从单一脚本升级为状态图 (StateGraph) 架构。
-   **SDK 封装**：代码结构重构为 `sdk/src`，包含 `agent.ts`, `tools/`, `services/`。
-   **类型安全**：全面迁移至 TypeScript。

### 阶段六：战略调整与 ERC-20 标准化
-   **架构迁移**：移除 BSV 依赖，完全迁移至 Ethereum Sepolia。
-   **代币模拟**：采用 WETH 合约模拟 MNEE 代币。
-   **安全增强 (HITL)**：实现 `shouldContinue` 守卫逻辑，拦截敏感操作。

### 阶段七：智能合约与业务深化 (最新)
-   **DeFi 业务扩展**：
    -   编写 `contracts/MNEEStaking.sol`，引入 OpenZeppelin 库确保安全性。
    -   搭建 Hardhat 开发环境，编写部署脚本。
    -   成功部署合约至 Sepolia 测试网。
-   **前端/后端优化**：
    -   **Bug Fix**: 解决 Agent 思考过程消失问题 (通过 SSE)。
    -   **Bug Fix**: 解决审批弹窗重叠问题 (通过 CSS Modal)。
    -   **Bug Fix**: 解决 Hardhat 配置文件冲突 (ESM/CJS) 和网络超时问题。
    -   **Feature**: 集成 RainbowKit 钱包连接功能。
    -   **Cleanup**: 清理了项目中不再使用的冗余 JS 文件。
    
### 阶段八：意图解析与批处理上线
-   **功能新增**：
    -   批量转账：`batch_transfer_mnee`、`batch_transfer_eth`。
    -   定时任务：`schedule_batch_transfer_mnee`，支持未来时间执行与任务列表查询。
-   **审批扩展**：
    -   对批处理与定时任务的总金额纳入阈值审批，保持资金安全。

---

## 4. Agent 架构深度解析

### 4.1 LangGraph 状态机
不同于传统的线性执行，我们采用了图结构：
- **Nodes**: `agent` (思考), `tools` (执行), `human_approval` (审批), `reject_action` (拒绝处理)。
- **Edges**: 
    - 正常流程: `agent` -> `tools` -> `agent`
    - 审批流程: `agent` -> (检测到大额) -> `human_approval` (中断) -> (用户批准) -> `tools`

### 4.2 工具箱 (Tool Design)
所有工具均基于 Zod Schema 定义强类型输入：
1.  **资产管理**：
    -   `get_eth_balance`: 查询 ETH (Gas)。
    -   `get_mnee_balance`: 查询 MNEE (ERC-20)。
    -   `swap_eth_for_mnee`: 模拟 DEX 兑换。
2.  **支付核心**：
    -   `approve_mnee_spend`: ERC-20 授权。
    -   `transfer_mnee`: ERC-20 转账。
    -   `transfer_eth`: 原生代币转账。
3.  **DeFi 业务**：
    -   `stake_mnee`: 质押 MNEE。
    -   `unstake_mnee`: 赎回 MNEE。

### 4.3 提示词工程 (Prompt Engineering)
Agent 被赋予了"加密货币支付助手"的角色，并被明确指示：
- 在转账 ERC-20 代币前，**必须**先检查 Allowance 并进行 Approve。
- 遇到大额交易需要请求用户确认。
- **主动建议**：当检测到用户有闲置 MNEE 资金时，主动建议进行 Staking 获取收益。

---

## 5. 下一步计划 (Roadmap & Limitations)

### 5.1 主网适配 (Mainnet Integration)
- **现状**：目前后端逻辑 (`EthereumService`) 及 Agent 配置完全基于 **Sepolia 测试网**。
- **缺失逻辑**：
    - 主网 RPC 节点配置及自动切换。
    - 真实的 MNEE 代币合约地址映射。
    - 主网 Gas 估算策略（EIP-1559 动态调整）以防止交易卡死或过高 Gas 消耗。
    - 主网 Uniswap V3 路由集成（目前 Swap 是模拟的或基于测试网 DEX）。

### 5.2 密钥管理与安全性 (Key Management)
- **现状**：**托管模式 (Custodial)**。Agent 的私钥 (`PRIVATE_KEY`) 存储在后端 `.env` 文件中，由 Agent 全权代理签名和广播交易。
- **风险**：
    - 中心化风险：一旦服务器被攻破，资金面临风险。
    - 用户体验：用户无法使用自己的钱包直接签名交易。
- **改进方向**：
    - **非托管模式 (Non-Custodial)**：仅由 Agent 构造交易数据 (Call Data)，通过前端请求用户钱包 (Metamask/RainbowKit) 进行签名。
    - **账户抽象 (Account Abstraction)**：引入 ERC-4337，使用 Paymaster 代付 Gas，实现更细粒度的权限控制（如仅授权 Agent 操作特定合约）。
