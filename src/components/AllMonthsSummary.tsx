import { useEffect, useMemo, useRef, useState } from 'react';
import { format, parse } from 'date-fns';
import { ArrowDownToLine, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { BankAccountBalance, ExpenseCategory, IncomeEntry, IncomeKind, MonthRecord } from '../types';
import { AnimatedRupees } from './AnimatedRupees';
import { formatPlainAmountForInput, formatRupeesFull, parseAmountInput } from '../utils/format';
import { createId } from '../utils/id';
import { MonthStatCards, STAT_GRADIENTS } from './MonthHeadingStats';
import { ExpensePie } from './ExpensePie';
import { SalaryForm } from './SalaryForm';

type Props = {
  months: MonthRecord[];
  sections: ExpenseCategory[];
  monthKeys: string[];
  bankAccounts: BankAccountBalance[];
  totalIncome: number;
  totalInvestments: number;
  totalExpenses: number;
  net: number;
  bankTotal: number;
  maskNumbers?: boolean;
  onSetBankAccounts: (accounts: BankAccountBalance[]) => void;
  onAddIncome: (monthKey: string, label: string, amount: number, kind: IncomeKind) => void;
  onUpdateIncome: (monthKey: string, id: string, patch: Partial<Pick<IncomeEntry, 'label' | 'amount' | 'kind'>>) => void;
  onDeleteIncome: (monthKey: string, id: string) => void;
  investmentProfit: number;
  onInvestmentProfitChange: (profit: number) => void;
  onDeleteMonth: (monthKey: string) => void;
  /** Pie “Details” links to `/category/...` (summary page only). */
  categoryDetailHref?: (category: ExpenseCategory) => string;
};

function monthTitle(key: string): string {
  try {
    return format(parse(key, 'yyyy-MM', new Date()), 'MMM yyyy');
  } catch {
    return key;
  }
}

const sortedMonths = (months: MonthRecord[]) =>
  [...months].sort((a, b) => a.monthKey.localeCompare(b.monthKey));

function splitIncome(income: IncomeEntry[]) {
  return {
    salary: income.filter((e) => e.kind === 'salary'),
    other: income.filter((e) => e.kind === 'other'),
    investment: income.filter((e) => e.kind === 'investment'),
  };
}

/** Full-column outline when a stat card jumps here (no per-cell fill). */
function incomeColFlash(
  col: 'salary' | 'other' | 'investment',
  active: Array<'salary' | 'other' | 'investment'>,
): string {
  if (!active.includes(col)) return '';
  return 'border-l-2 border-r-2 border-amber-400/75 shadow-[inset_0_0_20px_rgba(251,191,36,0.06)]';
}

/** Salary column: hide the word “Salary” when label is exactly Salary. Else show ₹amount (label). */
function formatIncomeLine(e: IncomeEntry, maskNumbers: boolean): string {
  const L = e.label.trim();
  const low = L.toLowerCase();
  if (e.kind === 'salary' && low === 'salary') {
    return maskNumbers ? '***' : formatRupeesFull(e.amount);
  }
  const amt = maskNumbers ? '***' : formatRupeesFull(e.amount);
  return `${amt} (${L})`;
}

function kindBadge(kind: IncomeKind): { emoji: string; classes: string } {
  if (kind === 'salary')
    return { emoji: '💰', classes: 'border-teal-400/30 bg-teal-500/15 text-teal-200' };
  if (kind === 'investment')
    return { emoji: '📈', classes: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200' };
  return { emoji: '🧾', classes: 'border-violet-400/30 bg-violet-500/15 text-violet-200' };
}

function IncomeLineRow({
  entry,
  onUpdate,
  onDelete,
  maskNumbers,
}: {
  entry: IncomeEntry;
  onUpdate: (id: string, patch: Partial<Pick<IncomeEntry, 'label' | 'amount' | 'kind'>>) => void;
  onDelete: () => void;
  maskNumbers: boolean;
}) {
  const [label, setLabel] = useState(entry.label);
  const [amountStr, setAmountStr] = useState(() => formatPlainAmountForInput(entry.amount));

  useEffect(() => {
    setLabel(entry.label);
    setAmountStr(formatPlainAmountForInput(entry.amount));
  }, [entry.id, entry.label, entry.amount]);

  const isPureSalary = entry.kind === 'salary' && entry.label.trim().toLowerCase() === 'salary';

  const commit = () => {
    const a = parseAmountInput(amountStr);
    if (a === null) {
      setLabel(entry.label);
      setAmountStr(formatPlainAmountForInput(entry.amount));
      return;
    }
    if (isPureSalary) {
      if (a <= 0) {
        setLabel(entry.label);
        setAmountStr(formatPlainAmountForInput(entry.amount));
        return;
      }
      onUpdate(entry.id, { amount: a, label: 'Salary', kind: 'salary' });
      return;
    }
    if (entry.kind === 'investment') {
      if (!label.trim()) {
        setLabel(entry.label);
        setAmountStr(formatPlainAmountForInput(entry.amount));
        return;
      }
      onUpdate(entry.id, { amount: a, label: label.trim(), kind: 'investment' });
      return;
    }
    if (a <= 0) {
      setLabel(entry.label);
      setAmountStr(formatPlainAmountForInput(entry.amount));
      return;
    }
    if (!label.trim()) {
      setLabel(entry.label);
      setAmountStr(formatPlainAmountForInput(entry.amount));
      return;
    }
    onUpdate(entry.id, { amount: a, label: label.trim(), kind: entry.kind });
  };

  const inputCls =
    'min-w-0 rounded bg-transparent px-1 py-0.5 text-[11px] outline-none ring-0 transition placeholder:text-ink-600 focus:ring-1 focus:ring-violet-400/50 sm:text-sm';
  const amountCls = `${inputCls} w-full min-w-0 tabular-nums text-ink-100`;
  const labelCls = `${inputCls} w-full min-w-0 text-ink-200`;

  const badge = kindBadge(entry.kind);

  if (maskNumbers) {
    return (
      <div className="flex items-start justify-between gap-1.5 rounded-lg border border-white/10 bg-black/25 px-2 py-1.5">
        <div className="flex min-w-0 flex-1 items-start gap-1.5">
          <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] leading-tight ${badge.classes}`}>
            {badge.emoji}
          </span>
          <span className="min-w-0 flex-1 text-[11px] text-ink-200 sm:text-sm">
            {formatIncomeLine(entry, true)}
          </span>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 rounded p-1 text-ink-500 hover:bg-rose-500/15 hover:text-rose-300"
          aria-label="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-1.5 rounded-lg border border-white/10 bg-black/25 px-2 py-1.5">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] leading-tight ${badge.classes}`}>
          {badge.emoji}
        </span>
        {isPureSalary ? (
          <input
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            inputMode="decimal"
            className={`${inputCls} w-full min-w-[8rem] tabular-nums text-ink-100`}
            aria-label="Salary amount"
          />
        ) : (
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5">
            <input
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              inputMode="decimal"
              className={amountCls}
              aria-label="Amount"
            />
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className={labelCls}
              placeholder="Label"
              aria-label="Description"
            />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="shrink-0 rounded p-1 text-ink-500 hover:bg-rose-500/15 hover:text-rose-600"
        aria-label="Delete"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

function IncomeColumn({
  entries,
  monthKey,
  onUpdateIncome,
  onDeleteIncome,
  maskNumbers,
}: {
  entries: IncomeEntry[];
  monthKey: string;
  onUpdateIncome: (monthKey: string, id: string, patch: Partial<Pick<IncomeEntry, 'label' | 'amount' | 'kind'>>) => void;
  onDeleteIncome: (monthKey: string, id: string) => void;
  maskNumbers: boolean;
}) {
  if (entries.length === 0) {
    return <span className="block min-h-[1.125rem]" aria-hidden />;
  }
  return (
    <div className="space-y-2">
      {entries.map((e) => (
        <IncomeLineRow
          key={e.id}
          entry={e}
          onUpdate={(id, patch) => onUpdateIncome(monthKey, id, patch)}
          onDelete={() => onDeleteIncome(monthKey, e.id)}
          maskNumbers={maskNumbers}
        />
      ))}
    </div>
  );
}

function NetWorthPanel({ netWorth, maskNumbers }: { netWorth: number; maskNumbers: boolean }) {
  return (
    <div className="w-full shrink-0 rounded-2xl border border-white/10 bg-ink-900/60 px-3 py-2.5 text-right shadow-inner shadow-black/20 sm:w-auto sm:min-w-[14rem] lg:ml-auto">
      <div className="inline-flex flex-wrap items-baseline justify-end gap-x-1.5 gap-y-0.5">
        <span className="font-display text-lg font-bold tracking-tight text-white sm:text-xl">
          Net worth
        </span>
        <span className="font-light text-ink-500" aria-hidden>
          —
        </span>
        <span className="font-display text-lg font-bold tabular-nums text-white sm:text-xl">
          <AnimatedRupees value={netWorth} maskNumbers={maskNumbers} />
        </span>
      </div>
    </div>
  );
}

export function AllMonthsSummary({
  months,
  sections,
  monthKeys,
  bankAccounts,
  totalIncome,
  totalInvestments,
  totalExpenses,
  net,
  bankTotal,
  maskNumbers = false,
  onSetBankAccounts,
  onAddIncome,
  onUpdateIncome,
  onDeleteIncome,
  investmentProfit,
  onInvestmentProfitChange,
  onDeleteMonth,
  categoryDetailHref,
}: Props) {
  const sortedKeysDesc = [...monthKeys].sort((a, b) => b.localeCompare(a));
  const salaryDefaultMonth = sortedKeysDesc[0] ?? '';
  const hasAccounts = bankAccounts.length > 0;
  const match =
    hasAccounts &&
    bankAccounts.every((a) => Number.isFinite(a.balance)) &&
    Math.round(bankTotal) === Math.round(net);

  const ordered = sortedMonths(months);

  const [chartHover, setChartHover] = useState<ExpenseCategory | null>(null);
  const [chartPinned, setChartPinned] = useState<ExpenseCategory | null>(null);

  const allIncomeSectionRef = useRef<HTMLElement | null>(null);
  const bankSectionRef = useRef<HTMLElement | null>(null);
  const spentByCategoryRef = useRef<HTMLElement | null>(null);

  const [highlightIncomeCols, setHighlightIncomeCols] = useState<Array<'salary' | 'other' | 'investment'>>([]);
  const [flashBank, setFlashBank] = useState(false);

  const flashTimerRef = useRef<number | null>(null);
  const flashBankTimerRef = useRef<number | null>(null);

  const totalsAllMonths = useMemo(() => {
    let salary = 0;
    let other = 0;
    let investment = 0;
    for (const m of months) {
      for (const e of m.income) {
        if (e.kind === 'investment') investment += e.amount;
        else if (e.kind === 'salary') salary += e.amount;
        else other += e.amount;
      }
    }
    return { salary, other, investment };
  }, [months]);

  function flashIncomeColumns(cols: Array<'salary' | 'other' | 'investment'>) {
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);

    setHighlightIncomeCols(cols);
    allIncomeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    flashTimerRef.current = window.setTimeout(() => {
      setHighlightIncomeCols([]);
    }, 2400);
  }

  function flashBankSection() {
    if (flashBankTimerRef.current) window.clearTimeout(flashBankTimerRef.current);

    setFlashBank(true);
    bankSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    flashBankTimerRef.current = window.setTimeout(() => {
      setFlashBank(false);
    }, 2400);
  }

  function scrollToSpentByCategory() {
    spentByCategoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleStatSelect(stat: 'income' | 'expenses' | 'investments' | 'savings') {
    if (stat === 'savings') {
      flashBankSection();
      return;
    }
    if (stat === 'expenses') {
      scrollToSpentByCategory();
      return;
    }
    if (stat === 'income') flashIncomeColumns(['salary', 'other']);
    if (stat === 'investments') flashIncomeColumns(['investment']);
  }

  const byCategoryAllMonths = useMemo(() => {
    const r = {} as Record<ExpenseCategory, number>;
    for (const c of sections) r[c] = 0;
    for (const m of months) {
      for (const e of m.expenses) {
        r[e.category] = (r[e.category] ?? 0) + e.amount;
      }
    }
    return r;
  }, [months, sections]);

  const updateAccount = (id: string, patch: Partial<BankAccountBalance>) => {
    onSetBankAccounts(bankAccounts.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const removeAccount = (id: string) => {
    onSetBankAccounts(bankAccounts.filter((a) => a.id !== id));
  };

  const addAccount = () => {
    const n = bankAccounts.length + 1;
    onSetBankAccounts([...bankAccounts, { id: createId(), name: `Account ${n}`, balance: 0 }]);
  };

  return (
    <div className="space-y-8 pb-2">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">All months overview</h1>
          <p className="mt-1 text-sm text-ink-500">
            Lifetime totals across every month: income, expenses, investments, and savings.
          </p>
        </div>
        <NetWorthPanel
          netWorth={bankTotal + totalInvestments + investmentProfit}
          maskNumbers={maskNumbers}
        />
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <section className="flex min-h-0 flex-col rounded-2xl border border-white/10 bg-ink-900 p-5 shadow-none">
          <div className="shrink-0">
            <h2 className="font-display text-lg font-semibold text-white">Income, Expenses & Investments</h2>
            <p className="mt-1 text-sm text-ink-500">
              All months combined — salary + other, expenses, investments, then savings.
            </p>
          </div>
          <div className="mt-4 flex min-h-0 flex-1 flex-col justify-center gap-3">
            <MonthStatCards
              incomeTotal={totalIncome}
              expenseTotal={totalExpenses}
              investmentTotal={totalInvestments}
              investmentProfit={investmentProfit}
              onInvestmentProfitChange={onInvestmentProfitChange}
              maskNumbers={maskNumbers}
              onSelectStat={handleStatSelect}
            />
          </div>
        </section>

        <section
          ref={bankSectionRef}
          className={`flex min-h-0 flex-col rounded-2xl border border-white/10 bg-ink-900 p-5 shadow-none transition ${
            flashBank
              ? 'ring-2 ring-violet-400/55 shadow-[0_0_28px_-8px_rgba(139,92,246,0.35)]'
              : ''
          }`}
        >
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-display text-base font-semibold tracking-tight text-white sm:text-lg">
                Bank balances
              </h2>
            </div>
            <button
              type="button"
              onClick={addAccount}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-500/25 ring-1 ring-cyan-400/35 transition hover:from-teal-500 hover:to-cyan-500"
            >
              <Plus className="h-4 w-4" />
              Add account
            </button>
          </div>

          <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
            {bankAccounts.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/15 bg-black/20 py-8 text-center text-sm text-ink-500">
                Add your bank accounts and current balances.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/20">
                <table className="w-full min-w-[280px] text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-[10px] font-medium uppercase tracking-wider text-ink-500">
                      <th className="px-2 py-2 pl-3">Account name</th>
                      <th className="w-[8.5rem] px-2 py-2 tabular-nums sm:w-40">Balance</th>
                      <th className="w-10 px-1 py-2" aria-hidden />
                    </tr>
                  </thead>
                  <tbody>
                    {bankAccounts.map((acc) => (
                      <tr key={acc.id} className="border-b border-white/5 last:border-0">
                        <td className="px-2 py-1.5 pl-3 align-middle">
                          <input
                            value={acc.name}
                            onChange={(e) => updateAccount(acc.id, { name: e.target.value })}
                            placeholder="e.g. HDFC Savings"
                            className="w-full min-w-0 rounded-lg border border-white/10 bg-ink-950 px-2 py-1.5 text-sm text-white"
                            aria-label={`Account name ${acc.name || 'new'}`}
                          />
                        </td>
                        <td className="px-2 py-1.5 align-middle">
                          <input
                            value={
                              maskNumbers
                                ? ''
                                : Number.isFinite(acc.balance) && acc.balance !== 0
                                  ? formatPlainAmountForInput(acc.balance)
                                  : acc.balance === 0
                                    ? '0'
                                    : ''
                            }
                            onChange={(e) => {
                              const raw = e.target.value.trim();
                              if (raw === '') {
                                updateAccount(acc.id, { balance: 0 });
                                return;
                              }
                              const n = parseAmountInput(raw);
                              if (n !== null) updateAccount(acc.id, { balance: n });
                            }}
                            placeholder={maskNumbers ? '***' : '0'}
                            inputMode="decimal"
                            readOnly={maskNumbers}
                            className={`w-full rounded-lg border border-white/10 bg-ink-950 px-2 py-1.5 text-sm tabular-nums ${
                              maskNumbers ? 'text-ink-500' : 'text-white'
                            }`}
                            aria-label={`Balance for ${acc.name || 'account'}`}
                          />
                        </td>
                        <td className="px-1 py-1.5 align-middle text-center">
                          <button
                            type="button"
                            onClick={() => removeAccount(acc.id)}
                            className="rounded-lg p-1.5 text-ink-500 hover:bg-rose-500/15 hover:text-rose-300"
                            aria-label="Remove account"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div
            className={`mt-6 shrink-0 rounded-xl border p-4 ${
              !hasAccounts
                ? 'border-white/10 bg-black/20'
                : match
                  ? 'border-emerald-500/40 bg-emerald-500/10'
                  : 'border-amber-500/40 bg-amber-500/10'
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-ink-400">Difference</p>
                <p
                  className={`mt-1 font-display text-xl font-bold tabular-nums ${
                    !hasAccounts
                      ? 'text-ink-500'
                      : match
                        ? 'text-white'
                        : bankTotal - net > 0
                          ? 'text-emerald-300'
                          : 'text-rose-300'
                  }`}
                >
                  {hasAccounts
                    ? maskNumbers
                      ? '***'
                      : formatRupeesFull(bankTotal - net)
                    : '—'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium uppercase tracking-wider text-ink-400">Combined bank balance</p>
                <p className="mt-1 font-display text-xl font-bold tabular-nums text-white">
                  {hasAccounts ? (maskNumbers ? '***' : formatRupeesFull(bankTotal)) : '—'}
                </p>
              </div>
            </div>
            {hasAccounts && (
              <p className={`mt-3 text-sm font-medium ${match ? 'text-emerald-300' : 'text-amber-200'}`}>
                {match
                  ? 'Bank total matches your savings (tracked net).'
                  : 'Adjust income, expenses, investments, or bank figures to reconcile.'}
              </p>
            )}
          </div>
        </section>
      </div>

      <section
        ref={spentByCategoryRef}
        className="rounded-2xl border border-white/10 bg-ink-900 p-4 shadow-none sm:p-5"
      >
        <h2 className="font-display text-base font-semibold text-white sm:text-lg">Spent by category</h2>
        <p className="mt-0.5 text-xs text-ink-500 sm:text-sm">
          Total expenses summed across all months. Hover for a quick peek, click to pin.
        </p>

        <div className="mt-3">
          <ExpensePie
            sections={sections}
            byCategory={byCategoryAllMonths}
            hoverCategory={chartHover}
            pinnedCategory={chartPinned}
            onHoverCategory={setChartHover}
            onLeaveChart={() => setChartHover(null)}
            onTogglePin={(c) => setChartPinned((p) => (p === c ? null : c))}
            onDismissPin={() => setChartPinned(null)}
            maskNumbers={maskNumbers}
            renderCategoryDetail={
              categoryDetailHref
                ? (cat) => (
                    <Link
                      to={categoryDetailHref(cat)}
                      className="flex shrink-0 items-center justify-center self-stretch rounded-lg border border-white/10 bg-black/35 px-2.5 text-[11px] font-semibold text-violet-300 underline-offset-2 transition hover:border-violet-400/45 hover:bg-violet-500/15 hover:text-violet-200 sm:px-3 sm:text-xs"
                      title={`View every ${cat} expense across all months`}
                    >
                      Details
                    </Link>
                  )
                : undefined
            }
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <SalaryForm
          className="w-full min-h-0"
          monthKeys={sortedKeysDesc.length ? sortedKeysDesc : monthKeys}
          targetMonthKey={salaryDefaultMonth}
          onAddSalary={onAddIncome}
          footerHint="Appears in the income table below and refreshes the totals above."
        />
        <aside className="flex flex-col justify-between rounded-2xl border border-white/10 bg-ink-900 p-4 shadow-none sm:p-5">
          <div>
            <h3 className="font-display text-sm font-semibold text-white">How income fits in</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-400">
              What you add here shows up in the line-by-line table below and in the summary cards at the top.
            </p>
            <ul className="mt-3 space-y-2 text-xs text-ink-300">
              <li className="flex gap-2">
                <span className="shrink-0" aria-hidden>
                  💰
                </span>
                <span>
                  <span className="font-medium text-ink-100">Salary & other</span> — counted toward
                  monthly income and cash flow.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0" aria-hidden>
                  📈
                </span>
                <span>
                  <span className="font-medium text-ink-100">Investments</span> — tracked in their
                  own column; they affect savings vs bank reconciliation.
                </span>
              </li>
            </ul>
          </div>
          <button
            type="button"
            onClick={() => allIncomeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-semibold text-ink-100 transition hover:border-violet-400/30 hover:bg-violet-500/10"
          >
            <ArrowDownToLine className="h-3.5 w-3.5 text-violet-300" />
            Jump to income table
          </button>
        </aside>
      </div>

      <section
        ref={allIncomeSectionRef}
        className="rounded-2xl border border-white/10 bg-ink-900 p-5 shadow-none"
      >
        <header className="mb-6 text-center">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-4xl">
            Income & Investments
          </h2>
        </header>
        <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
          <table className="w-full min-w-[600px] table-fixed border-separate border-spacing-0 text-base">
            <colgroup>
              <col className="w-[20%]" />
              <col className="w-[24%]" />
              <col className="w-[24%]" />
              <col className="w-[24%]" />
              <col className="w-[3.5rem]" />
            </colgroup>
            <thead>
              <tr className="border-b border-white/10">
                <th className="align-bottom px-3 pb-3 pt-4 text-left text-xs font-medium uppercase tracking-wider text-ink-500 sm:text-sm">
                  Totals
                </th>
                <th
                  className={`px-2 pb-3 pt-4 align-bottom text-center font-normal transition-colors ${incomeColFlash('salary', highlightIncomeCols)}`}
                >
                  <div
                    className={`relative overflow-hidden rounded-xl border border-teal-400/30 px-3 py-2.5 text-center shadow-[inset_0_1px_0_0_rgba(20,184,166,0.08)] ${STAT_GRADIENTS.income}`}
                  >
                    <p className="text-xs font-medium uppercase tracking-wider text-teal-200/90 sm:text-sm">Total salary</p>
                    <p className="mt-1 font-display text-xl font-bold tabular-nums text-white sm:text-2xl">
                      <AnimatedRupees value={totalsAllMonths.salary} maskNumbers={maskNumbers} />
                    </p>
                  </div>
                </th>
                <th
                  className={`px-2 pb-3 pt-4 align-bottom text-center font-normal transition-colors ${incomeColFlash('other', highlightIncomeCols)}`}
                >
                  <div
                    className={`relative overflow-hidden rounded-xl border border-violet-400/30 px-3 py-2.5 text-center shadow-[inset_0_1px_0_0_rgba(139,92,246,0.08)] ${STAT_GRADIENTS.other}`}
                  >
                    <p className="text-xs font-medium uppercase tracking-wider text-violet-200/90 sm:text-sm">Total other</p>
                    <p className="mt-1 font-display text-xl font-bold tabular-nums text-white sm:text-2xl">
                      <AnimatedRupees value={totalsAllMonths.other} maskNumbers={maskNumbers} />
                    </p>
                  </div>
                </th>
                <th
                  className={`px-2 pb-3 pt-4 align-bottom text-center font-normal transition-colors ${incomeColFlash('investment', highlightIncomeCols)}`}
                >
                  <div
                    className={`relative overflow-hidden rounded-xl border border-emerald-400/30 px-3 py-2.5 text-center shadow-[inset_0_1px_0_0_rgba(52,211,153,0.08)] ${STAT_GRADIENTS.investment}`}
                  >
                    <p className="text-xs font-medium uppercase tracking-wider text-emerald-200/90 sm:text-sm">Total investments</p>
                    <p className="mt-1 font-display text-xl font-bold tabular-nums text-white sm:text-2xl">
                      <AnimatedRupees value={totalsAllMonths.investment} maskNumbers={maskNumbers} />
                    </p>
                  </div>
                </th>
                <th className="align-bottom pb-3 pt-4" aria-hidden />
              </tr>
              <tr className="border-b border-white/10 text-sm uppercase tracking-wider text-ink-500 sm:text-base">
                <th className="px-3 pb-3 pr-3 pt-1 text-left font-semibold">Month</th>
                <th
                  className={`px-2 pb-3 pt-1 text-center font-semibold transition-colors ${incomeColFlash('salary', highlightIncomeCols)}`}
                >
                  <span className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-teal-400/20 bg-teal-500/10 px-3 py-2 text-sm sm:text-base">
                    💰 Salary
                  </span>
                </th>
                <th
                  className={`px-2 pb-3 pt-1 text-center font-semibold transition-colors ${incomeColFlash('other', highlightIncomeCols)}`}
                >
                  <span className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-sm sm:text-base">
                    🧾 Other income
                  </span>
                </th>
                <th
                  className={`px-2 pb-3 pt-1 text-center font-semibold transition-colors ${incomeColFlash('investment', highlightIncomeCols)}`}
                >
                  <span className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm sm:text-base">
                    📈 Investment
                  </span>
                </th>
                <th className="px-1 pb-3 pt-1 text-center font-semibold text-xs uppercase tracking-wider text-ink-500 sm:text-sm">
                  <span className="sr-only">Delete month</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((m, idx) => {
                const { salary, other, investment } = splitIncome(m.income);
                return (
                  <tr
                    key={m.monthKey}
                    className={`border-b border-white/5 align-top transition-colors ${
                      idx % 2 === 0 ? 'bg-black/10' : 'bg-transparent hover:bg-white/5'
                    }`}
                  >
                    <td className="px-3 py-3 text-left whitespace-nowrap">
                      <span className="inline-flex items-center rounded-full border border-white/10 bg-black/25 px-3.5 py-1.5 text-sm font-semibold text-ink-200 sm:text-base">
                        {monthTitle(m.monthKey)}
                      </span>
                    </td>
                    <td
                      className={`max-w-[160px] px-2 py-3 align-middle transition-colors sm:max-w-none ${incomeColFlash('salary', highlightIncomeCols)}`}
                    >
                      <IncomeColumn
                        entries={salary}
                        monthKey={m.monthKey}
                        onUpdateIncome={onUpdateIncome}
                        onDeleteIncome={onDeleteIncome}
                        maskNumbers={maskNumbers}
                      />
                    </td>
                    <td
                      className={`max-w-[160px] px-2 py-3 align-middle transition-colors sm:max-w-none ${incomeColFlash('other', highlightIncomeCols)}`}
                    >
                      <IncomeColumn
                        entries={other}
                        monthKey={m.monthKey}
                        onUpdateIncome={onUpdateIncome}
                        onDeleteIncome={onDeleteIncome}
                        maskNumbers={maskNumbers}
                      />
                    </td>
                    <td
                      className={`max-w-[160px] px-2 py-3 align-middle transition-colors sm:max-w-none ${incomeColFlash('investment', highlightIncomeCols)}`}
                    >
                      <IncomeColumn
                        entries={investment}
                        monthKey={m.monthKey}
                        onUpdateIncome={onUpdateIncome}
                        onDeleteIncome={onDeleteIncome}
                        maskNumbers={maskNumbers}
                      />
                    </td>
                    <td className="px-1 py-3 align-middle text-center">
                      {!maskNumbers && (
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Remove ${monthTitle(m.monthKey)} and all income and expenses for that month?`,
                              )
                            ) {
                              onDeleteMonth(m.monthKey);
                            }
                          }}
                          className="rounded-lg p-1.5 text-ink-500 transition hover:bg-rose-500/15 hover:text-rose-300"
                          title="Delete this month"
                          aria-label={`Delete month ${monthTitle(m.monthKey)}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {ordered.every((m) => m.income.length === 0) && (
            <p className="py-8 text-center text-ink-500">No income entries yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
