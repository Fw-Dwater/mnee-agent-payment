import { MNEEWallet } from "./blockchain_utils.js";
import { createPaymentAgent } from "./agent.js";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    console.log("🚀 Starting MNEE AI Agent Payment Test...");

    // 1. Configuration Check
    const privateKey = process.env.PRIVATE_KEY;
    const providerUrl = process.env.SEPOLIA_RPC_URL;
    const deepseekKey = process.env.DEEPSEEK_API_KEY;

    if (!privateKey || !providerUrl || !deepseekKey) {
        console.error("❌ Error: Missing environment variables.");
        console.error("Please ensure .env file has PRIVATE_KEY, SEPOLIA_RPC_URL, and DEEPSEEK_API_KEY");
        process.exit(1);
    }

    try {
        // 2. Initialize Wallet
        console.log("Initializing Wallet...");
        const wallet = new MNEEWallet(privateKey, providerUrl);
        const address = wallet.wallet.address;
        console.log(`Wallet Address: ${address}`);

        // 3. Check Initial Balance
        const balance = await wallet.getBalance();
        console.log(`Initial MNEE Balance: ${balance}`);

        if (parseFloat(balance) < 0.02) {
            console.warn("⚠️ Warning: Low MNEE balance. Test might fail if funds are insufficient for gas or payment.");
        }

        // 4. Create Agent
        console.log("Initializing Agent...");
        const { executor, config } = await createPaymentAgent(wallet);

        // 5. Define Task
        // We explicitly tell the agent the rules: Pay first, then get service.
        // In a real autonomous loop, the Agent would learn this from tool descriptions or system prompt.
        const prompt = `I need to check the weather in San Francisco. 
        The service requires a payment of ${config.price} MNEE to the address ${config.serviceAddress}.
        Please check my balance, authorize the payment if necessary (approve), make the payment, and then fetch the weather data.`;

        console.log("\n💬 User Prompt:", prompt);
        console.log("-----------------------------------");

        // 6. Run Agent
        const result = await executor.invoke({ input: prompt });

        console.log("-----------------------------------");
        console.log("✅ Agent Execution Completed!");
        console.log("📝 Final Answer:", result.output);

    } catch (error) {
        console.error("❌ Test Failed:", error);
    }
}

main();
