// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "../Ownable.sol";

contract TestOwnable is Ownable {
    constructor() Ownable() {}

    function withOnlyOwner() external onlyOwner {}
}
