import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { MNEE_CONFIG } from './blockchain_utils.js';

dotenv.config();

async function checkAccount() {
    console.log("🔍 Checking Account Status for Real Mode (Sepolia)...\n");

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey || privateKey.includes("your_private_key")) {
        console.error("❌ Error: PRIVATE_KEY is not set in .env");
        return;
    }

    const providerUrl = process.env.SEPOLIA_RPC_URL;
    if (!providerUrl) {
        console.error("❌ Error: SEPOLIA_RPC_URL is not set in .env");
        return;
    }

    try {
        const provider = new ethers.JsonRpcProvider(providerUrl);
        const wallet = new ethers.Wallet(privateKey, provider);
        
        console.log(`👤 Wallet Address: ${wallet.address}`);

        // 1. Check ETH Balance (Gas)
        const ethBalance = await provider.getBalance(wallet.address);
        const ethFormatted = ethers.formatEther(ethBalance);
        console.log(`⛽ ETH Balance:   ${ethFormatted} ETH`);

        if (parseFloat(ethFormatted) < 0.01) {
            console.warn(`   ⚠️  Low ETH! You need Sepolia ETH for gas fees.`);
            console.warn(`   👉 Get free ETH here: https://sepoliafaucet.com/ or https://www.infura.io/faucet/sepolia`);
        } else {
            console.log(`   ✅ Sufficient Gas`);
        }

        // 2. Check Token Balance
        console.log(`🎫 Token Address: ${MNEE_CONFIG.address}`);
        
        const code = await provider.getCode(MNEE_CONFIG.address);
        if (code === "0x") {
             console.log(`   ❌ Contract not found on chain (Using Mock Mode locally)`);
        } else {
             const contract = new ethers.Contract(MNEE_CONFIG.address, ["function balanceOf(address) view returns (uint256)", "function symbol() view returns (string)", "function decimals() view returns (uint8)"], wallet);
             try {
                 const symbol = await contract.symbol();
                 const decimals = await contract.decimals();
                 const balance = await contract.balanceOf(wallet.address);
                 console.log(`   ✅ Token Found: ${symbol} (${MNEE_CONFIG.address})`);
                 console.log(`   💰 Balance:     ${ethers.formatUnits(balance, decimals)} ${symbol}`);
             } catch (e) {
                 console.log(`   ⚠️  Token found but failed to read details: ${e.message}`);
             }
        }

    } catch (error) {
        console.error("❌ Connection Error:", error.message);
    }
}

checkAccount();
