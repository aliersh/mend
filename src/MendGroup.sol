// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title MendGroup
/// @notice Two-party non-custodial IOU contract that tracks shared expenses
///         between two fixed members and settles in USDC. The contract never
///         holds funds in normal operation — settlement routes USDC directly
///         from debtor to creditor via ERC-20 `approve` + `safeTransferFrom`.
/// @dev See `docs/specs.md` for the authoritative function-by-function spec
///      and `docs/design.md` for the rationale behind the design choices.
contract MendGroup is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // -----------------------------------------------------------------------
    // Errors
    // -----------------------------------------------------------------------

    /// @notice Caller is neither memberA nor memberB.
    error NotAMember();

    /// @notice Caller is not the current debtor for the outstanding balance.
    error NotDebtor();

    /// @notice settle() invoked when balance is already zero.
    error AlreadySettled();

    /// @notice Referenced expense ID has never been issued.
    /// @param expenseId The offending ID.
    error ExpenseDoesNotExist(uint256 expenseId);

    /// @notice Referenced expense has already been soft-deleted.
    /// @param expenseId The offending ID.
    error ExpenseIsDeleted(uint256 expenseId);

    /// @notice Provided amount is zero.
    error AmountMustBePositive();

    /// @notice Provided payer is neither memberA nor memberB.
    /// @param providedAddress The invalid payer address.
    error InvalidPayer(address providedAddress);

    /// @notice Provided expense description is empty.
    error DescriptionRequired();

    /// @notice Both members were the same address at construction.
    error CannotGroupWithSelf();

    /// @notice A member address was the zero address at construction.
    error InvalidMemberAddress();

    /// @notice The USDC address was the zero address at construction.
    error InvalidUsdcAddress();

    /// @notice The low-level ETH transfer in rescueETH returned false.
    error ETHTransferFailed();

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    /// @notice Emitted when a new expense is recorded.
    /// @param expenseId Monotonic ID assigned to the new expense.
    /// @param payer Wallet that paid for the expense.
    /// @param amount Amount in USDC base units (6 decimals).
    /// @param description Human-readable description.
    /// @param createdAt Unix timestamp at which the expense was first created.
    event ExpenseAdded(
        uint256 indexed expenseId, address indexed payer, uint256 amount, string description, uint64 createdAt
    );

    /// @notice Emitted when an expense is edited. `createdAt` is intentionally
    ///         omitted because it is preserved across edits.
    /// @param expenseId ID of the edited expense.
    /// @param payer New payer (may equal old payer).
    /// @param amount New amount in USDC base units.
    /// @param description New description.
    event ExpenseEdited(uint256 indexed expenseId, address indexed payer, uint256 amount, string description);

    /// @notice Emitted when an expense is soft-deleted.
    /// @param expenseId ID of the deleted expense.
    /// @param deletedBy Member who triggered the delete (may differ from the original payer).
    event ExpenseDeleted(uint256 indexed expenseId, address indexed deletedBy);

    /// @notice Emitted on a successful settle().
    /// @param payer Debtor whose USDC was transferred.
    /// @param payee Creditor that received USDC.
    /// @param amount USDC amount transferred (base units).
    event Settled(address indexed payer, address indexed payee, uint256 amount);

    /// @notice Emitted when ETH is rescued from the contract.
    /// @param to Destination address.
    /// @param amount ETH amount transferred (in wei).
    event ETHRescued(address indexed to, uint256 amount);

    /// @notice Emitted when an ERC-20 token is rescued from the contract.
    /// @param token ERC-20 token address.
    /// @param to Destination address.
    /// @param amount Token amount transferred.
    event ERC20Rescued(address indexed token, address indexed to, uint256 amount);

    // -----------------------------------------------------------------------
    // Types
    // -----------------------------------------------------------------------

    /// @notice One recorded shared expense.
    /// @dev Field order is load-bearing for storage packing. `payer` (20),
    ///      `createdAt` (8), and `deleted` (1) total 29 bytes and pack into a
    ///      single 32-byte slot. Reordering breaks packing silently and adds
    ///      ~3 storage slots per expense — see specs.md §4.1.
    struct Expense {
        // --- Slot 0 (packed: 29/32 bytes) ---
        address payer; // 20 bytes
        uint64 createdAt; // 8 bytes
        bool deleted; // 1 byte
        // --- Slot 1 ---
        uint256 amount;
        // --- Slot 2+ (variable, dynamic string) ---
        string description;
    }

    // -----------------------------------------------------------------------
    // Immutable state
    // -----------------------------------------------------------------------

    /// @notice First member of the group (the wallet that called `createGroup` on the factory).
    // forge-lint: disable-next-line(screaming-snake-case-immutable)
    address public immutable memberA;

    /// @notice Second member of the group (the counterparty passed to `createGroup`).
    // forge-lint: disable-next-line(screaming-snake-case-immutable)
    address public immutable memberB;

    /// @notice USDC token used for settlement. All amounts are denominated in its base units (6 decimals).
    // forge-lint: disable-next-line(screaming-snake-case-immutable)
    address public immutable usdc;

    // -----------------------------------------------------------------------
    // Mutable state
    // -----------------------------------------------------------------------

    /// @notice memberA's net position vs memberB. Positive means memberB owes
    ///         memberA; negative means memberA owes memberB; zero means settled.
    int256 public balance;

    /// @notice Mapping from expense ID to Expense. Unused IDs return a zero-valued struct.
    mapping(uint256 => Expense) public expenses;

    /// @notice Next expense ID to be assigned. Starts at 0 and only increases — IDs are never reused.
    uint256 public nextExpenseId;

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------

    /// @notice Deploy a new MendGroup with two fixed members and a fixed USDC token.
    /// @param _memberA First member address.
    /// @param _memberB Second member address.
    /// @param _usdc USDC token address.
    /// @dev Reverts InvalidMemberAddress if either member is the zero address.
    /// @dev Reverts CannotGroupWithSelf if both members are the same address.
    /// @dev Reverts InvalidUsdcAddress if `_usdc` is the zero address.
    constructor(address _memberA, address _memberB, address _usdc) {
        if (_memberA == address(0) || _memberB == address(0)) revert InvalidMemberAddress();
        if (_memberA == _memberB) revert CannotGroupWithSelf();
        if (_usdc == address(0)) revert InvalidUsdcAddress();

        memberA = _memberA;
        memberB = _memberB;
        usdc = _usdc;
    }

    // -----------------------------------------------------------------------
    // Modifiers
    // -----------------------------------------------------------------------

    /// @dev Restricts a function to memberA or memberB. The check is delegated
    ///      to an internal function rather than written inline so the bytecode
    ///      isn't duplicated at every call site (modifiers are inlined).
    modifier onlyMember() {
        _requireMember();
        _;
    }

    /// @dev Reverts NotAMember if `msg.sender` is neither member.
    function _requireMember() internal view {
        if (msg.sender != memberA && msg.sender != memberB) revert NotAMember();
    }

    // -----------------------------------------------------------------------
    // External / public functions
    // -----------------------------------------------------------------------

    /// @notice Record a new shared expense and update the balance.
    /// @param payer Wallet that paid for the expense (memberA or memberB).
    /// @param amount Amount in USDC base units (must be > 0).
    /// @param description Human-readable description (must be non-empty).
    /// @return expenseId The monotonically assigned ID of the new expense.
    /// @dev Reverts NotAMember if caller is not a member.
    /// @dev Reverts AmountMustBePositive if amount is zero.
    /// @dev Reverts InvalidPayer if payer is neither memberA nor memberB.
    /// @dev Reverts DescriptionRequired if description is empty.
    /// @dev Integer division means odd amounts lose 1 micro-USDC of precision; the payer absorbs the dust.
    function addExpense(address payer, uint256 amount, string calldata description)
        external
        onlyMember
        returns (uint256 expenseId)
    {
        if (amount == 0) revert AmountMustBePositive();
        if (payer != memberA && payer != memberB) revert InvalidPayer(payer);
        if (bytes(description).length == 0) revert DescriptionRequired();

        expenseId = nextExpenseId;
        uint64 createdAt = uint64(block.timestamp);

        expenses[expenseId] =
            Expense({payer: payer, createdAt: createdAt, deleted: false, amount: amount, description: description});

        nextExpenseId = expenseId + 1;

        balance += _signedContribution(payer, amount);

        emit ExpenseAdded(expenseId, payer, amount, description, createdAt);
    }

    /// @notice Replace an existing expense's payer, amount, and description.
    /// @param expenseId ID of the expense to edit.
    /// @param newPayer New payer (memberA or memberB).
    /// @param newAmount New amount in USDC base units (must be > 0).
    /// @param newDescription New description (must be non-empty).
    /// @dev Reverts NotAMember if caller is not a member.
    /// @dev Reverts ExpenseDoesNotExist if expenseId has never been issued.
    /// @dev Reverts ExpenseIsDeleted if the expense has been soft-deleted.
    /// @dev Reverts AmountMustBePositive if newAmount is zero.
    /// @dev Reverts InvalidPayer if newPayer is neither memberA nor memberB.
    /// @dev Reverts DescriptionRequired if newDescription is empty.
    /// @dev `createdAt` is preserved across edits.
    function editExpense(uint256 expenseId, address newPayer, uint256 newAmount, string calldata newDescription)
        external
        onlyMember
    {
        if (expenseId >= nextExpenseId) revert ExpenseDoesNotExist(expenseId);
        Expense memory old = expenses[expenseId];
        if (old.deleted) revert ExpenseIsDeleted(expenseId);
        if (newAmount == 0) revert AmountMustBePositive();
        if (newPayer != memberA && newPayer != memberB) revert InvalidPayer(newPayer);
        if (bytes(newDescription).length == 0) revert DescriptionRequired();

        balance -= _signedContribution(old.payer, old.amount);

        expenses[expenseId].payer = newPayer;
        expenses[expenseId].amount = newAmount;
        expenses[expenseId].description = newDescription;

        balance += _signedContribution(newPayer, newAmount);

        emit ExpenseEdited(expenseId, newPayer, newAmount, newDescription);
    }

    /// @notice Soft-delete an expense and reverse its contribution to balance.
    /// @param expenseId ID of the expense to delete.
    /// @dev Reverts NotAMember if caller is not a member.
    /// @dev Reverts ExpenseDoesNotExist if expenseId has never been issued.
    /// @dev Reverts ExpenseIsDeleted if the expense has already been soft-deleted.
    /// @dev Only the `deleted` flag changes; all other fields are preserved for the audit trail.
    function deleteExpense(uint256 expenseId) external onlyMember {
        if (expenseId >= nextExpenseId) revert ExpenseDoesNotExist(expenseId);
        Expense storage e = expenses[expenseId];
        if (e.deleted) revert ExpenseIsDeleted(expenseId);

        balance -= _signedContribution(e.payer, e.amount);
        e.deleted = true;

        emit ExpenseDeleted(expenseId, msg.sender);
    }

    /// @notice Settle the outstanding balance: the debtor pays the creditor in USDC.
    /// @dev Reverts AlreadySettled if balance is zero (checked first, before debtor resolution).
    /// @dev Reverts NotDebtor if caller is not the current debtor.
    /// @dev Any USDC transfer failure (insufficient balance/allowance) propagates and rolls back the tx.
    /// @dev Defense in depth: balance is zeroed before the external call (CEI), and the
    ///      function is also guarded by `nonReentrant`.
    function settle() external nonReentrant {
        int256 b = balance;
        if (b == 0) revert AlreadySettled();

        address debtor;
        address creditor;
        uint256 amount;
        if (b > 0) {
            debtor = memberB;
            creditor = memberA;
            // Cast to uint256 is safe: b > 0, so the high bit is unset.
            // forge-lint: disable-next-line(unsafe-typecast)
            amount = uint256(b);
        } else {
            debtor = memberA;
            creditor = memberB;
            // Cast is safe: b < 0 so -b > 0 and fits in uint256. Solidity 0.8
            // checked arithmetic in addExpense/editExpense reverts long before
            // b could approach int256.min, so unary negation cannot overflow here.
            // forge-lint: disable-next-line(unsafe-typecast)
            amount = uint256(-b);
        }

        if (msg.sender != debtor) revert NotDebtor();

        balance = 0;

        IERC20(usdc).safeTransferFrom(debtor, creditor, amount);

        emit Settled(debtor, creditor, amount);
    }

    /// @notice Read an expense by ID, returned as a struct.
    /// @param expenseId ID of the expense.
    /// @return The full Expense struct (including the `deleted` flag).
    /// @dev Reverts ExpenseDoesNotExist if expenseId has never been issued.
    function getExpense(uint256 expenseId) external view returns (Expense memory) {
        if (expenseId >= nextExpenseId) revert ExpenseDoesNotExist(expenseId);
        return expenses[expenseId];
    }

    /// @notice Send the contract's entire ETH balance to `to`.
    /// @param to Destination address.
    /// @dev Reverts NotAMember if caller is not a member.
    /// @dev Reverts ETHTransferFailed if the low-level call returns false.
    // forge-lint: disable-next-line(mixed-case-function)
    function rescueETH(address to) external onlyMember {
        uint256 amount = address(this).balance;
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert ETHTransferFailed();
        emit ETHRescued(to, amount);
    }

    /// @notice Send the contract's entire balance of `token` to `to`.
    /// @param token ERC-20 token address (any ERC-20, including USDC).
    /// @param to Destination address.
    /// @dev Reverts NotAMember if caller is not a member.
    /// @dev Any token.transfer failure propagates via SafeERC20.
    function rescueERC20(address token, address to) external onlyMember {
        uint256 amount = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(to, amount);
        emit ERC20Rescued(token, to, amount);
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    /// @dev Returns the signed contribution that `payer`'s `amount` makes to `balance`:
    ///      `+amount/2` if `payer == memberA`, `-amount/2` otherwise. Callers must
    ///      validate that `payer` is one of the two members before invoking this
    ///      helper for external inputs; for trusted storage reads (delete/edit
    ///      reversal) the value is already known to be a member.
    function _signedContribution(address payer, uint256 amount) internal view returns (int256) {
        // Cast is safe: `amount / 2` is bounded by uint256.max / 2, which is
        // below int256.max, so the high bit is always unset.
        // forge-lint: disable-next-line(unsafe-typecast)
        int256 half = int256(amount / 2);
        return payer == memberA ? half : -half;
    }
}
