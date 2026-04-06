import { motion } from 'framer-motion';
import { Landmark, PiggyBank, TrendingDown, TrendingUp } from 'lucide-react';
import { useEffect, useState, type KeyboardEvent } from 'react';
import { formatPlainAmountForInput } from '../utils/format';
import { AnimatedRupees } from './AnimatedRupees';

function parseAmount(raw: string): number | null {
  const v = parseFloat(raw.replace(/,/g, '').trim());
  return Number.isNaN(v) ? null : v;
}

function InvestmentCardContent({
  invested,
  profit,
  onInvestmentProfitChange,
  maskNumbers,
}: {
  invested: number;
  profit: number;
  onInvestmentProfitChange?: (profit: number) => void;
  maskNumbers: boolean;
}) {
  const pct = invested !== 0 ? (profit / invested) * 100 : null;
  const pctDisplay =
    pct === null ? null : Math.abs(pct % 1) < 0.05 ? String(Math.round(pct)) : pct.toFixed(1);

  const [profitStr, setProfitStr] = useState(() => (profit === 0 ? '' : formatPlainAmountForInput(profit)));
  useEffect(() => {
    setProfitStr(profit === 0 ? '' : formatPlainAmountForInput(profit));
  }, [profit]);

  const commitProfit = () => {
    if (!onInvestmentProfitChange) return;
    const raw = profitStr.trim();
    if (raw === '') {
      onInvestmentProfitChange(0);
      return;
    }
    const n = parseAmount(raw);
    if (n === null) {
      setProfitStr(profit === 0 ? '' : formatPlainAmountForInput(profit));
      return;
    }
    onInvestmentProfitChange(n);
  };

  const showBreakdown = onInvestmentProfitChange != null;

  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-200/90">Investments</p>
        <p className="mt-0.5 text-[9px] text-ink-500">Income lines tagged Investment</p>
        {showBreakdown ? (
          <div
            className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <p className="flex min-w-0 flex-wrap items-baseline gap-x-1 break-words font-display text-base font-bold tabular-nums text-white sm:text-lg">
              {maskNumbers ? (
                <span>*** + ***</span>
              ) : (
                <>
                  <AnimatedRupees value={invested} className="inline" />
                  <span> + </span>
                  <AnimatedRupees value={profit} className="inline" />
                  {pctDisplay !== null && invested !== 0 && (
                    <span className="text-emerald-400"> ({pctDisplay}%)</span>
                  )}
                  {invested === 0 && <span className="text-ink-600"> (—)</span>}
                </>
              )}
            </p>
            <label className="flex shrink-0 items-center gap-1.5 text-[9px] font-medium uppercase tracking-wider text-ink-500">
              <span className="whitespace-nowrap">Profit</span>
              <input
                type="text"
                inputMode="decimal"
                disabled={maskNumbers}
                value={maskNumbers ? '' : profitStr}
                onChange={(e) => setProfitStr(e.target.value)}
                onBlur={commitProfit}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
                placeholder="0"
                className="w-[5.5rem] rounded-lg border border-white/10 bg-black/35 px-2 py-1 text-xs text-white tabular-nums placeholder:text-ink-600 focus:border-emerald-400/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/35 disabled:cursor-not-allowed disabled:opacity-50 sm:w-28 sm:text-sm"
              />
            </label>
          </div>
        ) : (
          <p className="mt-1 break-words font-display text-lg font-bold tabular-nums text-white sm:text-xl">
            <AnimatedRupees value={invested} maskNumbers={maskNumbers} />
          </p>
        )}
      </div>
      <div className="rounded-lg bg-black/35 p-1.5 text-emerald-300">
        <Landmark className="h-4 w-4" />
      </div>
    </div>
  );
}

