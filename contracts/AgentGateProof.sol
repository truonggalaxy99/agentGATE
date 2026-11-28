// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AgentGateProof
 * @notice Soulbound AgentGate Pass — free collectible (gas only), once per Agent ID holder.
 * @dev Non-transferable. No mint fee, no custody of user funds. Not an investment.
 *
 * Agent ID (SPACE ID / Binance): 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F
 */

interface IAgentID {
    function balanceOf(address owner) external view returns (uint256);
}

contract AgentGateProof {
    IAgentID public constant AGENT_ID =
        IAgentID(0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F);

    string public constant name = "AgentGate Pass";
    string public constant symbol = "AGPASS";

    uint256 public totalMinted;

    /// @dev tokenId starts at 1; 0 means not minted
    mapping(address => uint256) public tokenOf;
    mapping(uint256 => address) private _ownerOf;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event ProofMinted(address indexed agent, uint256 indexed tokenId, uint256 timestamp);

    error NoAgentID();
    error AlreadyMinted();
    error Soulbound();
    error Nonexistent();

    function hasMinted(address user) public view returns (bool) {
        return tokenOf[user] != 0;
    }

    function balanceOf(address owner) external view returns (uint256) {
        if (owner == address(0)) revert Nonexistent();
        return tokenOf[owner] == 0 ? 0 : 1;
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address o = _ownerOf[tokenId];
        if (o == address(0)) revert Nonexistent();
        return o;
    }

    /**
     * @notice Mint one soulbound Pass for the caller (requires Agent ID).
     * @dev Gas only. Once per wallet that holds Agent ID.
     */
    function mintProof() external {
        if (AGENT_ID.balanceOf(msg.sender) == 0) revert NoAgentID();
        if (tokenOf[msg.sender] != 0) revert AlreadyMinted();

        uint256 id = ++totalMinted;
        tokenOf[msg.sender] = id;
        _ownerOf[id] = msg.sender;

        emit Transfer(address(0), msg.sender, id);
        emit ProofMinted(msg.sender, id, block.timestamp);
    }

    // --- Soulbound: block all transfers / approvals ---

    function approve(address, uint256) external pure {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) external pure {
        revert Soulbound();
    }

    function getApproved(uint256) external pure returns (address) {
        return address(0);
    }

    function isApprovedForAll(address, address) external pure returns (bool) {
        return false;
    }

    function transferFrom(address, address, uint256) external pure {
        revert Soulbound();
    }

    function safeTransferFrom(address, address, uint256) external pure {
        revert Soulbound();
    }

    function safeTransferFrom(address, address, uint256, bytes calldata) external pure {
        revert Soulbound();
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        // ERC165 + ERC721
        return interfaceId == 0x01ffc9a7 || interfaceId == 0x80ac58cd;
    }
}
