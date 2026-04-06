import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ListPlus, Plus, Trash2 } from 'lucide-react';
import type { ExpenseCategory, ExpenseEntry } from '../types';
import {
  CATEGORY_COLORS,
  CATEGORY_COLUMNS_ORDER,
  CATEGORY_DESCRIPTIONS,
  CATEGORY_GRADIENT,
} from '../constants';
import { formatPlainAmountForInput, formatRupeesFull } from '../utils/format';

function parseAmount(raw: string): number | null {
  const v = parseFloat(raw.replace(/,/g, '').trim());
  return Number.isNaN(v) ? null : v;
}

function ExpenseLineRow({
  entry,
  onUpdate,
  onDelete,
  maskNumbers,
}: {
  entry: ExpenseEntry;
  onUpdate: (id: string, patch: Partial<Pick<ExpenseEntry, 'label' | 'amount'>>) => void;
  onDelete: () => void;
  maskNumbers: boolean;
}) {
  const [label, setLabel] = useState(entry.label);
  const [amountStr, setAmountStr] = useState(() => formatPlainAmountForInput(entry.amount));

  useEffect(() => {
    setLabel(entry.label);
    setAmountStr(formatPlainAmountForInput(entry.amount));
  }, [entry.id, entry.label, entry.amount]);

  const commit = () => {
    const a = parseAmount(amountStr);
    if (a === null || a < 0) {
      setAmountStr(formatPlainAmountForInput(entry.amount));
      setLabel(entry.label);
      return;
    }
    if (!label.trim()) {
      setLabel(entry.label);
      setAmountStr(formatPlainAmountForInput(entry.amount));
      return;
    }
    onUpdate(entry.id, { amount: a, label: label.trim() });
  };

  const inputCls =
    'min-w-0 rounded bg-transparent px-1 py-0.5 text-[11px] font-bold outline-none ring-0 ring-violet-400/40 placeholder:text-ink-600 focus:ring-1 sm:text-xs';

  const rowMotion = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.22, ease: [0.25, 0.1, 0.25, 1] as const },
  };

  if (maskNumbers) {
    return (
      <motion.li
        layout={false}
        className="grid grid-cols-[25%_minmax(0,1fr)_auto] items-center gap-1 rounded-lg border border-black/25 bg-black/35 px-1.5 py-1.5 backdrop-blur-sm"
        {...rowMotion}
      >
        <span className="flex min-w-0 items-center gap-0.5 text-[11px] font-bold tabular-nums text-ink-100 sm:text-xs">
          <span className="shrink-0 text-ink-400" aria-hidden>
            ₹
          </span>
          ***
        </span>
        <span className="min-w-0 truncate text-[11px] font-bold text-ink-100 sm:text-xs">{entry.label}</span>
        <button
          type="button"
          onClick={onDelete}
          className="flex shrink-0 justify-end rounded p-1 text-ink-600 hover:bg-rose-500/20 hover:text-rose-300"
          aria-label="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </motion.li>
    );
  }

  return (
    <motion.li
      layout={false}
      className="grid grid-cols-[25%_minmax(0,1fr)_auto] items-center gap-1 rounded-lg border border-black/25 bg-black/35 px-1.5 py-1 backdrop-blur-sm"
      {...rowMotion}
    >
      <div className="flex min-w-0 items-center gap-0.5">
        <span className="shrink-0 text-[11px] font-bold text-ink-400 sm:text-xs" aria-hidden>
          ₹
        </span>
        <input
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          inputMode="decimal"
          className={`${inputCls} min-w-0 flex-1 tabular-nums text-ink-100`}
          aria-label="Amount"
        />
      </div>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className={`${inputCls} w-full text-ink-100`}
        placeholder="Name"
        aria-label="Description"
      />
      <button
        type="button"
        onClick={onDelete}
        className="flex shrink-0 justify-end rounded p-1 text-ink-600 hover:bg-rose-500/20 hover:text-rose-300"
        aria-label="Delete"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </motion.li>
  );
}

