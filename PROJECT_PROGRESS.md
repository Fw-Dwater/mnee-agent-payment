# MNEE Hackathon AI Agent 支付项目进展总结

## 1. 项目概述
本项目旨在构建一个基于区块链（Ethereum Sepolia 测试网）的 AI Agent 支付框架。用户可以通过自然语言与 Agent 交互，指示 Agent 管理资产、兑换代币 (Swap) 以及使用 MNEE 代币（ERC-20 标准）购买服务。

**核心技术栈：**
- **后端**: Node.js, Express
- **AI 框架**: LangChain.js (LangGraph StateMachine)
- **大模型**: DeepSeek-V3 (兼容 OpenAI SDK)
- **区块链**: Ethers.js v6, Sepolia Testnet, ERC-20 标准 (WETH 模拟 MNEE)
- **前端**: React (Vite), Axios
- **安全机制**: Human-in-the-Loop (HITL) 交易审批

---

## 2. 核心功能实现
1.  **AI Agent 智能决策**：
    -   基于 ReAct 模式（Reasoning + Acting）的思维链。
    -   自动规划：检查余额 -> (不足则) 兑换 -> 授权 (Approve) -> 支付 (Transfer)。
2.  **区块链交互 (ERC-20 Native)**：
    -   完全遵循 Ethereum ERC-20 标准。
    -   实现了 `swap_eth_for_mnee` (ETH -> MNEE 兑换/铸造)。
    -   实现了 `approve` 和 `transfer` 的标准支付流程。
3.  **安全审批机制 (Human-in-the-Loop)**：
    -   引入 LangGraph `interruptBefore` 机制。
    -   **阈值控制**：当交易金额超过预设阈值（如 0.00005 ETH/MNEE）时，Agent 自动暂停并请求人工审批。
    -   前端实时弹出审批卡片 (Approve/Reject)。
4.  **记忆系统 (Memory Manager)**：
    -   利用 LangGraph Checkpointer 实现会话状态持久化。
    -   支持历史对话记录查询 (`/api/history`)。
5.  **React 前端界面**：
    -   实时流式输出 Agent 的思考过程 (Thought Chain)。
    -   交互式审批界面。

---

## 3. 开发历程与关键问题解决 (Troubleshooting)

### 阶段一至四：基础框架与 API 攻坚
*(见历史记录：依赖配置、DeepSeek SSL 问题解决、工具参数优化)*

### 阶段五：SDK 重构与 LangGraph 迁移
-   **LangGraph 引入**：从单一脚本升级为状态图 (StateGraph) 架构。
-   **SDK 封装**：代码结构重构为 `sdk/src`，包含 `agent.ts`, `tools/`, `services/`。
-   **类型安全**：全面迁移至 TypeScript。

### 阶段六：战略调整与 ERC-20 标准化 (最新)
-   **问题描述**：原计划使用 MNEE 官方 BSV 链工具，但 Hackathon 要求聚焦于 Ethereum ERC-20 赛道，且官方 Sepolia 合约尚未部署。
-   **解决方案**：
    1.  **架构迁移**：移除所有 BSV/MNEE CLI 依赖，完全迁移至 Ethereum Sepolia。
    2.  **代币模拟**：采用 WETH (Wrapped ETH) 合约模拟 MNEE 代币行为。这确保了演示的 `approve` 和 `transfer` 逻辑与未来主网 MNEE (ERC-20) **完全一致**。
    3.  **工具集扩展**：新增 `swap_eth_for_mnee` 工具，模拟用户使用 ETH 兑换 MNEE 的场景。

-   **安全增强 (HITL)**：
    -   **挑战**：Agent 可能会在无监管下执行大额交易。
    -   **解决**：在 `sdk/src/agent.ts` 中实现 `shouldContinue` 守卫逻辑。识别敏感工具 (`transfer`, `swap`, `approve`) 并检查金额。触发 `human_approval` 节点中断执行流。

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

### 4.3 提示词工程 (Prompt Engineering)
Agent 被赋予了"加密货币支付助手"的角色，并被明确指示：
- 在转账 ERC-20 代币前，**必须**先检查 Allowance 并进行 Approve。
- 遇到大额交易需要请求用户确认。
