import { format, parse } from 'date-fns';
import { motion } from 'framer-motion';
import { ArrowLeft, ImagePlus, IndianRupee, LayoutGrid, LayoutList, Loader2, TrendingUp, X } from 'lucide-react';
import { useEffect, useState, type DragEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CATEGORY_COLORS, EXPENSE_CATEGORIES } from '../constants';
import type { ExpenseCategory, MonthRecord } from '../types';
import { formatRupeesFull } from '../utils/format';
import { fileToResizedDataUrl, parseImageDropFromDataTransfer, urlToResizedDataUrl } from '../utils/imageResize';
import { AnimatedRupees } from './AnimatedRupees';

function monthTitle(key: string): string {
  try {
    return format(parse(key, 'yyyy-MM', new Date()), 'MMM yyyy');
  } catch {
    return key;
  }
}

function isExpenseCategory(s: string): s is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(s);
}

type CategoryExpenseRow = {
  monthKey: string;
  id: string;
  label: string;
  amount: number;
};

function normalizeExpenseLabel(label: string): string {
  return label.trim().toLowerCase() || '\u200b';
}

type GroupedByLabelRow = {
  /** Key used for grouping (normalized); stable React key */
  groupKey: string;
  displayLabel: string;
  totalAmount: number;
  transactionCount: number;
  /** Distinct months that contain at least one of these lines, newest first */
  monthKeys: string[];
};

function collectExpensesForCategory(
  months: MonthRecord[],
  category: ExpenseCategory,
): CategoryExpenseRow[] {
  const rows: CategoryExpenseRow[] = [];
  for (const m of months) {
    for (const e of m.expenses) {
      if (e.category === category) {
        rows.push({
          monthKey: m.monthKey,
          id: e.id,
          label: e.label,
          amount: e.amount,
        });
      }
    }
  }
  return rows;
}

function groupExpensesByLabel(rows: CategoryExpenseRow[]): GroupedByLabelRow[] {
  const map = new Map<
    string,
    { displayLabel: string; totalAmount: number; transactionCount: number; months: Set<string> }
  >();

  for (const r of rows) {
    const key = normalizeExpenseLabel(r.label);
    const existing = map.get(key);
    if (existing) {
      existing.totalAmount += r.amount;
      existing.transactionCount += 1;
      existing.months.add(r.monthKey);
    } else {
      map.set(key, {
        displayLabel: r.label.trim() || 'Untitled',
        totalAmount: r.amount,
        transactionCount: 1,
        months: new Set([r.monthKey]),
      });
    }
  }

  const grouped: GroupedByLabelRow[] = [];
  for (const [groupKey, g] of map) {
    const monthKeys = [...g.months].sort((a, b) => b.localeCompare(a));
    grouped.push({
      groupKey,
      displayLabel: g.displayLabel,
      totalAmount: g.totalAmount,
      transactionCount: g.transactionCount,
      monthKeys,
    });
  }

  grouped.sort((a, b) => {
    const byAmt = b.totalAmount - a.totalAmount;
    if (byAmt !== 0) return byAmt;
    return a.displayLabel.localeCompare(b.displayLabel);
  });
  return grouped;
}

function formatMonthSpan(monthKeys: string[]): string {
  if (monthKeys.length === 0) return '';
  if (monthKeys.length === 1) return monthTitle(monthKeys[0]);
  const newest = monthTitle(monthKeys[0]);
  const oldest = monthTitle(monthKeys[monthKeys.length - 1]);
  if (monthKeys.length === 2) return `${oldest} · ${newest}`;
  return `${monthKeys.length} months (${oldest} – ${newest})`;
}

function tileImageStorageKey(category: ExpenseCategory, groupKey: string): string {
  return `${category}::${groupKey}`;
}

const VIEW_MODE_KEY = 'expense-tracker-category-detail-view';

type ViewMode = 'list' | 'tiles';

type Props = {
  months: MonthRecord[];
  maskNumbers: boolean;
  categoryTileImages?: Record<string, string>;
  onSetCategoryTileImage: (category: ExpenseCategory, groupKey: string, dataUrl: string | null) => void;
};

