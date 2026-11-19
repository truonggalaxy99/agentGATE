// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AgentGate
 * @notice Agent ID–gated identity layer for Agentic Wallet dApps on BNB Chain.
 * @dev Owner permissions: transferOwnership only. No mint, tax, pause-trading,
 *      freeze, or withdraw-user-funds functions. This contract never custodies assets.
 *
 * Agent ID (SPACE ID / Binance): 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F
 * Standard: ERC-721 non-transferable name.ai
 */

interface IAgentID {
    function balanceOf(address owner) external view returns (uint256);
}

contract AgentGate {
    IAgentID public constant AGENT_ID =
        IAgentID(0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F);

    address public owner;

    uint256 public totalCheckIns;
    uint256 public totalIntents;
    uint256 public totalActions;
    uint256 public uniqueAgents;

    mapping(address => uint256) public lastCheckIn;
    mapping(address => uint256) public intentCount;
    mapping(address => uint256) public actionCount;
    mapping(address => bool) public activated;

    event AgentCheckedIn(address indexed agent, uint256 timestamp);
    event IntentLogged(
        address indexed agent,
        bytes32 indexed intentType,
        bytes32 intentHash,
        string summary,
        uint256 timestamp
    );
    event ActionRecorded(address indexed agent, string action, uint256 timestamp);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NoAgentID();
    error NotOwner();
    error ZeroAddress();

    modifier onlyAgent() {
        if (AGENT_ID.balanceOf(msg.sender) == 0) revert NoAgentID();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /// @notice Whether an address holds a non-transferable Agent ID NFT
    function hasAgentID(address user) public view returns (bool) {
        return AGENT_ID.balanceOf(user) > 0;
    }

    /**
     * @notice Primary gate interaction for Agent ID holders.
     * @dev Counts toward hackathon on-chain interaction metrics.
     */
    function checkIn() external onlyAgent {
        if (!activated[msg.sender]) {
            activated[msg.sender] = true;
            uniqueAgents += 1;
        }
        lastCheckIn[msg.sender] = block.timestamp;
        totalCheckIns += 1;
        emit AgentCheckedIn(msg.sender, block.timestamp);
    }

    /**
     * @notice Log an AI-agent intent (perp/swap/predict/transfer) without moving funds.
     * @param intentType keccak256 category, e.g. keccak256("perp.open")
     * @param intentHash keccak256 of canonical intent JSON
     * @param summary short human-readable summary
     */
    function logIntent(
        bytes32 intentType,
        bytes32 intentHash,
        string calldata summary
    ) external onlyAgent {
        if (!activated[msg.sender]) {
            activated[msg.sender] = true;
            uniqueAgents += 1;
        }
        intentCount[msg.sender] += 1;
        totalIntents += 1;
        emit IntentLogged(msg.sender, intentType, intentHash, summary, block.timestamp);
    }

    /**
     * @notice Record a gated product action after user/agent confirmation.
     * @param action e.g. "perp", "swap", "predict", "transfer"
     */
    function recordAction(string calldata action) external onlyAgent {
        if (!activated[msg.sender]) {
            activated[msg.sender] = true;
            uniqueAgents += 1;
        }
        actionCount[msg.sender] += 1;
        totalActions += 1;
        emit ActionRecorded(msg.sender, action, block.timestamp);
    }

    /// @notice Owner can transfer contract ownership (admin only; no asset control)
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
