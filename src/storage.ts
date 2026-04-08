import type {
  AppData,
  BankAccountBalance,
  ExpenseCategory,
  ExpenseEntry,
  IncomeEntry,
  IncomeKind,
  MonthRecord,
} from './types';
import { EXPENSE_CATEGORIES } from './constants';
import { createId } from './utils/id';

const LEGACY_DATA_KEY = 'expense-tracker-data-v1';
const PREAUTH_DATA_KEY = 'expense-tracker-data-v1-preauth';

/** True when Supabase env is set — app expects login and per-user storage. */
export function isCloudBackendConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return Boolean(url && key && String(url).startsWith('http'));
}

export function getDataStorageKey(userId: string | null): string {
  if (!isCloudBackendConfigured()) return LEGACY_DATA_KEY;
  if (userId) return `expense-tracker-data-v1-user-${userId}`;
  return PREAUTH_DATA_KEY;
}

export function getMetaStorageKey(userId: string | null): string {
  if (!isCloudBackendConfigured()) return 'expense-tracker-meta-v1';
  if (userId) return `expense-tracker-meta-v1-user-${userId}`;
  return 'expense-tracker-meta-v1-preauth';
}

/** Full-app snapshot for “latest backup” (browser only; separate from main data key). */
export function getLatestBackupStorageKey(userId: string | null): string {
  if (!isCloudBackendConfigured()) return 'expense-tracker-latest-backup-v1';
  if (userId) return `expense-tracker-latest-backup-v1-user-${userId}`;
  return 'expense-tracker-latest-backup-v1-preauth';
}

export type LatestBackupEnvelope = {
  version: 1;
  savedAt: string;
  payload: AppData;
};

function cloneAppDataJson(d: AppData): AppData {
  return JSON.parse(JSON.stringify(d)) as AppData;
}

/** Persist a full copy for “Restore from latest backup” in this browser profile. */
export function saveLatestBackup(data: AppData, userId: string | null): void {
  const key = getLatestBackupStorageKey(userId);
  const env: LatestBackupEnvelope = {
    version: 1,
    savedAt: new Date().toISOString(),
    payload: cloneAppDataJson(data),
  };
  localStorage.setItem(key, JSON.stringify(env));
}

export function loadLatestBackupEnvelope(userId: string | null): LatestBackupEnvelope | null {
  const key = getLatestBackupStorageKey(userId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const p = parsed as Partial<LatestBackupEnvelope>;
    if (p.version !== 1 || typeof p.savedAt !== 'string' || !p.payload) return null;
    const migrated = migrateRawToAppData(p.payload);
    if (!migrated) return null;
    return { version: 1, savedAt: p.savedAt, payload: migrated };
  } catch {
    return null;
  }
}

export function clearStorageForUser(userId: string): void {
  try {
    localStorage.removeItem(getDataStorageKey(userId));
    localStorage.removeItem(getMetaStorageKey(userId));
    localStorage.removeItem(getLatestBackupStorageKey(userId));
  } catch {
    /* ignore */
  }
}

const VALID_SET = new Set<string>(EXPENSE_CATEGORIES);

const LEGACY_CATEGORY_MAP: Record<string, ExpenseCategory> = {
  Travel: 'Transport',
};

function migrateExpenseCategory(raw: string): ExpenseCategory {
  if (LEGACY_CATEGORY_MAP[raw]) return LEGACY_CATEGORY_MAP[raw];
  if (VALID_SET.has(raw)) return raw as ExpenseCategory;
  const clean = String(raw ?? '').trim();
  return clean || 'Other';
}

function mapExpenses(expenses: ExpenseEntry[]): ExpenseEntry[] {
  return (expenses ?? []).map((e) => ({
    ...e,
    category: migrateExpenseCategory(String(e.category)),
  }));
}

function migrateIncomeKind(raw: { id: string; label: string; amount: number; kind?: IncomeKind }): IncomeEntry {
  const k = raw.kind;
  if (k === 'salary' || k === 'other' || k === 'investment') {
    return { id: raw.id, label: raw.label, amount: raw.amount, kind: k };
  }
  const low = String(raw.label).trim().toLowerCase();
  const kind: IncomeKind = low === 'salary' ? 'salary' : 'other';
  return { id: raw.id, label: raw.label, amount: raw.amount, kind };
}

