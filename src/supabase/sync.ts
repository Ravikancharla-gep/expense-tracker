import type { AppData } from '../types';
import { getSyncMeta, mergeAppDataLayers, setSyncMeta } from '../storage';
import { getSupabase, isCloudConfigured } from './client';

const TABLE = 'expense_tracker_snapshots';

/** Count of income + expense lines (+ bank rows) — avoids wiping real data with an empty snapshot. */
function snapshotRichness(d: AppData): number {
  let n = d.bankAccounts.length;
  for (const m of d.months) {
    n += m.income.length + m.expenses.length;
  }
  return n;
}

/** True if local has at least one month record that remote does not (partial / old cloud snapshot). */
function remoteMissingSomeLocalMonths(remote: AppData, local: AppData): boolean {
  const r = new Set(remote.months.map((m) => m.monthKey));
  for (const m of local.months) {
    if (!r.has(m.monthKey)) return true;
  }
  return false;
}

export type RemoteSnapshot = {
  payload: AppData;
  updatedAt: Date;
};

export function cloudAvailable(): boolean {
  return isCloudConfigured && getSupabase() !== null;
}

export async function fetchRemoteSnapshot(userId: string): Promise<RemoteSnapshot | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from(TABLE)
    .select('payload, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;

  const payload = data.payload as AppData | null;
  if (!payload || payload.version !== 1 || !Array.isArray(payload.months)) return null;

  const updatedAt = new Date(String((data as { updated_at?: string }).updated_at ?? 0));
  if (Number.isNaN(updatedAt.getTime())) return null;

  return { payload, updatedAt };
}

export async function pushRemoteSnapshot(userId: string, data: AppData): Promise<Date | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const { data: row, error } = await sb
    .from(TABLE)
    .upsert(
      {
        user_id: userId,
        payload: data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select('updated_at')
    .maybeSingle();

  if (error) {
    console.error('[sync]', error.message);
    return null;
  }

  const ts = row?.updated_at ? new Date(String(row.updated_at)) : new Date();
  setSyncMeta({ localModifiedAt: ts.getTime() }, userId);
  return ts;
}

export type SyncDecision =
  | { action: 'push' }
  | { action: 'pull'; data: AppData }
  | { action: 'noop' };

/**
 * Single source of truth for “push local vs pull remote”.
 * Fixes: phone with empty local + fresh timestamps must not overwrite a full laptop snapshot.
 */
export async function decideSnapshotSync(userId: string, localData: AppData): Promise<SyncDecision> {
  const remote = await fetchRemoteSnapshot(userId);
  if (!remote) {
    return { action: 'push' };
  }

  const remoteMs = remote.updatedAt.getTime();
  const localTs = getSyncMeta(userId).localModifiedAt;
  const rRich = snapshotRichness(remote.payload);
  const lRich = snapshotRichness(localData);

  // Another device has real rows; this device is still empty — always take cloud.
  if (lRich === 0 && rRich > 0) {
    setSyncMeta({ localModifiedAt: remoteMs }, userId);
    return { action: 'pull', data: remote.payload };
  }

  if (remoteMs > localTs) {
    // Cloud newer: pull unless cloud is empty and we have local data (already handled above for rRich>0 lRich===0)
    if (rRich === 0 && lRich > 0) {
      return { action: 'push' };
    }
    // Newer cloud has fewer *lines* than this device:
    // - If remote is missing whole months, merge so we do not drop local months (partial snapshot).
    // - If both have the same months but remote has fewer lines, trust remote (deletes from another
    //   tab / device). Merging with local would re-add deleted rows — same bug as multi-tab + localhost.
    if (
      rRich > 0 &&
      lRich > rRich &&
      remoteMissingSomeLocalMonths(remote.payload, localData)
    ) {
      const merged = mergeAppDataLayers(remote.payload, localData);
      setSyncMeta({ localModifiedAt: remoteMs }, userId);
      return { action: 'pull', data: merged };
    }
    setSyncMeta({ localModifiedAt: remoteMs }, userId);
    return { action: 'pull', data: remote.payload };
  }

  if (remoteMs < localTs) {
    // Local thinks it’s newer — but never push empty over populated cloud (stale phone).
    if (lRich === 0 && rRich > 0) {
      setSyncMeta({ localModifiedAt: remoteMs }, userId);
      return { action: 'pull', data: remote.payload };
    }
    return { action: 'push' };
  }

  return { action: 'noop' };
}

export type ReconcileResult =
  | { action: 'pulled'; data: AppData }
  | { action: 'pushed' }
  | { action: 'noop' };

export async function reconcileAfterAuth(userId: string, localData: AppData): Promise<ReconcileResult> {
  const d = await decideSnapshotSync(userId, localData);
  if (d.action === 'pull') {
    return { action: 'pulled', data: d.data };
  }
  if (d.action === 'push') {
    await pushRemoteSnapshot(userId, localData);
    return { action: 'pushed' };
  }
  return { action: 'noop' };
}

/**
 * Fire-and-forget push via fetch with `keepalive`, used in `beforeunload`
 * so the browser completes the request even as the page closes.
 * Gracefully skips payloads that exceed the ~64 KB keepalive budget.
 */
export function pushSnapshotKeepalive(userId: string, data: AppData, accessToken: string): void {
  if (!accessToken) return;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anon) return;

  try {
    const body = JSON.stringify({
      user_id: userId,
      payload: data,
      updated_at: new Date().toISOString(),
    });
    if (body.length > 60_000) return;

    fetch(`${url}/rest/v1/${TABLE}?on_conflict=user_id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anon,
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body,
      keepalive: true,
    });
  } catch {
    /* best-effort */
  }
}
