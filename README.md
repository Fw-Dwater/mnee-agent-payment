# MNEE Hackathon AI & Agent Payments Framework

> **Submission Track**: AI & Agent Payments
> **Core Feature**: Agents or automated systems paying for services or data autonomously.

This project provides a core framework for AI Agents to interact with the MNEE token on the Ethereum Sepolia testnet. It uses **Node.js**, **Ethers.js v6**, and **LangGraph** to create an autonomous agent capable of checking balances, swapping ETH for MNEE, approving contracts, and making payments with **Human-in-the-Loop (HITL)** security checks.

## 🏆 Hackathon Alignment

This project specifically addresses the **AI & Agent Payments** track by building a system where:
1.  **Value moves automatically**: The AI Agent autonomously executes ERC-20 `approve` and `transfer` transactions based on user intent.
2.  **MNEE Integration (ERC-20)**: The system is designed to transact with the MNEE stablecoin using standard ERC-20 interfaces.
    *   *Note: For the purpose of this hackathon demo on the Sepolia Testnet, we utilize **WETH (Wrapped Ether)** to simulate MNEE's behavior, as the official MNEE contract is not deployed on Sepolia. This ensures our `approve` and `transfer` logic is 100% compatible with the mainnet MNEE.*
3.  **Security First**: Implements a "Human-in-the-Loop" mechanism where high-value transactions require manual approval.

## Features

- **Autonomous Payment Flow**: The agent autonomously decides when to check balance, swap ETH, approve transactions, and transfer funds.
- **Human-in-the-Loop (HITL)**: Transactions exceeding a defined threshold (e.g., 0.00005 ETH) automatically pause the agent and request user approval via the UI.
- **DeepSeek API Integration**: Powered by DeepSeek LLM (compatible with OpenAI SDK).
- **MNEE/ERC-20 Support**: Built-in support for ERC-20 token interactions (decimals, approve, transfer, balance).
- **React UI**: A modern chat interface to visualize the agent's thought process (ReAct logs) and handle approvals.

## Project Structure

- `sdk/src/agent.ts`: Core Agent logic using LangGraph. Defines the state machine and interrupt logic.
- `sdk/src/tools/`: Tool definitions (`transfer_mnee`, `swap_eth_for_mnee`, etc.).
- `sdk/src/services/ethereum.ts`: Helper class `EthereumService` wrapping Ethers.js for blockchain interactions.
- `server_sdk.ts`: Express backend API.
- `client/`: React frontend application.

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
   SEPOLIA_RPC_URL=https://1rpc.io/sepolia
   DEEPSEEK_API_KEY=your_deepseek_api_key
   # WETH Contract Address on Sepolia (simulating MNEE)
   MNEE_TOKEN_ADDRESS=0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14
   ```

## Usage

### Start the Backend
The backend handles the AI logic and blockchain interactions.
```bash
npx tsx server_sdk.ts
```

### Start the Frontend
The frontend provides the chat interface.
```bash
cd client
npm run dev
```

Open your browser to `http://localhost:5173`.

## How It Works

1.  **User Request**: "I want to buy weather data for 0.0001 MNEE."
2.  **Reasoning**: Agent checks balance. If MNEE is low, it calls `swap_eth_for_mnee`.
3.  **Approval Check**: When the agent attempts `transfer_mnee` (0.0001), the system detects it exceeds the auto-approval limit.
4.  **Human Intervention**: The UI shows an "Approval Required" card. The user clicks "Approve".
5.  **Execution**: The agent resumes, signs the transaction, and completes the payment.
6.  **Result**: The agent calls `get_weather_service` and returns the data.

## ⚠️ Notes

- **Gas Fees**: Real transactions require Sepolia ETH for gas. Ensure your wallet has ETH.
- **RPC Limits**: Public RPC URLs (like 1rpc.io) may have rate limits. If you see connection errors, try a different RPC.
