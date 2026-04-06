import { useEffect, useMemo, useState } from 'react';
import { Plus, Wallet } from 'lucide-react';
import { INCOME_KIND_OPTIONS } from '../constants';
import type { IncomeKind } from '../types';
import { formatPlainAmountForInput, parseAmountInput } from '../utils/format';

type Props = {
  /** Used to infer year range; any month keys from your data */
  monthKeys: string[];
  /** Month pre-selected (yyyy-MM) */
  targetMonthKey: string;
  onAddSalary: (monthKey: string, label: string, amount: number, kind: IncomeKind) => void;
  footerHint?: string;
  className?: string;
};

/** Earliest year for income (Aug 2023 onwards). */
const MIN_INCOME_YEAR = 2023;

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function parseYearMonth(key: string): { y: number; m: number } | null {
  const [ys, ms] = key.split('-');
  const y = parseInt(ys ?? '', 10);
  const m = parseInt(ms ?? '', 10);
  if (Number.isNaN(y) || Number.isNaN(m) || m < 1 || m > 12) return null;
  return { y, m };
}

function yearRangeFromKeys(keys: string[]): { min: number; max: number } {
  const years = keys.map((k) => parseYearMonth(k)?.y).filter((y): y is number => y !== undefined && !Number.isNaN(y));
  const cy = new Date().getFullYear();
  const max = years.length > 0 ? Math.max(...years, cy + 2) : cy + 2;
  return { min: MIN_INCOME_YEAR, max: Math.max(MIN_INCOME_YEAR, max) };
}

export function SalaryForm({
  monthKeys,
  targetMonthKey,
  onAddSalary,
  footerHint = 'Shows in that month’s income and totals.',
  className,
}: Props) {
  const { min: yMin, max: yMax } = useMemo(() => yearRangeFromKeys(monthKeys), [monthKeys]);

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = yMin; y <= yMax; y++) list.push(y);
    return list;
  }, [yMin, yMax]);

  const initial = parseYearMonth(targetMonthKey);
  const cy = new Date().getFullYear();
  const cm = new Date().getMonth() + 1;

  const [year, setYear] = useState(initial?.y ?? cy);
  const [month, setMonth] = useState(initial?.m ?? cm);
  const [extraLabel, setExtraLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [incomeKind, setIncomeKind] = useState<IncomeKind>('salary');

  useEffect(() => {
    const p = parseYearMonth(targetMonthKey);
    if (p) {
      setYear(Math.min(yMax, Math.max(yMin, p.y)));
      setMonth(p.m);
    }
  }, [targetMonthKey, yMin, yMax]);

  useEffect(() => {
    if (incomeKind === 'salary') {
      setExtraLabel('');
    }
  }, [incomeKind]);

  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  return (
    <div
      className={`flex min-h-0 flex-col rounded-2xl border border-white/10 bg-ink-900/50 p-4 ${className ?? ''}`}
    >
      <div className="mb-3 flex shrink-0 items-center gap-2">
        <div className="rounded-lg bg-teal-500/15 p-2 text-teal-300">
          <Wallet className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-display text-sm font-semibold text-white">Salary & income</h3>
          <p className="text-[11px] text-ink-500">Pick year and month, category, then amount.</p>
        </div>
      </div>
      <form
        className="flex min-h-0 flex-1 flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const a = parseAmountInput(amount);
          if (a === null) return;
          if (incomeKind !== 'investment' && a <= 0) return;
          if (incomeKind === 'investment' && a === 0) return;
          const label =
            incomeKind === 'salary' ? 'Salary' : extraLabel.trim();
          if (!label) return;
          onAddSalary(monthKey, label, a, incomeKind);
          setAmount('');
          if (incomeKind !== 'salary') setExtraLabel('');
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-ink-500">
            Year
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-ink-500">
            Month
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white"
            >
              {MONTH_SHORT.map((name, i) => (
                <option key={i + 1} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <p className="mb-1.5 text-xs text-ink-500">Category</p>
          <div className="rounded-xl border border-white/5 bg-black/20 p-2">
            <div
              className="flex flex-nowrap gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15"
              aria-label="Income category"
            >
              {INCOME_KIND_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setIncomeKind(o.value)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition sm:text-xs ${
                    incomeKind === o.value
                      ? 'bg-teal-600 text-white shadow-md shadow-teal-500/25 ring-1 ring-teal-400/40'
                      : 'bg-white/5 text-ink-400 hover:bg-white/10'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {incomeKind !== 'salary' && (
          <input
            value={extraLabel}
            onChange={(e) => setExtraLabel(e.target.value)}
            placeholder={
              incomeKind === 'investment'
                ? 'Label (required) — e.g. MF redemption, stocks'
                : 'Description (e.g. Bonus, Salary-2)'
            }
            className="w-full rounded-xl border border-white/10 bg-ink-950 px-3 py-2.5 text-sm"
          />
        )}

        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={() => {
            const raw = amount.trim();
            if (raw === '') return;
            const a = parseAmountInput(amount);
            if (a === null) return;
            if (incomeKind === 'investment') {
              if (a !== 0) setAmount(formatPlainAmountForInput(a));
            } else if (a > 0) {
              setAmount(formatPlainAmountForInput(a));
            }
          }}
          placeholder="Amount"
          inputMode="decimal"
          className="w-full rounded-xl border border-white/10 bg-ink-950 px-3 py-2.5 text-sm tabular-nums"
        />
        <div className="min-h-2 flex-1" aria-hidden />
        <button
          type="submit"
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-teal-600/90 py-2.5 text-sm font-semibold text-white shadow-md ring-1 ring-teal-400/30 hover:bg-teal-500"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Add to month
        </button>
      </form>
      <p className="mt-3 shrink-0 text-[10px] text-ink-600">{footerHint}</p>
    </div>
  );
}
