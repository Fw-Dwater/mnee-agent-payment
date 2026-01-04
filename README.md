# MNEE Hackathon AI & Agent Payments Framework

> **Submission Track**: AI & Agent Payments
> **Core Feature**: Autonomous DeFi Asset Management & Payments.

This project provides a comprehensive framework for AI Agents to interact with the MNEE token on the Ethereum Sepolia testnet. It uses **Node.js**, **Ethers.js v6**, **LangGraph**, and **Solidity** to create an autonomous agent capable of payments, asset management (Staking), and secure execution with **Human-in-the-Loop (HITL)** safeguards.

## 🏆 Hackathon Alignment

This project specifically addresses the **AI & Agent Payments** track by building a system where:
1.  **Value moves automatically**: The AI Agent autonomously executes ERC-20 `approve`, `transfer`, `stake`, and `unstake` transactions based on user intent.
2.  **DeFi Integration**: Includes a custom `MNEEStaking.sol` smart contract, demonstrating how Agents can manage complex financial positions, not just payments.
3.  **MNEE Integration (ERC-20)**: The system is designed to transact with the MNEE stablecoin using standard ERC-20 interfaces.
4.  **Security First**: Implements a "Human-in-the-Loop" mechanism where high-value transactions require manual approval via a secure UI.
5.  **Web3 Wallet Integration**: Frontend integrates **RainbowKit + Wagmi** for seamless user wallet connection (MetaMask, etc.).

## Features

- **Autonomous Asset Management**: The agent autonomously decides when to swap ETH, transfer MNEE, or **Stake MNEE** for yield based on user context.
- **DeFi Staking**: Integrated `MNEEStaking.sol` contract allows the Agent to deposit and withdraw funds to/from a smart contract.
- **Human-in-the-Loop (HITL)**: Transactions exceeding a defined threshold (e.g., 0.00005 ETH) automatically pause the agent and request user approval via a full-screen Modal.
- **Real-Time Visualization**: Frontend uses Server-Sent Events (SSE) to stream the Agent's "Thinking Process" and "Tool Execution" in real-time.
- **Web3 Wallet Login**: Users can connect their MetaMask wallet to view balances and interact with the DApp on Sepolia/Mainnet.
- **DeepSeek API Integration**: Powered by DeepSeek LLM (compatible with OpenAI SDK).
- **MNEE/ERC-20 Support**: Built-in support for ERC-20 token interactions (decimals, approve, transfer, balance).

## Project Structure

- `contracts/`: Solidity Smart Contracts (`MNEEStaking.sol`).
- `sdk/src/agent.ts`: Core Agent logic using LangGraph. Defines the state machine, HITL interrupt logic, and System Prompts.
- `sdk/src/tools/`: Tool definitions (`transfer_mnee`, `stake_mnee`, `unstake_mnee`, etc.).
- `sdk/src/services/ethereum.ts`: Helper class `EthereumService` wrapping Ethers.js for blockchain interactions.
- `server_sdk.ts`: Express backend API with SSE support.
- `client/`: React frontend application with optimized "Agent Thoughts" UI and RainbowKit Wallet Connect.

## Prerequisites

- Node.js (v18+)
- A Sepolia Ethereum Wallet Private Key (with some Sepolia ETH for Gas)
- DeepSeek API Key

## Installation

1. Install dependencies:
   ```bash
   npm install
   cd client && npm install && cd ..
   ```

2. Configure environment variables:
   Copy `.env.example` to `.env` and fill in your details:
   ```ini
   PRIVATE_KEY=your_private_key_here
   SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
   DEEPSEEK_API_KEY=your_deepseek_api_key
   # WETH Contract Address on Sepolia (simulating MNEE)
   MNEE_TOKEN_ADDRESS=0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14
   # Deployed Staking Contract
   MNEE_STAKING_CONTRACT_ADDRESS=0xB0d7BF5Cc1C82e55063BD677B8d8C42209A34a1E
   ```

## Usage

### Start the Backend
The backend handles the AI logic and blockchain interactions.
```bash
npx tsx server_sdk.ts
```

### Start the Frontend
The frontend provides the chat interface and wallet connection.
```bash
cd client
npm run dev
```

Open your browser to `http://localhost:5173`.

## How It Works

1.  **User Request**: "I want to buy weather data for 0.0001 MNEE." or "Help me manage my idle funds."
2.  **Reasoning**: Agent checks balance.
    - If MNEE is low, it calls `swap_eth_for_mnee`.
    - If funds are idle, it suggests `stake_mnee`.
3.  **Approval Check**: When the agent attempts a financial transaction (Transfer/Stake) > Threshold, the system detects it.
4.  **Human Intervention**: The UI shows a "Transaction Approval" modal. The user clicks "Approve".
5.  **Execution**: The agent resumes, signs the transaction, and completes the operation on-chain.
6.  **Result**: The agent confirms the Transaction Hash and updated balances.

## ⚠️ Notes

- **Gas Fees**: Real transactions require Sepolia ETH for gas. Ensure your wallet has ETH.
- **RPC Limits**: Public RPC URLs (like 1rpc.io) may have rate limits. If you see connection errors, try a different RPC.
