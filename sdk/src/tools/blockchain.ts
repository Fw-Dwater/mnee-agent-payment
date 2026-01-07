import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { EthereumService } from "../services/ethereum.js";
import dotenv from 'dotenv';

dotenv.config();

const MNEE_TOKEN_ADDRESS = process.env.MNEE_TOKEN_ADDRESS;
const MNEE_STAKING_CONTRACT_ADDRESS = process.env.MNEE_STAKING_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000"; // Placeholder
type BatchPayment = { to: string; amount: string };
export type ScheduledJob = { id: string; type: string; executeAt: number; payload: any; status?: 'pending' | 'completed' | 'failed' };
export const scheduledJobs: ScheduledJob[] = [];

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
                    
                    let stakedBalance = "0";
                    if (MNEE_STAKING_CONTRACT_ADDRESS && MNEE_STAKING_CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000") {
                        stakedBalance = await ethService.getStakedBalance(MNEE_STAKING_CONTRACT_ADDRESS);
                    }

                    return `MNEE Balance (Sepolia ERC-20): ${balance} MNEE\nStaked MNEE Balance: ${stakedBalance} MNEE`;
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
            name: "batch_transfer_mnee",
            description: "Batch transfer MNEE tokens to multiple recipients on Sepolia.",
            schema: z.object({
                payments: z.array(z.object({
                    to: z.string().describe("Recipient address"),
                    amount: z.string().describe("MNEE amount")
                })).min(1).max(50)
            }),
            func: async ({ payments }: { payments: BatchPayment[] }) => {
                try {
                    if (!MNEE_TOKEN_ADDRESS) throw new Error("MNEE_TOKEN_ADDRESS not configured.");
                    const results: { to: string; amount: string; txHash?: string; error?: string }[] = [];
                    for (const p of payments) {
                        try {
                            const txHash = await ethService.transferERC20(MNEE_TOKEN_ADDRESS, p.to, p.amount);
                            results.push({ to: p.to, amount: p.amount, txHash });
                        } catch (err: any) {
                            results.push({ to: p.to, amount: p.amount, error: err.message });
                        }
                    }
                    const success = results.filter(r => r.txHash).length;
                    const failed = results.filter(r => r.error).length;
                    return JSON.stringify({ summary: { success, failed }, results });
                } catch (e: any) {
                    return `Batch MNEE Transfer Failed: ${e.message}`;
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
        new DynamicStructuredTool({
            name: "stake_mnee",
            description: "Stake MNEE tokens into the staking contract to earn loyalty points.",
            schema: z.object({
                amount: z.string().describe("The amount of MNEE to stake")
            }),
            func: async ({ amount }) => {
                try {
                    if (!MNEE_TOKEN_ADDRESS) throw new Error("MNEE_TOKEN_ADDRESS not configured.");
                    // In a real scenario, we would read the contract address from ENV or a config
                    // For now, we use the placeholder or env
                    if (MNEE_STAKING_CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
                         return "Staking Contract not deployed yet. Please deploy the contract first.";
                    }
                    const txHash = await ethService.stakeMNEE(MNEE_STAKING_CONTRACT_ADDRESS, MNEE_TOKEN_ADDRESS, amount);
                    return `MNEE Staking Successful. Tx Hash: ${txHash}`;
                } catch (e: any) {
                    return `Staking Failed: ${e.message}`;
                }
            }
        }),
        new DynamicStructuredTool({
            name: "unstake_mnee",
            description: "Unstake MNEE tokens from the staking contract.",
            schema: z.object({
                amount: z.string().describe("The amount of MNEE to unstake")
            }),
            func: async ({ amount }) => {
                try {
                    if (MNEE_STAKING_CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
                         return "Staking Contract not deployed yet.";
                    }
                    const txHash = await ethService.unstakeMNEE(MNEE_STAKING_CONTRACT_ADDRESS, amount);
                    return `MNEE Unstaking Successful. Tx Hash: ${txHash}`;
                } catch (e: any) {
                    return `Unstaking Failed: ${e.message}`;
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
        }),
        new DynamicStructuredTool({
            name: "batch_transfer_eth",
            description: "Batch transfer ETH to multiple recipients on Sepolia.",
            schema: z.object({
                payments: z.array(z.object({
                    to: z.string().describe("Recipient address"),
                    amount: z.string().describe("ETH amount")
                })).min(1).max(50)
            }),
            func: async ({ payments }: { payments: BatchPayment[] }) => {
                try {
                    const results: { to: string; amount: string; txHash?: string; error?: string }[] = [];
                    for (const p of payments) {
                        try {
                            const txHash = await ethService.transfer(p.to, p.amount);
                            results.push({ to: p.to, amount: p.amount, txHash });
                        } catch (err: any) {
                            results.push({ to: p.to, amount: p.amount, error: err.message });
                        }
                    }
                    const success = results.filter(r => r.txHash).length;
                    const failed = results.filter(r => r.error).length;
                    return JSON.stringify({ summary: { success, failed }, results });
                } catch (e: any) {
                    return `Batch ETH Transfer Failed: ${e.message}`;
                }
            }
        }),
        new DynamicStructuredTool({
            name: "schedule_batch_transfer_mnee",
            description: "Schedule a batch MNEE transfer at a future time.",
            schema: z.object({
                payments: z.array(z.object({
                    to: z.string().describe("Recipient address"),
                    amount: z.string().describe("MNEE amount")
                })).min(1).max(50),
                executeAt: z.string().describe("ISO datetime or epoch milliseconds")
            }),
            func: async ({ payments, executeAt }: { payments: BatchPayment[]; executeAt: string }) => {
                try {
                    if (!MNEE_TOKEN_ADDRESS) throw new Error("MNEE_TOKEN_ADDRESS not configured.");
                    const ts = isNaN(Number(executeAt)) ? Date.parse(executeAt) : Number(executeAt);
                    if (!ts || ts <= Date.now()) throw new Error("Invalid executeAt time");
                    const id = Math.random().toString(36).slice(2);
                    scheduledJobs.push({ id, type: "batch_mnee", executeAt: ts, payload: { payments } });
                    const delay = ts - Date.now();
                    setTimeout(async () => {
                        for (const p of payments) {
                            try {
                                await ethService.transferERC20(MNEE_TOKEN_ADDRESS!, p.to, p.amount);
                            } catch {}
                        }
                    }, delay);
                    return JSON.stringify({ scheduled: true, id, executeAt: ts, count: payments.length });
                } catch (e: any) {
                    return `Schedule Failed: ${e.message}`;
                }
            }
        }),
        new DynamicStructuredTool({
            name: "schedule_recurring_transfer",
            description: "Schedule a recurring MNEE transfer (Automated Payment).",
            schema: z.object({
                to: z.string().describe("Recipient address"),
                amount: z.string().describe("MNEE amount per payment"),
                intervalMinutes: z.number().describe("Interval in minutes between payments"),
                count: z.number().optional().describe("Number of times to execute (default: 5)")
            }),
            func: async ({ to, amount, intervalMinutes, count = 5 }) => {
                try {
                    if (!MNEE_TOKEN_ADDRESS) throw new Error("MNEE_TOKEN_ADDRESS not configured.");
                    const id = Math.random().toString(36).slice(2);
                    const job = { 
                        id, 
                        type: "recurring_mnee", 
                        payload: { to, amount, intervalMinutes, remaining: count } 
                    };
                    
                    // Recursive timeout function
                    const runJob = async () => {
                        if (job.payload.remaining <= 0) return;
                        
                        try {
                            console.log(`Executing Recurring Payment ${id}: ${amount} MNEE to ${to}`);
                            await ethService.transferERC20(MNEE_TOKEN_ADDRESS!, to, amount);
                            job.payload.remaining--;
                            
                            if (job.payload.remaining > 0) {
                                setTimeout(runJob, intervalMinutes * 60 * 1000);
                            }
                        } catch (e) {
                            console.error(`Recurring Payment ${id} Failed:`, e);
                        }
                    };

                    // Start first execution after interval
                    setTimeout(runJob, intervalMinutes * 60 * 1000);
                    
                    scheduledJobs.push({ ...job, executeAt: Date.now() + intervalMinutes * 60 * 1000 } as any);

                    return `Recurring Payment Scheduled. ID: ${id}. Will transfer ${amount} MNEE to ${to} every ${intervalMinutes} minutes for ${count} times.`;
                } catch (e: any) {
                    return `Schedule Failed: ${e.message}`;
                }
            }
        }),
        new DynamicStructuredTool({
            name: "schedule_recurring_swap",
            description: "Schedule a recurring ETH to MNEE swap.",
            schema: z.object({
                amount: z.string().describe("ETH amount per swap"),
                intervalMinutes: z.number().describe("Interval in minutes between swaps"),
                count: z.number().optional().describe("Number of times to execute (default: 5)")
            }),
            func: async ({ amount, intervalMinutes, count = 5 }) => {
                try {
                    if (!MNEE_TOKEN_ADDRESS) throw new Error("MNEE_TOKEN_ADDRESS not configured.");
                    const id = Math.random().toString(36).slice(2);
                    const job = { 
                        id, 
                        type: "recurring_swap_eth_mnee", 
                        executeAt: Date.now() + intervalMinutes * 60 * 1000,
                        payload: { amount, intervalMinutes, remaining: count } 
                    };
                    
                    const runJob = async () => {
                        if (job.payload.remaining <= 0) {
                             job.status = 'completed';
                             return;
                        }
                        
                        try {
                            console.log(`Executing Recurring Swap ${id}: ${amount} ETH -> MNEE`);
                            await ethService.wrapETH(MNEE_TOKEN_ADDRESS!, amount);
                            job.payload.remaining--;
                            
                            if (job.payload.remaining > 0) {
                                const nextRun = Date.now() + intervalMinutes * 60 * 1000;
                                job.executeAt = nextRun; // Update next execution time
                                setTimeout(runJob, intervalMinutes * 60 * 1000);
                            } else {
                                job.status = 'completed';
                            }
                        } catch (e) {
                            console.error(`Recurring Swap ${id} Failed:`, e);
                            job.status = 'failed';
                        }
                    };

                    setTimeout(runJob, intervalMinutes * 60 * 1000);
                    
                    scheduledJobs.push(job as ScheduledJob);

                    return `Recurring Swap Scheduled. ID: ${id}. Will swap ${amount} ETH to MNEE every ${intervalMinutes} minutes for ${count} times.`;
                } catch (e: any) {
                    return `Schedule Failed: ${e.message}`;
                }
            }
        }),
        new DynamicStructuredTool({
            name: "list_scheduled_jobs",
            description: "List scheduled payment jobs.",
            schema: z.object({}),
            func: async () => {
                try {
                    const jobs = scheduledJobs.filter(j => j.executeAt > Date.now());
                    return JSON.stringify({ jobs });
                } catch (e: any) {
                    return `List Jobs Failed: ${e.message}`;
                }
            }
        }),
        new DynamicStructuredTool({
            name: "request_batch_transfer_input",
            description: "Request the user to fill out a batch transfer form via the frontend UI. Use this when the user indicates a batch transfer intent but details are incomplete or a UI is requested.",
            schema: z.object({
                token: z.enum(["ETH", "MNEE"]).describe("The token to transfer"),
                defaultAmount: z.string().optional().describe("Default amount per row"),
                count: z.number().optional().describe("Default number of rows")
            }),
            func: async ({ token, defaultAmount, count }) => {
                return `Form requested for ${token}. User input pending...`;
            }
        })
    ];
}
