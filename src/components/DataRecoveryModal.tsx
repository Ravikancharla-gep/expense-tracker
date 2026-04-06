import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { FolderOpen, HardDriveDownload, RotateCcw, X } from 'lucide-react';
import type { AppData } from '../types';
import {
  loadLatestBackupEnvelope,
  migrateRawToAppData,
  saveLatestBackup,
} from '../storage';

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  currentData: AppData;
  replaceAllData: (next: AppData) => void;
};

function downloadJsonEnvelope(payload: AppData): void {
  const env = {
    version: 1 as const,
    savedAt: new Date().toISOString(),
    payload,
  };
  const blob = new Blob([JSON.stringify(env)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.download = `expense-tracker-backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function DataRecoveryModal({
  open,
  onClose,
  userId,
  currentData,
  replaceAllData,
}: Props) {
  const panelId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [backupSavedAt, setBackupSavedAt] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setBackupSavedAt(loadLatestBackupEnvelope(userId)?.savedAt ?? null);
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    refresh();
    setMessage(null);
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleSave = () => {
    setBusyKey('save');
    try {
      let savedInBrowser = false;
      try {
        saveLatestBackup(currentData, userId);
        savedInBrowser = true;
      } catch {
        /* quota */
      }
      downloadJsonEnvelope(currentData);
      if (savedInBrowser) {
        setBackupSavedAt(new Date().toISOString());
        setMessage('Saved. A copy also downloaded to your device.');
      } else {
        setMessage('Saved to your device only (browser storage was full). Keep the downloaded file.');
      }
      refresh();
    } finally {
      setBusyKey(null);
    }
  };

  const handleRestore = () => {
    const env = loadLatestBackupEnvelope(userId);
    if (!env) {
      setMessage('No saved backup in this browser yet. Tap Save backup first.');
      return;
    }
    const when = new Date(env.savedAt).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    if (
      !window.confirm(
        `Replace everything with your backup from ${when}? You can save a new backup first if you need to.`,
      )
    ) {
      return;
    }
    setBusyKey('restore');
    try {
      replaceAllData(env.payload);
      setMessage(`Restored from ${when}.`);
      refresh();
    } finally {
      setBusyKey(null);
    }
  };

  const handleImportFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusyKey('file');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as unknown;
        const migrated = migrateRawToAppData(unwrapEnvelopePayload(parsed) ?? parsed);
        if (!migrated) {
          setMessage('That file does not look like a backup from this app.');
          setBusyKey(null);
          return;
        }
        if (
          !window.confirm(`Replace all data with “${file.name}”? This matches using a downloaded backup file.`)
        ) {
          setBusyKey(null);
          return;
        }
        replaceAllData(migrated);
        setMessage(`Loaded “${file.name}”.`);
        refresh();
      } catch {
        setMessage('Could not read that file.');
      } finally {
        setBusyKey(null);
      }
    };
    reader.onerror = () => {
      setMessage('Could not read that file.');
      setBusyKey(null);
    };
    reader.readAsText(file);
  };

  if (!open) return null;

  const backupLabel = backupSavedAt
    ? new Date(backupSavedAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${panelId}-title`}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border-2 border-violet-400/45 bg-ink-950/98 shadow-[0_0_0_1px_rgba(167,139,250,0.25),0_0_40px_-8px_rgba(139,92,246,0.35),0_25px_50px_-12px_rgba(0,0,0,0.9)] ring-1 ring-inset ring-white/15"
      >
        <div className="flex items-start justify-between gap-3 border-b border-violet-500/20 px-4 py-3 sm:px-5">
          <div>
            <h2 id={`${panelId}-title`} className="font-display text-base font-semibold text-white sm:text-lg">
              Backup
            </h2>
            <p className="mt-1 text-xs text-ink-500">
              Save your data, or go back to your last save. Same as this browser only—use the download for a file copy.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-ink-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4 sm:px-5">
          {message && (
            <p className="rounded-lg bg-teal-500/10 px-3 py-2 text-xs text-teal-200 ring-1 ring-teal-500/20">
              {message}
            </p>
          )}

          <p className="text-center text-xs text-ink-500">
            {backupLabel ? (
              <>
                Last save in this browser:{' '}
                <span className="font-medium text-ink-300">{backupLabel}</span>
              </>
            ) : (
              'No save in this browser yet.'
            )}
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              disabled={busyKey !== null}
              onClick={handleSave}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-lg ring-1 ring-teal-400/30 disabled:opacity-50"
            >
              <HardDriveDownload className="h-4 w-4 shrink-0" />
              {busyKey === 'save' ? 'Saving…' : 'Save backup'}
            </button>
            <button
              type="button"
              disabled={busyKey !== null || !backupSavedAt}
              onClick={handleRestore}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-ink-100 ring-1 ring-white/10 hover:bg-white/15 disabled:opacity-40"
            >
              <RotateCcw className="h-4 w-4 shrink-0" />
              {busyKey === 'restore' ? 'Restoring…' : 'Restore'}
            </button>
          </div>

          <div className="border-t border-violet-500/15 pt-4 text-center">
            <button
              type="button"
              disabled={busyKey !== null}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 text-sm font-medium text-violet-300/95 underline-offset-4 hover:text-violet-200 hover:underline disabled:opacity-50"
            >
              <FolderOpen className="h-4 w-4" />
              Import a backup file…
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              aria-label="Import backup JSON file"
              onChange={handleImportFile}
            />
            <p className="mt-2 text-[10px] text-ink-600">Use a .json file you saved before (replaces current data).</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function unwrapEnvelopePayload(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== 'object') return null;
  const o = parsed as { payload?: unknown; version?: number };
  if (o.payload != null && typeof o.payload === 'object' && (o.version === 1 || o.version === undefined)) {
    return o.payload;
  }
  return null;
}