export function CategoryExpenseHistory({
  months,
  maskNumbers,
  categoryTileImages = {},
  onSetCategoryTileImage,
}: Props) {
  const { categoryKey = '' } = useParams<{ categoryKey: string }>();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return localStorage.getItem(VIEW_MODE_KEY) === 'tiles' ? 'tiles' : 'list';
    } catch {
      return 'list';
    }
  });
  const [uploadBusyKey, setUploadBusyKey] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_MODE_KEY, viewMode);
    } catch {
      /* ignore */
    }
  }, [viewMode]);

  let category: ExpenseCategory | null = null;
  try {
    const decoded = decodeURIComponent(categoryKey);
    if (isExpenseCategory(decoded)) category = decoded;
  } catch {
    category = null;
  }

  const rows = category ? collectExpensesForCategory(months, category) : [];
  const groupedRows = groupExpensesByLabel(rows);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const maxAmount = groupedRows.length ? Math.max(...groupedRows.map((r) => r.totalAmount)) : 0;
  const accent = category ? CATEGORY_COLORS[category] : '#a78bfa';

  const handleTileImageChange = async (groupKey: string, files: FileList | null) => {
    const file = files?.[0];
    if (!file || !category) return;
    setUploadBusyKey(groupKey);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      onSetCategoryTileImage(category, groupKey, dataUrl);
    } catch {
      /* ignore */
    } finally {
      setUploadBusyKey(null);
    }
  };

  const handleTileDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleTileDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleTileDrop = async (groupKey: string, e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!category || uploadBusyKey === groupKey) return;
    const parsed = parseImageDropFromDataTransfer(e.dataTransfer);
    if (!parsed) return;
    setUploadBusyKey(groupKey);
    try {
      const dataUrl =
        parsed.kind === 'file'
          ? await fileToResizedDataUrl(parsed.file)
          : await urlToResizedDataUrl(parsed.url);
      onSetCategoryTileImage(category, groupKey, dataUrl);
    } catch {
      /* ignore */
    } finally {
      setUploadBusyKey(null);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(139,92,246,0.25),transparent)] opacity-100" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(78,205,196,0.12),transparent)]" />

      <header className="relative z-30 border-b border-white/5 bg-ink-950/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-ink-200 ring-1 ring-white/5 transition hover:border-violet-400/30 hover:bg-violet-500/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <Link
            to="/"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl px-2 py-2 text-sm text-violet-300 underline-offset-4 hover:text-violet-200 hover:underline"
          >
            Home
          </Link>
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-teal-400 shadow-lg shadow-violet-500/25 sm:h-10 sm:w-10">
              <IndianRupee className="h-4 w-4 text-white sm:h-5 sm:w-5" strokeWidth={2.5} />
            </div>
            <div className="min-w-0 text-right">
              <h1 className="font-display text-sm font-bold text-white sm:text-base">Category detail</h1>
              <p className="truncate text-[11px] text-ink-500 sm:text-xs">All months</p>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {!category ? (
          <div className="rounded-2xl border border-white/10 bg-ink-900/80 p-8 text-center">
            <p className="text-ink-400">Unknown category.</p>
            <Link to="/" className="mt-4 inline-block text-sm font-medium text-violet-400 hover:text-violet-300">
              Return to tracker
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: CATEGORY_COLORS[category] }}
                    aria-hidden
                  />
                  <h2 className="font-display text-xl font-bold text-white sm:text-2xl">{category}</h2>
                </div>
                <p
                  className="mt-1 truncate text-sm text-ink-500"
                  title={
                    viewMode === 'list'
                      ? 'Same name is merged (trim + case-insensitive). The shaded bar shows how large this row is compared to the biggest spend in the list.'
                      : 'Same name is merged. Add or drop a photo per row to visualize merchants or habits—including images dragged from websites.'
                  }
                >
                  {viewMode === 'list'
                    ? 'Merged by name · shaded bar = size vs. largest spend in this list'
                    : 'Merged by name · add/drop a photo per row (files or images from the web)'}
                </p>
              </div>
              <div className="flex flex-col items-stretch gap-3 sm:items-end">
                <div className="text-right sm:min-w-[10rem]">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-ink-500">Total</p>
                  <p className="font-display text-2xl font-bold tabular-nums text-white sm:text-3xl lg:text-4xl">
                    {maskNumbers ? '***' : formatRupeesFull(total)}
                  </p>
                </div>
                <div
                  className="inline-flex rounded-xl border border-white/10 bg-black/25 p-1 shadow-inner"
                  role="group"
                  aria-label="View mode"
                >
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    aria-pressed={viewMode === 'list'}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                      viewMode === 'list'
                        ? 'bg-violet-500/25 text-white ring-1 ring-violet-400/40'
                        : 'text-ink-500 hover:text-ink-300'
                    }`}
                  >
                    <LayoutList className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                    List
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('tiles')}
                    aria-pressed={viewMode === 'tiles'}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                      viewMode === 'tiles'
                        ? 'bg-violet-500/25 text-white ring-1 ring-violet-400/40'
                        : 'text-ink-500 hover:text-ink-300'
                    }`}
                  >
                    <LayoutGrid className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                    Tiles
                  </button>
                </div>
              </div>
            </div>

            {rows.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-ink-900/50 p-8 text-center text-ink-500">
                No expenses in this category yet.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-[11px] text-ink-500 sm:text-xs">
                  <span className="inline-flex items-center gap-1.5 font-medium text-ink-400">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-400/90" aria-hidden />
                    {groupedRows.length} name{groupedRows.length === 1 ? '' : 's'}
                  </span>
                  <span className="text-ink-600" aria-hidden>
                    ·
                  </span>
                  <span>
                    {rows.length} transaction{rows.length === 1 ? '' : 's'}
                  </span>
                  <span className="text-ink-600" aria-hidden>
                    ·
                  </span>
                  <span>
                    Avg / line{' '}
                    <span className="font-display font-semibold tabular-nums text-ink-300">
                      {maskNumbers ? '***' : formatRupeesFull(total / rows.length)}
                    </span>
                  </span>
                </div>

                {viewMode === 'list' ? (
                  <motion.ul
                    className="flex flex-col gap-2.5"
                    initial="hidden"
                    animate="show"
                    variants={{
                      hidden: { opacity: 0 },
                      show: {
                        opacity: 1,
                        transition: { staggerChildren: 0.04, delayChildren: 0.06 },
                      },
                    }}
                  >
                    {groupedRows.map((r, index) => {
                      const rank = index + 1;
                      /** Cap width so the bar stays left of the amount column; high enough to read as a bar. */
                      const widthPct =
                        maxAmount > 0
                          ? Math.min(78, Math.max(10, (r.totalAmount / maxAmount) * 100))
                          : 10;
                      const topThree = rank <= 3;
                      const subParts: string[] = [];
                      if (r.transactionCount > 1) {
                        subParts.push(`${r.transactionCount}×`);
                      }
                      subParts.push(formatMonthSpan(r.monthKeys));
                      const subline = subParts.filter(Boolean).join(' ');
                      return (
                        <motion.li
                          key={r.groupKey}
                          variants={{
                            hidden: { opacity: 0, y: 10 },
                            show: { opacity: 1, y: 0 },
                          }}
                          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                          className={`relative overflow-hidden rounded-2xl border transition hover:border-white/15 ${
                            topThree
                              ? 'border-violet-400/35 bg-gradient-to-br from-violet-950/50 via-ink-950/80 to-ink-900/90 shadow-[0_0_28px_-8px_rgba(139,92,246,0.35)]'
                              : 'border-white/10 bg-ink-950/70'
                          }`}
                        >
                          <div
                            className="pointer-events-none absolute inset-y-0 left-0 rounded-l-2xl opacity-[0.52] transition-[width] duration-500 ease-out"
                            style={{
                              width: `${widthPct}%`,
                              backgroundColor: accent,
                            }}
                            aria-hidden
                          />
                          <div
                            className="pointer-events-none absolute inset-y-0 left-0 w-[min(100%,28rem)] max-w-[82%] rounded-l-2xl bg-gradient-to-r from-black/40 via-black/15 to-transparent"
                            aria-hidden
                          />
                          <div className="relative z-10 flex items-stretch gap-3 px-4 py-3.5 sm:gap-4 sm:px-5 sm:py-4">
                            <div
                              className={`flex w-9 shrink-0 flex-col items-center justify-center rounded-xl border text-center font-display text-xs font-bold tabular-nums sm:w-11 sm:text-sm ${
                                rank === 1
                                  ? 'border-amber-400/50 bg-amber-500/15 text-amber-200'
                                  : rank === 2
                                    ? 'border-slate-400/40 bg-slate-500/15 text-slate-200'
                                    : rank === 3
                                      ? 'border-orange-400/35 bg-orange-900/30 text-orange-200'
                                      : 'border-white/10 bg-black/30 text-ink-500'
                              }`}
                              title={`Rank ${rank} by combined amount`}
                            >
                              <span className="text-[9px] font-medium uppercase tracking-wider text-ink-500 sm:text-[10px]">
                                #
                              </span>
                              {rank}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] sm:text-base">
                                {r.displayLabel}
                              </p>
                              <p className="mt-0.5 line-clamp-2 text-[11px] text-ink-300/95 sm:text-xs">
                                {subline}
                              </p>
                            </div>
                            <div className="shrink-0 self-center rounded-xl bg-black/35 px-2 py-1.5 text-right ring-1 ring-white/10 backdrop-blur-[2px] sm:px-2.5 sm:py-2">
                              <p className="font-display text-base font-bold tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)] sm:text-lg">
                                <AnimatedRupees value={r.totalAmount} maskNumbers={maskNumbers} />
                              </p>
                              {!maskNumbers && total > 0 && (
                                <p className="mt-0.5 text-[10px] tabular-nums text-ink-200">
                                  {((r.totalAmount / total) * 100).toFixed(0)}% of category
                                </p>
                              )}
                            </div>
                          </div>
                        </motion.li>
                      );
                    })}
                  </motion.ul>
                ) : (
                  <motion.div
                    className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                    initial="hidden"
                    animate="show"
                    variants={{
                      hidden: { opacity: 0 },
                      show: {
                        opacity: 1,
                        transition: { staggerChildren: 0.05, delayChildren: 0.05 },
                      },
                    }}
                  >
                    {groupedRows.map((r) => {
                      const storageKey = tileImageStorageKey(category, r.groupKey);
                      const src = categoryTileImages[storageKey];
                      const busy = uploadBusyKey === r.groupKey;
                      return (
                        <motion.article
                          key={r.groupKey}
                          variants={{
                            hidden: { opacity: 0, y: 12 },
                            show: { opacity: 1, y: 0 },
                          }}
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                          className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-950/80 shadow-lg shadow-black/20"
                        >
                          <div
                            className="group relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-b from-black/25 to-black/50"
                            onDragEnter={handleTileDragEnter}
                            onDragOver={handleTileDragOver}
                            onDrop={(e) => void handleTileDrop(r.groupKey, e)}
                          >
                            {src ? (
                              <>
                                <img
                                  src={src}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                                <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100">
                                  <span className="rounded-lg bg-black/70 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg">
                                    Change photo
                                  </span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="sr-only"
                                    disabled={busy}
                                    onChange={(e) => {
                                      void handleTileImageChange(r.groupKey, e.target.files);
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    onSetCategoryTileImage(category, r.groupKey, null);
                                  }}
                                  className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-black/55 text-ink-200 backdrop-blur-sm transition hover:border-rose-400/40 hover:bg-rose-950/60 hover:text-rose-100"
                                  title="Remove photo"
                                  aria-label="Remove photo"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <label className="flex h-full min-h-[9rem] w-full cursor-pointer flex-col items-center justify-center gap-1 border-b border-dashed border-white/10 px-4 pb-1 text-center text-ink-500 transition hover:bg-white/[0.04] hover:text-ink-300">
                                {busy ? (
                                  <Loader2 className="h-8 w-8 animate-spin text-violet-400" aria-hidden />
                                ) : (
                                  <>
                                    <ImagePlus className="h-8 w-8 opacity-75" strokeWidth={1.75} aria-hidden />
                                    <span className="text-xs font-medium">Add or drop photo</span>
                                    <span className="max-w-[14rem] text-[10px] leading-snug text-ink-600">
                                      From a site: drag the image onto this box
                                    </span>
                                  </>
                                )}
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="sr-only"
                                  disabled={busy}
                                  onChange={(e) => {
                                    void handleTileImageChange(r.groupKey, e.target.files);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                            )}
                            {busy && src ? (
                              <div
                                className="absolute inset-0 z-10 flex items-center justify-center bg-black/50"
                                aria-busy
                              >
                                <Loader2 className="h-9 w-9 animate-spin text-violet-300" aria-hidden />
                              </div>
                            ) : null}
                          </div>
                          <div className="flex flex-col items-center justify-center gap-0.5 border-t border-white/10 px-3 py-3.5 text-center">
                            <p className="w-full truncate text-sm font-semibold text-white sm:text-base">
                              {r.displayLabel}
                            </p>
                            <p className="font-display text-base font-bold tabular-nums text-white sm:text-lg">
                              <AnimatedRupees value={r.totalAmount} maskNumbers={maskNumbers} />
                            </p>
                          </div>
                        </motion.article>
                      );
                    })}
                  </motion.div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
