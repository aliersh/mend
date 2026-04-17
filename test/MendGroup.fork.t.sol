// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {MendGroup} from "../src/MendGroup.sol";

/// @dev Fork tests against real USDC on Optimism Sepolia. Proves `SafeERC20`
///      interactions (`safeTransferFrom` in settle, `safeTransfer` in
///      rescueERC20) work end-to-end against Circle's FiatTokenV2_2 proxy,
///      not just the ERC20Mock used in the unit suite. Skips cleanly when
///      OP_SEPOLIA_RPC_URL is unset so default `forge test` and CI remain
///      network-free.
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
        // `vm.rpcUrl("optimism_sepolia")` with `${OP_SEPOLIA_RPC_URL}` in
        // foundry.toml errors when the env var is unset (it cannot expand),
        // so the guard must read via `envOr` first and skip before we touch
        // any fork-related vm cheat.
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

    /// @dev USDC on OP Sepolia is an upgradeable proxy; the `adjust=true`
    ///      overload of `deal` also bumps totalSupply so the token's internal
    ///      accounting stays consistent if its implementation references it.
    function _fundWithUsdc(address to, uint256 amount) internal {
        deal(USDC, to, amount, true);
    }

    /// Proves `SafeERC20.safeTransferFrom` works against real USDC end-to-end.
    /// One direction is sufficient: the mock suite covers both directions;
    /// the fork's unique value is establishing real USDC accepts the happy path.
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

    /// Proves `SafeERC20.safeTransfer` works against real USDC when the
    /// contract holds the token — the iMG-009 fund-recovery invariant.
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
