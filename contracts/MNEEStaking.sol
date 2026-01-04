// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MNEEStaking
 * @dev A simple staking contract for MNEE tokens.
 * Users can stake MNEE to show loyalty and unlock premium agent features.
 * This aligns with the "MNEE Staking & Loyalty Contract" strategy.
 */
contract MNEEStaking is ReentrancyGuard, Ownable {
    IERC20 public immutable stakingToken;

    // Mapping from user address to staked amount
    mapping(address => uint256) public stakedBalance;
    
    // Total amount staked in the contract
    uint256 public totalStaked;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    constructor(address _stakingToken) Ownable(msg.sender) {
        require(_stakingToken != address(0), "Invalid token address");
        stakingToken = IERC20(_stakingToken);
    }

    /**
     * @notice Stake MNEE tokens into the contract.
     * @param amount The amount of MNEE to stake.
     * @dev User must approve the contract to spend 'amount' of MNEE first.
     */
    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Cannot stake 0");
        
        // Transfer tokens from user to contract
        stakingToken.transferFrom(msg.sender, address(this), amount);
        
        stakedBalance[msg.sender] += amount;
        totalStaked += amount;
        
        emit Staked(msg.sender, amount);
    }

    /**
     * @notice Withdraw staked MNEE tokens.
     * @param amount The amount to withdraw.
     */
    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "Cannot withdraw 0");
        require(stakedBalance[msg.sender] >= amount, "Insufficient staked balance");
        
        stakedBalance[msg.sender] -= amount;
        totalStaked -= amount;
        
        stakingToken.transfer(msg.sender, amount);
        
        emit Withdrawn(msg.sender, amount);
    }

    /**
     * @notice Get the staked balance of a user.
     * @param user The address of the user.
     */
    function getStakedBalance(address user) external view returns (uint256) {
        return stakedBalance[user];
    }
}
