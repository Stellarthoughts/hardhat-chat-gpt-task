// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

// Uncomment this line to use console.log
import "hardhat/console.sol";
import "./Whitelist.sol";

/// @title ICO contract
/// @author Stellarthoughts
/// @notice In this offering tokens are not transfered outright, but instead distributed after the sale ends
/// @dev I want this to be in compliance with the ERC20 standard down the road,
///      as this was an endeavor to see how i will do it on my own,
///      including testing the underlying contracts that can be found in OpenZeppelin library,
///      but instead implemented from scratch
contract TokenSale is Whitelist {
    uint public immutable timeStart;
    uint public immutable timeEnd;
    uint public immutable tokenPrice;
    uint public immutable tokenSupply;

    // A variable to keep track of ethers invested
    // Used for checking if there are enough tokens in supply for investor to pay ethers
    uint ethersInvested = 0;

    // Not sure about this one, will probably replace with timestamp checking to be consistent
    // If i am to keep it, might introduce whenSaleEnded modifier to avoid repeats
    bool saleEnded = false;

    // Keeps track of investors separatly as i think we're unable to parse mappings
    address[] public investors;

    mapping(address => uint) public ownerToEthers;
    mapping(address => uint) public ownerToTokens;

    event SaleEnded();
    event TokensTransfered(address _from, address _to, uint amount);

    /// @dev Slither warns me about block.timestamp comparisons, but i think it's safe here
    ///  	 it's also unknown to me yet if block.timestamp vulnerability applies to PoS as opposed to PoW
    /// @param _timeStart The start of the sale (Unix)
    /// @param _timeEnd The end of the sale (Unix)
    /// @param _tokenSupply The number of tokens avaliable to be distributed
    /// @param _tokenPrice The fixed price of the token in gwei
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

        _createSupply(owner, _tokenSupply);
    }

    /// @dev Im not quite sure about these fallback functions, advise if they're incorrect
    /// @notice Reverts the transaction if not called a proper buyTokens function
    fallback() external payable {
        buyTokens();
    }

    /// @notice Reverts the transaction if not called a proper buyTokens function
    receive() external payable {
        buyTokens();
    }

    /// @notice Creates supply of tokens of given amount on given address
    /// @param _account Address to which tokens will be assigned
    /// @param _amount Amount of tokens to assign
    function _createSupply(address _account, uint _amount) internal {
        ownerToTokens[_account] = _amount;
    }

    /// @dev Investor doesn't buy tokens outright, instead they will be
    ///      distributed after the sale ends by the owner
    function buyTokens() public payable onlyWhitelisted {
        require(block.timestamp >= timeStart, "Sale has not started");
        require(block.timestamp <= timeEnd, "Sale has ended");
        require(msg.value > 0, "Sent amount should be above 0");
        require(
            (msg.value + ethersInvested) / tokenPrice <= tokenSupply,
            "The supply was depleted"
        );
        if (ownerToEthers[msg.sender] == 0) {
            investors.push(msg.sender);
        }
        ownerToEthers[msg.sender] += msg.value;
        ethersInvested += msg.value;
    }

    /// @dev Calling this function is expected before distributing and withdrawing ethers by the owner
    /// 	 I did this because one version of the tasked me, but in the logic of this contract i think
    ///      it can be merged into distributeTokens function, or calling this function
    /// 	 will call distributeTokens iternally
    /// @notice Manages saleEnded variable.
    function endSale() external onlyOwner {
        require(block.timestamp >= timeEnd, "Sale period is not over yet");
        require(!saleEnded, "The sale is already over");
        saleEnded = true;
        emit SaleEnded();
    }

    /// @notice Distributes tokens among investors based on tokenPrice and amount of Ethers invested.
    /// @dev	For purposes of showing my steps will include the slither warnings and comment out the version
    /// 		 of the function which triggered it
    /** 
			TokenSale.distributeTokens() (contracts/TokenSale.sol#110-122) has external calls inside a loop: 
			address/(investor).transfer(amountEthers % tokenPrice) (contracts/TokenSale.sol#117)
			Reference: https://github.com/crytic/slither/wiki/Detector-Documentation/#calls-inside-a-loop
	
    		function distributeTokens() external onlyOwner {
				require(saleEnded);
				for (uint i = 0; i < investors.length; i++) {
					address investor = investors[i];
					uint amountEthers = ownerToEthers[investor];
					_transferTokens(owner, msg.sender, amountEthers / tokenPrice);
					if (amountEthers % tokenPrice != 0) {
						payable(investor).transfer(amountEthers % tokenPrice);
					}
					ownerToEthers[investor] = 0;
				}
				_burnTokens(owner);
			} 
	**/
    ///  Shifted the responsibility of withdrawing ethers to users of this contract, withdrawEtheres function
    function distributeTokens() external onlyOwner {
        require(saleEnded, "The sale is not over yet");
        for (uint i = 0; i < investors.length; i++) {
            address investor = investors[i];
            uint amountEthers = ownerToEthers[investor];
            _transferTokens(owner, investor, amountEthers / tokenPrice);
            ownerToEthers[investor] = amountEthers % tokenPrice;
        }
        _burnTokens(owner);
    }

    /// @notice Burns the token of given address
    /// @param _account Address which will have tokens burned
    function _burnTokens(address _account) internal {
        ownerToTokens[_account] = 0;
    }

    /// @notice Widthdraws ethers to owner account
    function withdrawEthersFromContract() external onlyOwner {
        require(saleEnded, "The sale is not over yet");
        uint blockedForInvestors = 0;
        for (uint i = 0; i < investors.length; i++) {
            blockedForInvestors += ownerToEthers[investors[i]];
        }
        if (blockedForInvestors < address(this).balance) {
            uint toTransfer = address(this).balance - blockedForInvestors;
            (bool sent, ) = owner.call{value: toTransfer}("");
            require(sent, "Failed to send Ether");
        }
    }

    /// @notice Widthdraws remaining ethers to the investor
    /// @dev Reentrancy bug spotted here by slither and fixed
    function withdrawEthers() external {
        require(saleEnded, "The sale is not over yet");
        require(
            ownerToEthers[msg.sender] > 0,
            "There are no ethers to withdraw"
        );
        uint returnEthers = ownerToEthers[msg.sender];
        ownerToEthers[msg.sender] = 0;
        (bool sent, ) = msg.sender.call{value: returnEthers}("");
        require(sent, "Failed to send Ether");
    }

    /// @notice Internal transfer tokens function.
    /// @dev Doesn't check for sender, but checks for avaliable amount
    /// @param _from Sender address
    /// @param _to Recepient address
    /// @param _amount Amount to send
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

    /// @notice External transfer tokens function.
    /// @dev Checks for sender and calls _transferTokens to do the transfer.
    /// @param _from Sender address
    /// @param _to Recepient address
    /// @param _amount Amount to send
    function transferTokens(address _from, address _to, uint _amount) external {
        require(saleEnded, "The sale is not over yet");
        require(_from == msg.sender, "You are not the correct sender");
        _transferTokens(_from, _to, _amount);
    }
}
