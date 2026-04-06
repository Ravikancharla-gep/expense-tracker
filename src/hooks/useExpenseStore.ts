import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AppData,
  BankAccountBalance,
  ExpenseCategory,
  ExpenseEntry,
  IncomeEntry,
  IncomeKind,
  MonthRecord,
} from '../types';
import {
  ensureMonth,
  getDataStorageKey,
  isCloudBackendConfigured,
  loadData,
  loadMergedDataForLoggedInUser,
  migrateRawToAppData,
  saveData,
} from '../storage';
import { createId } from '../utils/id';
import { parseQuickCommand } from '../utils/nlParser';
import { DEFAULT_MONTHLY_EXPENSE_LINES, EXPENSE_CATEGORIES } from '../constants';

function currentMonthKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function bootstrapData(authenticatedUserId: string | null): AppData {
  if (isCloudBackendConfigured() && !authenticatedUserId) {
    return { version: 1, months: [], bankAccounts: [] };
  }
  const d =
    isCloudBackendConfigured() && authenticatedUserId
      ? loadMergedDataForLoggedInUser(authenticatedUserId)
      : loadData(authenticatedUserId);
  if (d.months.length === 0) {
    const key = currentMonthKey();
    return {
      version: 1,
      months: [{ monthKey: key, income: [], expenses: [] }],
      bankAccounts: [],
    };
  }
  ensureMonth(d, currentMonthKey());
  return d;
}

export type AgentUndo = {
  kind: 'income' | 'expense';
  monthKey: string;
  id: string;
  label: string;
  /** Set for expense quick-adds — category the entry was filed under */
  category?: ExpenseCategory;
};

/**
 * @param authenticatedUserId — Supabase user id when logged in; `null` when no cloud or before login.
 *                           Each user gets isolated localStorage + cloud row (RLS).
 */
