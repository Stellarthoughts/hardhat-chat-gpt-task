// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

// Uncomment this line to use console.log
import "hardhat/console.sol";
import "./Ownable.sol";

contract Whitelist is Ownable {
    mapping(address => bool) public whitelisted;

    constructor() Ownable() {}

    modifier onlyWhitelisted() {
        require(
            whitelisted[msg.sender],
            "You should be whitelisted to call this function"
        );
        _;
    }

    function setWhitelisted(
        address _account,
        bool _whitelisted
    ) external onlyOwner {
        whitelisted[_account] = _whitelisted;
    }
}
