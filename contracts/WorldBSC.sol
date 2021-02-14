// SPDX-License-Identifier: MIT

pragma solidity 0.7.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract WorldBSC {

    IERC20 public immutable WORLD;
    IERC20 public immutable WRAPPED_WORLD;

    constructor(address _world, address _wrappedWorld) {
        require(_world != address(0), "WorldBSC: world is a zero address");
        require(_wrappedWorld != address(0), "WorldBSC: wrappedWorld is a zero address");

        WORLD = IERC20(_world);
        WRAPPED_WORLD = IERC20(_wrappedWorld);
    }

    function swapWrappedWorldToWorld(uint256 amount) external {
        require(amount > 0, "WorldBSC: input amount is zero");

        uint256 supply = WORLD.balanceOf(address(this));
        require(supply > 0, "WorldBSC: supply is zero");
        require(supply >= amount, "WorldBSC: supply is insufficient");

        uint256 balance = WRAPPED_WORLD.balanceOf(msg.sender);
        require(balance >= amount, "WorldBSC: caller's balance is insufficient");

        WRAPPED_WORLD.transferFrom(msg.sender, address(this), amount);
        WORLD.transfer(msg.sender, amount);
    }

    function swapWorldToWrappedWorld(uint256 amount) external {
        require(amount > 0, "WorldBSC: input amount is zero");

        uint256 supply = WRAPPED_WORLD.balanceOf(address(this));
        require(supply > 0, "WorldBSC: supply is zero");
        require(supply >= amount, "WorldBSC: supply is insufficient");

        uint256 balance = WORLD.balanceOf(msg.sender);
        require(balance >= amount, "WorldBSC: caller's balance is insufficient");

        WORLD.transferFrom(msg.sender, address(this), amount);
        WRAPPED_WORLD.transfer(msg.sender, amount);
    }
}
