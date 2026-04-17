// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import {Script, console} from "forge-std/Script.sol";

import {MendFactory} from "../src/MendFactory.sol";

contract Deploy is Script {
    function run() external {
        address usdc = vm.envAddress("USDC_ADDRESS");

        vm.startBroadcast();
        MendFactory factory = new MendFactory(usdc);
        vm.stopBroadcast();

        console.log("MendFactory deployed at:", address(factory));
        console.log("USDC address:", usdc);
    }
}
