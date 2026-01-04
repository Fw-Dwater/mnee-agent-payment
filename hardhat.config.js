import "@nomicfoundation/hardhat-ethers";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '.env') });

const PRIVATE_KEY = process.env.PRIVATE_KEY ? process.env.PRIVATE_KEY.trim() : "";
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL ? process.env.SEPOLIA_RPC_URL.trim() : "";

console.log("Configuring Hardhat...");

if (!SEPOLIA_RPC_URL) {
    console.error("❌ SEPOLIA_RPC_URL is missing in .env");
}

export default {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`] : [],
      chainId: 11155111,
    },
  },
};
