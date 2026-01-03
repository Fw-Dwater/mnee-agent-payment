import { BaseMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";

export const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  // Context for approval
  pendingToolCall: Annotation<any>({
    reducer: (x, y) => y ?? x,
  }),
  approvalStatus: Annotation<"PENDING" | "APPROVED" | "REJECTED" | undefined>({
    reducer: (x, y) => y ?? x,
  }),
});

export interface MNEEConfig {
    rpcUrl: string;
    privateKey: string;
    mneeTokenAddress: string;
    maxAutoAmount: string; // Threshold for auto-approval
    openAIApiKey: string;
    baseURL?: string;
    modelName?: string;
}
