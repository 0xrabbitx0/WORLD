// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, network, run } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { TASK_VERIFY } from "@nomiclabs/hardhat-etherscan/dist/src/constants";

async function main(): Promise<void> {
  const TOKEN_ADDRESS = "0x31FFbe9bf84b4d9d02cd40eCcAB4Af1E2877Bbc6";

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
  // const chainId = network.config.chainId as ChainId;
  const lpTokenAddress = "0x015081CeCBa29736fBae67b08a9abFc12e0c6A04"

  await worldFarm.add(
    10,
    lpTokenAddress,
    false,
  );

  await worldToken.setLpStakingAddress(worldFarm.address);
  await worldToken.excludeFromRewards(worldFarm.address);
  // await worldToken.excludeFromFees(worldFarm.address);

  await run(TASK_VERIFY, {
    address: worldFarm.address,
    constructorArgsParams: [TOKEN_ADDRESS, START_BLOCK.toString()],
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
