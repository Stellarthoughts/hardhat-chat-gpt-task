// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

// Uncomment this line to use console.log
import "hardhat/console.sol";
import "./Whitelist.sol";

contract TokenSale is Whitelist {
    uint public timeStart;
    uint public timeEnd;
    uint public tokenPrice;
    uint public tokenSupply;
    uint ethersInvested = 0;
    bool saleEnded = false;

    address[] public investors;
    mapping(address => uint) ownerToEthers;
    mapping(address => uint) ownerToTokens;

    event SaleEnded();
    event TokensTransfered(address _from, address _to, uint amount);

    constructor(
        uint _timeStart,
        uint _timeEnd,
        uint _tokenSupply,
        uint _tokenPrice
    ) {
        require(
            _timeStart > block.timestamp,
            "Start of the sale must be in the future"
        );
        require(
            _timeStart < _timeEnd,
            "End of the sale must come after the start"
        );
        require(_tokenSupply > 0, "There must be more than 0 tokens for sale");
        require(_tokenPrice > 0, "Price of the token must be more than 0");

        timeStart = _timeStart;
        timeEnd = _timeEnd;
        tokenPrice = _tokenPrice;
        tokenSupply = _tokenSupply;

        createSupply(owner, _tokenSupply);
    }

    fallback() external payable {
        require(msg.value > 0, "No ether was sent");
        payable(msg.sender).transfer(msg.value);
    }

    receive() external payable {
        require(msg.value > 0, "No ether was sent");
        payable(msg.sender).transfer(msg.value);
    }

    function createSupply(address _account, uint _amount) internal {
        ownerToTokens[_account] = _amount;
    }

    function buyToken() external payable onlyWhitelisted {
        require(block.timestamp < timeEnd, "Sale has ended");
        require(msg.value > 0, "Sent amount should be above 0");
        require(
            (msg.value + ethersInvested) / tokenPrice < tokenSupply,
            "The supply was depleted"
        );
        if (ownerToEthers[msg.sender] == 0) {
            investors.push(msg.sender);
        }
        ownerToEthers[msg.sender] += msg.value;
        ethersInvested += msg.value;
    }

    function endSale() external onlyOwner {
        require(block.timestamp > timeEnd, "Sale period is not over yet");
        require(!saleEnded, "The sale is already over");
        saleEnded = true;
        emit SaleEnded();
    }

    function distributeTokens() external onlyOwner {
        require(saleEnded);
        for (uint i = 0; i < investors.length; i++) {
            address investor = investors[i];
            uint amountEthers = ownerToEthers[investor];
            _transferTokens(owner, msg.sender, amountEthers / tokenPrice);
            payable(investor).transfer(amountEthers % tokenPrice);
            ownerToEthers[investor] = 0;
        }
        _burnTokens(owner);
    }

    function withdrawEthers() external onlyOwner {
        require(saleEnded);
        payable(owner).transfer(address(this).balance);
    }

    function _burnTokens(address _account) internal {
        ownerToTokens[_account] = 0;
    }

    function _transferTokens(
        address _from,
        address _to,
        uint _amount
    ) internal {
        require(
            ownerToTokens[_from] >= _amount,
            "The sender doesn't have enough tokens"
        );
        ownerToTokens[_from] -= _amount;
        ownerToTokens[_to] += _amount;
        emit TokensTransfered(_from, _to, _amount);
    }

    function transferTokens(address _from, address _to, uint _amount) external {
        require(_from == msg.sender);
        require(saleEnded);
        _transferTokens(_from, _to, _amount);
    }
}
