import hre from "hardhat";
const { ethers } = hre;

async function main() {
  const mneeTokenAddress = process.env.MNEE_TOKEN_ADDRESS;

  if (!mneeTokenAddress) {
    console.error("Please set MNEE_TOKEN_ADDRESS in .env");
    process.exit(1);
  }

  console.log("Deploying MNEEStaking contract...");
  console.log("Staking Token (MNEE):", mneeTokenAddress);

  console.log("Network:", hre.network.name);
  // Safe check for accounts existence
  const sepoliaConfig = hre.config.networks.sepolia;
  if (sepoliaConfig && sepoliaConfig.accounts) {
      console.log("Config accounts loaded:", Array.isArray(sepoliaConfig.accounts) ? sepoliaConfig.accounts.length : "Not an array");
  } else {
      console.log("Config accounts missing for Sepolia");
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("No signer found. Check your .env PRIVATE_KEY.");
  }
  console.log("Deploying with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance));

  const MNEEStaking = await ethers.getContractFactory("MNEEStaking", deployer);
  const staking = await MNEEStaking.deploy(mneeTokenAddress);

  await staking.waitForDeployment();

  const address = await staking.getAddress();
  console.log(`MNEEStaking deployed to ${address}`);
  
  console.log("\nIMPORTANT: Please update your .env file with the new contract address:");
  console.log(`MNEE_STAKING_CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
