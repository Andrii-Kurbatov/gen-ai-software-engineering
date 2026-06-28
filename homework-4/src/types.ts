export type Expense = {
  id: string;
  description: string;
  amount: number;
  category: string;
  createdAt: string;
};

export type CreateExpenseInput = {
  description: string;
  amount: number;
  category: string;
};

export type ListFilters = {
  category?: string;
  maxAmount?: string;
};