/** Dark surfaces with a colored glow from the top-left — stat cards & summary table totals. */
export const STAT_GRADIENTS = {
  income:
    'bg-[radial-gradient(ellipse_200%_200%_at_0%_0%,rgba(34,211,238,0.34)_0%,rgba(22,26,38,0.9)_60%,#080a10_100%)]',
  expense:
    'bg-[radial-gradient(ellipse_200%_200%_at_0%_0%,rgba(244,63,94,0.30)_0%,rgba(22,26,38,0.9)_60%,#080a10_100%)]',
  investment:
    'bg-[radial-gradient(ellipse_200%_200%_at_0%_0%,rgba(52,211,153,0.32)_0%,rgba(22,26,38,0.9)_60%,#080a10_100%)]',
  /** Other income column (violet) — all-months table only */
  other:
    'bg-[radial-gradient(ellipse_200%_200%_at_0%_0%,rgba(167,139,250,0.30)_0%,rgba(22,26,38,0.9)_60%,#080a10_100%)]',
  savings:
    'bg-[radial-gradient(ellipse_200%_200%_at_0%_0%,rgba(139,92,246,0.30)_0%,rgba(22,26,38,0.9)_60%,#080a10_100%)]',
  savingsDeficit:
    'bg-[radial-gradient(ellipse_200%_200%_at_0%_0%,rgba(245,158,11,0.30)_0%,rgba(22,26,38,0.9)_60%,#080a10_100%)]',
} as const;

type CardsProps = {
  incomeTotal: number;
  expenseTotal: number;
  /** Sum of income lines tagged Investment (allocated to investments, not part of “total income”). */
  investmentTotal: number;
  /** When false, hides the Savings card (e.g. monthly workspace). Defaults to true. */
  showSavings?: boolean;
  maskNumbers?: boolean;
  /** When set with `onInvestmentProfitChange`, the Investments card shows invested + profit (%) and a profit field. */
  investmentProfit?: number;
  onInvestmentProfitChange?: (profit: number) => void;
  /**
   * Optional callback used by the summary page:
   * - clicking "Total income" scrolls/highlights the matching income columns
   * - clicking "Total expenses" scrolls/highlights another income column
   * - clicking "Investments" scrolls/highlights the investment column
   * - clicking "Savings" flashes the bank balances card
   */
  onSelectStat?: (stat: 'income' | 'expenses' | 'investments' | 'savings') => void;
};

