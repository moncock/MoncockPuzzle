// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

// pulls in ERC-721 + URI storage extension from OpenZeppelin
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.2/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract PuzzleNFT is ERC721URIStorage {
    // next token ID to mint
    uint256 public nextTokenId;

    constructor() ERC721("MatchAndMintPuzzle", "MMP") {
        // you could seed nextTokenId here if you wanted
    }

    /// @notice Mint a new NFT to to with metadata URI uri
    /// @dev anyone can call this — if you want only owner, add an onlyOwner guard
    function mintNFT(address to, string calldata uri) external returns (uint256) {
        uint256 tokenId = nextTokenId;
        nextTokenId += 1;

        // safeMint emits the Transfer event
        _safeMint(to, tokenId);

        // stores the on-chain URI for tokenURI()
        _setTokenURI(tokenId, uri);

        return tokenId;
    }
}
