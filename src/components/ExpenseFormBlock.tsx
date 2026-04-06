import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import type { ExpenseCategory } from '../types';
import { EXPENSE_CATEGORIES } from '../constants';
import { formatPlainAmountForInput } from '../utils/format';

type Props = {
  monthKey: string;
  onAddExpense: (label: string, amount: number, category: ExpenseCategory) => void;
  /** e.g. h-full to align with the stat column */
  className?: string;
};

function parseAmount(raw: string): number | null {
  const v = parseFloat(raw.replace(/,/g, '').trim());
  return Number.isNaN(v) ? null : v;
}

export function ExpenseFormBlock({ monthKey, onAddExpense, className }: Props) {
  const [expLabel, setExpLabel] = useState('');
  const [expAmt, setExpAmt] = useState('');
  const [expCat, setExpCat] = useState<ExpenseCategory>('Food');

  useEffect(() => {
    setExpLabel('');
    setExpAmt('');
    setExpCat('Food');
  }, [monthKey]);

  return (
    <div
      className={`flex min-h-0 flex-col rounded-2xl border border-white/10 bg-ink-900/50 p-4 ${className ?? ''}`}
    >
      <h3 className="font-display text-sm font-semibold text-white">Add Expense manually</h3>
      <p className="mt-0.5 text-[11px] text-ink-500">Same as Quick add, without typing a command.</p>
      <form
        className="mt-3 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const a = parseAmount(expAmt);
          if (!expLabel.trim() || a === null || a <= 0) return;
          onAddExpense(expLabel.trim(), a, expCat);
          setExpLabel('');
          setExpAmt('');
        }}
      >
        <input
          value={expLabel}
          onChange={(e) => setExpLabel(e.target.value)}
          placeholder="What was it?"
          className="w-full rounded-xl border border-white/10 bg-ink-950 px-3 py-2.5 text-sm"
        />
        <input
          value={expAmt}
          onChange={(e) => setExpAmt(e.target.value)}
          onBlur={() => {
            const raw = expAmt.trim();
            if (raw === '') return;
            const a = parseAmount(expAmt);
            if (a !== null && a > 0) setExpAmt(formatPlainAmountForInput(a));
          }}
          placeholder="Amount"
          inputMode="decimal"
          className="w-full rounded-xl border border-white/10 bg-ink-950 px-3 py-2.5 text-sm tabular-nums"
        />
        <div className="rounded-xl border border-white/5 bg-black/20 p-2">
          <div
            className="flex flex-nowrap gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15"
            aria-label="Expense categories"
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setExpCat(c)}
                className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium transition sm:px-2.5 sm:text-[11px] ${
                  expCat === c
                    ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/30'
                    : 'bg-white/5 text-ink-400 hover:bg-white/10'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <button
          type="submit"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white shadow-md ring-1 ring-white/10 hover:bg-zinc-800"
        >
          <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} />
          Add expense
        </button>
      </form>
    </div>
  );
}
