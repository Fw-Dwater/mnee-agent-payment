import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createMNEEAgent } from './sdk/src/agent';
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { v4 as uuidv4 } from 'uuid';

dotenv.config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// In-memory checkpointer for demo
const checkpointer = new MemorySaver();

// Cache for the compiled graph
const config = {
    rpcUrl: process.env.SEPOLIA_RPC_URL!,
    privateKey: process.env.PRIVATE_KEY!,
    mneeTokenAddress: process.env.MNEE_TOKEN_ADDRESS || "0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF",
    maxAutoAmount: "0.00005", // Low threshold for demo
    openAIApiKey: process.env.DEEPSEEK_API_KEY!, // Using DeepSeek key
    baseURL: "https://api.deepseek.com",
    modelName: "deepseek-chat"
};

const agent = createMNEEAgent(config, checkpointer);

// Helper to format steps from message history
function extractSteps(messages: any[]) {
    const steps = [];
    
    // We filter for AIMessages (thoughts/calls) and ToolMessages (results)
    // We ignore HumanMessages (User input) for the steps view as that's already in chat
    for (const msg of messages) {
        if (msg instanceof AIMessage) {
            // Check if it has tool calls
            if (msg.tool_calls && msg.tool_calls.length > 0) {
                steps.push({
                    type: 'thought',
                    content: msg.content || "Deciding next action...",
                    timestamp: Date.now()
                });
                for (const tool of msg.tool_calls) {
                    steps.push({
                        type: 'call',
                        tool: tool.name,
                        args: tool.args,
                        id: tool.id,
                        timestamp: Date.now()
                    });
                }
            } else if (msg.content) {
                 // Final answer or simple thought
                 // If it's the last message, it's the answer, handled separately by frontend
                 // But we can include it as a 'thought' step too
                 steps.push({
                    type: 'thought',
                    content: msg.content,
                    timestamp: Date.now()
                });
            }
        } else if (msg instanceof ToolMessage) {
            steps.push({
                type: 'result',
                tool_call_id: msg.tool_call_id,
                output: msg.content,
                timestamp: Date.now()
            });
        }
    }
    return steps;
}

app.post('/api/chat', async (req, res) => {
    const { message, sessionId } = req.body;
    const threadId = sessionId || uuidv4();
    
    const threadConfig = { configurable: { thread_id: threadId } };
    
    try {
        console.log(`📩 [${threadId}] Msg: ${message}`);
        
        const inputs = {
            messages: [new HumanMessage(message)]
        };

        const result = await agent.invoke(inputs, threadConfig);
        
        // Check if we are interrupted
        const snapshot = await agent.getState(threadConfig);
        const steps = extractSteps(result.messages);
        console.log("DEBUG: Extracted steps:", JSON.stringify(steps, null, 2));

        if (snapshot.next && snapshot.next.includes("human_approval")) {
             return res.json({
                 response: "⚠️ **Approval Required**: The transaction amount exceeds the auto-approval limit. Please approve or reject.",
                 status: "APPROVAL_REQUIRED",
                 sessionId: threadId,
                 steps: steps
             });
        }
        
        // Get last message
        const lastMsg = result.messages[result.messages.length - 1];
        res.json({
            response: lastMsg.content,
            status: "COMPLETED",
            sessionId: threadId,
            steps: steps
        });

    } catch (error: any) {
        console.error("❌ Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/approve', async (req, res) => {
    const { sessionId, action } = req.body; // action: 'APPROVED' | 'REJECTED'
    const threadConfig = { configurable: { thread_id: sessionId } };

    try {
        console.log(`🛡️ [${sessionId}] Action: ${action}`);
        
        // Resume graph with state update
        // We update the state first, then invoke with null to resume
        await agent.updateState(threadConfig, {
            approvalStatus: action
        });
        
        const result = await agent.invoke(null, threadConfig);

        const lastMsg = result.messages[result.messages.length - 1];
        const steps = extractSteps(result.messages);

        res.json({
            response: lastMsg.content,
            status: "COMPLETED",
            sessionId: sessionId,
            steps: steps
        });
        
    } catch (error: any) {
        console.error("❌ Approval Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/history/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const threadConfig = { configurable: { thread_id: sessionId } };

    try {
        const state = await agent.getState(threadConfig);
        if (!state.values || !state.values.messages) {
            return res.json({ messages: [], steps: [] });
        }

        const history = state.values.messages.map((msg: any) => {
            if (msg instanceof HumanMessage) {
                return { role: 'user', content: msg.content };
            } else if (msg instanceof AIMessage) {
                return { role: 'assistant', content: msg.content };
            }
            return null;
        }).filter((msg: any) => msg !== null && msg.content); // Filter out empty or system messages if any

        const steps = extractSteps(state.values.messages);

        res.json({ messages: history, steps });
    } catch (error: any) {
        console.error("❌ History Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`🚀 SDK Server running at http://localhost:3001`);
});
