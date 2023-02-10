import { ethers } from "hardhat";

async function main() {
  const currentTimestampInSeconds = Math.round(Date.now() / 1000);
  const ONE_MONTH_IN_SECS = 30 * 24 * 60 * 60;
  const timeStart = currentTimestampInSeconds + ONE_MONTH_IN_SECS;
  const timeEnd = currentTimestampInSeconds + ONE_MONTH_IN_SECS * 2;
  const tokenPrice = ethers.utils.parseEther("0.1");
  const tokenSupply = 100000;

  const TokenSale = await ethers.getContractFactory("TokenSale");
  const tokenSale = await TokenSale.deploy(
    timeStart,
    timeEnd,
    tokenSupply,
    tokenPrice
  );

  await tokenSale.deployed();

  console.log(
    `TokenSale deployed to ${tokenSale.address}: timeStart ${timeStart}, timeEnd ${timeEnd}, tokenPrice ${tokenPrice}, tokenSupply ${tokenSupply}`
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
