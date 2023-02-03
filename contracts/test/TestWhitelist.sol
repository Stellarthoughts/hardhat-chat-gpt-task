// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "../Whitelist.sol";

contract TestWhitelist is Whitelist {
    constructor() Whitelist() {}

    function withWhitelist() external onlyWhitelisted {}
}
