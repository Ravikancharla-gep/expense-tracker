import type { ExpenseCategory } from '../types';
import { EXPENSE_CATEGORIES } from '../constants';

type CategoryGuess = { category: ExpenseCategory; confidence: number };

/** More specific phrases first. */
const KEYWORD_MAP: { keys: string[]; category: ExpenseCategory; weight: number }[] = [
  { keys: ['netflix', 'amazon prime', 'prime video', 'youtube premium', 'google one', 'hotstar', 'disney', 'spotify', 'apple music', 'icloud'], category: 'Recharges', weight: 1.2 },
  { keys: ['wifi', 'wi-fi', 'broadband', 'fiber', 'jio', 'airtel', 'recharge', 'prepaid', 'postpaid', 'phone bill', 'mobile bill'], category: 'Recharges', weight: 1.1 },
  { keys: ['lpg', 'gas cylinder', 'cooking gas'], category: 'Recharges', weight: 1.1 },
  { keys: ['subscription', 'sub ', 'membership'], category: 'Recharges', weight: 0.9 },
  { keys: ['rent', 'deposit', 'maintenance', 'society'], category: 'Bills', weight: 1.1 },
  { keys: ['electricity', 'current bill', 'power bill', 'bescom', 'mseb'], category: 'Bills', weight: 1.1 },
  { keys: ['water bill'], category: 'Bills', weight: 1.1 },
  { keys: ['bill', 'emi home', 'property tax'], category: 'Bills', weight: 0.85 },
  { keys: ['uber', 'ola', 'taxi', 'cab', 'auto ', 'rickshaw', 'metro', 'fuel', 'petrol', 'diesel', 'parking', 'toll', 'fastag'], category: 'Transport', weight: 1 },
  { keys: ['flight', 'train ticket', 'irctc', 'bus ticket'], category: 'Transport', weight: 0.95 },
  { keys: ['hotel', 'airbnb', 'vacation', 'trip', 'resort'], category: 'Enjoy', weight: 1 },
  { keys: ['movie', 'cinema', 'theatre', 'theater', 'inox', 'pvr'], category: 'Enjoy', weight: 1.1 },
  { keys: ['restaurant', 'zomato', 'swiggy', 'dine out', 'dining out', 'outside food', 'street food', 'pub ', 'bar '], category: 'Enjoy', weight: 1.05 },
  { keys: ['park', 'amusement', 'games', 'bowling', 'arcade'], category: 'Enjoy', weight: 1 },
  { keys: ['skin', 'hair', 'shampoo', 'moisturizer', 'serum', 'cosmetic', 'makeup', 'trimmer', 'razor'], category: 'Personal Care', weight: 1.1 },
  { keys: ['bathroom', 'soap', 'toothpaste', 'toilet', 'detergent', 'cleaning', 'mop', 'surf excel'], category: 'Personal Care', weight: 1 },
  { keys: ['amazon', 'flipkart', 'myntra', 'clothes', 'apparel', 'shirt', 'shoes', 'sneaker', 'watch', 'accessor'], category: 'Shopping', weight: 1 },
  { keys: ['fruit', 'fruits', 'dates', 'peanut butter', 'eggs', 'juice', 'organic', 'grocery', 'groceries', 'milk', 'curd', 'vegetable', 'dry fruit', 'nuts'], category: 'Food', weight: 1 },
  { keys: ['food', 'snack', 'cafe', 'coffee', 'breakfast', 'lunch', 'dinner', 'meal prep'], category: 'Food', weight: 0.85 },
  { keys: ['family', 'parents', 'kids', 'child', 'school fee', 'fees', 'gift for', 'relative', 'spouse'], category: 'Family', weight: 1 },
  { keys: ['stationery', 'stationary', 'pen', 'notebook', 'printout'], category: 'Other', weight: 1.1 },
  { keys: ['bike service', 'scooter service', 'vehicle service', 'mechanic', 'spare part'], category: 'Other', weight: 1.1 },
];

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

