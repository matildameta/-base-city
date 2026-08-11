// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BaseCityRegistry
/// @notice Minimal on-chain "plot ownership" registry for the Base City app.
///         Calling claimPlot() records msg.sender as owning a plot, with a
///         real transaction on Base. Anyone can call it once; a second call
///         just updates the claimedAt timestamp (re-customization).
contract BaseCityRegistry {
    struct Plot {
        address owner;
        uint64 claimedAt;
        string metadataURI; // optional: link to building customization JSON
    }

    mapping(address => Plot) public plots;
    address[] public owners;

    event PlotClaimed(address indexed owner, uint64 claimedAt);
    event PlotCustomized(address indexed owner, string metadataURI);

    function claimPlot() external {
        if (plots[msg.sender].claimedAt == 0) {
            owners.push(msg.sender);
        }
        plots[msg.sender] = Plot({
            owner: msg.sender,
            claimedAt: uint64(block.timestamp),
            metadataURI: plots[msg.sender].metadataURI
        });
        emit PlotClaimed(msg.sender, uint64(block.timestamp));
    }

    function customize(string calldata metadataURI) external {
        require(plots[msg.sender].claimedAt != 0, "claim a plot first");
        plots[msg.sender].metadataURI = metadataURI;
        emit PlotCustomized(msg.sender, metadataURI);
    }

    function totalOwners() external view returns (uint256) {
        return owners.length;
    }
}
