// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {MendGroup} from "../src/MendGroup.sol";

/// @notice Fork tests against real USDC on Optimism Sepolia. Skips when
///         `OP_SEPOLIA_RPC_URL` is unset.
contract MendGroupForkTest is Test {
    /// USDC on Optimism Sepolia (Circle official). Source: .env.
    address internal constant USDC = 0x5fd84259d66Cd46123540766Be93DFE6D43130D7;

    /// Pinned block for determinism. Chosen ~329 blocks behind HEAD at
    /// authoring time (well past the L2 reorg window). Re-pin if the USDC
    /// implementation is ever upgraded.
    uint256 internal constant FORK_BLOCK = 42_329_000;

    MendGroup internal group;
    address internal memberA;
    address internal memberB;

    function setUp() public {
        // `vm.rpcUrl` would error on unset env — read via `envOr` so we can skip gracefully.
        string memory url = vm.envOr("OP_SEPOLIA_RPC_URL", string(""));
        if (bytes(url).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(url, FORK_BLOCK);

        memberA = makeAddr("memberA");
        memberB = makeAddr("memberB");
        group = new MendGroup(memberA, memberB, USDC);

        _fundWithUsdc(memberA, 1_000_000_000); // 1,000 USDC
        _fundWithUsdc(memberB, 1_000_000_000);

        vm.label(USDC, "USDC");
        vm.label(memberA, "memberA");
        vm.label(memberB, "memberB");
        vm.label(address(group), "MendGroup");
    }

    function _fundWithUsdc(address to, uint256 amount) internal {
        // `adjust=true` also bumps totalSupply — USDC is a proxy.
        deal(USDC, to, amount, true);
    }

    function test_Fork_SettleFlow() public {
        uint256 amount = 100_000_000; // 100 USDC — balance = +50e6, debtor = memberB.

        vm.prank(memberA);
        group.addExpense(memberA, amount, "dinner");

        uint256 aBefore = IERC20(USDC).balanceOf(memberA);
        uint256 bBefore = IERC20(USDC).balanceOf(memberB);
        uint256 owed = amount / 2;

        vm.prank(memberB);
        IERC20(USDC).approve(address(group), owed);

        vm.prank(memberB);
        group.settle();

        assertEq(IERC20(USDC).balanceOf(memberA), aBefore + owed, "creditor credited");
        assertEq(IERC20(USDC).balanceOf(memberB), bBefore - owed, "debtor debited");
        assertEq(IERC20(USDC).balanceOf(address(group)), 0, "contract non-custodial");
        assertEq(group.balance(), 0, "balance zeroed");
    }

    function test_Fork_RescueERC20_RealUsdc() public {
        uint256 stuck = 250_000_000; // 250 USDC sent to the contract by mistake.
        _fundWithUsdc(address(group), stuck);

        uint256 aBefore = IERC20(USDC).balanceOf(memberA);

        vm.prank(memberA);
        group.rescueERC20(USDC, memberA);

        assertEq(IERC20(USDC).balanceOf(address(group)), 0, "contract drained");
        assertEq(IERC20(USDC).balanceOf(memberA), aBefore + stuck, "recipient credited");
    }
}
