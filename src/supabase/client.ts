import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isCloudConfigured = Boolean(
  url && anon && url.startsWith('http') && anon.length > 20
);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isCloudConfigured || !url || !anon) return null;
  if (!client) {
    client = createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}

/**
 * Magic-link emails must point to a URL the phone can open — not http://localhost.
 * Set `VITE_SITE_URL` in `.env` to your deployed app (https://…) or a tunnel (e.g. ngrok).
 * Add the same URL under Supabase → Authentication → URL Configuration → Redirect URLs.
 */
export function getAuthRedirectBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_SITE_URL?.trim();
  if (fromEnv && /^https?:\/\//i.test(fromEnv)) {
    return fromEnv.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}
