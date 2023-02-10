// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

contract Ownable {
	address public immutable owner;

	constructor() {
		owner = msg.sender;
	}

	modifier onlyOwner() {
		require(msg.sender == owner, "Only owner can access this function");
		_;
	}
}
