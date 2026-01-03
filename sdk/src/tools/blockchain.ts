import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { EthereumService } from "../services/ethereum.js";
import dotenv from 'dotenv';

dotenv.config();

const MNEE_TOKEN_ADDRESS = process.env.MNEE_TOKEN_ADDRESS;

export function createMneeTools(ethService: EthereumService) {
    if (!MNEE_TOKEN_ADDRESS) {
        console.warn("⚠️ MNEE_TOKEN_ADDRESS not found in .env. MNEE tools might fail.");
    }

    return [
        // --- MNEE Tools (ERC-20 on Sepolia) ---
        new DynamicStructuredTool({
            name: "get_mnee_balance",
            description: "Get the current MNEE (Testnet ERC-20) token balance of the agent's wallet (Sepolia Network).",
            schema: z.object({}),
            func: async () => {
                try {
                    if (!MNEE_TOKEN_ADDRESS) throw new Error("MNEE_TOKEN_ADDRESS not configured.");
                    const balance = await ethService.getERC20Balance(MNEE_TOKEN_ADDRESS);
                    return `MNEE Balance (Sepolia ERC-20): ${balance} MNEE`;
                } catch (e: any) {
                    return `Failed to get MNEE balance: ${e.message}`;
                }
            }
        }),
        new DynamicStructuredTool({
            name: "get_mnee_address",
            description: "Get the agent's MNEE wallet address (Same as ETH address on Sepolia).",
            schema: z.object({}),
            func: async () => {
                return ethService.getAddress();
            }
        }),
        new DynamicStructuredTool({
            name: "transfer_mnee",
            description: "Transfer MNEE tokens to another address on Sepolia Network.",
            schema: z.object({
                to: z.string().describe("The recipient Ethereum address"),
                amount: z.string().describe("The amount of MNEE to transfer")
            }),
            func: async ({ to, amount }) => {
                try {
                    if (!MNEE_TOKEN_ADDRESS) throw new Error("MNEE_TOKEN_ADDRESS not configured.");
                    const txHash = await ethService.transferERC20(MNEE_TOKEN_ADDRESS, to, amount);
                    return `MNEE Transfer Successful. Tx Hash: ${txHash}`;
                } catch (e: any) {
                    return `MNEE Transfer Failed: ${e.message}`;
                }
            }
        }),
        new DynamicStructuredTool({
            name: "swap_eth_for_mnee",
            description: "Swap ETH for MNEE tokens (Testnet: Wraps ETH to MNEE/WETH).",
            schema: z.object({
                amount: z.string().describe("Amount of ETH to swap for MNEE")
            }),
            func: async ({ amount }) => {
                try {
                    if (!MNEE_TOKEN_ADDRESS) throw new Error("MNEE_TOKEN_ADDRESS not configured.");
                    const txHash = await ethService.wrapETH(MNEE_TOKEN_ADDRESS, amount);
                    return `Swap Successful (ETH -> MNEE). Tx Hash: ${txHash}`;
                } catch (e: any) {
                    return `Swap Failed: ${e.message}`;
                }
            }
        }),
        new DynamicStructuredTool({
            name: "approve_mnee_spend",
            description: "Approve a spender (contract/address) to spend MNEE tokens.",
            schema: z.object({
                spender: z.string().describe("The address to approve"),
                amount: z.string().describe("The amount of MNEE to approve")
            }),
            func: async ({ spender, amount }) => {
                try {
                     if (!MNEE_TOKEN_ADDRESS) throw new Error("MNEE_TOKEN_ADDRESS not configured.");
                     const txHash = await ethService.approveERC20(MNEE_TOKEN_ADDRESS, spender, amount);
                     return `MNEE Approval Successful. Tx Hash: ${txHash}`;
                } catch (e: any) {
                    return `Approval Failed: ${e.message}`;
                }
            }
        }),

        // --- Ethereum Tools (Native ETH) ---
        new DynamicStructuredTool({
            name: "get_eth_balance",
            description: "Get the current ETH balance of the agent's wallet (Sepolia Network).",
            schema: z.object({}),
            func: async () => {
                try {
                    const balance = await ethService.getBalance();
                    return `ETH Balance (Sepolia): ${balance} ETH`;
                } catch (e: any) {
                    return `Failed to get ETH balance: ${e.message}`;
                }
            }
        }),
        new DynamicStructuredTool({
            name: "get_eth_address",
            description: "Get the agent's Ethereum wallet address.",
            schema: z.object({}),
            func: async () => {
                return ethService.getAddress();
            }
        }),
        new DynamicStructuredTool({
            name: "transfer_eth",
            description: "Transfer ETH to another address on Sepolia Network.",
            schema: z.object({
                to: z.string().describe("The recipient Ethereum address"),
                amount: z.string().describe("The amount of ETH to transfer")
            }),
            func: async ({ to, amount }) => {
                try {
                    const txHash = await ethService.transfer(to, amount);
                    return `ETH Transfer Successful. Tx Hash: ${txHash}`;
                } catch (e: any) {
                    return `ETH Transfer Failed: ${e.message}`;
                }
            }
        })
    ];
}
