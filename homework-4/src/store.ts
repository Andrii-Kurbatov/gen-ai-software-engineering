import { randomUUID } from 'crypto';
import { CreateExpenseInput, Expense, ListFilters } from './types';

const expenses: Expense[] = [];

/** Clear all expenses — primarily used to keep tests independent. */
export function reset(): void {
  expenses.length = 0;
}

export function createExpense(input: CreateExpenseInput): Expense {
  const expense: Expense = {
    id: randomUUID(),
    description: input.description,
    amount: input.amount,
    category: input.category,
    createdAt: new Date().toISOString(),
  };
  expenses.push(expense);
  return expense;
}

export function listExpenses(filters: ListFilters): Expense[] {
  let result = expenses.slice();

  if (filters.category) {
    result = result.filter((e) => e.category === filters.category);
  }

  if (filters.maxAmount !== undefined) {
    const max = parseFloat(filters.maxAmount);
    if (!isNaN(max)) {
      result = result.filter((e) => e.amount <= max);
    }
  }

  return result;
}

export function getExpense(id: string): Expense | undefined {
  return expenses.find((e) => e.id === id);
}

export function getSummary(): { total: number; byCategory: Record<string, number> } {
  const byCategory: Record<string, number> = {};
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
  }
  const total = Object.values(byCategory).reduce((sum, v) => sum + v, 0);
  return { total, byCategory };
}
