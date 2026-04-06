import { useState } from 'react';
import { IndianRupee, KeyRound, Loader2, Lock, User } from 'lucide-react';
import { motion } from 'framer-motion';

type Props = {
  onSignIn: (email: string, password: string) => Promise<{ error: string | null }>;
  onSignUp: (email: string, password: string) => Promise<{ error: string | null }>;
};

/** Bare usernames become unique emails for Supabase (password auth requires an email-shaped id). */
export function loginIdToEmail(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (t.includes('@')) return t;
  const slug = t.replace(/[^a-z0-9._-]/g, '') || 'user';
  const domain = (import.meta.env.VITE_LOGIN_EMAIL_DOMAIN as string | undefined)?.trim() || 'example.com';
  return `${slug}@${domain}`;
}

export function LoginScreen({ onSignIn, onSignUp }: Props) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const email = loginIdToEmail(loginId);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(139,92,246,0.25),transparent)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(78,205,196,0.12),transparent)]" />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-ink-950/90 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-8"
      >
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-teal-400 shadow-lg shadow-violet-500/30">
            <IndianRupee className="h-8 w-8 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="mt-4 font-display text-xl font-bold text-white sm:text-2xl">Expense Tracker</h1>
          <p className="mt-2 text-sm text-ink-500">
            {mode === 'signin' ? 'Sign in with your username and password.' : 'Create an account — your data stays private.'}
          </p>
        </div>

        <form
          className="mt-8 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const id = loginId.trim();
            if (!id || !password || busy) return;
            if (password.length < 6) {
              setMessage('Password must be at least 6 characters.');
              return;
            }
            setBusy(true);
            setMessage(null);
            const fn = mode === 'signin' ? onSignIn : onSignUp;
            void fn(email, password).then(({ error }) => {
              setBusy(false);
              if (error) {
                setMessage(error);
                return;
              }
            });
          }}
        >
          <div>
            <label htmlFor="login-id" className="mb-1 block text-left text-xs font-medium text-ink-400">
              Username or email
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
              <input
                id="login-id"
                type="text"
                autoComplete="username"
                placeholder="ravi or you@email.com"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-ink-900/80 py-3 pl-10 pr-4 text-sm text-ink-100 outline-none ring-violet-500/20 placeholder:text-ink-500 focus:border-violet-400/40 focus:ring-2"
              />
            </div>
            {!loginId.trim().includes('@') && loginId.trim().length > 0 && (
              <p className="mt-1 text-left text-[10px] text-ink-500">
                Uses <span className="font-mono text-ink-400">{email}</span> behind the scenes
              </p>
            )}
          </div>

          <div>
            <label htmlFor="login-password" className="mb-1 block text-left text-xs font-medium text-ink-400">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
              <input
                id="login-password"
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-ink-900/80 py-3 pl-10 pr-4 text-sm text-ink-100 outline-none ring-violet-500/20 placeholder:text-ink-500 focus:border-violet-400/40 focus:ring-2"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:from-violet-500 hover:to-teal-500 disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {mode === 'signin' ? 'Signing in…' : 'Creating account…'}
              </>
            ) : (
              <>
                <KeyRound className="h-4 w-4" />
                {mode === 'signin' ? 'Sign in' : 'Create account'}
              </>
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
            setMessage(null);
          }}
          className="mt-4 w-full text-center text-sm text-violet-300/90 hover:text-violet-200"
        >
          {mode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
        </button>

        <p className="mt-6 text-center text-[10px] leading-relaxed text-ink-500">
          If login always fails after sign-up: open{' '}
          <span className="text-ink-400">Supabase → Authentication → Providers → Email</span> and disable{' '}
          <span className="text-ink-400">Confirm email</span>, then use the same username/email + password again (or
          create a new user).
        </p>

        {message && (
          <p
            className={`mt-4 text-center text-sm ${
              message.includes('created') || message.includes('signed in') ? 'text-teal-300/95' : 'text-rose-300'
            }`}
          >
            {message}
          </p>
        )}
      </motion.div>
    </div>
  );
}