export function useExpenseStore(authenticatedUserId: string | null) {
  const [data, setData] = useState<AppData>(() => bootstrapData(authenticatedUserId));
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => currentMonthKey());
  const [agentMessage, setAgentMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [dataReady, setDataReady] = useState<boolean>(!isCloudBackendConfigured());

  useEffect(() => {
    const next = bootstrapData(authenticatedUserId);
    setData(next);
    if (isCloudBackendConfigured()) {
      setDataReady(!!authenticatedUserId);
    }
    setSelectedMonthKey((prev) => {
      const keys = new Set(next.months.map((m) => m.monthKey));
      if (keys.has(prev)) return prev;
      const sorted = [...next.months].sort((a, b) => b.monthKey.localeCompare(a.monthKey));
      return sorted[0]?.monthKey ?? currentMonthKey();
    });
  }, [authenticatedUserId]);

  useEffect(() => {
    if (!dataReady) return;
    if (isCloudBackendConfigured() && !authenticatedUserId) return;
    saveData(data, authenticatedUserId);
  }, [data, authenticatedUserId, dataReady]);

  // Cross-tab sync: pick up changes written by other tabs via the storage event.
  useEffect(() => {
    const targetKey = getDataStorageKey(authenticatedUserId);
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== targetKey || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue) as unknown;
        const migrated = migrateRawToAppData(parsed);
        if (migrated) {
          ensureMonth(migrated, currentMonthKey());
          setData(migrated);
        }
      } catch {
        /* ignore corrupt writes */
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [authenticatedUserId]);

  /** Keep monthly tab on a month that still exists (e.g. after deleting a month). */
  useEffect(() => {
    if (data.months.length === 0) return;
    const keys = new Set(data.months.map((m) => m.monthKey));
    if (keys.has(selectedMonthKey)) return;
    const sorted = [...data.months].sort((a, b) => b.monthKey.localeCompare(a.monthKey));
    setSelectedMonthKey(sorted[0]!.monthKey);
  }, [data.months, selectedMonthKey]);

  const month = useMemo(() => {
    return data.months.find((m) => m.monthKey === selectedMonthKey) ?? null;
  }, [data.months, selectedMonthKey]);

  const totals = useMemo(() => {
    if (!month) {
      return {
        income: 0,
        investment: 0,
        expenses: 0,
        byCategory: {} as Record<ExpenseCategory, number>,
      };
    }
    let income = 0;
    let investment = 0;
    for (const e of month.income) {
      if (e.kind === 'investment') investment += e.amount;
      else income += e.amount;
    }
    const byCategory = {} as Record<ExpenseCategory, number>;
    for (const c of EXPENSE_CATEGORIES) byCategory[c] = 0;
    for (const e of month.expenses) {
      byCategory[e.category] += e.amount;
    }
    const expenses = month.expenses.reduce((s, e) => s + e.amount, 0);
    return { income, investment, expenses, byCategory };
  }, [month]);

  const lifetimeTotals = useMemo(() => {
    let income = 0;
    let investment = 0;
    let expenses = 0;
    for (const m of data.months) {
      for (const e of m.income) {
        if (e.kind === 'investment') investment += e.amount;
        else income += e.amount;
      }
      expenses += m.expenses.reduce((s, e) => s + e.amount, 0);
    }
    return { income, investment, expenses, net: income - expenses - investment };
  }, [data.months]);

  const bankTotal = useMemo(
    () =>
      data.bankAccounts.reduce((s, a) => s + (Number.isFinite(a.balance) ? a.balance : 0), 0),
    [data.bankAccounts]
  );

  const addMonth = useCallback((monthKey: string) => {
    setSelectedMonthKey(monthKey);
    setData((prev) => {
      if (prev.months.some((m) => m.monthKey === monthKey)) {
        return prev;
      }
      const next = {
        ...prev,
        months: [...prev.months],
        bankAccounts: [...prev.bankAccounts],
      };
      ensureMonth(next, monthKey);
      return next;
    });
  }, []);

  const addIncome = useCallback(
    (monthKey: string, label: string, amount: number, kind: IncomeKind = 'other'): string => {
      const id = createId();
      const entry: IncomeEntry = { id, label, amount, kind };
      setData((prev) => {
        const next = {
          ...prev,
          bankAccounts: [...prev.bankAccounts],
          months: prev.months.map((m) => ({
            ...m,
            income: [...m.income],
            expenses: [...m.expenses],
          })),
        };
        const m = ensureMonth(next, monthKey);
        m.income.push(entry);
        return next;
      });
      return id;
    },
    []
  );

  const updateIncome = useCallback(
    (monthKey: string, id: string, patch: Partial<Pick<IncomeEntry, 'label' | 'amount' | 'kind'>>) => {
      setData((prev) => ({
        ...prev,
        bankAccounts: [...prev.bankAccounts],
        months: prev.months.map((m) =>
          m.monthKey !== monthKey
            ? m
            : {
                ...m,
                income: m.income.map((e) => (e.id === id ? { ...e, ...patch } : e)),
              }
        ),
      }));
    },
    []
  );

  const addExpense = useCallback(
    (monthKey: string, label: string, amount: number, category: ExpenseCategory): string => {
      const id = createId();
      const entry: ExpenseEntry = { id, label, amount, category };
      setData((prev) => {
        const next = {
          ...prev,
          bankAccounts: [...prev.bankAccounts],
          months: prev.months.map((x) => ({
            ...x,
            income: [...x.income],
            expenses: [...x.expenses],
          })),
        };
        const m = ensureMonth(next, monthKey);
        m.expenses.push(entry);
        return next;
      });
      return id;
    },
    []
  );

  /** Adds default ₹0 line items for the month where that category+label is not already present. */
  const addDefaultMonthlyExpenseLines = useCallback((monthKey: string) => {
    setData((prev) => {
      const next = {
        ...prev,
        bankAccounts: [...prev.bankAccounts],
        months: prev.months.map((x) => ({
          ...x,
          income: [...x.income],
          expenses: [...x.expenses],
        })),
      };
      const m = ensureMonth(next, monthKey);
      const seen = new Set(
        m.expenses.map((e) => `${e.category}::${e.label.trim().toLowerCase()}`)
      );
      for (const { category, labels } of DEFAULT_MONTHLY_EXPENSE_LINES) {
        for (const raw of labels) {
          const label = raw.trim();
          if (!label) continue;
          const key = `${category}::${label.toLowerCase()}`;
          if (seen.has(key)) continue;
          seen.add(key);
          m.expenses.push({ id: createId(), label, amount: 0, category });
        }
      }
      return next;
    });
  }, []);

  const deleteIncome = useCallback((monthKey: string, id: string) => {
    setData((prev) => ({
      ...prev,
      bankAccounts: [...prev.bankAccounts],
      months: prev.months.map((m) =>
        m.monthKey === monthKey ? { ...m, income: m.income.filter((e) => e.id !== id) } : m
      ),
    }));
  }, []);

  const deleteExpense = useCallback((monthKey: string, id: string) => {
    setData((prev) => ({
      ...prev,
      bankAccounts: [...prev.bankAccounts],
      months: prev.months.map((m) =>
        m.monthKey === monthKey ? { ...m, expenses: m.expenses.filter((e) => e.id !== id) } : m
      ),
    }));
  }, []);

  const updateExpense = useCallback(
    (monthKey: string, id: string, patch: Partial<Pick<ExpenseEntry, 'label' | 'amount' | 'category'>>) => {
      setData((prev) => ({
        ...prev,
        bankAccounts: [...prev.bankAccounts],
        months: prev.months.map((m) =>
          m.monthKey !== monthKey
            ? m
            : {
                ...m,
                expenses: m.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)),
              }
        ),
      }));
    },
    []
  );

  /** Removes a month (income + expenses). Ensures at least one empty month remains. */
  const deleteMonth = useCallback((monthKey: string) => {
    setData((prev) => {
      const filtered = prev.months.filter((m) => m.monthKey !== monthKey);
      const nextMonths: MonthRecord[] =
        filtered.length === 0
          ? [{ monthKey: currentMonthKey(), income: [], expenses: [] }]
          : filtered.map((m) => ({
              ...m,
              income: [...m.income],
              expenses: [...m.expenses],
            }));
      return {
        ...prev,
        bankAccounts: [...prev.bankAccounts],
        months: nextMonths,
      };
    });
  }, []);

  const setBankAccounts = useCallback((accounts: BankAccountBalance[]) => {
    setData((prev) => ({
      ...prev,
      bankAccounts: [...accounts],
      months: prev.months.map((m) => ({ ...m })),
    }));
  }, []);

  const setInvestmentProfit = useCallback((profit: number) => {
    const v = Number.isFinite(profit) ? profit : 0;
    setData((prev) => ({
      ...prev,
      investmentProfit: v,
      bankAccounts: [...prev.bankAccounts],
      months: prev.months.map((m) => ({ ...m })),
    }));
  }, []);

  const replaceAllData = useCallback((next: AppData) => {
    const d: AppData = {
      version: 1,
      months: next.months.map((m) => ({
        monthKey: m.monthKey,
        income: m.income.map((e) => ({ ...e })),
        expenses: m.expenses.map((e) => ({ ...e })),
      })),
      bankAccounts: next.bankAccounts.map((a) => ({ ...a })),
    };
    if (typeof next.investmentProfit === 'number' && Number.isFinite(next.investmentProfit)) {
      d.investmentProfit = next.investmentProfit;
    }
    if (next.categoryTileImages && Object.keys(next.categoryTileImages).length > 0) {
      d.categoryTileImages = { ...next.categoryTileImages };
    }
    d.months.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
    ensureMonth(d, currentMonthKey());
    setData(d);
    setSelectedMonthKey((prev) => {
      const keys = new Set(d.months.map((m) => m.monthKey));
      if (keys.has(prev)) return prev;
      const sorted = [...d.months].sort((a, b) => b.monthKey.localeCompare(a.monthKey));
      return sorted[0]?.monthKey ?? currentMonthKey();
    });
  }, []);

  const setCategoryTileImage = useCallback(
    (category: ExpenseCategory, groupKey: string, dataUrl: string | null) => {
      const storageKey = `${category}::${groupKey}`;
      setData((prev) => {
        const prevTiles = { ...(prev.categoryTileImages ?? {}) };
        if (dataUrl === null) delete prevTiles[storageKey];
        else prevTiles[storageKey] = dataUrl;
        const next: AppData = {
          ...prev,
          bankAccounts: [...prev.bankAccounts],
          months: prev.months.map((m) => ({ ...m, income: [...m.income], expenses: [...m.expenses] })),
        };
        if (Object.keys(prevTiles).length > 0) next.categoryTileImages = prevTiles;
        else delete next.categoryTileImages;
        return next;
      });
    },
    [],
  );

  const runAgentCommand = useCallback(
    (text: string, targetMonthKey: string): { ok: boolean; undo?: AgentUndo; error?: string } => {
      const cmd = parseQuickCommand(text);
      if (cmd.kind === 'error') {
        setAgentMessage({ type: 'err', text: cmd.message });
        return { ok: false, error: cmd.message };
      }
      if (cmd.kind === 'income') {
        const id = addIncome(targetMonthKey, cmd.label, cmd.amount, 'other');
        return {
          ok: true,
          undo: { kind: 'income', monthKey: targetMonthKey, id, label: cmd.label },
        };
      }
      const id = addExpense(targetMonthKey, cmd.label, cmd.amount, cmd.category);
      return {
        ok: true,
        undo: {
          kind: 'expense',
          monthKey: targetMonthKey,
          id,
          label: cmd.label,
          category: cmd.category,
        },
      };
    },
    [addExpense, addIncome]
  );

  return {
    data,
    dataReady,
    replaceAllData,
    selectedMonthKey,
    month,
    totals,
    lifetimeTotals,
    bankAccounts: data.bankAccounts,
    bankTotal,
    addMonth,
    addIncome,
    updateIncome,
    addExpense,
    addDefaultMonthlyExpenseLines,
    updateExpense,
    deleteIncome,
    deleteExpense,
    deleteMonth,
    setBankAccounts,
    setInvestmentProfit,
    setCategoryTileImage,
    runAgentCommand,
    agentMessage,
    clearAgentMessage: () => setAgentMessage(null),
  };
}
