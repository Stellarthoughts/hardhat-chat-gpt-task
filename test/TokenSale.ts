import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";

describe("TokenSale", function () {
	function getTime() {
		return Math.round(Date.now() / 1000)
	}
	function getMonthSeconds() {
		return 30 * 24 * 60 * 60
	}

	async function deployContractCustom(timeStart: number, timeEnd: number, tokenSupply: BigNumber, tokenPrice: number) {
		const [owner, otherAccount] = await ethers.getSigners()

		const TokenSale = await ethers.getContractFactory("TokenSale")
		const tokenSale = await TokenSale.deploy(timeStart, timeEnd, tokenSupply, tokenPrice)

		return { tokenSale, timeStart, timeEnd, tokenPrice, tokenSupply, owner, otherAccount }
	}

	async function deployContractFixture() {
		const [owner, otherAccount] = await ethers.getSigners()

		const currentTimestampInSeconds = Math.round(Date.now() / 1000)
		const ONE_MONTH_IN_SECS = 30 * 24 * 60 * 60;
		const timeStart = currentTimestampInSeconds + ONE_MONTH_IN_SECS
		const timeEnd = currentTimestampInSeconds + ONE_MONTH_IN_SECS * 2
		const tokenPrice = ethers.utils.parseEther("0.1")
		const tokenSupply = 100000

		const TokenSale = await ethers.getContractFactory("TokenSale")
		const tokenSale = await TokenSale.deploy(timeStart, timeEnd, tokenSupply, tokenPrice)

		return { tokenSale, timeStart, timeEnd, tokenPrice, tokenSupply, owner, otherAccount }
	}
	describe("Deployment", function () {
		it("Should revert if timeStart is before or equals current time", async function () {
			const tokenSale = deployContractCustom(
				getTime(),
				getTime() + getMonthSeconds() * 2,
				ethers.utils.parseEther("0.1"),
				100000
			)
			await expect(tokenSale).to.be.revertedWith("Start of the sale must be in the future")
		})
		it("Should revert if timeEnd is before or equals timeStart", async function () {
			const tokenSale = deployContractCustom(
				getTime() + getMonthSeconds(),
				getTime() + getMonthSeconds(),
				ethers.utils.parseEther("0.1"),
				100000
			)
			await expect(tokenSale).to.be.revertedWith("End of the sale must come after the start")
		})
		it("Should revert if tokenSupply is 0 or less", async function () {
			const tokenSale = deployContractCustom(
				getTime() + getMonthSeconds(),
				getTime() + getMonthSeconds() * 2,
				ethers.utils.parseEther("0.1"),
				0
			)
			await expect(tokenSale).to.be.revertedWith("There must be more than 0 tokens for sale")
		})
		it("Should revert if tokenPrice is 0 or less", async function () {
			const tokenSale = deployContractCustom(
				getTime() + getMonthSeconds(),
				getTime() + getMonthSeconds() * 2,
				ethers.utils.parseEther("0"),
				100000
			)
			await expect(tokenSale).to.be.revertedWith("Price of the token must be more than 0")
		})
	})
	describe("Buying", function () {
		it("Sent amount should be above 0", async function () {

		})
	})
})