import { ExpenseAdded, ExpenseEdited, ExpenseDeleted, Settled } from '../generated/templates/MendGroup/MendGroup'
import { Expense, Settlement } from '../generated/schema'

export function handleExpenseAdded(event: ExpenseAdded): void {
  // Group identity = event.address — the emitting MendGroup contract.
  // This is the only correct source: template handlers carry no "group" param.
  let id = event.address.toHexString() + '-' + event.params.expenseId.toString()
  let expense = new Expense(id)
  expense.group = event.address.toHexString()
  expense.expenseId = event.params.expenseId
  expense.payer = event.params.payer
  expense.amount = event.params.amount
  expense.description = event.params.description
  // Use the event param, not block.timestamp: the contract emits the original
  // creation time so edits do not change when an expense was first recorded.
  expense.createdAt = event.params.createdAt
  expense.deleted = false
  expense.edited = false
  expense.save()
}

export function handleExpenseEdited(event: ExpenseEdited): void {
  let id = event.address.toHexString() + '-' + event.params.expenseId.toString()
  let expense = Expense.load(id)
  if (expense == null) return
  expense.payer = event.params.payer
  expense.amount = event.params.amount
  expense.description = event.params.description
  expense.edited = true
  expense.save()
}

export function handleExpenseDeleted(event: ExpenseDeleted): void {
  let id = event.address.toHexString() + '-' + event.params.expenseId.toString()
  let expense = Expense.load(id)
  if (expense == null) return
  expense.deleted = true
  expense.save()
}

export function handleSettled(event: Settled): void {
  let id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
  let settlement = new Settlement(id)
  settlement.group = event.address.toHexString()
  settlement.payer = event.params.payer
  settlement.payee = event.params.payee
  settlement.amount = event.params.amount
  settlement.timestamp = event.block.timestamp
  settlement.save()
}
