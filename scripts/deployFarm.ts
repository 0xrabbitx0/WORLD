// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, network, run } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { ChainId, Pair, Token, WETH } from "@uniswap/sdk";
import { TASK_VERIFY } from "@nomiclabs/hardhat-etherscan/dist/src/pluginContext";

async function main(): Promise<void> {
  const TOKEN_ADDRESS = "0xBF494F02EE3FdE1F20BEE6242bCe2d1ED0c15e47";

  // CHANGE THIS BEFORE DEPLOYING TO MAIN NET!
  const START_BLOCK = await ethers.provider.getBlockNumber() + 10;

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

  const WorldFarm: ContractFactory = await ethers.getContractFactory("WorldFarm");
  const worldFarm: Contract = await WorldFarm.deploy(
    TOKEN_ADDRESS,
    START_BLOCK,
  );
  await worldFarm.deployed();
  console.log("WorldFarm deployed to: ", worldFarm.address);
  console.log("WorldFarm start block: ", START_BLOCK);

  // INITIAL SETUP
  const chainId = network.config.chainId as ChainId;
  const lpTokenAddress = Pair.getAddress(
    new Token(chainId, worldToken.address, 18, "any"),
    WETH[chainId],
  );

  await worldFarm.add(
    10,
    lpTokenAddress,
    false,
  );

  await worldToken.setLpStakingAddress(worldFarm.address);
  await worldToken.excludeFromRewards(worldFarm.address);
  await worldToken.excludeFromFees(worldFarm.address);

  await run(TASK_VERIFY, {
    address: worldFarm.address,
    constructorArguments: [TOKEN_ADDRESS, START_BLOCK.toString()],
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
