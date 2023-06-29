import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contrancts with the account: ${deployer.address}`);

  const provider = deployer.provider;
  const balance = await provider.getBalance(deployer.address);
  console.log(`Deploying Account balance: ${balance.toString()}`);

  const DeepLink = await ethers.getContractFactory('DeepLink');
  const deepLink = await DeepLink.deploy();
  console.log(`DeepLink NFT address: ${deepLink.getAddress()}`);

  const Auction = await ethers.getContractFactory('Auction');
  const auction = await Auction.deploy();
  console.log(`Auction contract address: ${auction.getAddress()}`);

  console.log(`Done`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});