function guessCategoryFromText(text: string): CategoryGuess {
  const n = normalize(text);
  let best: CategoryGuess = { category: 'Other', confidence: 0 };
  for (const row of KEYWORD_MAP) {
    for (const k of row.keys) {
      if (n.includes(k)) {
        const c = row.weight * (k.length >= 5 ? 1.15 : 1);
        if (c > best.confidence) {
          best = { category: row.category, confidence: c };
        }
      }
    }
  }
  for (const c of EXPENSE_CATEGORIES) {
    const needle = c.toLowerCase();
    if (n.includes(needle)) {
      return { category: c, confidence: 10 };
    }
  }
  return best;
}

function extractAmount(text: string): number | null {
  const n = text.replace(/,/g, '');
  const patterns = [
    /(?:rs\.?|rupees?|inr|₹)\s*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*(?:rs\.?|rupees?|inr|₹)/i,
    /(\d+(?:\.\d+)?)(?=rs|rupee|inr)/i,
    /(\d+(?:\.\d+)?)\s*(?:rs\.?|rupees?|inr|₹)?/i,
  ];
  for (const re of patterns) {
    const m = n.match(re);
    if (m) {
      const v = parseFloat(m[1]);
      if (!Number.isNaN(v)) return v;
    }
  }
  const loose = n.match(/(\d{1,3}(?:\.\d+)?|\d+(?:,\d{3})*(?:\.\d+)?)/);
  if (loose) {
    const v = parseFloat(loose[1].replace(/,/g, ''));
    if (!Number.isNaN(v)) return v;
  }
  return null;
}

function extractLabel(text: string, amountStr: string): string {
  let rest = text;
  const inMatch = rest.match(/\b(?:in|for|on|under|as)\s+(.+)$/i);
  if (inMatch) {
    return inMatch[1].replace(/\b(in|for|on)\b/gi, '').trim() || 'Expense';
  }
  rest = rest.replace(/(?:add\s+)?(?:an?\s+)?expense(?:\s+of)?/gi, '');
  rest = rest.replace(/spent|pay|paid|buy|bought/gi, '');
  rest = rest.replace(amountStr, '');
  rest = rest.replace(/(?:rs\.?|rupees?|inr|₹)/gi, '');
  rest = rest.replace(/\d+(?:\.\d+)?/g, '');
  rest = rest.replace(/\s+/g, ' ').trim();
  if (rest.length > 1) return rest.slice(0, 80);
  return 'Expense';
}

export type ParsedCommand =
  | { kind: 'expense'; amount: number; label: string; category: ExpenseCategory }
  | { kind: 'income'; amount: number; label: string }
  | { kind: 'error'; message: string };

export function parseQuickCommand(raw: string): ParsedCommand {
  const text = raw.trim();
  if (!text) return { kind: 'error', message: 'Say what to add, e.g. “Add expense 30 rs in Fruits”.' };

  const lower = text.toLowerCase();
  const isIncome =
    /\bincome\b/.test(lower) ||
    /\bsalary\b/.test(lower) ||
    /\bcredit\b/.test(lower) ||
    (/\badd\b/.test(lower) && /\b(salary|bonus|freelance|stipend)\b/.test(lower));

  const amount = extractAmount(text);
  if (amount === null || amount <= 0) {
    return { kind: 'error', message: 'Could not find a valid amount. Try: “Add expense of 500 in Groceries”.' };
  }

  const amountMatch = text.match(/\d+(?:\.\d+)?/);
  const amountStr = amountMatch ? amountMatch[0] : String(amount);

  if (isIncome) {
    let label = 'Income';
    if (/\bsalary\b/i.test(text)) label = 'Salary';
    else if (/\bfreelance\b/i.test(text)) label = 'Freelance';
    else if (/\bbonus\b/i.test(text)) label = 'Bonus';
    else {
      const afterIncome = text.replace(/\b(add|income|of|rs|rupees?|inr|₹|\d+(?:\.\d+)?)\b/gi, '').trim();
      if (afterIncome.length > 1) label = afterIncome.slice(0, 60);
    }
    return { kind: 'income', amount, label };
  }

  const label = extractLabel(text, amountStr);
  const { category } = guessCategoryFromText(`${label} ${text}`);

  return { kind: 'expense', amount, label, category };
}
