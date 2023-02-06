import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs"
import { expect } from "chai"
import { ethers } from "hardhat"
import { BigNumber } from "ethers"

describe("TokenSale", function () {

	// Helpers
	function getTime() {
		return Math.round(Date.now() / 1000)
	}

	function getMonthSeconds() {
		return 30 * 24 * 60 * 60
	}

	async function defaultContractSettings() {
		// !!! I replaced Date.now() with this as having multiple fixtures
		// !!! or tests seem to influence the simulation time somehow. Need an advise on what's the best way to get the current time.
		const currentTimestampInSeconds = await time.latest()
		const ONE_MONTH_IN_SECS = 30 * 24 * 60 * 60
		const timeStart = currentTimestampInSeconds + ONE_MONTH_IN_SECS
		const timeEnd = currentTimestampInSeconds + ONE_MONTH_IN_SECS * 2
		const tokenPrice = ethers.utils.parseEther("0.1")
		const tokenSupply = 10000

		return { timeStart, timeEnd, tokenPrice, tokenSupply }
	}

	// Deployments
	async function deployContractCustom(timeStart: number, timeEnd: number, tokenPrice: BigNumber, tokenSupply: number) {
		const [owner, otherAccount] = await ethers.getSigners()

		const TokenSale = await ethers.getContractFactory("TokenSale")
		const tokenSale = await TokenSale.deploy(timeStart, timeEnd, tokenSupply, tokenPrice)

		return { tokenSale, timeStart, timeEnd, tokenPrice, tokenSupply, owner, otherAccount }
	}

	// Fixtures
	async function deployContractFixture() {
		const [owner, otherAccount, otherAccount2, otherAccount3] = await ethers.getSigners()

		const { timeStart, timeEnd, tokenPrice, tokenSupply } = await defaultContractSettings()

		const TokenSale = await ethers.getContractFactory("TokenSale")
		const tokenSale = await TokenSale.deploy(timeStart, timeEnd, tokenSupply, tokenPrice)

		return { tokenSale, timeStart, timeEnd, tokenPrice, tokenSupply, owner, otherAccount, otherAccount2, otherAccount3 }
	}

	async function deployContractSaleStartedFixture() {
		const [owner, otherAccount, otherAccount2, otherAccount3] = await ethers.getSigners()

		const { timeStart, timeEnd, tokenPrice, tokenSupply } = await defaultContractSettings()

		const TokenSale = await ethers.getContractFactory("TokenSale")
		const tokenSale = await TokenSale.deploy(timeStart, timeEnd, tokenSupply, tokenPrice)

		await time.increaseTo(timeStart);
		await tokenSale.setWhitelisted(otherAccount.address, true)
		await tokenSale.setWhitelisted(otherAccount2.address, true)
		await tokenSale.setWhitelisted(otherAccount3.address, true)

		return { tokenSale, timeStart, timeEnd, tokenPrice, tokenSupply, owner, otherAccount, otherAccount2, otherAccount3 }
	}

	async function deployContractSaleEndedFixture() {
		const [owner, otherAccount, otherAccount2, otherAccount3] = await ethers.getSigners()

		const { timeStart, timeEnd, tokenPrice, tokenSupply } = await defaultContractSettings()

		const TokenSale = await ethers.getContractFactory("TokenSale")
		const tokenSale = await TokenSale.deploy(timeStart, timeEnd, tokenSupply, tokenPrice)

		await time.increaseTo(timeStart);
		await tokenSale.setWhitelisted(otherAccount.address, true)
		await tokenSale.setWhitelisted(otherAccount2.address, true)
		await tokenSale.setWhitelisted(otherAccount3.address, true)

		const buyers = [otherAccount, otherAccount2, otherAccount3]

		for (let i = 0; i < buyers.length; i++) {
			await tokenSale.connect(buyers[i]).buyTokens({ value: tokenPrice.mul(10) })
		}

		await time.increaseTo(timeEnd + 1);
		await tokenSale.endSale()
		await tokenSale.distributeTokens()
		await tokenSale.withdrawEthersFromContract()

		return { tokenSale, timeStart, timeEnd, tokenPrice, tokenSupply, owner, otherAccount, otherAccount2, otherAccount3 }
	}

	// Tests
	describe("Deployment", function () {
		it("Should revert if timeStart is before or equals current time", async function () {
			const tokenSale = deployContractCustom(
				getTime() - 1,
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
			await expect(tokenSale.connect(otherAccount).buyTokens({
				value: ethers.utils.parseEther("0.1")
			})).to.be.revertedWith("Sale has not started")
		})

		it("Should revert if sale has ended", async function () {
			const { tokenSale, otherAccount, timeEnd } = await loadFixture(deployContractSaleStartedFixture)
			await time.increaseTo(timeEnd + 1)
			await expect(tokenSale.connect(otherAccount).buyTokens({
				value: ethers.utils.parseEther("0.1")
			})).to.be.revertedWith("Sale has ended")
		})

		it("Should revert if sent amount is 0 or less", async function () {
			const { tokenSale, otherAccount } = await loadFixture(deployContractSaleStartedFixture)
			await expect(tokenSale.connect(otherAccount).buyTokens({
				value: ethers.utils.parseEther("0")
			})).to.be.revertedWith("Sent amount should be above 0")
		})

		it("Should revert if trying to invest more than allowed by supply and token price", async function () {
			const { tokenSale, otherAccount, tokenPrice, tokenSupply } = await loadFixture(deployContractSaleStartedFixture)
			await expect(tokenSale.connect(otherAccount).buyTokens({
				value: tokenPrice.mul(tokenSupply).add(tokenPrice)
			})).to.be.revertedWith("The supply was depleted")
		})

		it("Should keep track of investors", async function () {
			const { tokenSale, otherAccount } = await loadFixture(deployContractSaleStartedFixture)
			await tokenSale.connect(otherAccount).buyTokens({
				value: ethers.utils.parseEther("0.1")
			})
			expect(await tokenSale.investors(0)).to.equal(otherAccount.address)
		})

		it("Should keep track of invested ethers", async function () {
			const { tokenSale, otherAccount } = await loadFixture(deployContractSaleStartedFixture)
			const ethersAmount = ethers.utils.parseEther("0.1")
			await tokenSale.connect(otherAccount).buyTokens({
				value: ethersAmount
			})
			expect(await tokenSale.ownerToEthers(otherAccount.address)).to.equal(ethersAmount)
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
			const { tokenSale, otherAccount, otherAccount2, otherAccount3, timeEnd, tokenPrice, tokenSupply } = await loadFixture(deployContractSaleStartedFixture)
			const ethersAmount = tokenPrice.mul(tokenSupply).div(3);
			const expectedTokens = Math.floor(tokenSupply / 3)
			const buyers = [otherAccount, otherAccount2, otherAccount3]

			for (let i = 0; i < buyers.length; i++) {
				await tokenSale.connect(buyers[i]).buyTokens({
					value: ethersAmount
				})
			}

			await time.increaseTo(timeEnd + 1)
			await tokenSale.endSale()
			await tokenSale.distributeTokens()

			for (let i = 0; i < buyers.length; i++) {
				expect(await tokenSale.ownerToTokens(buyers[i].address)).to.equal(expectedTokens)
			}
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
		it("Should revert if the sale has not ended", async function () {
			const { tokenSale } = await loadFixture(deployContractFixture)
			await expect(tokenSale.withdrawEthersFromContract()).to.be.revertedWith("The sale is not over yet")
		})

		it("Should revert if there are no ethers for investor to withdraw", async function () {
			const { tokenSale, otherAccount, tokenPrice, timeEnd } = await loadFixture(deployContractSaleStartedFixture)
			const toPay = tokenPrice.mul(20)
			await tokenSale.connect(otherAccount).buyTokens({
				value: toPay
			})
			await time.increaseTo(timeEnd + 1)
			await tokenSale.endSale()
			await tokenSale.distributeTokens()
			await expect(tokenSale.connect(otherAccount).withdrawEthers()).to.be.revertedWith("There are no ethers to withdraw")
		})

		it("Should return the right amount of ether to owner", async function () {
			const { tokenSale, owner, otherAccount, tokenPrice, timeEnd, timeStart } = await loadFixture(deployContractSaleStartedFixture)
			const toPay = tokenPrice.mul(20)
			await tokenSale.connect(otherAccount).buyTokens({
				value: toPay
			})
			await time.increaseTo(timeEnd + 1)
			await tokenSale.endSale()
			await tokenSale.distributeTokens()
			await expect(tokenSale.withdrawEthersFromContract()).to.changeEtherBalance(owner, toPay)
		})

		it("Should return the right amount of ether back to investors", async function () {
			const { tokenSale, otherAccount, tokenPrice, timeEnd } = await loadFixture(deployContractSaleStartedFixture)
			const tokenCount = 21
			const toPay = tokenPrice.mul(tokenCount)
			const additionalEthers = ethers.utils.parseEther("0.05");
			await tokenSale.connect(otherAccount).buyTokens({
				value: toPay.add(additionalEthers)
			})
			await time.increaseTo(timeEnd + 1)
			await tokenSale.endSale()
			await tokenSale.distributeTokens()
			await tokenSale.withdrawEthersFromContract()
			await expect(tokenSale.connect(otherAccount).withdrawEthers()).to.changeEtherBalance(otherAccount, additionalEthers)
		})
	})

	describe("Transfering", function () {
		it("Should revert if the sale has not ended", async function () {
			const { tokenSale, otherAccount, owner } = await loadFixture(deployContractSaleStartedFixture)
			await expect(tokenSale.connect(otherAccount)
				.transferTokens(otherAccount.address, owner.address, 1)).to.be.revertedWith("The sale is not over yet")
		})

		it("Should revert if called from incorrect address", async function () {
			const { tokenSale, otherAccount, otherAccount2, owner } = await loadFixture(deployContractSaleEndedFixture)
			await expect(tokenSale.connect(otherAccount)
				.transferTokens(otherAccount2.address, owner.address, 1)).to.be.revertedWith("You are not the correct sender")
		})

		it("Should transfer the tokens between accounts", async function () {
			const { tokenSale, otherAccount, owner } = await loadFixture(deployContractSaleEndedFixture)
			await tokenSale.connect(otherAccount).transferTokens(otherAccount.address, owner.address, 1)
			expect(await tokenSale.ownerToTokens(owner.address)).to.equal(1)
		})

		it("Should emit TokensTransfered event with correct arguments", async function () {
			const { tokenSale, otherAccount, owner } = await loadFixture(deployContractSaleEndedFixture)
			await expect(tokenSale.connect(otherAccount).transferTokens(otherAccount.address, owner.address, 1))
				.to.emit(tokenSale, "TokensTransfered")
				.withArgs(otherAccount.address, owner.address, 1)
		})
	})
})