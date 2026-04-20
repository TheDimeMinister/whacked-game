/**
 * Absolute origin for Supabase auth redirects (reset password, email confirm).
 * Uses the current deployment host in the browser so Vercel preview and production
 * both work without hardcoding URLs.
 */
export function getAuthRedirectBase(): string {
  if (typeof window !== 'undefined') return window.location.origin
  const fromEnv = import.meta.env.VITE_SITE_URL as string | undefined
  if (fromEnv?.trim()) return fromEnv.replace(/\/$/, '')
  return ''
}
