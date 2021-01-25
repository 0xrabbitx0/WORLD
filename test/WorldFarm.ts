import { waffle } from "hardhat";
import { expect } from "chai";

import WorldFarmArtifact from "../artifacts/contracts/WorldFarm.sol/WorldFarm.json";
import WorldTokenArtifact from "../artifacts/contracts/WorldToken.sol/WorldToken.json";
import ERC20MockArtifact from "../artifacts/contracts/mocks/ERC20Mock.sol/ERC20Mock.json";

import { WorldFarm, WorldToken, ERC20Mock } from "../typechain";
import { Wallet, utils, constants } from "ethers";

const { deployContract, provider } = waffle;

const toNumber = (num) => Number(utils.formatEther(num)).toFixed(4);

describe("WORLD farm unit tests", () => {
  const [
    deployer,
    marketing,
    account1,
    account2,
  ] = provider.getWallets() as Wallet[];
  let worldFarm: WorldFarm;
  let worldToken: WorldToken;
  let lpToken: ERC20Mock;

  beforeEach(async () => {
    worldToken = (await deployContract(deployer, WorldTokenArtifact, [
      marketing.address,
    ])) as WorldToken;
    lpToken = (await deployContract(deployer, ERC20MockArtifact, [
      "WORLD-ETH PAIR",
      "UNI-V2",
      utils.parseEther("10000"),
    ])) as ERC20Mock;

    const block = await provider.getBlockNumber();
    const blocksPerDay = 6550;
    worldFarm = (await deployContract(deployer, WorldFarmArtifact, [
      worldToken.address,
      blocksPerDay,
      block + 1, // start block
    ])) as WorldFarm;

    await worldFarm.add(
      10,
      lpToken.address,
      false,
    );

    await worldToken.excludeFromReward(worldFarm.address);
    await worldToken.excludeFromFee(worldFarm.address);
  });

  it("should increase pending rewards when a block is mined", async () => {
    await worldToken.transfer(worldFarm.address, utils.parseEther("1000000"));

    const [blockReward] = await worldFarm.getWorldPerBlock();

    const SEVEN_LP_TOKENS = utils.parseEther("7"); // 70% share
    const THREE_LP_TOKENS = utils.parseEther("3"); // 30% share
    await lpToken.transfer(account1.address, SEVEN_LP_TOKENS);
    await lpToken.transfer(account2.address, THREE_LP_TOKENS);
    await lpToken.connect(account1).approve(worldFarm.address, constants.MaxUint256);
    await lpToken.connect(account2).approve(worldFarm.address, constants.MaxUint256);

    await worldFarm.connect(account1).deposit(0, SEVEN_LP_TOKENS);
    await worldFarm.connect(account2).deposit(0, THREE_LP_TOKENS); // a block is mined here
    const account1InitialPendingRewards = await worldFarm.connect(account1).pendingRewards(0, account1.address);
    const account2InitialPendingRewards = await worldFarm.connect(account2).pendingRewards(0, account2.address);
    expect(toNumber(account1InitialPendingRewards)).to.equal(toNumber(blockReward));
    expect(account2InitialPendingRewards).to.equal(0);

    await provider.send("evm_mine", []);

    const account1PendingRewards = await worldFarm.connect(account1).pendingRewards(0, account1.address);
    const account2PendingRewards = await worldFarm.connect(account2).pendingRewards(0, account2.address);
    expect(toNumber(account1PendingRewards))
      .to.equal(toNumber(account1InitialPendingRewards.add(blockReward.mul(70).div(100)))); // previous reward + 70% of block reward
    expect(toNumber(account2PendingRewards))
      .to.equal(toNumber(blockReward.mul(30).div(100))); // 30% of block reward
  });

  it("should calculate block reward if current block is after or same start block", async () => {
    await worldToken.transfer(worldFarm.address, utils.parseEther("1000000"));

    const currentBlock = await provider.getBlockNumber();
    const startBlock = await worldFarm.startBlock();
    const [blockReward] = await worldFarm.getWorldPerBlock();

    expect(currentBlock).to.gte(startBlock);
    expect(blockReward).to.equal(utils.parseEther("1.526717557251908396"));
  });

  it("should calculate block reward if timestamp is after or same block reward update time", async () => {
    await worldToken.transfer(worldFarm.address, utils.parseEther("1000000"));

    await worldFarm.updatePool(0); // this updates worldPerBlock and blockRewardLastUpdateTime

    const blockTimestamp = await (await provider.getBlock(await provider.getBlockNumber())).timestamp;
    const updateTime = await worldFarm.getWorldPerBlockUpdateTime();

    const [blockReward, update] = await worldFarm.getWorldPerBlock();
    expect(blockReward).to.equal(utils.parseEther("1.526717557251908396"));
    expect(update).to.equal(false);

    const lastUpdateTime = await worldFarm.blockRewardLastUpdateTime();
    expect(lastUpdateTime).to.equal(blockTimestamp);

    await worldToken.transfer(worldFarm.address, utils.parseEther("1000000"));

    const tomorrowMidnightUtc = blockTimestamp + updateTime.sub(blockTimestamp).toNumber() + 1;
    await provider.send("evm_increaseTime", [tomorrowMidnightUtc]);
    await provider.send("evm_mine", []);

    const [newBlockReward, newUpdate] = await worldFarm.getWorldPerBlock();
    expect(newBlockReward).to.equal(utils.parseEther("3.053435114503816793"));
    expect(newUpdate).to.equal(true);
  });

  it("should calculate block reward if worldPerBlock is zero", async () => {
    const block = await provider.getBlockNumber();
    const blocksPerDay = 6550;
    worldFarm = (await deployContract(deployer, WorldFarmArtifact, [
      worldToken.address,
      blocksPerDay,
      block + 1, // start block
    ])) as WorldFarm; // worldPerBlock is currently zero here
    await worldToken.transfer(worldFarm.address, utils.parseEther("1000000"));

    const [blockReward, update] = await worldFarm.getWorldPerBlock();
    expect(blockReward).to.equal(utils.parseEther("1.526717557251908396"));
    expect(update).to.equal(true);
  });

  it("should return the same block reward", async () => {
    await worldToken.transfer(worldFarm.address, utils.parseEther("1000000"));

    await worldFarm.updatePool(0); // this updates worldPerBlock and blockRewardLastUpdateTime

    const [blockReward, update] = await worldFarm.getWorldPerBlock();
    expect(blockReward).to.equal(utils.parseEther("1.526717557251908396"));
    expect(update).to.equal(false);
  });

  it("should return zero block reward if start block is before current block", async () => {
    const block = await provider.getBlockNumber();
    const blocksPerDay = 6550;
    worldFarm = (await deployContract(deployer, WorldFarmArtifact, [
      worldToken.address,
      blocksPerDay,
      block + 10, // start block
    ])) as WorldFarm;
    await worldToken.transfer(worldFarm.address, utils.parseEther("1000000"));

    const [blockReward, update] = await worldFarm.getWorldPerBlock();
    const startBlock = await worldFarm.startBlock();
    const currentBlock = await provider.getBlockNumber();

    expect(currentBlock).to.equal(block + 2);
    expect(startBlock).to.equal(block + 10);
    expect(blockReward).to.equal(0);
    expect(update).to.equal(false);
  });

  it("should return zero block reward if pool reward is zero", async () => {
    const block = await provider.getBlockNumber();
    const blocksPerDay = 6550;
    worldFarm = (await deployContract(deployer, WorldFarmArtifact, [
      worldToken.address,
      blocksPerDay,
      block + 1, // start block
    ])) as WorldFarm;

    const [blockReward, update] = await worldFarm.getWorldPerBlock();
    expect(blockReward).to.equal(0);
    expect(update).to.equal(false);
  });

  it("should revert if the same lp token is being added twice", async () => {
    await expect(worldFarm.add(
      10,
      lpToken.address,
      false,
    )).to.be.reverted;
  });

  it("should revert if add allocPoint is outside of range 5-10", async () => {
    await expect(worldFarm.add(
      4,
      "0x000000000000000000000000000000000000dEaD",
      false,
    )).to.be.reverted;

    await expect(worldFarm.add(
      11,
      "0x000000000000000000000000000000000000dEaD",
      false,
    )).to.be.reverted;
  });

  it("should revert if set allocPoint is outside of range 5-10", async () => {
    await expect(worldFarm.set(
      0,
      4,
      false,
    )).to.be.reverted;

    await expect(worldFarm.set(
      0,
      11,
      false,
    )).to.be.reverted;
  });

  it("should not revert if add allocPoint is in range 5-10", async () => {
    await expect(worldFarm.add(
      6,
      "0x000000000000000000000000000000000000dEaD",
      false,
    )).to.be.not.reverted;
  });

  it("should not revert if set allocPoint is in range 5-10", async () => {
    await expect(worldFarm.set(
      0,
      6,
      false,
    )).to.be.not.reverted;
  });
});
