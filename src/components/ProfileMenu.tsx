import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, DatabaseBackup, KeyRound, LogOut } from 'lucide-react';

function initialsFromEmail(email: string): string {
  const local = email.split('@')[0]?.trim() ?? email;
  const parts = local.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]![0];
    const b = parts[1]![0];
    if (a && b) return (a + b).toUpperCase().slice(0, 2);
  }
  return local.slice(0, 2).toUpperCase() || '?';
}

type Props = {
  email: string;
  onSignOut: () => Promise<void>;
  onOpenDataRecovery?: () => void;
  onChangePassword?: (nextPassword: string) => Promise<void>;
};

export function ProfileMenu({ email, onSignOut, onOpenDataRecovery, onChangePassword }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [nextPassword, setNextPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleSignOut = useCallback(async () => {
    setBusy(true);
    try {
      await onSignOut();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }, [onSignOut]);

  const label = initialsFromEmail(email);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        id={`${menuId}-trigger`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${menuId}-menu` : undefined}
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className="group inline-flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-1.5 text-white transition hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50 disabled:opacity-60 sm:gap-1.5 sm:pr-2"
        title="Account"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/90 to-teal-500/80 text-xs font-bold text-white shadow-md shadow-violet-900/30 ring-2 ring-white/10 sm:h-10 sm:w-10 sm:text-sm">
          <span className="select-none">{label}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-ink-400 transition group-hover:text-ink-200 ${open ? 'rotate-180' : ''}`}
          strokeWidth={2.5}
          aria-hidden
        />
      </button>

      {open && (
        <div
          id={`${menuId}-menu`}
          aria-labelledby={`${menuId}-trigger`}
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 min-w-[14rem] rounded-2xl border border-white/10 bg-ink-950/95 py-2 shadow-2xl shadow-black/50 backdrop-blur-xl"
        >
          <div className="border-b border-white/10 px-3 pb-2 pt-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-ink-500">Signed in</p>
            <p className="mt-0.5 truncate text-xs font-medium text-ink-100" title={email}>
              {email}
            </p>
          </div>
          <div className="px-1 pt-1">
            {onChangePassword && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setPasswordOpen((v) => !v);
                    setPasswordMsg(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-violet-200/95 transition hover:bg-violet-500/15 hover:text-violet-100 disabled:opacity-50"
                >
                  <KeyRound className="h-4 w-4 shrink-0 opacity-90" />
                  <span>Change password</span>
                </button>
                {passwordOpen && (
                  <div className="mx-2 mb-2 mt-1 rounded-xl border border-white/10 bg-black/25 p-2">
                    <input
                      type="password"
                      value={nextPassword}
                      onChange={(e) => setNextPassword(e.target.value)}
                      placeholder="New password"
                      className="w-full rounded-lg border border-white/10 bg-ink-950 px-2 py-1.5 text-xs text-white placeholder:text-ink-600"
                    />
                    <button
                      type="button"
                      disabled={busy || nextPassword.trim().length < 6}
                      onClick={async () => {
                        setBusy(true);
                        setPasswordMsg(null);
                        try {
                          await onChangePassword(nextPassword.trim());
                          setNextPassword('');
                          setPasswordMsg('Password updated.');
                        } catch (err) {
                          setPasswordMsg(err instanceof Error ? err.message : 'Unable to update password.');
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className="mt-2 w-full rounded-lg bg-violet-600 px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Update password
                    </button>
                    {passwordMsg && <p className="mt-1 text-[10px] text-ink-400">{passwordMsg}</p>}
                  </div>
                )}
              </>
            )}
            {onOpenDataRecovery && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  onOpenDataRecovery();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-teal-200/95 transition hover:bg-teal-500/15 hover:text-teal-100 disabled:opacity-50"
              >
                <DatabaseBackup className="h-4 w-4 shrink-0 opacity-90" />
                <span className="flex flex-col gap-0">
                  <span>Backup</span>
                  <span className="text-[10px] font-normal text-ink-500">Save or restore your data</span>
                </span>
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSignOut()}
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-rose-200/95 transition hover:bg-rose-500/15 hover:text-rose-100 disabled:opacity-50"
            >
              <LogOut className="h-4 w-4 shrink-0 opacity-90" />
              <span className="flex flex-col gap-0">
                <span>Log out</span>
                <span className="text-[10px] font-normal text-ink-500">Sign in with another account</span>
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
