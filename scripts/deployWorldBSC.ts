// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, network, run } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { TASK_VERIFY } from "@nomiclabs/hardhat-etherscan/dist/src/constants";

async function main(): Promise<void> {
  const TOKEN_ADDRESS = "0x31FFbe9bf84b4d9d02cd40eCcAB4Af1E2877Bbc6";
  const WRAPPED_TOKEN_ADDRESS = "0x97beCDC5e95858eC2a8CD8631B3d56234461aD62";

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

  const WorldBSC: ContractFactory = await ethers.getContractFactory("WorldBSC");
  const worldBSC: Contract = await WorldBSC.deploy(
    TOKEN_ADDRESS,
    WRAPPED_TOKEN_ADDRESS
  );
  await worldBSC.deployed();
  console.log("WorldBSC deployed to: ", worldBSC.address);

  // INITIAL SETUP
  await worldToken.excludeFromRewards(worldBSC.address);
  await worldToken.excludeFromFees(worldBSC.address);

  await run(TASK_VERIFY, {
    address: worldBSC.address,
    constructorArgsParams: [TOKEN_ADDRESS, WRAPPED_TOKEN_ADDRESS],
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
