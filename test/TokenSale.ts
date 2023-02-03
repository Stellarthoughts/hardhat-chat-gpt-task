import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs"
import { expect } from "chai"
import { ethers } from "hardhat"
import { BigNumber } from "ethers"

describe("TokenSale", function () {
	function getTime() {
		return Math.round(Date.now() / 1000)
	}
	function getMonthSeconds() {
		return 30 * 24 * 60 * 60
	}

	async function deployContractCustom(timeStart: number, timeEnd: number, tokenPrice: BigNumber, tokenSupply: number) {
		const [owner, otherAccount] = await ethers.getSigners()

		const TokenSale = await ethers.getContractFactory("TokenSale")
		const tokenSale = await TokenSale.deploy(timeStart, timeEnd, tokenSupply, tokenPrice)

		return { tokenSale, timeStart, timeEnd, tokenPrice, tokenSupply, owner, otherAccount }
	}

	async function deployContractFixture() {
		const [owner, otherAccount, otherAccount2, otherAccount3] = await ethers.getSigners()

		const currentTimestampInSeconds = Math.round(Date.now() / 1000)
		const ONE_MONTH_IN_SECS = 30 * 24 * 60 * 60
		const timeStart = currentTimestampInSeconds + ONE_MONTH_IN_SECS
		const timeEnd = currentTimestampInSeconds + ONE_MONTH_IN_SECS * 2
		const tokenPrice = ethers.utils.parseEther("0.1")
		const tokenSupply = 10000

		const TokenSale = await ethers.getContractFactory("TokenSale")
		const tokenSale = await TokenSale.deploy(timeStart, timeEnd, tokenSupply, tokenPrice)

		return { tokenSale, timeStart, timeEnd, tokenPrice, tokenSupply, owner, otherAccount, otherAccount2, otherAccount3 }
	}

	describe("Deployment", function () {
		it("Should revert if timeStart is before or equals current time", async function () {
			const tokenSale = deployContractCustom(
				getTime(),
				getTime() + getMonthSeconds() * 2,
				ethers.utils.parseEther("0.1"),
				10000
			)
			await expect(tokenSale).to.be.revertedWith("Start of the sale must be in the future")
		})

		it("Should revert if timeEnd is before or equals timeStart", async function () {
			const tokenSale = deployContractCustom(
				getTime() + getMonthSeconds(),
				getTime() + getMonthSeconds(),
				ethers.utils.parseEther("0.1"),
				10000
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
				10000
			)
			await expect(tokenSale).to.be.revertedWith("Price of the token must be more than 0")
		})

		it("Should create supply on owner address", async function () {
			const { tokenSale, tokenSupply, owner } = await loadFixture(deployContractFixture)
			expect(await tokenSale.ownerToTokens(owner.address)).to.equal(tokenSupply)
		})
	})

	describe("Buying", function () {
		it("Should revert if sale has not started", async function () {
			const { tokenSale, otherAccount } = await loadFixture(deployContractFixture)
			await tokenSale.setWhitelisted(otherAccount.address, true)
			await expect(tokenSale.connect(otherAccount).buyToken({
				value: ethers.utils.parseEther("0.1")
			})).to.be.revertedWith("Sale has not started")
		})

		it("Should revert if sale has ended", async function () {
			const { tokenSale, otherAccount, timeEnd } = await loadFixture(deployContractFixture)
			await tokenSale.setWhitelisted(otherAccount.address, true)
			await time.increaseTo(timeEnd + 1)
			await expect(tokenSale.connect(otherAccount).buyToken({
				value: ethers.utils.parseEther("0.1")
			})).to.be.revertedWith("Sale has ended")
		})

		it("Should revert if sent amount is 0 or less", async function () {
			const { tokenSale, otherAccount, timeStart, timeEnd } = await loadFixture(deployContractFixture)
			await tokenSale.setWhitelisted(otherAccount.address, true)
			await time.increaseTo((timeStart + timeEnd) / 2)
			await expect(tokenSale.connect(otherAccount).buyToken({
				value: ethers.utils.parseEther("0")
			})).to.be.revertedWith("Sent amount should be above 0")
		})

		it("Should revert if trying to invest more than allowed by supply and token price", async function () {
			const { tokenSale, otherAccount, timeStart, timeEnd, tokenPrice, tokenSupply } = await loadFixture(deployContractFixture)
			await tokenSale.setWhitelisted(otherAccount.address, true)
			await time.increaseTo((timeStart + timeEnd) / 2)
			await expect(tokenSale.connect(otherAccount).buyToken({
				value: tokenPrice.mul(tokenSupply).add(tokenPrice)
			})).to.be.revertedWith("The supply was depleted")
		})

		it("Should keep track of investors", async function () {
			const { tokenSale, otherAccount, timeStart, timeEnd } = await loadFixture(deployContractFixture)
			await tokenSale.setWhitelisted(otherAccount.address, true)
			await time.increaseTo((timeStart + timeEnd) / 2)
			await tokenSale.connect(otherAccount).buyToken({
				value: ethers.utils.parseEther("0.1")
			})
			expect(await tokenSale.investors(0)).to.equal(otherAccount.address)
		})

		it("Should keep track of invested ethers", async function () {
			const { tokenSale, otherAccount, timeStart, timeEnd } = await loadFixture(deployContractFixture)
			await tokenSale.setWhitelisted(otherAccount.address, true)
			await time.increaseTo((timeStart + timeEnd) / 2)
			await tokenSale.connect(otherAccount).buyToken({
				value: ethers.utils.parseEther("0.1")
			})
			expect(await tokenSale.ownerToEthers(otherAccount.address)).to.equal(ethers.utils.parseEther("0.1"))
		})
	})

	describe("Actions", function () {
		it("Should revert if trying to end the sale before the end period", async function () {
			const { tokenSale, timeStart } = await loadFixture(deployContractFixture)
			await time.increaseTo(timeStart)
			await expect(tokenSale.endSale()).to.be.revertedWith("Sale period is not over yet")
		})

		it("Should should revert if the sale was declared ended before", async function () {
			const { tokenSale, timeEnd } = await loadFixture(deployContractFixture)
			await time.increaseTo(timeEnd + 1)
			await tokenSale.endSale()
			await expect(tokenSale.endSale()).to.be.revertedWith("The sale is already over")
		})

		it("Should emit SaleEnd event", async function () {
			const { tokenSale, timeEnd } = await loadFixture(deployContractFixture)
			await time.increaseTo(timeEnd + 1)
			await expect(tokenSale.endSale()).to.emit(tokenSale, "SaleEnded")
		})
	})

	describe("Distribution", function () {
		it("Should revert if the sale was not declared ended", async function () {
			const { tokenSale } = await loadFixture(deployContractFixture)
			await expect(tokenSale.distributeTokens()).to.be.revertedWith("The sale is not over yet")
		})

		it("Should distribute correctly among 3 investors", async function () {
			const { tokenSale, otherAccount, otherAccount2, otherAccount3, timeStart, timeEnd, tokenPrice, tokenSupply } = await loadFixture(deployContractFixture)
			await tokenSale.setWhitelisted(otherAccount.address, true)
			await tokenSale.setWhitelisted(otherAccount2.address, true)
			await tokenSale.setWhitelisted(otherAccount3.address, true)
			await time.increaseTo((timeStart + timeEnd) / 2)
			const ethersAmount = tokenPrice.mul(tokenSupply).div(3);
			await tokenSale.connect(otherAccount).buyToken({
				value: ethersAmount
			})
			await tokenSale.connect(otherAccount2).buyToken({
				value: ethersAmount
			})
			await tokenSale.connect(otherAccount3).buyToken({
				value: ethersAmount
			})
			await time.increaseTo(timeEnd + 1)
			await tokenSale.endSale()
			await tokenSale.distributeTokens()
			const expectedTokens = Math.floor(tokenSupply / 3)
			expect(await tokenSale.ownerToTokens(otherAccount.address)).to.equal(expectedTokens)
			expect(await tokenSale.ownerToTokens(otherAccount2.address)).to.equal(expectedTokens)
			expect(await tokenSale.ownerToTokens(otherAccount3.address)).to.equal(expectedTokens)
		})
	})

	describe("Burning", function () {
		it("Should burn the rest of the tokens after distributuion", async function () {
			const { tokenSale, owner, timeEnd } = await loadFixture(deployContractFixture)
			await time.increaseTo(timeEnd + 1)
			await tokenSale.endSale()
			await tokenSale.distributeTokens()
			expect(await tokenSale.ownerToTokens(owner.address)).to.equal(0)
		})
	})

	describe("Withdrawal", function () {
		it("Should return the right amount of ether to owner")

		it("Should return the right amount of ether to investors")
	})

	describe("Transfering", function () {
		it("Should revert if the sale has not ended")

		it("Should revert if called from incorrect address")

		it("Should transfer the tokens between accounts")

		it("Should emit Transfer event")
	})
})