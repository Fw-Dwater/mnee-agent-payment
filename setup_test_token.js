import { ethers } from 'ethers';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sepolia WETH Contract
const WETH_ADDRESS = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
const WETH_ABI = [
    "function deposit() payable",
    "function balanceOf(address) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)"
];

async function setup() {
    console.log("🛠️  Initializing Test Token Environment (WETH)...");

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey || privateKey.includes("your_private_key")) {
        console.error("❌ Error: Please set your PRIVATE_KEY in .env first.");
        process.exit(1);
    }

    const providerUrl = process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org";
    const provider = new ethers.JsonRpcProvider(providerUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log(`👤 Wallet: ${wallet.address}`);

    try {
        // 1. Check ETH
        const ethBalance = await provider.getBalance(wallet.address);
        console.log(`⛽ ETH Balance: ${ethers.formatEther(ethBalance)} ETH`);

        if (ethBalance < ethers.parseEther("0.02")) {
            console.error("❌ Insufficient ETH. You need at least 0.02 Sepolia ETH to run this setup safely.");
            process.exit(1);
        }

        // 2. Connect to WETH
        const weth = new ethers.Contract(WETH_ADDRESS, WETH_ABI, wallet);
        const wethBalance = await weth.balanceOf(wallet.address);
        console.log(`💰 Current WETH Balance: ${ethers.formatEther(wethBalance)} WETH`);

        // 3. Deposit if needed (Get 0.001 WETH)
        if (wethBalance < ethers.parseEther("0.001")) {
            console.log("🔄 Wrapping 0.001 ETH to WETH (Respecting low balance limit)...");
            const tx = await weth.deposit({ value: ethers.parseEther("0.001") });
            console.log(`   Tx Sent: ${tx.hash}`);
            await tx.wait();
            console.log("   ✅ Wrap Successful!");
        } else {
            console.log("   ✅ You already have enough WETH.");
        }

        // 4. Update .env
        const envPath = path.join(__dirname, '.env');
        let envContent = fs.readFileSync(envPath, 'utf8');

        if (envContent.includes("MNEE_TOKEN_ADDRESS=")) {
            // Replace existing
            envContent = envContent.replace(/MNEE_TOKEN_ADDRESS=.*/g, `MNEE_TOKEN_ADDRESS=${WETH_ADDRESS}`);
        } else {
            // Append
            envContent += `\nMNEE_TOKEN_ADDRESS=${WETH_ADDRESS}\n`;
        }

        fs.writeFileSync(envPath, envContent);
        console.log("📝 Updated .env with WETH contract address.");
        
        console.log("\n🎉 Setup Complete! Please restart your server to apply changes:");
        console.log("   Ctrl+C then 'node server.js'");

    } catch (error) {
        console.error("❌ Setup Failed:", error);
    }
}

setup();
