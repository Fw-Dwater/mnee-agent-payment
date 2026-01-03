# MNEE Hackathon Story

## Inspiration
The rapid rise of AI agents has unlocked incredible potential for automation, but most agents hit a hard wall when it comes to financial execution. They can plan a trip but can't book the flight; they can find a data set but can't pay for the API key.

We were inspired by the vision of **Autonomous Economic Agents**—software that doesn't just "chat" but actually participates in the economy. However, giving an AI a wallet is terrifying. The risk of hallucinations leading to drained funds is real.

Our inspiration for the **MNEE AI Agent Payments Framework** was to solve this "Trust vs. Autonomy" paradox. We wanted to build a system where an agent could natively interact with the MNEE stablecoin ecosystem to pay for services, but with a robust "Human-in-the-Loop" safety net that feels seamless, not obstructive.

## What it does
Our project is a comprehensive SDK and reference implementation that enables AI Agents to:
1.  **Understand Financial Intent**: The agent parses natural language commands like "Pay 0.001 MNEE for weather data."
2.  **Manage Assets Autonomously**: It checks its own balances and, if necessary, performs token swaps (e.g., ETH to MNEE) to acquire the required currency.
3.  **Navigate ERC-20 Complexity**: The agent understands the difference between `approve` and `transfer`. It automatically handles the approval allowance flow required by ERC-20 tokens before making payments.
4.  **Enforce Security Policies**: It implements a configurable **Human-in-the-Loop (HITL)** mechanism. Small transactions pass automatically, but transactions exceeding a threshold trigger a system interrupt.
    *   Logic: If $Transaction_{amount} > Threshold_{limit}$ (e.g., $0.00005$), then state $\rightarrow$ `APPROVAL_REQUIRED`.
5.  **Simulate Real-World Scenarios**: In our demo, the agent pays for a simulated premium service (Weather API) using MNEE (simulated via WETH on Sepolia).

## How we built it
We built the system on a modern, modular stack designed for scalability:

*   **The Brain (AI)**: We used **DeepSeek V3** (via OpenAI-compatible SDK) as the reasoning engine. Its strong logic capabilities allow it to plan multi-step financial operations (e.g., "I have 0 MNEE but 0.1 ETH -> Swap -> Approve -> Transfer").
*   **The Nervous System (Orchestration)**: We utilized **LangGraph** to build a stateful graph. This was crucial for the HITL feature. Unlike a simple chain, a Graph allows us to persist the agent's state ("I am about to pay") to a database, wait for user input (Approval), and then resume execution exactly where it left off.
*   **The Hands (Blockchain)**: We used **Ethers.js v6** for all blockchain interactions. We built a dedicated `EthereumService` class that abstracts the complexities of JSON-RPC, signing, and gas estimation.
*   **The Interface**: A **React + Vite** frontend provides a transparent view of the agent's "thoughts" (ReAct log) and serves as the control center for approvals.
*   **The Infrastructure**: We deployed on **Sepolia Testnet**. Since MNEE is not yet on Sepolia, we architected a simulation layer using **WETH (Wrapped Ether)**. WETH behaves exactly like an ERC-20 token (requiring `approve`/`transfer`), ensuring our code is 100% mainnet-ready for the real MNEE token.

## Challenges we ran into
1.  **The "Approval" Dance**: One of the biggest hurdles was teaching the AI that it cannot just "transfer" an ERC-20 token to a contract; it must "approve" it first. Early versions of the agent would repeatedly fail. We solved this by creating distinct tools (`approve_mnee_spend` and `transfer_mnee`) and refining the system prompt to explain the dependency.
2.  **State Persistence**: Implementing the "Pause for Approval" feature was tricky. We had to ensure that when the server restarted or the connection dropped, the agent didn't lose the context of *why* it needed approval. LangGraph's checkpointer system was the solution here.
3.  **Testnet Limitations**: We wanted to use the real MNEE token, but it wasn't available on Sepolia. We considered deploying our own mock token, but decided to use Canonical WETH instead. This was a better choice because it's a battle-tested contract that guarantees standard compliance, making our tests more valid.

## Accomplishments that we're proud of
*   **Seamless HITL UX**: We're proud of how smooth the approval process feels. The user asks for a payment, the chat pauses, a card appears, the user clicks "Approve", and the AI immediately says "Thanks, sending transaction now." It feels like magic.
*   **Robust Error Handling**: The agent doesn't just crash if a transaction fails (e.g., out of gas). It catches the error, reflects on it ("I ran out of gas"), and informs the user.
*   **Modular Architecture**: The `EthereumService` and `Agent` logic are decoupled. This means other developers can swap out the LLM or the frontend and still use our core payment logic.

## What we learned
*   **AI needs "Guardrails", not "Handcuffs"**: We learned that hard-coding every step makes the agent useless, but giving it total freedom is dangerous. The "Threshold" approach (auto-approve small amounts, check large ones) strikes the perfect balance.
*   **Blockchain Latency is a UX Challenge**: Waiting 15 seconds for a block confirmation feels like an eternity in a chat interface. We learned the importance of providing optimistic updates or "thinking..." states to keep the user engaged.
*   **Standardization Matters**: By sticking strictly to ERC-20 standards (even for our simulation), we ensured our tool is compatible with the broader Ethereum ecosystem (Wallets, DEXs, etc.).

## What's next for MNEE Hackathon AI & Agent Payments Framework
*   **Mainnet Launch**: Once MNEE is live, we will switch the contract address in our `.env` file, and the system will work with real money immediately.
*   **DeFi Integration**: We plan to add tools for the agent to interact with DeFi protocols—e.g., "Put my MNEE into a yield vault."
*   **Multi-Signature Support**: For enterprise use cases, we want to support multi-sig wallets (Safe), where the AI proposes a transaction and multiple humans must sign it.
*   **Mobile App**: Porting the React frontend to React Native to allow approvals via push notifications on a phone.

## Built With
- **typescript**: The primary language for robust, type-safe code.
- **langgraph**: For orchestrating the complex state machine and HITL flows.
- **node.js**: The runtime environment for our agent SDK.
- **ethers.js**: For handling all Ethereum/Sepolia blockchain interactions.
- **react**: For building the interactive dashboard and chat interface.
- **deepseek**: The LLM engine powering the agent's reasoning.
- **ethereum**: The underlying blockchain network (Sepolia Testnet).
- **express.js**: For the backend API server.
- **vite**: For fast frontend tooling.
