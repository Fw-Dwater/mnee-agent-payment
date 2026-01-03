import { EthereumService } from "../services/ethereum.js";
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    console.log("Checking Agent MNEE (ERC-20) Balance...");
    try {
        const ethService = new EthereumService();
        const address = ethService.getAddress();
        console.log(`Agent Address: ${address}`);
        
        const ethBalance = await ethService.getBalance();
        console.log(`ETH Balance: ${ethBalance}`);

        const mneeAddress = process.env.MNEE_TOKEN_ADDRESS;
        if (!mneeAddress) {
            console.error("❌ MNEE_TOKEN_ADDRESS not found in .env");
            return;
        }
        console.log(`MNEE Token Address: ${mneeAddress}`);

        const mneeBalance = await ethService.getERC20Balance(mneeAddress);
        console.log(`MNEE Balance: ${mneeBalance}`);
        
    } catch (error: any) {
        console.error("Error:", error);
    }
}

main();
