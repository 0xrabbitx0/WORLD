import { waffle } from "hardhat";
import { expect } from "chai";

import WorldTokenArtifact from "../artifacts/contracts/WorldToken.sol/WorldToken.json";
import WorldOTCArtifact from "../artifacts/contracts/WorldOTC.sol/WorldOTC.json";
import WorldVestingArtifact from "../artifacts/contracts/WorldVesting.sol/WorldVesting.json";

import { WorldOTC, WorldToken, WorldVesting } from "../typechain";
import { utils, Wallet } from "ethers";

const { deployContract, provider, deployMockContract } = waffle;
const { parseEther, formatEther } = utils;

const DAY = 86400;
const getVesting = async (buyer, vestings) => {
  return (await deployMockContract(buyer, WorldVestingArtifact.abi)).attach(vestings[0]) as any;
};

const fastForwardByDays = async (days) => {
  await provider.send("evm_increaseTime", [days * DAY]);
  await provider.send("evm_mine", []);
};

describe("WORLD OTC unit tests", () => {
  const [
    deployer,
    buyer,
    buyer2
  ] = provider.getWallets() as Wallet[];
  let worldToken: WorldToken;
  let worldOTC: WorldOTC;
  let worldVestingLogic: WorldVesting;

  beforeEach(async () => {
    worldToken = (await deployContract(deployer, WorldTokenArtifact, [
      deployer.address,
    ])) as WorldToken;

    worldVestingLogic = (await deployContract(deployer, WorldVestingArtifact)) as WorldVesting;

    worldOTC = (await deployContract(deployer, WorldOTCArtifact, [
      worldToken.address,
      worldVestingLogic.address,
      parseEther("0.00009") // rate is 0.00009 eth per world token by default
    ])) as WorldOTC;

    await worldToken.transfer(worldOTC.address, parseEther("100000"));

    await worldToken.excludeFromFees(worldOTC.address);
  });

  it("should revert if restricted function's caller is not owner", async () => {
    await expect(worldOTC.connect(buyer).withdrawTokens()).to.be.reverted;
    await expect(worldOTC.connect(buyer).withdrawFunds()).to.be.reverted;
    await expect(worldOTC.connect(buyer).setRate(parseEther("1"))).to.be.reverted;
    await expect(worldOTC.connect(buyer).setVestingDuration(10)).to.be.reverted;
    await expect(worldOTC.connect(buyer).setVestingCliffDuration(20)).to.be.reverted;
    await expect(worldOTC.connect(buyer).setWhitelistedOnly(true)).to.be.reverted;
    await expect(worldOTC.connect(buyer).addToWhitelist(buyer.address)).to.be.reverted;
    await expect(worldOTC.connect(buyer).removeFromWhitelist(buyer.address)).to.be.reverted;
  });

  it("should revert buy if otc world balance is zero ", async () => {
    worldOTC = (await deployContract(deployer, WorldOTCArtifact, [
      worldToken.address,
      worldVestingLogic.address,
      parseEther("0.00009")
    ])) as WorldOTC;

    const worldOTCBalance = await worldToken.balanceOf(worldOTC.address);
    expect(worldOTCBalance).to.equal(0);

    await expect(worldOTC.connect(buyer).buy({ value: parseEther("1") })).to.be.reverted;
  });

  it("should revert buy if eth value is less than 1", async () => {
    await expect(worldOTC.connect(buyer).buy({ value: parseEther("0.5") })).to.be.reverted;
  });

  it("should revert buy if eth value is not a whole number", async () => {
    await expect(worldOTC.connect(buyer).buy({ value: parseEther("1.4") })).to.be.reverted;
  });

  it("should revert buy if otc world balance is insufficient", async () => {
    // otc world balance is 100000
    await worldOTC.setRate(parseEther("0.001"));
    await expect(worldOTC.connect(buyer).buy({ value: parseEther("1000") })).to.be.reverted;
  });

  it("should transfer expected amount of world tokens after 1 eth buy", async () => {
    await worldOTC.connect(buyer).buy({ value: parseEther("1") });

    const vestings = await worldOTC.getAllVestings(buyer.address);
    const vesting: WorldVesting = await getVesting(buyer, vestings);

    const vestingBalance = await worldToken.balanceOf(vesting.address);
    expect(vestingBalance).to.equal(parseEther("11111.111111111111111111"));

    await expect(vesting.release()).to.be.reverted;
  });

  it("should revert if no world tokens are due", async () => {
    await worldOTC.connect(buyer).buy({ value: parseEther("1") });

    const vestings = await worldOTC.getAllVestings(buyer.address);
    const vesting: WorldVesting = await getVesting(buyer, vestings);

    await expect(vesting.release()).to.be.reverted;
  });

  it("should release 25% of vested world tokens after 7 days", async () => {
    await worldOTC.connect(buyer).buy({ value: parseEther("1") });

    const vestings = await worldOTC.getAllVestings(buyer.address);
    const vesting: WorldVesting = await getVesting(buyer, vestings);

    let buyerBalance = await worldToken.balanceOf(buyer.address);
    expect(buyerBalance).to.equal(0);

    await fastForwardByDays(7);

    await vesting.release();

    buyerBalance = await worldToken.balanceOf(buyer.address);
    expect(buyerBalance).to.equal(parseEther("2695.20223242915915383")); // 25% minus fee
  });

  it("should release ~56% of vested world tokens after 16 days", async () => {
    await worldOTC.connect(buyer).buy({ value: parseEther("2") });

    const vestings = await worldOTC.getAllVestings(buyer.address);
    const vesting: WorldVesting = await getVesting(buyer, vestings);

    let buyerBalance = await worldToken.balanceOf(buyer.address);
    expect(buyerBalance).to.equal(0);

    await expect(vesting.release()).to.be.reverted;

    await fastForwardByDays(16);

    await vesting.release();

    buyerBalance = await worldToken.balanceOf(buyer.address);
    expect(buyerBalance).to.equal(parseEther("12333.159227616491155676")); // ~56% minus fee
  });

  it("should release 100% of world token balance after 28 days", async () => {
    await worldOTC.connect(buyer).buy({ value: parseEther("3") });

    const vestings = await worldOTC.getAllVestings(buyer.address);
    const vesting: WorldVesting = await getVesting(buyer, vestings);

    let buyerBalance = await worldToken.balanceOf(buyer.address);
    expect(buyerBalance).to.equal(0);

    await expect(vesting.release()).to.be.reverted;

    await fastForwardByDays(28);

    await worldToken.transfer(vesting.address, parseEther("30000"));

    await vesting.release();

    buyerBalance = await worldToken.balanceOf(buyer.address);
    expect(buyerBalance).to.equal(parseEther("61735.568789918867598826")); // 100% of vesting contract balance minus fee

    const vestingBalance = await worldToken.balanceOf(vesting.address);
    expect(vestingBalance).to.equal(0);
  });

  it("should revert if buyer is not whitelisted", async () => {
    await worldOTC.setWhitelistedOnly(true);
    await expect(worldOTC.connect(buyer).buy({ value: parseEther("1") })).to.be.reverted;
  });

  it("should not revert if buyer is whitelisted", async () => {
    await worldOTC.setWhitelistedOnly(true);
    await worldOTC.addToWhitelist(buyer.address);
    await worldOTC.connect(buyer).buy({ value: parseEther("1") });
  });

  it("should release expected amount if rate is 1 eth", async () => {
    await worldOTC.setRate(parseEther("1"));

    await worldOTC.connect(buyer).buy({ value: parseEther("3") });

    const vestings = await worldOTC.getAllVestings(buyer.address);
    const vesting: WorldVesting = await getVesting(buyer, vestings);

    let vestingBalance = await worldToken.balanceOf(vesting.address);
    expect(vestingBalance).to.equal(parseEther("3"));

    let buyerBalance = await worldToken.balanceOf(buyer.address);
    expect(buyerBalance).to.equal(0);

    await expect(vesting.release()).to.be.reverted;

    await fastForwardByDays(14);

    await vesting.release();

    buyerBalance = await worldToken.balanceOf(buyer.address);
    expect(buyerBalance).to.equal(parseEther("1.455002624004755456"));

    await fastForwardByDays(6); // day 20

    await vesting.release();

    buyerBalance = await worldToken.balanceOf(buyer.address);
    expect(buyerBalance).to.equal(parseEther("2.078575544969376117"));

    await fastForwardByDays(8); // day 28

    await vesting.release();

    buyerBalance = await worldToken.balanceOf(buyer.address);
    expect(buyerBalance).to.equal(parseEther("2.910000873000442292"));

    vestingBalance = await worldToken.balanceOf(vesting.address);
    expect(vestingBalance).to.equal(0);
  });

  it("should release expected amount if cliff duration is 1 day and vesting duation is 2 days", async () => {
    await worldOTC.setRate(parseEther("0.01"));
    await worldOTC.setVestingCliffDuration(DAY);
    await worldOTC.setVestingDuration(2 * DAY);

    await worldOTC.connect(buyer).buy({ value: parseEther("1") });

    const vestings = await worldOTC.getAllVestings(buyer.address);
    const vesting: WorldVesting = await getVesting(buyer, vestings);

    let vestingBalance = await worldToken.balanceOf(vesting.address);
    expect(vestingBalance).to.equal(parseEther("100"));

    let buyerBalance = await worldToken.balanceOf(buyer.address);
    expect(buyerBalance).to.equal(0);

    await expect(vesting.release()).to.be.reverted;

    await fastForwardByDays(1);

    await vesting.release();

    buyerBalance = await worldToken.balanceOf(buyer.address);
    expect(buyerBalance).to.equal(parseEther("48.501365198837359636"));

    await fastForwardByDays(1); // day 2

    await vesting.release();

    buyerBalance = await worldToken.balanceOf(buyer.address);
    expect(buyerBalance).to.equal(parseEther("97.000970016975315256"));

    vestingBalance = await worldToken.balanceOf(vesting.address);
    expect(vestingBalance).to.equal(0);
  });

  it("should not have the same vesting address if different buyers", async () => {
    await worldOTC.connect(buyer).buy({ value: parseEther("1") });
    await worldOTC.connect(buyer2).buy({ value: parseEther("1") });

    const vestings = await worldOTC.getAllVestings(buyer.address);
    const vesting: WorldVesting = await getVesting(buyer, vestings);

    const buyer2Vestings = await worldOTC.getAllVestings(buyer2.address);
    const buyer2Vesting = await getVesting(buyer2, buyer2Vestings);

    expect(vesting.address).to.not.equal(buyer2Vesting.address)
  });

  it("should return buyer vestings length", async () => {
    await worldOTC.connect(buyer).buy({ value: parseEther("1") });
    await worldOTC.connect(buyer).buy({ value: parseEther("1") });
    await worldOTC.connect(buyer).buy({ value: parseEther("1") });
    await worldOTC.connect(buyer).buy({ value: parseEther("1") });

    const vestings = await worldOTC.getAllVestings(buyer.address);
    expect(new Set(vestings).size).to.equal(4); // no duplicates
    expect(vestings.length).to.equal(4);

    const filteredVestings = await worldOTC.getVestings(buyer.address, 0, 2);
    expect(new Set(filteredVestings).size).to.equal(2); // no duplicates
    expect(filteredVestings.length).to.equal(2);
  });
});
