import { waffle } from "hardhat";
import { expect } from "chai";

import WorldTokenArtifact from "../artifacts/contracts/WorldToken.sol/WorldToken.json";

import { WorldToken } from "../typechain";
import { Wallet, utils } from "ethers";

const { deployContract, provider } = waffle;

describe("WORLD token unit tests", () => {
  const [
    deployer,
    marketing,
    lpStaking,
    merchantStaking,
    holder1,
    holder2,
    holder3,
  ] = provider.getWallets() as Wallet[];
  let worldToken: WorldToken;

  beforeEach(async () => {
    worldToken = (await deployContract(deployer, WorldTokenArtifact, [
      marketing.address,
    ])) as WorldToken;

    await worldToken.setLpStakingAddress(lpStaking.address);
    await worldToken.excludeFromRewards(lpStaking.address);
    await worldToken.excludeFromFees(lpStaking.address);
  });

  it("should initialize phase 1 as expected", async () => {
    const marketingAddress = await worldToken.marketingAddress();

    expect(marketingAddress).to.equal(marketing.address);

    expect(await worldToken.isExcludedFromRewards(marketingAddress)).to.equal(true);
    expect(await worldToken.isExcludedFromRewards(deployer.address)).to.equal(true);

    expect(await worldToken.isExcludedFromFees(marketingAddress)).to.equal(true);
    expect(await worldToken.isExcludedFromFees(deployer.address)).to.equal(true);
    expect(await worldToken.isExcludedFromFees("0x000000000000000000000000000000000000dEaD")).to.equal(true);

    expect(await worldToken.taxPercentage()).to.equal(3);
    expect(await worldToken.holderTaxAlloc()).to.equal(10);
    expect(await worldToken.marketingTaxAlloc()).to.equal(10);
    expect(await worldToken.lpTaxAlloc()).to.equal(10);
    expect(await worldToken.merchantTaxAlloc()).to.equal(0);
    expect(await worldToken.totalTaxAlloc()).to.equal(30);

    const HUNDRED_MILLION_TOKENS = utils.parseEther("100000000");
    expect(await worldToken.totalSupply()).to.equal(HUNDRED_MILLION_TOKENS);
    expect(await worldToken.name()).to.equal("World Token");
    expect(await worldToken.symbol()).to.equal("WORLD");
    expect(await worldToken.decimals()).to.equal(18);
  });

  const shouldTaxTokenTransfer = async (args) => {
    const TEN_MILLION_TOKENS = utils.parseEther("10000000");
    await worldToken.connect(marketing).transfer(holder1.address, TEN_MILLION_TOKENS);
    await worldToken.connect(marketing).transfer(holder2.address, TEN_MILLION_TOKENS);

    const holder1Balance = await worldToken.balanceOf(holder1.address);
    const holder2Balance = await worldToken.balanceOf(holder1.address);
    expect(holder1Balance).to.equal(TEN_MILLION_TOKENS);
    expect(holder2Balance).to.equal(TEN_MILLION_TOKENS);

    const holder1Token = worldToken.connect(holder1);
    const FIVE_MILLION_TOKENS = utils.parseEther("5000000");
    await holder1Token.transfer(holder3.address, FIVE_MILLION_TOKENS);

    const newHolder1Balance = await worldToken.balanceOf(holder1.address);
    const newHolder2Balance = await worldToken.balanceOf(holder2.address);
    const newHolder3Balance = await worldToken.balanceOf(holder3.address);

    expect(newHolder1Balance).to.equal(args.expectedHolder1Balance);
    expect(newHolder2Balance).to.equal(args.expectedHolder2Balance);
    expect(newHolder3Balance).to.equal(args.expectedHolder3Balance);

    const marketingBalance = await worldToken.balanceOf(marketing.address);
    const lpStakingBalance = await worldToken.balanceOf(lpStaking.address);
    const merchantStakingBalance = await worldToken.balanceOf(merchantStaking.address);

    const FIFTY_THOUSAND_TOKENS = utils.parseEther("50000");
    const EIGHTY_MILLION_TOKENS = utils.parseEther("80000000");
    expect(marketingBalance).to.equal(EIGHTY_MILLION_TOKENS.add(FIFTY_THOUSAND_TOKENS));
    expect(lpStakingBalance).to.equal(FIFTY_THOUSAND_TOKENS);
    expect(merchantStakingBalance).to.equal(args.expectedMerchantStakingBalance);

    const totalTransferredTokens = Number(utils.formatEther(newHolder1Balance))
      + Number(utils.formatEther(newHolder2Balance))
      + Number(utils.formatEther(newHolder3Balance))
      + Number(utils.formatEther(marketingBalance))
      + Number(utils.formatEther(lpStakingBalance))
      + Number(utils.formatEther(merchantStakingBalance));

    const TWENTY_MILLION_TOKENS = Number(utils.formatEther(TEN_MILLION_TOKENS.add(TEN_MILLION_TOKENS)));
    expect(totalTransferredTokens).to.equal(Number(utils.formatEther(EIGHTY_MILLION_TOKENS)) + TWENTY_MILLION_TOKENS);
  };

  it("should tax token transfer according to phase 1 taxation", async () => {
    await shouldTaxTokenTransfer({
      expectedHolder1Balance: utils.parseEther("5012594.458438287153652392"),
      expectedHolder2Balance: utils.parseEther("10025188.916876574307304785"),
      expectedHolder3Balance: utils.parseEther("4862216.624685138539042821"),
      expectedMerchantStakingBalance: 0,
    });
  });

  it("should tax token transfer according to phase 2 taxation", async () => {
    await worldToken.setTaxAllocations(
      6,
      10,
      10,
      4,
    );
    await worldToken.setMerchantStakingAddress(merchantStaking.address);
    await worldToken.excludeFromRewards(merchantStaking.address);

    await shouldTaxTokenTransfer({
      expectedHolder1Balance: utils.parseEther("5007556.675062972292191435"),
      expectedHolder2Balance: utils.parseEther("10015113.350125944584382871"),
      expectedHolder3Balance: utils.parseEther("4857329.974811083123425692"),
      expectedMerchantStakingBalance: utils.parseEther("20000"),
    });
  });

  it("should exclude holder 1 address from rewards", async () => {
    const FIFTY_THOUSAND_TOKENS = utils.parseEther("50000");
    await worldToken.connect(marketing).transfer(holder1.address, FIFTY_THOUSAND_TOKENS);

    await worldToken.excludeFromRewards(holder1.address);
    expect(await worldToken.isExcludedFromRewards(holder1.address)).to.equal(true);

    const holder1Token = worldToken.connect(holder1);
    const TEN_THOUSAND_TOKENS = utils.parseEther("10000");
    await holder1Token.transfer(holder2.address, TEN_THOUSAND_TOKENS);

    const holder1Balance = await worldToken.balanceOf(holder1.address);
    expect(holder1Balance).to.equal(FIFTY_THOUSAND_TOKENS.sub(TEN_THOUSAND_TOKENS));

    const holder2Balance = await worldToken.balanceOf(holder2.address);
    const fee = utils.parseEther("200");
    expect(holder2Balance).to.equal(TEN_THOUSAND_TOKENS.sub(fee));

    const holder2Token = worldToken.connect(holder2);
    const FIVE_THOUSAND_TOKENS = utils.parseEther("5000");
    await holder2Token.transfer(holder3.address, FIVE_THOUSAND_TOKENS);

    expect(holder1Balance).to.equal(FIFTY_THOUSAND_TOKENS.sub(TEN_THOUSAND_TOKENS));
  });

  it("should exclude holder 1 address from fees", async () => {
    const FIFTY_THOUSAND_TOKENS = utils.parseEther("50000");
    await worldToken.connect(marketing).transfer(holder1.address, FIFTY_THOUSAND_TOKENS);

    await worldToken.excludeFromFees(holder1.address);
    expect(await worldToken.isExcludedFromFees(holder1.address)).to.equal(true);

    const holder1Token = worldToken.connect(holder1);
    const TEN_THOUSAND_TOKENS = utils.parseEther("10000");
    await holder1Token.transfer(holder2.address, TEN_THOUSAND_TOKENS);

    const holder2Balance = await worldToken.balanceOf(holder2.address);
    expect(holder2Balance).to.equal(TEN_THOUSAND_TOKENS);

    const holder2Token = worldToken.connect(holder2);
    await holder2Token.transfer(holder1.address, TEN_THOUSAND_TOKENS);

    expect(await worldToken.balanceOf(holder1.address)).to.equal(FIFTY_THOUSAND_TOKENS);
  });

  it("should retain tax percentage after transfer if address is excluded", async () => {
    const FIFTY_THOUSAND_TOKENS = utils.parseEther("50000");
    await worldToken.connect(marketing).transfer(holder1.address, FIFTY_THOUSAND_TOKENS);

    await worldToken.excludeFromFees(holder1.address);

    const holder1Token = worldToken.connect(holder1);
    const TEN_THOUSAND_TOKENS = utils.parseEther("10000");
    await holder1Token.transfer(holder2.address, TEN_THOUSAND_TOKENS);

    expect(await worldToken.taxPercentage()).to.equal(3);
  });


  it("should revert if _holderTaxAlloc is outside of range 1-10", async () => {
    await expect(worldToken.setTaxAllocations(
      0,
      10,
      10,
      10,
    )).to.be.reverted;
    await expect(worldToken.setTaxAllocations(
      11,
      10,
      10,
      10,
    )).to.be.reverted;
  });

  it("should revert if _lpTaxAlloc is outside of range 1-10", async () => {
    await expect(worldToken.setTaxAllocations(
      10,
      10,
      0,
      10,
    )).to.be.reverted;
    await expect(worldToken.setTaxAllocations(
      10,
      10,
      11,
      10,
    )).to.be.reverted;
  });

  it("should revert if _marketingTaxAlloc is greater than 10", async () => {
    await expect(worldToken.setTaxAllocations(
      10,
      11,
      10,
      10,
    )).to.be.reverted;
  });

  it("should revert if _merchantTaxAlloc is greater than 10", async () => {
    await expect(worldToken.setTaxAllocations(
      10,
      10,
      10,
      11,
    )).to.be.reverted;
  });

  it("should not revert if setTaxAllocations args are in range", async () => {
    await expect(worldToken.setTaxAllocations(
      5,
      10,
      10,
      10,
    )).to.be.not.reverted;

    await expect(worldToken.setTaxAllocations(
      10,
      10,
      5,
      10,
    )).to.be.not.reverted;

    await expect(worldToken.setTaxAllocations(
      10,
      5,
      10,
      10,
    )).to.be.not.reverted;

    await expect(worldToken.setTaxAllocations(
      10,
      10,
      10,
      5,
    )).to.be.not.reverted;
  });
});
