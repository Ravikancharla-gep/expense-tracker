/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Public https URL for auth redirects (optional). */
  readonly VITE_SITE_URL?: string;
  /** Domain for bare usernames → name@domain (default example.com). Set your own in production. */
  readonly VITE_LOGIN_EMAIL_DOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
