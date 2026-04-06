import { format, parse } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import type { MonthRecord } from '../types';
import { formatRupeesFull } from '../utils/format';

const MONTH_INDEXES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

type Props = {
  months: MonthRecord[];
  selectedKey: string;
  viewYear: number;
  onViewYearChange: (year: number) => void;
  onActivateMonth: (monthKey: string) => void;
  maskNumbers?: boolean;
};

function keyFor(y: number, month: number): string {
  return `${y}-${String(month).padStart(2, '0')}`;
}

function monthNameOnly(year: number, month: number): string {
  try {
    return format(parse(keyFor(year, month), 'yyyy-MM', new Date()), 'MMM');
  } catch {
    return String(month);
  }
}

const yearNavBtn =
  'inline-flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-sm font-medium text-ink-400 transition hover:bg-white/10 hover:text-white sm:px-3';

export function MonthStrip({
  months,
  selectedKey,
  viewYear,
  onViewYearChange,
  onActivateMonth,
  maskNumbers = false,
}: Props) {
  const setByKey = new Map(months.map((m) => [m.monthKey, m]));

  return (
    <div className="rounded-2xl border border-white/10 bg-ink-900/50 p-3 shadow-lg backdrop-blur-md sm:p-4">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-200">
          <Calendar className="h-5 w-5" />
        </div>
        <div className="flex min-w-0 flex-1 justify-center px-1 sm:px-2">
          <div className="inline-flex items-center gap-3 sm:gap-6">
            <button
              type="button"
              onClick={() => onViewYearChange(viewYear - 1)}
              className={yearNavBtn}
              aria-label="Previous year"
            >
              <ChevronLeft className="h-4 w-4 shrink-0 opacity-80" />
              <span>Prev year</span>
            </button>
            <span className="min-w-[4.5rem] text-center font-display text-lg font-bold tabular-nums text-white sm:text-xl">
              {viewYear}
            </span>
            <button
              type="button"
              onClick={() => onViewYearChange(viewYear + 1)}
              className={yearNavBtn}
              aria-label="Next year"
            >
              <span>Next year</span>
              <ChevronRight className="h-4 w-4 shrink-0 opacity-80" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 w-full">
        <div className="grid w-full grid-cols-12 gap-1 sm:gap-1.5">
          {MONTH_INDEXES.map((mi) => {
            const mk = keyFor(viewYear, mi);
            const has = setByKey.has(mk);
            const rec = setByKey.get(mk);
            const spent = rec ? rec.expenses.reduce((s, e) => s + e.amount, 0) : 0;
            const active = selectedKey === mk;

            return (
              <button
                key={mk}
                type="button"
                onClick={() => onActivateMonth(mk)}
                className={`flex min-w-0 w-full flex-col rounded-lg border px-0.5 py-2 text-center transition duration-150 active:scale-[0.98] sm:rounded-xl sm:px-1 sm:py-2.5 ${
                  active
                    ? 'border-violet-400/60 bg-gradient-to-b from-violet-500/25 to-teal-500/10 shadow-[0_0_16px_-6px_rgba(139,92,246,0.55)]'
                    : has
                      ? 'border-sky-400/25 bg-sky-500/5 hover:border-sky-400/40'
                      : 'border-white/10 bg-ink-950/40 hover:border-white/20 hover:bg-ink-800/40'
                }`}
              >
                <span
                  className={`truncate font-display text-sm font-semibold leading-tight sm:text-base ${
                    active ? 'text-violet-100' : 'text-sky-200/90'
                  }`}
                >
                  {monthNameOnly(viewYear, mi)}
                </span>
                <span className="mt-1 truncate text-[10px] font-medium tabular-nums leading-tight text-ink-500 sm:text-xs">
                  {has ? (maskNumbers ? '***' : formatRupeesFull(spent)) : '—'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