type Props = {
  byCategory: Record<ExpenseCategory, number>;
  expenses: ExpenseEntry[];
  highlightedCategory: ExpenseCategory | null;
  onAddDefaultMonthlyLines: () => void;
  onAddExpense: (category: ExpenseCategory) => void;
  onUpdateExpense: (id: string, patch: Partial<Pick<ExpenseEntry, 'label' | 'amount'>>) => void;
  onDeleteExpense: (id: string) => void;
  maskNumbers?: boolean;
};

export function CategoryColumns({
  byCategory,
  expenses,
  highlightedCategory,
  onAddDefaultMonthlyLines,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  maskNumbers = false,
}: Props) {
  return (
    <section className="rounded-2xl border border-white/10 bg-ink-900/25 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold text-white">All Transactions by Section</h2>
          <p className="mt-1 text-sm text-ink-500">
            Every line item for this month — click the pie or chart list above to keep a column highlighted
            while you scroll.
          </p>
        </div>
        {!maskNumbers && (
          <button
            type="button"
            onClick={onAddDefaultMonthlyLines}
            className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-xs font-semibold text-ink-100 shadow-sm transition hover:border-violet-400/45 hover:bg-violet-500/15 hover:text-white sm:self-center"
            title="Add Transport, Recharges, Bills, Personal Care, and Other lines at ₹0 when missing"
          >
            <ListPlus className="h-4 w-4 text-violet-300/90" aria-hidden />
            Add Default Lines
          </button>
        )}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORY_COLUMNS_ORDER.map((cat) => {
          const list = expenses.filter((e) => e.category === cat).sort((a, b) => b.amount - a.amount);
          const total = byCategory[cat];
          const active = highlightedCategory === cat;
          const accent = CATEGORY_COLORS[cat];
          return (
            <div
              key={cat}
              className={`flex min-h-[12rem] flex-col rounded-xl border bg-gradient-to-br p-3 shadow-sm transition-[box-shadow,background-color,border-color] ${CATEGORY_GRADIENT[cat]} ${
                active
                  ? 'border-violet-400/80 shadow-[0_0_28px_-6px_rgba(139,92,246,0.55)] ring-2 ring-violet-400/40'
                  : 'border-white/15'
              }`}
            >
              <div
                className="mb-2 border-b pb-3"
                style={{
                  borderColor: active ? `${accent}99` : 'rgba(255,255,255,0.08)',
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-h-[2.75rem] w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
                      <span className="font-display text-base font-bold leading-tight text-white sm:text-lg">
                        {cat}
                      </span>
                      <span className="font-display text-lg font-bold tabular-nums text-white/95 sm:text-xl">
                        {maskNumbers ? '***' : formatRupeesFull(total)}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-3 text-center text-[9px] leading-snug text-ink-400">
                      {CATEGORY_DESCRIPTIONS[cat]}
                    </p>
                  </div>
                  {!maskNumbers && (
                    <button
                      type="button"
                      onClick={() => onAddExpense(cat)}
                      className="shrink-0 rounded-lg border border-white/15 bg-black/30 p-1.5 text-ink-200 transition hover:border-violet-400/40 hover:bg-violet-500/15 hover:text-white"
                      title={`Add expense in ${cat}`}
                      aria-label={`Add expense in ${cat}`}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <ul className="scrollbar-none flex-1 space-y-2 overflow-y-auto">
                {list.map((e) => (
                  <ExpenseLineRow
                    key={e.id}
                    entry={e}
                    onUpdate={onUpdateExpense}
                    onDelete={() => onDeleteExpense(e.id)}
                    maskNumbers={maskNumbers}
                  />
                ))}
              </ul>
              {list.length === 0 && (
                <p className="flex-1 py-4 text-center text-[10px] text-ink-600">No entries</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
