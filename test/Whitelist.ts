import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { expect } from "chai"
import { ethers } from "hardhat"

describe("Whitelist", function () {
	async function deployContractFixture() {
		const [owner, otherAccount] = await ethers.getSigners()

		const TestWhitelist = await ethers.getContractFactory("TestWhitelist")
		const testWhitelist = await TestWhitelist.deploy()

		testWhitelist.connect(owner)

		return { testWhitelist, owner, otherAccount }
	}

	describe("Whitelisting", function () {
		it("Should contain whitelisted account and be true after setWhitelisted to true", async function () {
			const { testWhitelist, otherAccount } = await loadFixture(deployContractFixture)
			await testWhitelist.setWhitelisted(otherAccount.address, true)
			expect(await testWhitelist.whitelisted(otherAccount.address)).to.equal(true)
		})
	})

	describe("Modifiers", function () {
		it("Should revert if non-whitelisted calls the function with onlyWhitelisted", async function () {
			const { testWhitelist, otherAccount } = await loadFixture(deployContractFixture)
			await expect(testWhitelist.connect(otherAccount).withWhitelist()).to.be.revertedWith("You should be whitelisted to call this function")
		})
	})
})