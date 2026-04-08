import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Cloud, CloudOff, DollarSign, Eye, EyeOff, IndianRupee, LayoutList, Loader2 } from 'lucide-react';
import { AgentBar } from './components/AgentBar';
import { AgentUndoStrip } from './components/AgentUndoStrip';
import { MonthStrip } from './components/MonthStrip';
import { MonthStatCards } from './components/MonthHeadingStats';
import { ExpenseFormBlock } from './components/ExpenseFormBlock';
import { ExpensePie } from './components/ExpensePie';
import { CategoryColumns } from './components/CategoryColumns';
import { AllMonthsSummary } from './components/AllMonthsSummary';
import { CategoryExpenseHistory } from './components/CategoryExpenseHistory';
import { LoginScreen } from './components/LoginScreen';
import { DataRecoveryModal } from './components/DataRecoveryModal';
import { ProfileMenu } from './components/ProfileMenu';
import { useCloudSync, type SyncStatus } from './hooks/useCloudSync';
import { useExpenseStore, type AgentUndo } from './hooks/useExpenseStore';
import { useSupabaseAuth } from './hooks/useSupabaseAuth';
import { isCloudBackendConfigured } from './storage';
import type { AppData, ExpenseCategory } from './types';
import { setActiveCurrency } from './utils/format';

function categoryDetailPath(category: ExpenseCategory): string {
  return `/category/${encodeURIComponent(category)}`;
}

function yearFromKey(key: string): number {
  const y = parseInt(key.split('-')[0] ?? '', 10);
  return Number.isNaN(y) ? new Date().getFullYear() : y;
}

function findAmount(data: AppData, u: AgentUndo): number | undefined {
  const m = data.months.find((x) => x.monthKey === u.monthKey);
  if (!m) return undefined;
  if (u.kind === 'income') {
    return m.income.find((e) => e.id === u.id)?.amount;
  }
  return m.expenses.find((e) => e.id === u.id)?.amount;
}

