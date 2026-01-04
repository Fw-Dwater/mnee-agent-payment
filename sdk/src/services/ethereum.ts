import { ethers } from "ethers";
import dotenv from 'dotenv';

dotenv.config();

export class EthereumService {
    private provider: ethers.JsonRpcProvider;
    private wallet: ethers.Wallet;

    constructor() {
        const rpcUrl = process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org";
        const privateKey = process.env.PRIVATE_KEY;
        
        if (!privateKey) {
            throw new Error("PRIVATE_KEY not found in .env");
        }

        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.wallet = new ethers.Wallet(privateKey, this.provider);
    }

    getAddress(): string {
        return this.wallet.address;
    }

    async getBalance(): Promise<string> {
        try {
            const bal = await this.provider.getBalance(this.wallet.address);
            return ethers.formatEther(bal);
        } catch (e: any) {
            console.error("Error getting ETH balance:", e);
            return "0";
        }
    }

    async transfer(to: string, amount: string): Promise<string> {
        try {
            const parsedAmount = ethers.parseEther(amount);
            
            // Gas Safety Check
            const feeData = await this.provider.getFeeData();
            const estimatedGas = await this.wallet.estimateGas({ to, value: parsedAmount });
            const gasCost = estimatedGas * (feeData.gasPrice || 1n);
            const balance = await this.provider.getBalance(this.wallet.address);

            if (balance < parsedAmount + gasCost) {
                throw new Error(`Insufficient ETH balance for amount + gas. Need ${ethers.formatEther(parsedAmount + gasCost)} ETH.`);
            }

            const tx = await this.wallet.sendTransaction({
                to,
                value: parsedAmount
            });
            console.log(`ETH Transfer submitted: ${tx.hash}`);
            await tx.wait();
            return tx.hash;
        } catch (e: any) {
            console.error("ETH Transfer error:", e);
            throw new Error(`ETH Transfer failed: ${e.message}`);
        }
    }

    // --- ERC-20 Support ---

    private getERC20Contract(tokenAddress: string) {
        const abi = [
            "function balanceOf(address owner) view returns (uint256)",
            "function transfer(address to, uint256 amount) returns (bool)",
            "function approve(address spender, uint256 amount) returns (bool)",
            "function allowance(address owner, address spender) view returns (uint256)",
            "function deposit() payable", // For WETH
            "function withdraw(uint256 amount)" // For WETH
        ];
        return new ethers.Contract(tokenAddress, abi, this.wallet);
    }

    async getERC20Balance(tokenAddress: string): Promise<string> {
        try {
            const contract = this.getERC20Contract(tokenAddress);
            const bal = await contract.balanceOf(this.wallet.address);
            return ethers.formatEther(bal);
        } catch (e: any) {
            console.error("Error getting ERC20 balance:", e);
            throw new Error(`Failed to get ERC20 balance: ${e.message}`);
        }
    }

    async transferERC20(tokenAddress: string, to: string, amount: string): Promise<string> {
        try {
            const contract = this.getERC20Contract(tokenAddress);
            const parsedAmount = ethers.parseEther(amount);

            // Gas Check (ERC-20 Transfer)
            const feeData = await this.provider.getFeeData();
            const estimatedGas = await contract.transfer.estimateGas(to, parsedAmount);
            const gasCost = estimatedGas * (feeData.gasPrice || 1n);
            const ethBalance = await this.provider.getBalance(this.wallet.address);

            if (ethBalance < gasCost) {
                throw new Error(`Insufficient ETH for Gas. Estimated cost: ${ethers.formatEther(gasCost)} ETH.`);
            }

            const tx = await contract.transfer(to, parsedAmount);
            console.log(`ERC20 Transfer submitted: ${tx.hash}`);
            await tx.wait();
            return tx.hash;
        } catch (e: any) {
            console.error("ERC20 Transfer error:", e);
            throw new Error(`ERC20 Transfer failed: ${e.message}`);
        }
    }

    async approveERC20(tokenAddress: string, spender: string, amount: string): Promise<string> {
        try {
            const contract = this.getERC20Contract(tokenAddress);
            const parsedAmount = ethers.parseEther(amount);

            // Gas Check (Approve)
            const feeData = await this.provider.getFeeData();
            const estimatedGas = await contract.approve.estimateGas(spender, parsedAmount);
            const gasCost = estimatedGas * (feeData.gasPrice || 1n);
            const ethBalance = await this.provider.getBalance(this.wallet.address);

            if (ethBalance < gasCost) {
                throw new Error(`Insufficient ETH for Gas (Approve). Estimated cost: ${ethers.formatEther(gasCost)} ETH.`);
            }

            const tx = await contract.approve(spender, parsedAmount);
            console.log(`ERC20 Approve submitted: ${tx.hash}`);
            await tx.wait();
            return tx.hash;
        } catch (e: any) {
            console.error("ERC20 Approve error:", e);
            throw new Error(`ERC20 Approve failed: ${e.message}`);
        }
    }

    async wrapETH(tokenAddress: string, amount: string): Promise<string> {
        try {
            const contract = this.getERC20Contract(tokenAddress);
            // Check if it has deposit method (WETH)
            // Note: If it's not WETH, this might fail, but for our mock "MNEE" (which is WETH), it works.
            const tx = await contract.deposit({ value: ethers.parseEther(amount) });
            console.log(`Wrap ETH submitted: ${tx.hash}`);
            await tx.wait();
            return tx.hash;
        } catch (e: any) {
             console.error("Wrap ETH error:", e);
             throw new Error(`Wrap ETH failed: ${e.message}`);
        }
    }
}
