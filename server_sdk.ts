import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createMNEEAgent } from './sdk/src/agent';
import { scheduledJobs } from './sdk/src/tools/blockchain';
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { v4 as uuidv4 } from 'uuid';

dotenv.config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

app.use((req, res, next) => {
    console.log(`Incoming ${req.method} request to ${req.url}`);
    next();
});

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

app.get('/api/jobs', (req, res) => {
    res.json({ jobs: scheduledJobs });
});

app.post('/api/chat', async (req, res) => {
    const { message, sessionId, userAddress } = req.body;
    const threadId = sessionId || uuidv4();
    const threadConfig = { configurable: { thread_id: threadId } };

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        console.log(`📩 [${threadId}] Msg: ${message} | User: ${userAddress || "None"}`);
        
        // Send initial status
        res.write(`data: ${JSON.stringify({ type: 'status', sessionId: threadId })}\n\n`);
        if (!userAddress) {
            res.write(`data: ${JSON.stringify({ type: 'response', content: '请先连接钱包后再进行查询或操作。' })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
            return;
        }

        const contextMessage = userAddress 
            ? `\n\n[Context: User's connected wallet address is ${userAddress}. If the user asks for "my balance" or "my wallet", use this address.]`
            : `\n\n[Context: User has not connected a wallet. If they ask for "my balance", remind them to connect a wallet.]`;

        const inputs = {
            messages: [new HumanMessage(message + contextMessage)]
        };

        const stream = await agent.streamEvents(inputs, {
            ...threadConfig,
            version: "v2"
        });

        for await (const event of stream) {
            const eventType = event.event;
            
            // Handle Thoughts (LLM generation)
            if (eventType === "on_chat_model_stream") {
                // Optional: Stream tokens if frontend supported it
                // For now, we can capture the full thought at 'on_chat_model_end'
            }
            else if (eventType === "on_chat_model_end") {
                // Check if it's an AIMessage with content (Thought)
                const output = event.data.output;
                if (output && output.content && typeof output.content === 'string') {
                    const step = {
                        type: 'thought',
                        content: output.content,
                        timestamp: Date.now()
                    };
                    res.write(`data: ${JSON.stringify({ type: 'step', step })}\n\n`);
                }
            }
            // Handle Tool Calls
            else if (eventType === "on_tool_start") {
                const step = {
                    type: 'call',
                    tool: event.name,
                    args: event.data.input,
                    timestamp: Date.now()
                };
                res.write(`data: ${JSON.stringify({ type: 'step', step })}\n\n`);
            }
            // Handle Tool Results
            else if (eventType === "on_tool_end") {
                const step = {
                    type: 'result',
                    tool: event.name,
                    output: typeof event.data.output === 'string' ? event.data.output : JSON.stringify(event.data.output),
                    timestamp: Date.now()
                };
                res.write(`data: ${JSON.stringify({ type: 'step', step })}\n\n`);
            }
        }

        // Check for interruption (Approval) or Final Answer
        const snapshot = await agent.getState(threadConfig);
        
        if (snapshot.next && snapshot.next.includes("human_approval")) {
             // Find the pending tool call
             const messages = snapshot.values.messages;
             const lastMsg = messages[messages.length - 1];
             let pendingToolCall = null;
             if (lastMsg.tool_calls && lastMsg.tool_calls.length > 0) {
                 pendingToolCall = lastMsg.tool_calls[0];
             }

             res.write(`data: ${JSON.stringify({ 
                 type: 'status', 
                 status: 'APPROVAL_REQUIRED',
                 tool: pendingToolCall
             })}\n\n`);
             
             res.write(`data: ${JSON.stringify({
                 type: 'response',
                 content: "⚠️ **Approval Required**: The transaction amount exceeds the auto-approval limit. Please review the details below."
             })}\n\n`);
        } else {
             // Get final message
             const messages = snapshot.values.messages;
             const lastMsg = messages[messages.length - 1];
             if (lastMsg && lastMsg.content) {
                 res.write(`data: ${JSON.stringify({
                     type: 'response',
                     content: lastMsg.content
                 })}\n\n`);
             }
        }

        res.write('data: [DONE]\n\n');
        res.end();

    } catch (error: any) {
        console.error("❌ Error:", error);
        res.write(`data: ${JSON.stringify({ type: 'error', content: error.message })}\n\n`);
        res.end();
    }
});

app.post('/api/approve', async (req, res) => {
    const { sessionId, action } = req.body; // action: 'APPROVED' | 'REJECTED'
    const threadConfig = { configurable: { thread_id: sessionId } };

    try {
        console.log(`🛡️ [${sessionId}] Action: ${action}`);
        
        // Resume graph with state update
        // We update the state first
        await agent.updateState(threadConfig, {
            approvalStatus: action
        });
        
        // Invoke with null to resume execution
        // We use streamEvents to be consistent with chat endpoint
        // This ensures the frontend gets the same "steps" experience
        
        // However, since we are returning a JSON response in the current App.tsx logic for approve,
        // we can stick to invoke OR change App.tsx to handle stream for approve too.
        // Given the user issue "Thinking... disappeared" was for chat, let's keep it simple for now
        // and just return the final result, BUT ensure steps are extracted correctly.
        
        // NOTE: If we use invoke(null), it resumes from the interruption point.
        const result = await agent.invoke(null, threadConfig);

        const steps = extractSteps(result.messages);
        const lastMsg = result.messages[result.messages.length - 1];

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

app.post('/api/submit-input', async (req, res) => {
    const { sessionId, toolCallId, inputData } = req.body;
    const threadConfig = { configurable: { thread_id: sessionId } };

    try {
        console.log(`📝 [${sessionId}] Input Submitted for ${toolCallId}`);
        
        // Construct the ToolMessage representing the user's input
        const toolMessage = new ToolMessage({
            tool_call_id: toolCallId,
            content: JSON.stringify(inputData), // The user's filled form data
            name: "request_batch_transfer_input"
        });

        // Update state to include this message and approve
        // This effectively "mocks" the tool execution with the user's data
        await agent.updateState(threadConfig, {
            messages: [toolMessage],
            approvalStatus: "APPROVED"
        });
        
        // Resume execution
        const result = await agent.invoke(null, threadConfig);

        const steps = extractSteps(result.messages);
        const lastMsg = result.messages[result.messages.length - 1];

        res.json({
            response: lastMsg.content,
            status: "COMPLETED",
            sessionId: sessionId,
            steps: steps
        });
        
    } catch (error: any) {
        console.error("❌ Input Submission Error:", error);
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

// Export for Vercel
export default app;

// Only start server if run directly
import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    app.listen(port, () => {
        console.log(`🚀 SDK Server running at http://localhost:3001`);
    });
}