function mapIncome(income: { id: string; label: string; amount: number; kind?: IncomeKind }[]): IncomeEntry[] {
  return (income ?? []).map((e) => migrateIncomeKind(e));
}

type LegacyMonth = Omit<MonthRecord, 'expenses'> & {
  expenses?: ExpenseEntry[];
  bankAccounts?: BankAccountBalance[];
  bankBalanceActual?: number;
};

function stripMonth(raw: LegacyMonth): { record: MonthRecord; banks?: BankAccountBalance[] } {
  const record: MonthRecord = {
    monthKey: raw.monthKey,
    income: mapIncome(raw.income ?? []),
    expenses: mapExpenses(raw.expenses ?? []),
  };
  let banks: BankAccountBalance[] | undefined;
  if (raw.bankAccounts && raw.bankAccounts.length > 0) {
    banks = raw.bankAccounts.map((a) => ({ ...a }));
  } else if (raw.bankBalanceActual != null && typeof raw.bankBalanceActual === 'number') {
    banks = [{ id: createId(), name: 'Primary account', balance: raw.bankBalanceActual }];
  }
  return { record, banks };
}

/** Migrate raw parsed JSON (from disk or localStorage) into canonical `AppData`. */
export function migrateRawToAppData(parsed: unknown): AppData | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const p = parsed as AppData & { months?: LegacyMonth[] };
  if (p.version !== 1 || !Array.isArray(p.months)) return null;

  let globalBanks: BankAccountBalance[] = Array.isArray(p.bankAccounts)
    ? p.bankAccounts.map((a) => ({ ...a }))
    : [];

  const sortedRaw = [...p.months].sort((a, b) => (a.monthKey ?? '').localeCompare(b.monthKey ?? ''));
  const months: MonthRecord[] = [];

  for (const m of sortedRaw) {
    const { record, banks } = stripMonth(m);
    months.push(record);
    if (globalBanks.length === 0 && banks && banks.length > 0) {
      globalBanks = banks;
    }
  }

  months.sort((a, b) => b.monthKey.localeCompare(a.monthKey));

  const rawProfit = (p as { investmentProfit?: unknown }).investmentProfit;
  const investmentProfit =
    typeof rawProfit === 'number' && Number.isFinite(rawProfit) ? rawProfit : undefined;

  const rawTiles = (p as { categoryTileImages?: unknown }).categoryTileImages;
  let categoryTileImages: Record<string, string> | undefined;
  if (rawTiles && typeof rawTiles === 'object' && rawTiles !== null && !Array.isArray(rawTiles)) {
    const o: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawTiles)) {
      if (typeof v === 'string' && v.startsWith('data:image/')) o[k] = v;
    }
    if (Object.keys(o).length > 0) categoryTileImages = o;
  }

  return {
    version: 1,
    months,
    bankAccounts: globalBanks,
    ...((p.currency === 'USD' || p.currency === 'INR') ? { currency: p.currency } : {}),
    ...(Array.isArray(p.customSections)
      ? { customSections: p.customSections.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) }
      : {}),
    ...(investmentProfit !== undefined ? { investmentProfit } : {}),
    ...(categoryTileImages ? { categoryTileImages } : {}),
  };
}

export type SyncMeta = {
  localModifiedAt: number;
};

export function getSyncMeta(userId: string | null): SyncMeta {
  const key = getMetaStorageKey(userId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { localModifiedAt: 0 };
    const p = JSON.parse(raw) as Partial<SyncMeta>;
    return {
      localModifiedAt:
        typeof p.localModifiedAt === 'number' && Number.isFinite(p.localModifiedAt) ? p.localModifiedAt : 0,
    };
  } catch {
    return { localModifiedAt: 0 };
  }
}

export function setSyncMeta(meta: SyncMeta, userId: string | null): void {
  const key = getMetaStorageKey(userId);
  try {
    localStorage.setItem(key, JSON.stringify(meta));
  } catch {
    /* ignore quota */
  }
}

export function bumpLocalModified(userId: string | null): void {
  setSyncMeta({ localModifiedAt: Date.now() }, userId);
}

function emptyAppData(): AppData {
  return { version: 1, months: [], bankAccounts: [] };
}

