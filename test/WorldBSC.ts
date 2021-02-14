import { waffle } from "hardhat";
import { expect } from "chai";

import WorldTokenArtifact from "../artifacts/contracts/WorldToken.sol/WorldToken.json";
import WorldBSCArtifact from "../artifacts/contracts/WorldBSC.sol/WorldBSC.json";

import { ERC20Mock, WorldBSC, WorldToken } from "../typechain";
import { constants, utils, Wallet } from "ethers";
import ERC20MockArtifact from "../artifacts/contracts/mocks/ERC20Mock.sol/ERC20Mock.json";

const { deployContract, provider } = waffle;
const { parseEther } = utils;

describe("WORLD OTC unit tests", () => {
  const [
    deployer,
    account
  ] = provider.getWallets() as Wallet[];
  let worldToken: WorldToken;
  let bWorldToken: ERC20Mock;
  let worldBSC: WorldBSC;

  beforeEach(async () => {
    worldToken = (await deployContract(deployer, WorldTokenArtifact, [
      deployer.address,
    ])) as WorldToken;

    bWorldToken = (await deployContract(deployer, ERC20MockArtifact, [
      "Wrapped WORLD",
      "bWORLD",
      utils.parseEther("100000"),
    ])) as ERC20Mock;

    worldBSC = (await deployContract(deployer, WorldBSCArtifact, [
      worldToken.address,
      bWorldToken.address
    ])) as WorldBSC;

    await worldToken.excludeFromFees(worldBSC.address);
    await worldToken.excludeFromRewards(worldBSC.address);
  });

  it("should swap 100 wrapped world to 100 world", async () => {
    await worldToken.transfer(worldBSC.address, parseEther("50000"));
    await bWorldToken.transfer(account.address, parseEther("200"));

    let balance = await worldToken.balanceOf(account.address);
    expect(balance).to.equal(0);

    await bWorldToken.connect(account).approve(worldBSC.address, constants.MaxUint256);
    await worldBSC.connect(account).swapWrappedWorldToWorld(parseEther("100"));

    const wrappedBalance = await bWorldToken.balanceOf(account.address);
    expect(wrappedBalance).to.equal(parseEther("100"));

    balance = await worldToken.balanceOf(account.address);
    expect(balance).to.equal(parseEther("100"));
  });

  it("should swap 100 world to 100 wrapped world", async () => {
    await bWorldToken.transfer(worldBSC.address, parseEther("50000"));
    await worldToken.transfer(account.address, parseEther("200"));

    let wrappedBalance = await bWorldToken.balanceOf(account.address);
    expect(wrappedBalance).to.equal(0);

    await worldToken.connect(account).approve(worldBSC.address, constants.MaxUint256);
    await worldBSC.connect(account).swapWorldToWrappedWorld(parseEther("100"));

    const balance = await worldToken.balanceOf(account.address);
    expect(balance).to.equal(parseEther("100"));

    wrappedBalance = await worldToken.balanceOf(account.address);
    expect(wrappedBalance).to.equal(parseEther("100"));
  });

  it("should revert if input amount is zero", async () => {
    await expect(worldBSC.connect(account).swapWrappedWorldToWorld(0)).to.be.reverted;
    await expect(worldBSC.connect(account).swapWorldToWrappedWorld(0)).to.be.reverted;
  });

  it("should revert if supply is zero", async () => {
    await expect(worldBSC.connect(account).swapWrappedWorldToWorld(parseEther("100"))).to.be.reverted;
    await expect(worldBSC.connect(account).swapWorldToWrappedWorld(parseEther("100"))).to.be.reverted;
  });

  it("should revert if supply is insufficient", async () => {
    await worldToken.transfer(worldBSC.address, parseEther("10"));
    await bWorldToken.transfer(worldBSC.address, parseEther("10"));

    await expect(worldBSC.connect(account).swapWrappedWorldToWorld(parseEther("100"))).to.be.reverted;
    await expect(worldBSC.connect(account).swapWorldToWrappedWorld(parseEther("100"))).to.be.reverted;
  });

  it("should revert if caller's balance is insufficient", async () => {
    await worldToken.transfer(worldBSC.address, parseEther("1000"));
    await bWorldToken.transfer(worldBSC.address, parseEther("1000"));

    await expect(worldBSC.connect(account).swapWrappedWorldToWorld(parseEther("100"))).to.be.reverted;
    await expect(worldBSC.connect(account).swapWorldToWrappedWorld(parseEther("100"))).to.be.reverted;
  });
});
