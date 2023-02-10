import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Ownable", function () {
	async function deployContractFixture() {
		const [owner, otherAccount] = await ethers.getSigners();

		const TestOwnable = await ethers.getContractFactory("TestOwnable");
		const testOwnable = await TestOwnable.deploy();

		testOwnable.connect(owner);

		return { testOwnable, owner, otherAccount };
	}
	describe("Deployment", function () {
		it("Should set the correct owner", async function () {
			const { testOwnable, owner } = await loadFixture(deployContractFixture);
			expect(await testOwnable.owner()).to.equal(owner.address);
		});
	});
	describe("Modifiers", function () {
		it("Should revert if non-owner calls the function with onlyOwner", async function () {
			const { testOwnable, otherAccount } = await loadFixture(deployContractFixture);
			await expect(testOwnable.connect(otherAccount).withOnlyOwner()).to.be.revertedWith(
				"Only owner can access this function"
			);
		});
	});
});