/** Lines of real data — must match sync.ts `snapshotRichness` semantics. */
export function dataRichness(d: AppData): number {
  let n = d.bankAccounts.length;
  for (const m of d.months) {
    n += m.income.length + m.expenses.length;
  }
  return n;
}

/** Read a single raw snapshot from localStorage (any known key). */
export function loadSnapshotFromStorageKey(storageKey: string): AppData | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    const migrated = migrateRawToAppData(parsed);
    return migrated ?? null;
  } catch {
    return null;
  }
}

/**
 * Merge several snapshots (same user, different storage keys). Months union by `monthKey`;
 * income/expense lines dedupe by `id`. Banks union by `id`.
 */
export function mergeAppDataLayers(...layers: AppData[]): AppData {
  const nonEmpty = layers.filter((l) => l.months.length > 0 || l.bankAccounts.length > 0);
  if (nonEmpty.length === 0) return emptyAppData();
  if (nonEmpty.length === 1) {
    const only = nonEmpty[0]!;
    return {
      version: 1,
      months: only.months.map((m) => ({
        monthKey: m.monthKey,
        income: m.income.map((e) => ({ ...e })),
        expenses: m.expenses.map((e) => ({ ...e })),
      })),
      bankAccounts: only.bankAccounts.map((a) => ({ ...a })),
      ...((only.currency === 'USD' || only.currency === 'INR') ? { currency: only.currency } : {}),
      ...(only.customSections && only.customSections.length > 0
        ? { customSections: [...only.customSections] }
        : {}),
      ...(typeof only.investmentProfit === 'number' && Number.isFinite(only.investmentProfit)
        ? { investmentProfit: only.investmentProfit }
        : {}),
      ...(only.categoryTileImages && Object.keys(only.categoryTileImages).length > 0
        ? { categoryTileImages: { ...only.categoryTileImages } }
        : {}),
    };
  }

  const incomeByMonth = new Map<string, Map<string, IncomeEntry>>();
  const expensesByMonth = new Map<string, Map<string, ExpenseEntry>>();
  const banks = new Map<string, BankAccountBalance>();
  let investmentProfit: number | undefined;
  const categoryTileImages: Record<string, string> = {};
  let currency: 'INR' | 'USD' | undefined;
  const customSectionSet = new Set<string>();

  for (const src of nonEmpty) {
    if (typeof src.investmentProfit === 'number' && Number.isFinite(src.investmentProfit)) {
      investmentProfit = src.investmentProfit;
    }
    if (src.currency === 'USD' || src.currency === 'INR') currency = src.currency;
    for (const s of src.customSections ?? []) customSectionSet.add(s);
    if (src.categoryTileImages) {
      Object.assign(categoryTileImages, src.categoryTileImages);
    }
    for (const a of src.bankAccounts) banks.set(a.id, { ...a });
    for (const m of src.months) {
      if (!incomeByMonth.has(m.monthKey)) incomeByMonth.set(m.monthKey, new Map());
      if (!expensesByMonth.has(m.monthKey)) expensesByMonth.set(m.monthKey, new Map());
      const im = incomeByMonth.get(m.monthKey)!;
      const em = expensesByMonth.get(m.monthKey)!;
      for (const e of m.income) im.set(e.id, { ...e });
      for (const e of m.expenses) em.set(e.id, { ...e });
    }
  }

  const monthKeys = new Set([...incomeByMonth.keys(), ...expensesByMonth.keys()]);
  const months: MonthRecord[] = [...monthKeys].map((monthKey) => ({
    monthKey,
    income: [...(incomeByMonth.get(monthKey)?.values() ?? [])],
    expenses: [...(expensesByMonth.get(monthKey)?.values() ?? [])],
  }));
  months.sort((a, b) => b.monthKey.localeCompare(a.monthKey));

  const out: AppData = {
    version: 1,
    months,
    bankAccounts: [...banks.values()],
  };
  if (investmentProfit !== undefined) out.investmentProfit = investmentProfit;
  if (currency) out.currency = currency;
  if (customSectionSet.size > 0) out.customSections = [...customSectionSet];
  if (Object.keys(categoryTileImages).length > 0) out.categoryTileImages = categoryTileImages;
  return out;
}

