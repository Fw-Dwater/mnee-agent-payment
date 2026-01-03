import dotenv from 'dotenv';
import { createMNEEAgent } from './sdk/src/agent';
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { v4 as uuidv4 } from 'uuid';

dotenv.config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // For DeepSeek SSL

console.log("DEBUG: DEEPSEEK_API_KEY exists:", !!process.env.DEEPSEEK_API_KEY);
console.log("DEBUG: PRIVATE_KEY exists:", !!process.env.PRIVATE_KEY);

async function runTest() {
    console.log("🚀 Starting SDK Test...");

    const config = {
        rpcUrl: process.env.SEPOLIA_RPC_URL!,
        privateKey: process.env.PRIVATE_KEY!,
        mneeTokenAddress: process.env.MNEE_TOKEN_ADDRESS || "0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF",
        maxAutoAmount: "0.00005", 
        openAIApiKey: process.env.DEEPSEEK_API_KEY!,
        baseURL: "https://api.deepseek.com",
        modelName: "deepseek-chat"
    };

    const checkpointer = new MemorySaver();
    const agent = createMNEEAgent(config, checkpointer);
    
    const threadId = uuidv4();
    const threadConfig = { configurable: { thread_id: threadId } };

    // Test 1: Balance Check (Simple)
    console.log("\n--- Test 1: Check Balance ---");
    const input1 = { messages: [new HumanMessage("Check my MNEE balance")] };
    const result1 = await agent.invoke(input1, threadConfig);
    console.log("Agent:", result1.messages[result1.messages.length - 1].content);

    // Test 2: High Value Transfer (Should Trigger Approval)
    console.log("\n--- Test 2: High Value Transfer (Expect Approval) ---");
    const input2 = { messages: [new HumanMessage("Transfer 0.0001 MNEE to 0x1234567890123456789012345678901234567890")] };
    
    // First invoke - should pause
    const result2 = await agent.invoke(input2, threadConfig);
    
    // Check status
    const snapshot = await agent.getState(threadConfig);
    console.log("Next step:", snapshot.next);
    
    if (snapshot.next.includes("human_approval")) {
        console.log("⚠️ Paused for approval as expected.");
        
        // Approve it
        console.log("✅ Approving transaction...");
        await agent.updateState(threadConfig, { approvalStatus: "APPROVED" });
        
        // Resume
        console.log("▶️ Resuming...");
        // passing null or empty config to resume from current state
        const result3 = await agent.invoke(null, threadConfig);
        console.log("Agent Final Response:", result3.messages[result3.messages.length - 1].content);
    } else {
        console.log("❌ Did not pause! Result:", result2);
    }
}

runTest().catch(console.error);
