import { useEffect, useRef, type ReactNode } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import type { ExpenseCategory } from '../types';
import { CATEGORY_COLORS, EXPENSE_CATEGORIES } from '../constants';
import { formatRupeesFull } from '../utils/format';

type Slice = { name: ExpenseCategory; value: number };

type Props = {
  byCategory: Record<ExpenseCategory, number>;
  hoverCategory: ExpenseCategory | null;
  pinnedCategory: ExpenseCategory | null;
  onHoverCategory: (category: ExpenseCategory | null) => void;
  /** Clears hover only (e.g. mouse leaves chart + legend); does not clear pinned focus */
  onLeaveChart: () => void;
  onTogglePin: (category: ExpenseCategory) => void;
  /** Clears pinned slice when user clicks outside the chart block */
  onDismissPin?: () => void;
  maskNumbers?: boolean;
  /**
   * Optional extra column per row (e.g. “Details” link). Only passed from All months summary —
   * monthly expense split omits this so no drill-down appears there.
   */
  renderCategoryDetail?: (category: ExpenseCategory) => ReactNode;
};

export function ExpensePie({
  byCategory,
  hoverCategory,
  pinnedCategory,
  onHoverCategory,
  onLeaveChart,
  onTogglePin,
  onDismissPin,
  maskNumbers = false,
  renderCategoryDetail,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (onDismissPin == null) return;
    const dismiss: () => void = onDismissPin;
    function handlePointerDown(ev: PointerEvent) {
      const el = rootRef.current;
      if (!el) return;
      const t = ev.target;
      if (t instanceof Node && !el.contains(t)) dismiss();
    }
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [onDismissPin]);
  const pieData: Slice[] = EXPENSE_CATEGORIES.map((name) => ({
    name,
    value: byCategory[name],
  })).filter((d) => d.value > 0);

  const total = pieData.reduce((s, d) => s + d.value, 0);
  const renderZeroRing = total === 0;
  // Recharts needs at least one slice to draw the donut ring.
  const pieDataForRender: Slice[] = renderZeroRing ? [{ name: 'Other', value: 1 }] : pieData;

  const focus = pinnedCategory ?? hoverCategory;

  /** Radii as % of the smaller chart dimension so the ring scales with the container */
  const pieInnerR = '39%';
  const pieOuterR = '80%';

  /** Fixed height for the donut panel only; “All sections” hugs its rows (no flex gap below the list). */
  const panelSize =
    'h-[20.5rem] min-h-[20.5rem] sm:h-[23.5rem] sm:min-h-[23.5rem] lg:h-[26.5rem] lg:min-h-[26.5rem]';
  const panelBase = `flex flex-col overflow-hidden rounded-2xl border border-white/10 ${panelSize}`;
  const sectionsPanelClass =
    'flex w-full flex-col rounded-2xl border border-white/10 bg-ink-950/60 p-3';

  return (
    <div
      ref={rootRef}
      className="grid gap-4 lg:grid-cols-2 lg:items-start lg:gap-5"
      onMouseLeave={onLeaveChart}
    >
      <div className={`relative ${panelBase} bg-ink-900/40 p-4`}>
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/5 via-transparent to-teal-500/5" />
        {total === 0 ? (
          <div className="relative min-h-0 w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <Pie
                  data={pieDataForRender}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={pieInnerR}
                  outerRadius={pieOuterR}
                  paddingAngle={3}
                  stroke="rgba(15,17,26,0.95)"
                  strokeWidth={1}
                  animationBegin={0}
                  animationDuration={380}
                  isAnimationActive={false}
                  onMouseEnter={() => {
                    // No hover when there is no data.
                  }}
                  onClick={() => {
                    // No pin when there is no data.
                  }}
                >
                  {pieDataForRender.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill="rgba(148,163,184,0.12)"
                      fillOpacity={1}
                      style={{ outline: 'none', cursor: 'default' }}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <span className="block text-[10px] uppercase tracking-widest text-ink-500">Total -</span>
                <span className="font-display text-base font-bold tabular-nums text-white sm:text-lg">
                  {maskNumbers ? '***' : formatRupeesFull(0)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative min-h-0 w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={pieInnerR}
                  outerRadius={pieOuterR}
                  paddingAngle={3}
                  stroke="rgba(15,17,26,0.95)"
                  strokeWidth={1}
                  animationBegin={0}
                  animationDuration={380}
                  isAnimationActive
                  onMouseEnter={(_, index) => {
                    const s = pieData[index];
                    if (s) onHoverCategory(s.name);
                  }}
                  onClick={(_, index) => {
                    const s = pieData[index];
                    if (s) onTogglePin(s.name);
                  }}
                >
                  {pieData.map((entry) => {
                    const dimmed = focus && focus !== entry.name;
                    return (
                      <Cell
                        key={entry.name}
                        fill={CATEGORY_COLORS[entry.name]}
                        fillOpacity={dimmed ? 0.38 : 1}
                        style={{ outline: 'none', cursor: 'pointer' }}
                      />
                    );
                  })}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <span className="block text-[10px] uppercase tracking-widest text-ink-500">Spent</span>
                <span className="font-display text-base font-bold tabular-nums text-white sm:text-lg">
                  {maskNumbers ? '***' : formatRupeesFull(total)}
                </span>
              </div>
            </div>
          </div>
        )}
        <p className="relative mt-2 shrink-0 text-center text-[11px] text-ink-500">
          Hover for a quick peek — click a slice or list row to keep the section highlighted below.
        </p>
      </div>

      <div className={sectionsPanelClass}>
        <p className="shrink-0 text-xs font-medium uppercase tracking-wider text-ink-500">
          All sections
        </p>
        <ul className="scrollbar-none mt-2 flex flex-col space-y-1.5">
          {EXPENSE_CATEGORIES.map((cat) => {
            const v = byCategory[cat];
            const active = focus === cat;
            const isPinned = pinnedCategory === cat;
            const detailExtra = renderCategoryDetail?.(cat);
            return (
              <li key={cat} className="flex min-w-0 items-stretch gap-1.5">
                <button
                  type="button"
                  onMouseEnter={() => onHoverCategory(cat)}
                  onClick={() => onTogglePin(cat)}
                  className={`flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition ${
                    active
                      ? isPinned
                        ? 'border-violet-400/60 bg-violet-500/20 ring-1 ring-violet-400/30'
                        : 'border-violet-400/50 bg-violet-500/15'
                      : 'border-transparent bg-black/20 hover:border-white/10 hover:bg-black/30'
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-ink-200 sm:text-xs">
                    <span
                      className="mr-1.5 inline-block h-2 w-2 shrink-0 rounded-sm"
                      style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                    />
                    {cat}
                  </span>
                  <span className="shrink-0 font-display text-xs font-semibold tabular-nums text-white sm:text-sm">
                    {maskNumbers ? '***' : formatRupeesFull(v)}
                  </span>
                </button>
                {detailExtra ?? null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