/**
 * When Supabase is configured, the same person’s data may exist under multiple keys:
 * - `expense-tracker-data-v1` (before env had Supabase)
 * - `expense-tracker-data-v1-preauth` (before login / older flows)
 * - `expense-tracker-data-v1-user-<id>` (after login)
 * Without merging legacy/preauth on first run, logging in or adding `.env` looks like “everything vanished”.
 *
 * Once anything has been persisted under the signed-in user key, that blob is treated as the only
 * source of truth. Layer merges are a union by row id with no tombstones; merging older keys after
 * a delete would resurrect removed lines on refresh.
 */
export function loadMergedDataForLoggedInUser(userId: string): AppData {
  const userKey = getDataStorageKey(userId);
  try {
    if (localStorage.getItem(userKey) !== null) {
      const fromUser = loadSnapshotFromStorageKey(userKey);
      return fromUser ?? emptyAppData();
    }
  } catch {
    /* fall through to migration merge */
  }

  const fromLegacy = loadSnapshotFromStorageKey(LEGACY_DATA_KEY);
  const fromPreauth = loadSnapshotFromStorageKey(PREAUTH_DATA_KEY);

  const candidates = [fromLegacy, fromPreauth].filter(Boolean) as AppData[];
  if (candidates.length === 0) return emptyAppData();
  if (candidates.length === 1) return candidates[0]!;

  return mergeAppDataLayers(...candidates);
}

export type StoredSnapshotRow = {
  key: string;
  title: string;
  richness: number;
  monthCount: number;
  entryLines: number;
  ok: boolean;
};

function titleForSnapshotKey(key: string): string {
  if (key === LEGACY_DATA_KEY) return 'Original storage (before cloud login)';
  if (key === PREAUTH_DATA_KEY) return 'Pre-login / offline draft';
  if (key.startsWith('expense-tracker-data-v1-user-')) {
    const id = key.slice('expense-tracker-data-v1-user-'.length);
    const short = id.length > 12 ? `${id.slice(0, 8)}…` : id;
    return `Signed-in account (${short})`;
  }
  return key;
}

/** Every `expense-tracker-data-v1*` blob in this browser (for recovery UI). */
export function listStoredDataSnapshots(): StoredSnapshotRow[] {
  const rows: StoredSnapshotRow[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith('expense-tracker-data-v1')) continue;
    const data = loadSnapshotFromStorageKey(key);
    if (!data) {
      rows.push({ key, title: titleForSnapshotKey(key), richness: 0, monthCount: 0, entryLines: 0, ok: false });
      continue;
    }
    const richness = dataRichness(data);
    const monthCount = data.months.length;
    const entryLines = richness - data.bankAccounts.length;
    rows.push({ key, title: titleForSnapshotKey(key), richness, monthCount, entryLines, ok: true });
  }
  rows.sort((a, b) => b.richness - a.richness || b.monthCount - a.monthCount);
  return rows;
}

/** Merge current in-memory data with every parseable snapshot still in localStorage. */
export function mergeCurrentWithAllStoredSnapshots(current: AppData): AppData {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('expense-tracker-data-v1')) keys.push(k);
  }
  const layers: AppData[] = [{ ...current, months: current.months.map((m) => ({ ...m, income: [...m.income], expenses: [...m.expenses] })), bankAccounts: [...current.bankAccounts] }];
  for (const k of keys) {
    const d = loadSnapshotFromStorageKey(k);
    if (d && dataRichness(d) > 0) layers.push(d);
  }
  return mergeAppDataLayers(...layers);
}

export function loadData(userId: string | null): AppData {
  try {
    const raw = localStorage.getItem(getDataStorageKey(userId));
    if (!raw) return emptyAppData();
    const parsed = JSON.parse(raw) as unknown;
    const migrated = migrateRawToAppData(parsed);
    return migrated ?? emptyAppData();
  } catch {
    return emptyAppData();
  }
}

export function saveData(data: AppData, userId: string | null): void {
  try {
    localStorage.setItem(getDataStorageKey(userId), JSON.stringify(data));
    bumpLocalModified(userId);
  } catch {
    /* quota exceeded */
  }
}

export function ensureMonth(data: AppData, monthKey: string): MonthRecord {
  let m = data.months.find((x) => x.monthKey === monthKey);
  if (!m) {
    m = { monthKey, income: [], expenses: [] };
    data.months.push(m);
    data.months.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }
  return m;
}
