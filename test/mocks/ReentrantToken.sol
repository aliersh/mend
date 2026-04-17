// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MendGroup} from "../../src/MendGroup.sol";

/// @dev Reentrancy vector used to prove MendGroup's nonReentrant guard on settle().
///      Exposes the minimal IERC20 surface SafeERC20 will touch and reenters settle()
///      inside transferFrom. The inner revert MUST bubble up — do not try/catch it,
///      or the assertion shifts from "nonReentrant triggered" to "AlreadySettled
///      triggered because CEI already zeroed the balance".
contract ReentrantToken is IERC20 {
    function transferFrom(address, address, uint256) external returns (bool) {
        MendGroup(msg.sender).settle();
        return true;
    }

    function totalSupply() external pure returns (uint256) {
        return 0;
    }

    function balanceOf(address) external pure returns (uint256) {
        return 0;
    }

    function allowance(address, address) external pure returns (uint256) {
        return type(uint256).max;
    }

    function transfer(address, uint256) external pure returns (bool) {
        return true;
    }

    function approve(address, uint256) external pure returns (bool) {
        return true;
    }
}
