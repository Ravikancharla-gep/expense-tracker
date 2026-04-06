export type ExpenseCategory =
  | 'Family'
  | 'Transport'
  | 'Recharges'
  | 'Food'
  | 'Bills'
  | 'Shopping'
  | 'Personal Care'
  | 'Enjoy'
  | 'Other';

export type IncomeKind = 'salary' | 'other' | 'investment';

export interface IncomeEntry {
  id: string;
  label: string;
  amount: number;
  /** Where this line appears in the summary table */
  kind: IncomeKind;
}

export interface ExpenseEntry {
  id: string;
  label: string;
  amount: number;
  category: ExpenseCategory;
}

export interface BankAccountBalance {
  id: string;
  name: string;
  balance: number;
}

export interface MonthRecord {
  monthKey: string;
  income: IncomeEntry[];
  expenses: ExpenseEntry[];
}

export interface AppData {
  version: 1;
  months: MonthRecord[];
  bankAccounts: BankAccountBalance[];
  /**
   * Profit/loss on investments (user-entered). Used for net worth; may be negative (e.g. sales).
   * Percentage is derived vs. total investment income when invested ≠ 0.
   */
  investmentProfit?: number;
  /**
   * Optional photo (JPEG data URL) for category detail “tiles” view, keyed by
   * `${ExpenseCategory}::${normalizedLabelGroupKey}`.
   */
  categoryTileImages?: Record<string, string>;
}
