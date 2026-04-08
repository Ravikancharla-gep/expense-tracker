import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { AppData } from '../types';
import { getSupabase, isCloudConfigured } from '../supabase/client';
import {
  decideSnapshotSync,
  fetchRemoteSnapshot,
  pushRemoteSnapshot,
  pushSnapshotKeepalive,
  reconcileAfterAuth,
} from '../supabase/sync';

const RECONCILE_DEBOUNCE_MS = 600;
const PUSH_DEBOUNCE_MS = 300;
const SNAPSHOT_TABLE = 'expense_tracker_snapshots';
const PERIODIC_RECONCILE_MS = 5000;

export type SyncStatus = 'idle' | 'pending' | 'syncing' | 'synced' | 'error' | 'offline';

function snapshotRichness(d: AppData): number {
  let n = d.bankAccounts.length;
  for (const m of d.months) n += m.income.length + m.expenses.length;
  return n;
}

/**
 * Background Supabase snapshot reconcile + push + periodic pull.
 *
 * `dataReady` **must** be false until `useExpenseStore` has bootstrapped the
 * real user data into React state.  This prevents the reconcile from comparing
 * an empty transient state against the cloud and accidentally pulling stale data.
 */
export function useCloudSync(
  data: AppData,
  replaceAllData: (next: AppData) => void,
  user: User | null,
  dataReady: boolean,
): SyncStatus {
  const dataRef = useRef(data);
  dataRef.current = data;

  const [syncStatus, setSyncStatus] = useState<SyncStatus>(isCloudConfigured ? 'idle' : 'offline');
  const tokenRef = useRef('');
  const lastReconcileRef = useRef<{ userId: string; at: number } | null>(null);
  const lastRemoteSeenMsRef = useRef<number>(0);

  // Keep access token fresh so the beforeunload flush can attach it.
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !user) {
      tokenRef.current = '';
      return;
    }
    sb.auth.getSession().then(({ data: { session } }) => {
      tokenRef.current = session?.access_token ?? '';
    });
  }, [user]);

  const runReconcile = useCallback(
    async (userId: string) => {
      const now = Date.now();
      const prev = lastReconcileRef.current;
      if (prev?.userId === userId && now - prev.at < RECONCILE_DEBOUNCE_MS) {
        return;
      }
      lastReconcileRef.current = { userId, at: now };

      setSyncStatus('syncing');
      try {
        const r = await reconcileAfterAuth(userId, dataRef.current);
        if (r.action === 'pulled') {
          replaceAllData(r.data);
        }
        const remote = await fetchRemoteSnapshot(userId);
        if (remote) lastRemoteSeenMsRef.current = Math.max(lastRemoteSeenMsRef.current, remote.updatedAt.getTime());
        setSyncStatus('synced');
      } catch {
        setSyncStatus('error');
      }
    },
    [replaceAllData],
  );

  // ---------- Reconcile after auth — only when data is ready ----------
  useEffect(() => {
    if (!user || !isCloudConfigured || !dataReady) return;
    void runReconcile(user.id);
  }, [user, runReconcile, dataReady]);

  // ---------- Debounced push / pull after every data change ----------
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !isCloudConfigured || !user || !dataReady) return;

    setSyncStatus('pending');

    const t = window.setTimeout(() => {
      void (async () => {
        setSyncStatus('syncing');
        try {
          const d = await decideSnapshotSync(user.id, dataRef.current);
          if (d.action === 'pull') {
            replaceAllData(d.data);
            setSyncStatus('synced');
            return;
          }
          if (d.action === 'noop') {
            setSyncStatus('synced');
            return;
          }
          await pushRemoteSnapshot(user.id, dataRef.current);
          setSyncStatus('synced');
        } catch {
          setSyncStatus('error');
        }
      })();
    }, PUSH_DEBOUNCE_MS);

    return () => clearTimeout(t);
  }, [data, user, replaceAllData, dataReady]);

  // ---------- Visibility: push on hidden, pull on visible + periodic poll ----------
  useEffect(() => {
    if (!user || !isCloudConfigured || !dataReady) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        void (async () => {
          try {
            const d = await decideSnapshotSync(user.id, dataRef.current);
            if (d.action === 'push') await pushRemoteSnapshot(user.id, dataRef.current);
          } catch {
            /* best-effort on hide */
          }
        })();
        return;
      }
      void (async () => {
        try {
          const d = await decideSnapshotSync(user.id, dataRef.current);
          if (d.action === 'pull') replaceAllData(d.data);
          if (d.action === 'push') await pushRemoteSnapshot(user.id, dataRef.current);
          setSyncStatus('synced');
        } catch {
          setSyncStatus('error');
        }
      })();
    };

    document.addEventListener('visibilitychange', handleVisibility);

    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void (async () => {
        try {
          const d = await decideSnapshotSync(user.id, dataRef.current);
          if (d.action === 'pull') replaceAllData(d.data);
          if (d.action === 'push') await pushRemoteSnapshot(user.id, dataRef.current);
          const remote = await fetchRemoteSnapshot(user.id);
          if (remote) {
            const remoteMs = remote.updatedAt.getTime();
            if (remoteMs > lastRemoteSeenMsRef.current) {
              lastRemoteSeenMsRef.current = remoteMs;
              replaceAllData(remote.payload);
            }
          }
        } catch {
          setSyncStatus('error');
        }
      })();
    }, PERIODIC_RECONCILE_MS);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(interval);
    };
  }, [user, replaceAllData, dataReady]);

  // ---------- Realtime pull: when another device writes, this device refreshes quickly ----------
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !user || !isCloudConfigured || !dataReady) return;

    const channel = sb
      .channel(`expense-sync-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: SNAPSHOT_TABLE,
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void (async () => {
            try {
              // Fast-path realtime: fetch latest row and apply immediately.
              const remote = await fetchRemoteSnapshot(user.id);
              if (!remote) return;
              const remoteMs = remote.updatedAt.getTime();
              if (remoteMs <= lastRemoteSeenMsRef.current) return;
              lastRemoteSeenMsRef.current = remoteMs;
              replaceAllData(remote.payload);
              setSyncStatus('synced');
            } catch {
              setSyncStatus('error');
            }
          })();
        },
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [user, replaceAllData, dataReady]);

  // ---------- Flush to cloud on page close / refresh ----------
  useEffect(() => {
    if (!user || !isCloudConfigured || !dataReady) return;

    const flush = () => {
      // Never flush an empty snapshot on unload; that can wipe cloud from a new device.
      if (tokenRef.current && snapshotRichness(dataRef.current) > 0) {
        pushSnapshotKeepalive(user.id, dataRef.current, tokenRef.current);
      }
    };
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, [user, dataReady]);

  return syncStatus;
}
