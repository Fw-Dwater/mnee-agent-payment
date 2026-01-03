import { ChatOpenAI } from "@langchain/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { DynamicStructuredTool, DynamicTool } from "@langchain/core/tools";
import { z } from "zod";
import { MNEEWallet, MNEE_CONFIG } from "./blockchain_utils.js";
import dotenv from "dotenv";
import https from "https"; // Import https for custom agent

// 强制禁用全局 SSL 验证 (针对 DeepSeek API 可能的证书问题)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

dotenv.config();

// Mock Service Configuration (Updated to Premium Alpha Feed)
const PREMIUM_SERVICE_ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // Example Service Provider
const SERVICE_PRICE = "0.0001"; // Cost in MNEE

// Helper to format Etherscan links
const getEtherscanLink = (hash) => `[View on Sepolia Etherscan](https://sepolia.etherscan.io/tx/${hash})`;

/**
 * Initialize the AI Agent
 * @param {MNEEWallet} wallet - The initialized wallet instance
 * @param {import('./memory_manager.js').MemoryManager} memoryManager - Shared state of active subscriptions and history
 */
export async function createPaymentAgent(wallet, memoryManager) {
    // 1. Define Tools

    // Tool: Check Subscription Status
    const checkSubscriptionTool = new DynamicTool({
        name: "check_subscription_status",
        description: "Check if the user has an active subscription to the Premium Alpha Feed. ALWAYS check this before paying.",
        func: async () => {
            console.log("🤖 Agent: Checking subscription status...");
            const isSubscribed = memoryManager.hasSubscription(PREMIUM_SERVICE_ADDRESS);
            return isSubscribed 
                ? "STATUS: ACTIVE. You have already paid. You can access 'get_premium_alpha' directly."
                : "STATUS: INACTIVE. You have NOT paid yet.";
        }
    });

    // Tool: Manage User Context (Preferences)
    const manageContextTool = new DynamicTool({
        name: "manage_user_context",
        description: "Save or retrieve user preferences. Input format: 'ACTION KEY VALUE'. Actions: SET, GET, GET_ALL. Example: 'SET user_name Tony', 'GET default_city', 'GET_ALL'.",
        func: async (input) => {
            const parts = input.trim().split(" ");
            const action = parts[0]?.toUpperCase();
            
            if (action === "SET") {
                const key = parts[1];
                const value = parts.slice(2).join(" "); // Allow value to contain spaces
                if (!key || !value) return "Error: SET requires key and value (e.g. 'SET city Madrid').";
                memoryManager.setPreference(key, value);
                return `Preference saved: ${key} = ${value}`;
            } else if (action === "GET") {
                const key = parts[1];
                if (!key) return "Error: GET requires key (e.g. 'GET city').";
                const val = memoryManager.getPreference(key);
                return val ? `Value for ${key}: ${val}` : `No value found for ${key}`;
            } else if (action === "GET_ALL") {
                return JSON.stringify(memoryManager.getAllPreferences());
            } else {
                return "Error: Invalid action. Use SET, GET, or GET_ALL.";
            }
        }
    });

    // Tool: Check Transaction History
    const checkHistoryTool = new DynamicTool({
        name: "check_transaction_history",
        description: "Get a list of recent transactions executed by the agent.",
        func: async () => {
            const txs = memoryManager.getTransactions();
            if (txs.length === 0) return "No transactions found.";
            return JSON.stringify(txs, null, 2);
        }
    });

    // Tool: Check Wallet Status (MNEE + ETH + Allowance)
    const checkWalletTool = new DynamicTool({
        name: "check_wallet_status",
        description: "Check MNEE balance, ETH (Gas) balance, and Allowance for the Service Address. ALWAYS check this before attempting payment.",
        func: async () => {
            console.log("🤖 Agent: Checking wallet status...");
            const mneeBal = await wallet.getBalance();
            const ethBal = await wallet.getEthBalance();
            const allowance = await wallet.checkAllowance(PREMIUM_SERVICE_ADDRESS);
            
            return JSON.stringify({
                MNEE_Balance: `${mneeBal} MNEE`,
                ETH_Gas_Balance: `${ethBal} ETH`,
                Allowance_For_Service: `${allowance} MNEE`,
                Service_Address: PREMIUM_SERVICE_ADDRESS,
                Required_Price: SERVICE_PRICE
            });
        }
    });

    // Tool: Approve MNEE
    const approveTool = new DynamicTool({
        name: "approve_mnee",
        description: "Approve the Service Address to spend MNEE. Input format: 'AMOUNT'. Example: '0.0001'. ONLY call if Allowance < Price.",
        func: async (input) => {
            const amount = input.trim();
            if (!amount) return "Error: Amount required.";

            console.log(`🤖 Agent: Approving service for ${amount} MNEE...`);
            try {
                const tx = await wallet.approve(PREMIUM_SERVICE_ADDRESS, String(amount));
                return `Approval Successful. Tx: ${getEtherscanLink(tx.hash)}`;
            } catch (error) {
                return `Approval Failed: ${error.message}`;
            }
        }
    });

    // Tool: Transfer MNEE
    const transferTool = new DynamicTool({
        name: "transfer_mnee",
        description: "Transfer MNEE tokens to pay for service. Input format: 'AMOUNT'. Example: '0.0001'. MUST be called AFTER checking Allowance and Balance.",
        func: async (input) => {
            const amount = input.trim();
            if (!amount) return "Error: Amount required.";

            // Prevent double payment
            if (memoryManager.hasSubscription(PREMIUM_SERVICE_ADDRESS)) {
                return "PAYMENT ALREADY RECEIVED. Do NOT pay again. Call 'get_premium_alpha' now.";
            }

            console.log(`🤖 Agent: Transferring ${amount} MNEE to Service...`);
            try {
                const tx = await wallet.transfer(PREMIUM_SERVICE_ADDRESS, String(amount));
                
                // Log Transaction to Memory
                memoryManager.addTransaction({
                    hash: tx.hash,
                    type: "transfer",
                    amount: String(amount),
                    recipient: PREMIUM_SERVICE_ADDRESS,
                    token: "MNEE"
                });

                memoryManager.addSubscription(PREMIUM_SERVICE_ADDRESS);
                console.log("✅ Payment Verified locally");
                return `Transfer Successful. Tx: ${getEtherscanLink(tx.hash)}. PAYMENT VERIFIED. You MUST now call 'get_premium_alpha' IMMEDIATELY.`;
            } catch (error) {
                return `Transfer Failed: ${error.message}`;
            }
        }
    });

    // Tool: Premium Alpha Feed (Replaces Weather)
    const getAlphaTool = new DynamicTool({
        name: "get_premium_alpha",
        description: "Get exclusive crypto market insights. REQUIREMENT: You MUST have paid (transferred MNEE) first.",
        func: async () => {
            if (!memoryManager.hasSubscription(PREMIUM_SERVICE_ADDRESS)) {
                 throw new Error("PAYMENT REQUIRED: You must pay (transfer) MNEE to the service address first.");
            }
            console.log(`🤖 Agent: Fetching Premium Alpha...`);
            
            return JSON.stringify({
                title: "🚀 MNEE Market Alpha - Daily Insight",
                trend: "BULLISH",
                insight: "MNEE on-chain volume has increased by 40% in the last 24h. Smart money accumulation detected.",
                recommendation: "Accumulate below $1.02",
                access_status: "PREMIUM UNLOCKED"
            });
        }
    });

    const tools = [checkSubscriptionTool, manageContextTool, checkHistoryTool, checkWalletTool, approveTool, transferTool, getAlphaTool];

    // 2. Initialize LLM (DeepSeek via OpenAI SDK)
    console.log("Initializing DeepSeek Model with Key:", process.env.DEEPSEEK_API_KEY ? "Found" : "Missing");
    
    // Create custom HTTPS agent to bypass SSL validation
    const httpsAgent = new https.Agent({
        rejectUnauthorized: false,
        keepAlive: false // Disable keep-alive to avoid stale connection issues
    });

    const model = new ChatOpenAI({ 
        modelName: "deepseek-chat", 
        temperature: 0,
        configuration: {
            baseURL: "https://api.deepseek.com",
            httpAgent: httpsAgent, // Used if node-fetch is active
            fetch: global.fetch, // Force use of native fetch (Node.js 22+)
        },
        openAIApiKey: process.env.DEEPSEEK_API_KEY,
        maxRetries: 2, // Reduce retries to fail faster
        timeout: 30000 // 30s timeout
    });

    // 3. Create Agent Executor
    // Switch to ReAct (Zero-Shot) which is often more robust for generic LLMs than Function Calling
    const executor = await initializeAgentExecutorWithOptions(tools, model, {
        agentType: "chat-zero-shot-react-description", // Chat-optimized ReAct
        verbose: true,
        maxIterations: 8, // Increased iterations for more complex flow
        returnIntermediateSteps: true,
        agentArgs: {
            prefix: `You are an autonomous DeFi Agent specializing in on-chain payments.
            
            IMPORTANT CONFIGURATION:
            - Premium Service Address: ${PREMIUM_SERVICE_ADDRESS}
            - Service Price: ${SERVICE_PRICE} MNEE
            
            STRICT ACTION PROTOCOL (Follow Sequentially):
            1. IF user asks for "Alpha", "Insights", or "Market Data":
               a. Call 'check_subscription_status'.
               b. IF Active -> Call 'get_premium_alpha' and return the data.
               c. IF Inactive -> PROCEED TO PAYMENT FLOW.
            
            PAYMENT FLOW:
            1. Call 'check_wallet_status' to see MNEE Balance, ETH Gas, and Allowance.
            2. IF MNEE Balance < ${SERVICE_PRICE}, abort and tell user to top up.
            3. IF ETH Balance < 0.0001, warn user about low gas but try anyway.
            4. CHECK ALLOWANCE:
               - IF Allowance < ${SERVICE_PRICE}: Call 'approve_mnee' with amount ${SERVICE_PRICE}.
               - IF Allowance >= ${SERVICE_PRICE}: Skip approval.
            5. Call 'transfer_mnee' with amount ${SERVICE_PRICE}.
            6. Call 'get_premium_alpha'.

            ALWAYS return the final insights to the user nicely formatted.
            Use the provided tools directly. Do not output code.`,
        }
    });

    return { executor, config: { serviceAddress: PREMIUM_SERVICE_ADDRESS, price: SERVICE_PRICE } };
}