/** Income, expenses, investments, savings — use in the row below the title, beside the manual expense form. */
export function MonthStatCards({
  incomeTotal,
  expenseTotal,
  investmentTotal,
  showSavings = true,
  maskNumbers = false,
  investmentProfit = 0,
  onInvestmentProfitChange,
  onSelectStat,
}: CardsProps) {
  const savings = incomeTotal - expenseTotal - investmentTotal;
  const savingsDeficit = savings < 0;
  const selectable = Boolean(onSelectStat);

  function handleKeyDown(
    e: KeyboardEvent<HTMLDivElement>,
    stat: 'income' | 'expenses' | 'investments' | 'savings',
  ) {
    if (!selectable) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectStat?.(stat);
    }
  }

  return (
    <div className="flex w-full max-w-full flex-col gap-3 lg:max-w-none">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.14 }}
        className={`relative overflow-hidden rounded-2xl border border-cyan-400/35 p-3 shadow-[inset_0_1px_0_0_rgba(34,211,238,0.06)] transition sm:p-4 ${STAT_GRADIENTS.income} ${
          selectable ? 'cursor-pointer hover:border-cyan-300/55 hover:shadow-[0_0_28px_-6px_rgba(34,211,238,0.35)]' : ''
        }`}
        role={selectable ? 'button' : undefined}
        tabIndex={selectable ? 0 : undefined}
        onClick={() => onSelectStat?.('income')}
        onKeyDown={(e) => handleKeyDown(e, 'income')}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-cyan-200/90">Total income</p>
            <p className="mt-0.5 text-[9px] text-ink-500">Salary & Other</p>
            <p className="mt-1 break-words font-display text-lg font-bold tabular-nums text-white sm:text-xl">
              <AnimatedRupees value={incomeTotal} maskNumbers={maskNumbers} />
            </p>
          </div>
          <div className="rounded-lg bg-black/35 p-1.5 text-cyan-300">
            <TrendingUp className="h-4 w-4" />
          </div>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.14, delay: 0.03 }}
        className={`relative overflow-hidden rounded-2xl border border-rose-400/35 p-3 shadow-[inset_0_1px_0_0_rgba(244,63,94,0.06)] transition sm:p-4 ${STAT_GRADIENTS.expense} ${
          selectable ? 'cursor-pointer hover:border-rose-300/55 hover:shadow-[0_0_28px_-6px_rgba(244,63,94,0.28)]' : ''
        }`}
        role={selectable ? 'button' : undefined}
        tabIndex={selectable ? 0 : undefined}
        onClick={() => onSelectStat?.('expenses')}
        onKeyDown={(e) => handleKeyDown(e, 'expenses')}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-rose-300/95">Total expenses</p>
            <p className="mt-0.5 text-[9px] text-ink-500">Monthly expenses</p>

            <p className="mt-1 break-words font-display text-lg font-bold tabular-nums text-white sm:text-xl">
              <AnimatedRupees value={expenseTotal} maskNumbers={maskNumbers} />
            </p>
          </div>
          <div className="rounded-lg bg-black/35 p-1.5 text-rose-200">
            <TrendingDown className="h-4 w-4" />
          </div>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.14, delay: 0.045 }}
        className={`relative overflow-hidden rounded-2xl border border-emerald-400/35 p-3 shadow-[inset_0_1px_0_0_rgba(52,211,153,0.06)] transition sm:p-4 ${STAT_GRADIENTS.investment} ${
          selectable ? 'cursor-pointer hover:border-emerald-300/55 hover:shadow-[0_0_28px_-6px_rgba(52,211,153,0.28)]' : ''
        }`}
        role={selectable ? 'button' : undefined}
        tabIndex={selectable ? 0 : undefined}
        onClick={() => onSelectStat?.('investments')}
        onKeyDown={(e) => handleKeyDown(e, 'investments')}
      >
        <InvestmentCardContent
          invested={investmentTotal}
          profit={investmentProfit}
          onInvestmentProfitChange={onInvestmentProfitChange}
          maskNumbers={maskNumbers}
        />
      </motion.div>
      {showSavings && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.14, delay: 0.06 }}
          className={`relative overflow-hidden rounded-2xl border p-3 transition sm:p-4 ${
            savingsDeficit
              ? `border-amber-400/35 shadow-[inset_0_1px_0_0_rgba(245,158,11,0.06)] ${STAT_GRADIENTS.savingsDeficit}`
              : `border-violet-400/35 shadow-[inset_0_1px_0_0_rgba(139,92,246,0.06)] ${STAT_GRADIENTS.savings}`
          } ${
            selectable
              ? savingsDeficit
                ? 'cursor-pointer hover:border-amber-300/60 hover:shadow-[0_0_28px_-6px_rgba(245,158,11,0.25)]'
                : 'cursor-pointer hover:border-violet-400/50 hover:shadow-[0_0_28px_-6px_rgba(139,92,246,0.22)]'
              : ''
          }`}
          role={selectable ? 'button' : undefined}
          tabIndex={selectable ? 0 : undefined}
          onClick={() => onSelectStat?.('savings')}
          onKeyDown={(e) => handleKeyDown(e, 'savings')}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p
                className={`text-[10px] font-medium uppercase tracking-wider ${
                  savingsDeficit ? 'text-amber-200/90' : 'text-violet-200/90'
                }`}
              >
                Savings
              </p>
              <p className="mt-0.5 text-[9px] text-ink-500">Income − expenses − investments</p>
              <p className="mt-1 break-words font-display text-lg font-bold tabular-nums text-white sm:text-xl">
                <AnimatedRupees value={savings} maskNumbers={maskNumbers} />
              </p>
            </div>
            <div
              className={`rounded-lg p-1.5 ${
                savingsDeficit ? 'bg-black/35 text-amber-200' : 'bg-black/35 text-violet-300'
              }`}
            >
              <PiggyBank className="h-4 w-4" />
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
