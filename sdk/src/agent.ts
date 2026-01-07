import { StateGraph, END, START } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AgentState, MNEEConfig } from "./types";
import { createMneeTools } from "./tools/blockchain";
import { ToolMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import https from "https";

import { EthereumService } from "./services/ethereum";

export function createMNEEAgent(config: MNEEConfig, checkpointer?: any) {
    const ethService = new EthereumService();
    const tools = createMneeTools(ethService);
    const toolNode = new ToolNode(tools);

    // Custom HTTPS Agent for DeepSeek SSL issues
    const httpsAgent = new https.Agent({
        rejectUnauthorized: false,
        keepAlive: false
    });

    const model = new ChatOpenAI({
        modelName: config.modelName || "deepseek-chat",
        apiKey: config.openAIApiKey,
        configuration: {
            baseURL: config.baseURL || "https://api.deepseek.com",
            httpAgent: httpsAgent,
            fetch: global.fetch,
        },
        temperature: 0
    }).bindTools(tools);

    // Node: Agent
    async function agentNode(state: typeof AgentState.State) {
        const { messages } = state;
        
        const systemPrompt = new SystemMessage(
            `You are the MNEE AI Agent, an intelligent asset manager for the MNEE ecosystem on Ethereum Sepolia.

Capabilities:
- Manage MNEE (ERC-20) and ETH assets.
- Execute payments, swaps (ETH->MNEE), approvals, staking, and unstaking.
- Understand high-level user intents and translate them into actions, including batch operations and scheduled tasks.
- Proactively suggest staking when idle MNEE is detected.

Guidelines:
- When asked for balances, report both wallet and staked balances.
- Before transfers, verify amounts and recipients.
- For batch operations, summarize planned actions and costs, then execute.
- For scheduling, confirm the time window and summarize the plan.`
        );

        const messagesWithSystem = [systemPrompt, ...messages];
        const result = await model.invoke(messagesWithSystem);
        return { messages: [result] };
    }

    // Node: Human Approval (Placeholder for interruption)
    async function humanApprovalNode(state: typeof AgentState.State) {
        // Logic to clear approval status if it was pending? 
        // Or just pass through.
        return {}; 
    }

    // Node: Reject Action
    async function rejectActionNode(state: typeof AgentState.State) {
        // Append a message simulating tool rejection
        const { messages } = state;
        const lastMsg = messages[messages.length - 1] as AIMessage;
        
        if (!lastMsg.tool_calls || lastMsg.tool_calls.length === 0) {
            // Should not happen in normal flow
            return {
                 messages: [new HumanMessage("I rejected the transaction.")]
            };
        }

        // Construct valid ToolMessages for all tool calls to satisfy the model requirement
        const toolMessages = lastMsg.tool_calls.map(call => {
            return new ToolMessage({
                tool_call_id: call.id!,
                content: "Error: User REJECTED the transaction request. The action was NOT executed.",
                name: call.name
            });
        });

        return {
            messages: toolMessages,
            approvalStatus: undefined // Reset
        };
    }

    // Conditional Logic: Check if tools need approval
    function shouldContinue(state: typeof AgentState.State) {
        const lastMessage = state.messages[state.messages.length - 1] as AIMessage;

        if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
            return END;
        }

        const financialTools = [
            "transfer_mnee",
            "transfer_eth",
            "swap_eth_for_mnee",
            "approve_mnee_spend",
            "stake_mnee",
            "unstake_mnee",
            "batch_transfer_mnee",
            "batch_transfer_eth",
            "schedule_batch_transfer_mnee",
            "schedule_recurring_transfer",
            "schedule_recurring_swap",
            "request_batch_transfer_input"
        ];
        const calls = lastMessage.tool_calls;
        
        for (const call of calls) {
            if (call.name === "request_batch_transfer_input") {
                 return "human_approval";
            }
            if (financialTools.includes(call.name)) {
                let amount = 0;
                if (call.args.amount) amount = parseFloat(call.args.amount);
                if (call.args.ethAmount) amount = parseFloat(call.args.ethAmount);
                if (call.name === "schedule_recurring_transfer" || call.name === "schedule_recurring_swap") {
                    const baseAmount = parseFloat(call.args.amount || "0");
                    const count = call.args.count || 5;
                    amount = baseAmount * count;
                }
                if (call.args.payments && Array.isArray(call.args.payments)) {
                    try {
                        amount = call.args.payments.reduce((sum: number, p: any) => sum + parseFloat(p.amount || "0"), 0);
                    } catch {
                        amount = 0;
                    }
                }
                if (call.args.executeAt && call.args.payments && Array.isArray(call.args.payments)) {
                    try {
                        amount = call.args.payments.reduce((sum: number, p: any) => sum + parseFloat(p.amount || "0"), 0);
                    } catch {
                        amount = 0;
                    }
                }
                
                if (amount > parseFloat(config.maxAutoAmount)) {
                    if (state.approvalStatus !== "APPROVED") {
                         return "human_approval";
                    }
                }
            }
        }

        return "tools";
    }

    // Logic after approval interruption
    function checkApproval(state: typeof AgentState.State) {
        if (state.approvalStatus === "APPROVED") {
            return "tools";
        }
        return "reject_action";
    }

    const workflow = new StateGraph(AgentState)
        .addNode("agent", agentNode)
        .addNode("tools", toolNode)
        .addNode("human_approval", humanApprovalNode)
        .addNode("reject_action", rejectActionNode)
        .addEdge(START, "agent")
        .addConditionalEdges("agent", shouldContinue, {
            [END]: END,
            tools: "tools",
            human_approval: "human_approval"
        })
        .addConditionalEdges("human_approval", checkApproval, {
            tools: "tools",
            reject_action: "reject_action"
        })
        .addEdge("tools", "agent")
        .addEdge("reject_action", "agent");

    return workflow.compile({
        checkpointer: checkpointer,
        interruptBefore: ["human_approval"]
    });
}
