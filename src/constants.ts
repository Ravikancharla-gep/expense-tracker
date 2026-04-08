import type { ExpenseCategory, IncomeKind } from './types';

export const INCOME_KIND_OPTIONS: { value: IncomeKind; label: string }[] = [
  { value: 'salary', label: 'Salary' },
  { value: 'other', label: 'Other' },
  { value: 'investment', label: 'Investment' },
];

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Transport',
  'Recharges',
  'Bills',
  'Shopping',
  'Personal Care',
  'Other',
  'Family',
  'Food',
  'Enjoy',
];

export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategory[] = [...EXPENSE_CATEGORIES];

/**
 * Common recurring expense labels per category — used by “Add common lines” to insert ₹0 rows
 * for the current month when missing (deduped by category + label, case-insensitive).
 */
export const DEFAULT_MONTHLY_EXPENSE_LINES: { category: ExpenseCategory; labels: string[] }[] = [
  { category: 'Transport', labels: ['Fuel', 'Rapido Bike'] },
  { category: 'Recharges', labels: ['YouTube', 'Netflix'] },
  { category: 'Bills', labels: ['PG Rent', 'Current', 'Iron'] },
  {
    category: 'Personal Care',
    labels: ['Saloon', 'Hair Care', 'Skin Care', 'Body Care', 'Washing'],
  },
  { category: 'Other', labels: ['Stationary', 'Medical'] },
];

/** Grid order for “All transactions by section” (3×3: logistics → lifestyle → people & food). */
export const CATEGORY_COLUMNS_ORDER: ExpenseCategory[] = [
  'Transport',
  'Recharges',
  'Bills',
  'Shopping',
  'Personal Care',
  'Other',
  'Family',
  'Food',
  'Enjoy',
];

export const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Family: '#a78bfa',
  Transport: '#38bdf8',
  Recharges: '#22d3ee',
  Food: '#4ecdc4',
  Bills: '#f7c948',
  Shopping: '#fb923c',
  'Personal Care': '#f472b6',
  Enjoy: '#ff6b6b',
  Other: '#94a3b8',
};

export const CATEGORY_GRADIENT: Record<ExpenseCategory, string> = {
  Family: 'from-violet-500/35 via-violet-600/15 to-violet-950/50',
  Transport: 'from-sky-500/35 via-sky-600/15 to-sky-950/50',
  Recharges: 'from-cyan-400/35 via-cyan-600/15 to-cyan-950/50',
  Food: 'from-teal-400/35 via-emerald-700/15 to-teal-950/50',
  Bills: 'from-amber-400/35 via-amber-600/15 to-amber-950/50',
  Shopping: 'from-orange-400/35 via-orange-600/15 to-orange-950/50',
  'Personal Care': 'from-fuchsia-400/35 via-pink-600/15 to-fuchsia-950/50',
  Enjoy: 'from-rose-500/35 via-rose-600/15 to-rose-950/50',
  Other: 'from-slate-500/35 via-slate-600/15 to-slate-950/50',
};

/** Short hints shown next to the pie when a category is focused */
export const CATEGORY_DESCRIPTIONS: Record<ExpenseCategory, string> = {
  Family: 'Family-related spend.',
  Transport: 'Commute & getting around (fuel, cab, public transport).',
  Recharges: 'Phone, Wi‑Fi, Gas, Google / YouTube / Prime / Netflix',
  Food: 'Restaurant, Fruits, Juice, Eggs, Food items',
  Bills: 'Rent, electricity (“current”), fixed home utilities.',
  Shopping: 'Clothes and general Amazon / online orders.',
  'Personal Care': 'Skin & hair care, bathroom supplies, cleaning items.',
  Enjoy: 'Leisure travel, movies, restaurants, outside food, parks, games.',
  Other: 'Stationery, bike service, or anything that doesn’t fit elsewhere.',
};

const FALLBACK_CATEGORY_COLORS = [
  '#8b5cf6',
  '#06b6d4',
  '#22c55e',
  '#f59e0b',
  '#fb7185',
  '#60a5fa',
  '#f97316',
];

const FALLBACK_CATEGORY_GRADIENTS = [
  'from-violet-500/35 via-violet-600/15 to-violet-950/50',
  'from-cyan-400/35 via-cyan-600/15 to-cyan-950/50',
  'from-emerald-400/35 via-emerald-600/15 to-emerald-950/50',
  'from-amber-400/35 via-amber-600/15 to-amber-950/50',
  'from-rose-400/35 via-rose-600/15 to-rose-950/50',
  'from-blue-400/35 via-blue-600/15 to-blue-950/50',
  'from-orange-400/35 via-orange-600/15 to-orange-950/50',
];

function stableIndex(key: string, size: number): number {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(hash) % size;
}

export function getCategoryColor(category: ExpenseCategory): string {
  return CATEGORY_COLORS[category] ?? FALLBACK_CATEGORY_COLORS[stableIndex(category, FALLBACK_CATEGORY_COLORS.length)];
}

export function getCategoryGradient(category: ExpenseCategory): string {
  return CATEGORY_GRADIENT[category] ?? FALLBACK_CATEGORY_GRADIENTS[stableIndex(category, FALLBACK_CATEGORY_GRADIENTS.length)];
}

export function getCategoryDescription(category: ExpenseCategory): string {
  return CATEGORY_DESCRIPTIONS[category] ?? 'Custom section.';
}
