// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, network, run } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { TASK_VERIFY } from "@nomiclabs/hardhat-etherscan/dist/src/pluginContext";

async function main(): Promise<void> {
  const TOKEN_ADDRESS = "0x99533c23477ce72d322204f7e8182099836953ca";
  const RATE = ethers.utils.parseEther("0.0009");

  if (network.name === "hardhat") {
    console.warn(
      "You are trying to deploy a contract to the Hardhat Network, which" +
      "gets automatically created and destroyed every time. Use the Hardhat" +
      " option '--network localhost'",
    );
  }

  const [deployer] = await ethers.getSigners();
  console.log(
    "Deploying the contracts with the account:",
    await deployer.getAddress(),
  );

  console.log("Account balance: ", ethers.utils.formatEther(await deployer.getBalance()));

  const WorldToken: ContractFactory = await ethers.getContractFactory("WorldToken");
  const worldToken: Contract = await WorldToken.attach(TOKEN_ADDRESS);
  console.log("WorldToken address: ", worldToken.address);

  const WorldVesting: ContractFactory = await ethers.getContractFactory("WorldVesting");
  const worldVesting: Contract = await WorldVesting.deploy();
  await worldVesting.deployed();
  console.log("WorldVesting deployed to: ", worldVesting.address);

  const WorldOTC: ContractFactory = await ethers.getContractFactory("WorldOTC");
  const worldOTC: Contract = await WorldOTC.deploy(worldToken.address, worldVesting.address, RATE);
  await worldOTC.deployed();
  console.log("WorldOTC deployed to: ", worldOTC.address);

  await worldToken.excludeFromFees(worldOTC.address);

  await run(TASK_VERIFY, {
    address: worldOTC.address,
    constructorArguments: [worldToken.address, worldVesting.address, RATE.toString()],
  });

  await run(TASK_VERIFY, {
    address: worldVesting.address
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
