// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, network, run } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import {
  ChainId,
  Pair,
  Token,
  WETH
} from '@uniswap/sdk';
import { TASK_VERIFY } from "@nomiclabs/hardhat-etherscan/dist/src/pluginContext";

async function main(): Promise<void> {
  const MARKETING_ADDRESS = "0xD4713A489194eeE0ccaD316a0A6Ec2322290B4F9";

  if (network.name === "hardhat") {
    console.warn(
      "You are trying to deploy a contract to the Hardhat Network, which" +
      "gets automatically created and destroyed every time. Use the Hardhat" +
      " option '--network localhost'"
    );
  }

  const [deployer] = await ethers.getSigners();
  console.log(
    "Deploying the contracts with the account:",
    await deployer.getAddress()
  );

  console.log("Account balance: ", ethers.utils.formatEther(await deployer.getBalance()));

  console.log("Marketing address: ", MARKETING_ADDRESS);

  const WorldToken: ContractFactory = await ethers.getContractFactory("WorldToken");
  const worldToken: Contract = await WorldToken.deploy(MARKETING_ADDRESS);
  await worldToken.deployed();
  console.log("WorldToken deployed to: ", worldToken.address);

  // INITIAL SETUP
  const chainId = network.config.chainId as ChainId;
  const lpTokenAddress = Pair.getAddress(
    new Token(chainId, worldToken.address, 18, 'any'),
    WETH[chainId]
  );

  await worldToken.excludeFromRewards(lpTokenAddress);

  await run(TASK_VERIFY, {
    address: worldToken.address,
    constructorArguments: [MARKETING_ADDRESS],
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
