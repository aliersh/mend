// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import {Test} from "forge-std/Test.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

import {PontiFactory} from "../src/PontiFactory.sol";
import {PontiGroup} from "../src/PontiGroup.sol";

contract PontiFactoryTest is Test {
    event GroupCreated(address indexed group, address indexed memberA, address indexed memberB);

    ERC20Mock internal usdc;
    PontiFactory internal factory;

    address internal memberA;
    address internal memberB;

    function setUp() public {
        usdc = new ERC20Mock();
        factory = new PontiFactory(address(usdc));
        memberA = makeAddr("memberA");
        memberB = makeAddr("memberB");
    }

    // ---------------------------------------------------------------------
    // constructor
    // ---------------------------------------------------------------------

    function test_Constructor_RevertsOnZeroUsdc() public {
        vm.expectRevert(PontiFactory.InvalidUsdcAddress.selector);
        new PontiFactory(address(0));
    }

    function test_Constructor_StoresUsdc() public view {
        assertEq(factory.usdc(), address(usdc));
    }

    // ---------------------------------------------------------------------
    // createGroup — reverts
    // ---------------------------------------------------------------------

    function test_CreateGroup_RevertsOnSelfGroup() public {
        vm.prank(memberA);
        vm.expectRevert(PontiFactory.CannotGroupWithSelf.selector);
        factory.createGroup(memberA);
    }

    function test_CreateGroup_RevertsOnZeroOtherMember() public {
        vm.prank(memberA);
        vm.expectRevert(PontiFactory.InvalidMemberAddress.selector);
        factory.createGroup(address(0));
    }

    // ---------------------------------------------------------------------
    // createGroup — happy path
    // ---------------------------------------------------------------------

    function test_CreateGroup_DeploysWithCorrectImmutables() public {
        vm.prank(memberA);
        address groupAddr = factory.createGroup(memberB);

        PontiGroup group = PontiGroup(payable(groupAddr));
        assertEq(group.memberA(), memberA);
        assertEq(group.memberB(), memberB);
        assertEq(group.usdc(), address(usdc));
    }

    function test_CreateGroup_EmitsGroupCreated() public {
        // Precompute the CREATE address for indexed topic matching.
        address predicted = vm.computeCreateAddress(address(factory), vm.getNonce(address(factory)));

        vm.expectEmit(true, true, true, true, address(factory));
        emit GroupCreated(predicted, memberA, memberB);

        vm.prank(memberA);
        address actual = factory.createGroup(memberB);
        assertEq(actual, predicted);
    }

    function test_CreateGroup_AllowsMultipleGroupsWithSameCounterparty() public {
        vm.startPrank(memberA);
        address g1 = factory.createGroup(memberB);
        address g2 = factory.createGroup(memberB);
        vm.stopPrank();

        assertTrue(g1 != g2);
        assertEq(PontiGroup(payable(g1)).memberA(), memberA);
        assertEq(PontiGroup(payable(g2)).memberA(), memberA);
        assertEq(PontiGroup(payable(g1)).memberB(), memberB);
        assertEq(PontiGroup(payable(g2)).memberB(), memberB);
    }

    // ---------------------------------------------------------------------
    // createGroup — fuzz
    // ---------------------------------------------------------------------

    function testFuzz_CreateGroup_AnyValidCounterparty(address caller, address other) public {
        vm.assume(caller != address(0));
        vm.assume(other != address(0));
        vm.assume(caller != other);

        vm.prank(caller);
        PontiGroup group = PontiGroup(payable(factory.createGroup(other)));

        assertEq(group.memberA(), caller);
        assertEq(group.memberB(), other);
        assertEq(group.usdc(), address(usdc));
    }
}
