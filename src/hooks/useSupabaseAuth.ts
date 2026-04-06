import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase, isCloudConfigured } from '../supabase/client';

export function useSupabaseAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(isCloudConfigured);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !isCloudConfigured) {
      setAuthLoading(false);
      return;
    }

    sb.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const sb = getSupabase();
    if (!sb) return { error: 'Supabase is not configured.' };
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await sb.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (!error) return { error: null };

    let msg = error.message;
    // Unconfirmed users get the same generic error as wrong password — explain for app owners.
    if (/invalid login|invalid credentials|email not confirmed/i.test(msg)) {
      msg =
        'Could not sign in. Either the password is wrong, or the account is not confirmed yet. In Supabase Dashboard → Authentication → Providers → Email, turn OFF “Confirm email” (or open the confirmation link from your inbox), then try again.';
    }
    return { error: msg };
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    const sb = getSupabase();
    if (!sb) return { error: 'Supabase is not configured.' };
    const normalizedEmail = email.trim().toLowerCase();

    const { data, error } = await sb.auth.signUp({
      email: normalizedEmail,
      password,
    });
    if (error) return { error: error.message };

    // When "Confirm email" is off, Supabase usually returns a session here.
    if (data.session) return { error: null };

    // Some projects return no session until email is confirmed — try signing in immediately
    // (works when confirmations are disabled but signUp response omitted session).
    const { error: signInErr } = await sb.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (!signInErr) return { error: null };

    if (data.user) {
      return {
        error:
          'Account created, but you must confirm your email before signing in. Check your inbox, or in Supabase go to Authentication → Providers → Email and disable “Confirm email” for password-only testing.',
      };
    }

    return { error: signInErr.message };
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase()?.auth.signOut();
    setUser(null);
  }, []);

  return {
    user,
    authLoading,
    signInWithPassword,
    signUpWithPassword,
    signOut,
  };
}
