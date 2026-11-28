// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AgentPulseMine
 * @notice Agent ID–gated Mode A pulse: stake 0.002 BNB → after 24h reclaim 100% BNB + AGPULSE.
 * @dev Experimental. No promised returns / not passive income. AGPULSE may be worthless.
 *      Owner cannot withdraw user escrow — only the agent claims via claimFree.
 *      Owner: transferOwnership + setBaseRewardPerShare (may only decrease).
 *
 * Agent ID: 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F
 */

interface IAgentID {
    function balanceOf(address owner) external view returns (uint256);
}

interface IAgentPulseToken {
    function mint(address to, uint256 amount) external;
}

contract AgentPulseMine {
    IAgentID public constant AGENT_ID =
        IAgentID(0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F);

    uint256 public constant SHARE_COST = 0.002 ether;
    uint256 public constant LOCK = 24 hours;
    uint256 public constant EPOCH_SHARES = 150_000;

    IAgentPulseToken public immutable token;
    address public immutable gate;

    address public owner;
    uint256 public baseRewardPerShare; // e.g. 1000e18; halves each epoch of EPOCH_SHARES
    uint256 public totalShares;
    uint256 public totalClaimedShares;

    struct Position {
        address agent;
        uint128 amount;
        uint64 unlockTime;
        bool claimed;
        uint256 rewardFixed;
    }

    Position[] public positions;
    mapping(address => uint256[]) public positionsOf;
    /// @dev UTC day index = timestamp / 1 days
    mapping(address => uint256) public lastEnterDay;

    event Entered(
        address indexed agent,
        uint256 indexed positionId,
        uint256 amount,
        uint256 rewardFixed,
        uint256 unlockTime
    );
    event Claimed(
        address indexed agent,
        uint256 indexed positionId,
        uint256 amount,
        uint256 reward
    );
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event BaseRewardUpdated(uint256 previous, uint256 next);

    error NoAgentID();
    error BadValue();
    error DailyCap();
    error NotReady();
    error AlreadyClaimed();
    error NotYours();
    error NotOwner();
    error ZeroAddress();
    error RewardTooHigh();
    error TransferFailed();

    modifier onlyAgent() {
        if (AGENT_ID.balanceOf(msg.sender) == 0) revert NoAgentID();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @param owner_ EOA admin (required for CREATE2 factory deploys where msg.sender is the factory)
    constructor(address token_, address gate_, uint256 baseRewardPerShare_, address owner_) {
        if (token_ == address(0) || gate_ == address(0) || owner_ == address(0)) revert ZeroAddress();
        token = IAgentPulseToken(token_);
        gate = gate_;
        baseRewardPerShare = baseRewardPerShare_;
        owner = owner_;
        emit OwnershipTransferred(address(0), owner_);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice May only decrease base reward (anti-rug FOMO floor).
    function setBaseRewardPerShare(uint256 next) external onlyOwner {
        if (next == 0 || next > baseRewardPerShare) revert RewardTooHigh();
        emit BaseRewardUpdated(baseRewardPerShare, next);
        baseRewardPerShare = next;
    }

    function currentRewardPerShare() public view returns (uint256) {
        uint256 epoch = totalShares / EPOCH_SHARES;
        if (epoch >= 64) return 0;
        return baseRewardPerShare >> epoch;
    }

    function positionCount() external view returns (uint256) {
        return positions.length;
    }

    function positionsOfLength(address agent) external view returns (uint256) {
        return positionsOf[agent].length;
    }

    function canEnterToday(address agent) public view returns (bool) {
        if (AGENT_ID.balanceOf(agent) == 0) return false;
        return lastEnterDay[agent] < block.timestamp / 1 days;
    }

    /**
     * @notice Mode A enter: exact SHARE_COST BNB, 1 share / Agent / UTC day.
     * @dev Pair with AgentGate.checkIn() in the same user prompt (separate tx).
     */
    function enterFree() external payable onlyAgent {
        if (msg.value != SHARE_COST) revert BadValue();
        uint256 day = block.timestamp / 1 days;
        if (lastEnterDay[msg.sender] >= day) revert DailyCap();
        lastEnterDay[msg.sender] = day;

        uint256 reward = currentRewardPerShare();
        uint256 id = positions.length;
        positions.push(
            Position({
                agent: msg.sender,
                amount: uint128(msg.value),
                unlockTime: uint64(block.timestamp + LOCK),
                claimed: false,
                rewardFixed: reward
            })
        );
        positionsOf[msg.sender].push(id);
        totalShares += 1;

        emit Entered(msg.sender, id, msg.value, reward, block.timestamp + LOCK);
    }

    /**
     * @notice After LOCK, reclaim 100% BNB escrow + mint fixed AGPULSE. Owner cannot call for you.
     */
    function claimFree(uint256 positionId) external {
        if (positionId >= positions.length) revert NotYours();
        Position storage p = positions[positionId];
        if (p.agent != msg.sender) revert NotYours();
        if (p.claimed) revert AlreadyClaimed();
        if (block.timestamp < p.unlockTime) revert NotReady();

        p.claimed = true;
        totalClaimedShares += 1;

        uint256 reward = p.rewardFixed;
        uint256 amount = p.amount;

        if (reward > 0) {
            token.mint(msg.sender, reward);
        }

        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit Claimed(msg.sender, positionId, amount, reward);
    }

    /// @notice Claim all unlocked positions for caller (gas-bounded by their count).
    function claimFreeAll() external {
        uint256[] storage ids = positionsOf[msg.sender];
        uint256 n = ids.length;
        for (uint256 i = 0; i < n; i++) {
            uint256 positionId = ids[i];
            Position storage p = positions[positionId];
            if (p.claimed) continue;
            if (block.timestamp < p.unlockTime) continue;

            p.claimed = true;
            totalClaimedShares += 1;

            uint256 reward = p.rewardFixed;
            uint256 amount = p.amount;

            if (reward > 0) {
                token.mint(msg.sender, reward);
            }

            (bool ok, ) = msg.sender.call{value: amount}("");
            if (!ok) revert TransferFailed();

            emit Claimed(msg.sender, positionId, amount, reward);
        }
    }

    receive() external payable {
        revert BadValue();
    }
}