const SYNC_CFG: Record<Exclude<SyncStatus, 'offline'>, { cls: string; label: string }> = {
  idle:    { cls: 'bg-ink-800/50 text-ink-500 ring-ink-700', label: 'Cloud' },
  pending: { cls: 'bg-amber-500/10 text-amber-300 ring-amber-500/20', label: 'Pending' },
  syncing: { cls: 'bg-amber-500/10 text-amber-400 ring-amber-500/20', label: 'Saving\u2026' },
  synced:  { cls: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20', label: 'Saved' },
  error:   { cls: 'bg-rose-500/10 text-rose-400 ring-rose-500/20', label: 'Sync error' },
};

function SyncBadge({ status }: { status: SyncStatus }) {
  if (status === 'offline') return null;
  const { cls, label } = SYNC_CFG[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium ring-1 ring-inset ${cls}`}
      title={label}
    >
      {status === 'syncing' ? <Loader2 className="h-3 w-3 animate-spin" /> :
       status === 'error' ? <CloudOff className="h-3 w-3" /> :
       <Cloud className="h-3 w-3" />}
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}

export default function App() {
  const requireLogin = isCloudBackendConfigured();
  const {
    user,
    authLoading,
    signInWithPassword,
    signUpWithPassword,
    signOut: supabaseSignOut,
    updatePassword,
  } = useSupabaseAuth();

  const {
    data,
    dataReady,
    replaceAllData,
    selectedMonthKey,
    month,
    totals,
    lifetimeTotals,
    bankAccounts,
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
    addCustomSection,
    renameSection,
    deleteCustomSection,
    moveExpenseToCategory,
    currency,
    setCurrency,
    sections,
    customSections,
    runAgentCommand,
    agentMessage,
    clearAgentMessage,
  } = useExpenseStore(user?.id ?? null);

  const syncStatus = useCloudSync(data, replaceAllData, user, dataReady);

  const handleSignOut = async () => {
    await supabaseSignOut();
    // Do not clear localStorage on sign-out — data is keyed by user id and is needed
    // when the same account signs in again; clearing made it look like “all data lost”.
  };

  const [viewYear, setViewYear] = useState(() => yearFromKey(selectedMonthKey));
  const [showSummary, setShowSummary] = useState(false);
  const [maskNumbers, setMaskNumbers] = useState(false);
  const [chartHover, setChartHover] = useState<ExpenseCategory | null>(null);
  const [chartPinned, setChartPinned] = useState<ExpenseCategory | null>(null);
  const [dataRecoveryOpen, setDataRecoveryOpen] = useState(false);
  const [agentTrail, setAgentTrail] = useState<AgentUndo[]>([]);
  const [quickAddHighlightId, setQuickAddHighlightId] = useState<string | null>(null);
  const expenseSplitSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setActiveCurrency(currency);
  }, [currency]);

  useEffect(() => {
    setViewYear(yearFromKey(selectedMonthKey));
  }, [selectedMonthKey]);

  useEffect(() => {
    setAgentTrail([]);
    setQuickAddHighlightId(null);
    setChartHover(null);
    setChartPinned(null);
  }, [selectedMonthKey]);

  useEffect(() => {
    if (!quickAddHighlightId) return;
    const t = window.setTimeout(() => setQuickAddHighlightId(null), 3200);
    return () => clearTimeout(t);
  }, [quickAddHighlightId]);

  const chartFocus = chartPinned ?? chartHover;

  const monthKeys = data.months.map((m) => m.monthKey);

  if (requireLogin && authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 text-ink-400">
        <p className="text-sm">Loading…</p>
      </div>
    );
  }

  if (requireLogin && !user) {
    return <LoginScreen onSignIn={signInWithPassword} onSignUp={signUpWithPassword} />;
  }

  const dashboard = (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(139,92,246,0.25),transparent)] opacity-100" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(78,205,196,0.12),transparent)]" />

      <header className="relative z-30 border-b border-white/5 bg-ink-950/40 backdrop-blur-xl">
        <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <motion.button
              type="button"
              onClick={() => setCurrency(currency === 'INR' ? 'USD' : 'INR')}
              animate={{ rotate: [0, -6, 6, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-teal-400 shadow-lg shadow-violet-500/30 sm:h-11 sm:w-11"
              title={`Switch currency to ${currency === 'INR' ? '$' : '₹'}`}
            >
              {currency === 'INR' ? (
                <IndianRupee className="h-5 w-5 text-white sm:h-6 sm:w-6" strokeWidth={2.5} />
              ) : (
                <DollarSign className="h-5 w-5 text-white sm:h-6 sm:w-6" strokeWidth={2.5} />
              )}
            </motion.button>
            <div className="min-w-0">
              <h1 className="font-display text-base font-bold text-white sm:text-xl">Expense Tracker</h1>
              <p className="text-[11px] text-ink-500 sm:text-xs">Track every expense, every month.</p>
            </div>
          </div>
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setShowSummary((v) => !v)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold shadow-lg transition sm:px-4 ${
                showSummary
                  ? 'bg-gradient-to-r from-fuchsia-600/90 to-rose-600/90 text-white ring-1 ring-fuchsia-400/40 hover:from-fuchsia-500 hover:to-rose-500'
                  : 'bg-gradient-to-r from-violet-600 to-teal-600 text-white ring-1 ring-teal-400/30 hover:from-violet-500 hover:to-teal-500'
              }`}
            >
              <LayoutList className="h-4 w-4" />
              <span className="hidden sm:inline">{showSummary ? 'Monthly Expenses' : 'All months summary'}</span>
              <span className="sm:hidden">{showSummary ? 'Monthly' : 'Summary'}</span>
            </button>
          </div>
          <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2">
            {user && <SyncBadge status={syncStatus} />}
            <button
              type="button"
              onClick={() => setMaskNumbers((v) => !v)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold shadow-lg transition sm:px-4 ring-1 ${
                maskNumbers
                  ? 'bg-black/40 text-white ring-white/10 hover:bg-black/30'
                  : 'bg-white/5 text-ink-100 ring-white/10 hover:bg-white/10'
              }`}
              title={maskNumbers ? 'Show money amounts' : 'Hide money amounts for sharing'}
            >
              {maskNumbers ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              <span className="hidden sm:inline">{maskNumbers ? 'Show numbers' : 'Hide numbers'}</span>
              <span className="sm:hidden">{maskNumbers ? 'Show' : 'Hide'}</span>
            </button>
            {user && (
              <ProfileMenu
                email={user.email ?? user.id}
                onSignOut={handleSignOut}
                onOpenDataRecovery={() => setDataRecoveryOpen(true)}
                onChangePassword={async (nextPassword) => {
                  const r = await updatePassword(nextPassword);
                  if (r.error) throw new Error(r.error);
                }}
              />
            )}
          </div>
        </div>
      </header>

      <main
        className={`relative z-10 mx-auto max-w-6xl px-4 sm:px-6 ${showSummary ? 'pb-3 pt-4 sm:pb-4 sm:pt-5' : 'py-4 sm:py-5'}`}
      >
        {showSummary ? (
          <AllMonthsSummary
            months={data.months}
            sections={sections}
            monthKeys={monthKeys.length ? monthKeys : [selectedMonthKey]}
            bankAccounts={bankAccounts}
            totalIncome={lifetimeTotals.income}
            totalInvestments={lifetimeTotals.investment}
            totalExpenses={lifetimeTotals.expenses}
            net={lifetimeTotals.net}
            bankTotal={bankTotal}
            investmentProfit={data.investmentProfit ?? 0}
            onInvestmentProfitChange={setInvestmentProfit}
            maskNumbers={maskNumbers}
            onSetBankAccounts={setBankAccounts}
            onAddIncome={addIncome}
            onUpdateIncome={updateIncome}
            onDeleteIncome={deleteIncome}
            onDeleteMonth={deleteMonth}
            categoryDetailHref={categoryDetailPath}
          />
        ) : (
          <>
            <div className="mb-3 sm:mb-4">
              <MonthStrip
                months={data.months}
                selectedKey={selectedMonthKey}
                viewYear={viewYear}
                onViewYearChange={setViewYear}
                onActivateMonth={addMonth}
                maskNumbers={maskNumbers}
              />
            </div>

            <div className="min-w-0">
              <AnimatePresence mode="sync" initial={false}>
                {month ? (
                  <motion.div
                    key={month.monthKey}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.16, ease: [0.25, 0.1, 0.25, 1] }}
                    className="flex flex-col gap-5 lg:gap-6"
                  >
                    <div className="flex flex-col gap-4 lg:gap-5">
                      <div className="flex min-w-0 flex-col gap-2">
                        <AgentBar
                          onSubmit={(text) => {
                            const r = runAgentCommand(text, selectedMonthKey);
                            if (r.ok && r.undo) {
                              setAgentTrail((prev) => [r.undo!, ...prev].slice(0, 5));
                              setQuickAddHighlightId(r.undo.id);
                            }
                          }}
                          feedback={agentMessage}
                          onDismissFeedback={clearAgentMessage}
                        />
                        <AgentUndoStrip
                          items={agentTrail}
                          highlightId={quickAddHighlightId}
                          resolveAmount={(u) => findAmount(data, u)}
                          maskNumbers={maskNumbers}
                          onRemove={(u) => {
                            if (u.kind === 'income') deleteIncome(u.monthKey, u.id);
                            else deleteExpense(u.monthKey, u.id);
                            setAgentTrail((t) => t.filter((x) => x.id !== u.id));
                            setQuickAddHighlightId((h) => (h === u.id ? null : h));
                          }}
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch lg:gap-5">
                        <div className="min-w-0 lg:col-span-4">
                          <MonthStatCards
                            incomeTotal={totals.income}
                            expenseTotal={totals.expenses}
                            investmentTotal={totals.investment}
                            showSavings={false}
                            maskNumbers={maskNumbers}
                            onSelectStat={(stat) => {
                              if (stat === 'expenses') {
                                expenseSplitSectionRef.current?.scrollIntoView({
                                  behavior: 'smooth',
                                  block: 'start',
                                });
                              }
                            }}
                          />
                        </div>
                        <div className="flex min-h-0 min-w-0 lg:col-span-8">
                          <ExpenseFormBlock
                            className="h-full w-full min-h-[18rem] lg:min-h-0"
                            monthKey={selectedMonthKey}
                            onAddExpense={(label, amount, cat) =>
                              addExpense(selectedMonthKey, label, amount, cat)
                            }
                          />
                        </div>
                      </div>
                    </div>

                    {/* Row 3 */}
                    <section
                      ref={expenseSplitSectionRef}
                      className="scroll-mt-4 rounded-2xl border border-white/10 bg-ink-900 p-4 shadow-none sm:p-5"
                    >
                      <h2 className="font-display text-base font-semibold text-white sm:text-lg">Expense Split</h2>
                      <p className="mt-0.5 text-xs text-ink-500 sm:text-sm">
                        All sections with totals (including zero-value rows). Click a slice or row to keep a column
                        highlighted while you scroll.
                      </p>
                      <div className="mt-3">
                        <ExpensePie
                          sections={sections}
                          byCategory={totals.byCategory}
                          hoverCategory={chartHover}
                          pinnedCategory={chartPinned}
                          onHoverCategory={setChartHover}
                          onLeaveChart={() => setChartHover(null)}
                          onTogglePin={(c) =>
                            setChartPinned((p) => (p === c ? null : c))
                          }
                          onDismissPin={() => setChartPinned(null)}
                          maskNumbers={maskNumbers}
                        />
                      </div>
                    </section>

                    {/* Row 4 */}
                    <CategoryColumns
                      sections={sections}
                      customSections={customSections}
                      byCategory={totals.byCategory}
                      expenses={month.expenses}
                      highlightedCategory={chartFocus}
                      maskNumbers={maskNumbers}
                      onAddDefaultMonthlyLines={() =>
                        addDefaultMonthlyExpenseLines(selectedMonthKey)
                      }
                      onAddExpense={(category) =>
                        addExpense(selectedMonthKey, 'New expense', 0, category)
                      }
                      onUpdateExpense={(id, patch) =>
                        updateExpense(selectedMonthKey, id, patch)
                      }
                      onDeleteExpense={(id) => {
                        deleteExpense(selectedMonthKey, id);
                        setAgentTrail((t) => t.filter((x) => x.id !== id));
                      }}
                      onRenameSection={renameSection}
                      onAddCustomSection={addCustomSection}
                      onDeleteCustomSection={deleteCustomSection}
                      onMoveExpense={(id, category) => moveExpenseToCategory(selectedMonthKey, id, category)}
                    />
                  </motion.div>
                ) : (
                  <motion.p
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-2xl border border-white/10 bg-ink-900/40 p-12 text-center text-ink-400"
                  >
                    Pick a month from the bar above.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </main>
      <DataRecoveryModal
        open={dataRecoveryOpen}
        onClose={() => setDataRecoveryOpen(false)}
        userId={user?.id ?? null}
        currentData={data}
        replaceAllData={replaceAllData}
      />
    </div>
  );

  return (
    <Routes>
      <Route
        path="/category/:categoryKey"
        element={
          <CategoryExpenseHistory
            months={data.months}
            maskNumbers={maskNumbers}
            categoryTileImages={data.categoryTileImages}
            onSetCategoryTileImage={setCategoryTileImage}
          />
        }
      />
      <Route path="/" element={dashboard} />
    </Routes>
  );
}
