import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MNEEWallet } from './blockchain_utils.js';
import { createPaymentAgent } from './agent.js';
import { MemoryManager } from './memory_manager.js';

dotenv.config();

// Disable SSL certificate validation (Fix for DeepSeek API SSL error)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Initialize Memory Manager (Persistent Storage)
const memoryManager = new MemoryManager();

// Initialize Wallet
let wallet;
try {
    wallet = new MNEEWallet(
        process.env.PRIVATE_KEY,
        process.env.SEPOLIA_RPC_URL
    );
    console.log(`✅ Wallet initialized: ${wallet.wallet.address}`);
} catch (error) {
    console.error("❌ Failed to initialize wallet:", error.message);
}

app.post('/api/chat', async (req, res) => {
    const { message } = req.body;

    if (!wallet) {
        return res.status(500).json({ error: "Server wallet not initialized" });
    }

    try {
        console.log(`📩 Received message: ${message}`);
        
        // Create a fresh agent for each request (to avoid state pollution)
        const { executor } = await createPaymentAgent(wallet, memoryManager);
        
        // Execute the agent
        const result = await executor.invoke({
            input: message
        });

        // The result contains 'output' (final answer) and 'intermediateSteps'
        res.json({
            response: result.output,
            steps: result.intermediateSteps.map(step => ({
                action: step.action.tool,
                input: step.action.toolInput,
                log: step.action.log,
                observation: step.observation
            }))
        });

    } catch (error) {
        console.error("❌ Agent execution error:", error);
        res.status(500).json({ 
            error: "Agent failed to process request",
            details: error.message 
        });
    }
});

app.listen(port, () => {
    console.log(`🚀 API Server running at http://localhost:${port}`);
});
