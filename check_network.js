import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

console.log("RPC URL:", process.env.SEPOLIA_RPC_URL);

async function check() {
    try {
        console.log("Connecting to provider...");
        const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
        console.log("Getting network...");
        const network = await provider.getNetwork();
        console.log("Chain ID:", network.chainId.toString());
        
        const address = "0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF";
        console.log("Getting code...");
        const code = await provider.getCode(address);
        console.log(`Code at ${address}:`, code.slice(0, 50) + "...");
    } catch (e) {
        console.error("Error:", e);
    }
}

check();
