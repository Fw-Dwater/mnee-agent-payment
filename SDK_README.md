# MNEE AI Agent Payment SDK

The MNEE AI Agent Payment SDK provides a robust, LangGraph-based framework for integrating autonomous crypto payment agents into your applications. It supports the Sepolia testnet and includes built-in "Human-in-the-Loop" safety mechanisms for high-value transactions.

## Features

- **Stateful Agent Architecture**: Built on LangGraph `StateGraph` for reliable, multi-step execution.
- **Blockchain Tools**: Full suite of Ethers.js v6 tools for MNEE token interaction (Balance, Approve, Transfer, Split Payment, Refund).
- **Human-in-the-Loop**: Configurable thresholds to pause execution and require user approval for large transactions.
- **Persistence**: Support for checkpointers to save and resume agent state.
- **Type-Safe**: Written in TypeScript with complete type definitions.

## Installation

```bash
npm install mnee-agent-sdk @langchain/langgraph @langchain/openai ethers
```

*(Note: Ensure you have `ethers` v6 and necessary LangChain peer dependencies installed)*

## Configuration

Initialize the agent with your blockchain and AI provider credentials:

```typescript
import { createMNEEAgent, MNEEConfig } from "./sdk/src";
import { MemorySaver } from "@langchain/langgraph";

const config: MNEEConfig = {
    // Blockchain
    rpcUrl: process.env.SEPOLIA_RPC_URL!,
    privateKey: process.env.PRIVATE_KEY!,
    mneeTokenAddress: "0x...", 
    
    // Safety
    maxAutoAmount: "50", // Pause for transactions > 50 MNEE

    // AI Provider (DeepSeek/OpenAI)
    openAIApiKey: process.env.DEEPSEEK_API_KEY!,
    baseURL: "https://api.deepseek.com",
    modelName: "deepseek-chat"
};

// Optional: Persistence
const checkpointer = new MemorySaver();

const agent = createMNEEAgent(config, checkpointer);
```

## Usage

### Basic Interaction

```typescript
import { HumanMessage } from "@langchain/core/messages";

const inputs = {
    messages: [new HumanMessage("Check my balance")]
};

const config = { configurable: { thread_id: "session-123" } };
const result = await agent.invoke(inputs, config);

console.log(result.messages[result.messages.length - 1].content);
```

### Handling Human Approval

When a transaction exceeds `maxAutoAmount`, the agent pauses at the `human_approval` node.

```typescript
const inputs = {
    messages: [new HumanMessage("Transfer 1000 MNEE to 0x123...")]
};

// 1. Run agent
const result = await agent.invoke(inputs, config);

// 2. Check state
const snapshot = await agent.getState(config);

if (snapshot.next.includes("human_approval")) {
    console.log("Transaction requires approval!");
    
    // 3. User approves (via UI)
    await agent.updateState(config, { approvalStatus: "APPROVED" });
    
    // 4. Resume execution
    const finalResult = await agent.invoke(null, config);
    console.log("Transaction completed:", finalResult.messages.at(-1).content);
}
```

## API Reference

### `createMNEEAgent(config: MNEEConfig, checkpointer?: Checkpointer)`
Creates and compiles the StateGraph.

### `MNEEConfig` Interface
- `rpcUrl`: Sepolia RPC endpoint.
- `privateKey`: Wallet private key (Agent's wallet).
- `mneeTokenAddress`: ERC-20 contract address.
- `maxAutoAmount`: String, limit before requiring approval.
- `openAIApiKey`: API Key for LLM.

## Tools Included

1. **`get_balance`**: Checks ETH and MNEE balance.
2. **`approve_spender`**: Approves a spender contract (e.g. for swaps).
3. **`transfer_token`**: Transfers MNEE to a recipient.
4. **`split_payment`**: Splits an amount among multiple recipients.
5. **`refund_user`**: Sends MNEE back to a user (Refund).

## Architecture

The SDK uses a graph with the following nodes:
- **`agent`**: LLM decision making.
- **`tools`**: Executes blockchain operations.
- **`human_approval`**: Wait state for high-value checks.
- **`reject_action`**: Handles rejection logic.

![Graph Structure](https://placeholder-graph-url)
