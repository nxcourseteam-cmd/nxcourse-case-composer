import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Fail loudly in dev rather than producing a confusing auth error later.
  console.error(
    'Missing Supabase env vars. Copy .env.example to .env and set ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // needed for magic-link callback
  },
})

// Ensure a live, valid session before a write. supabase-js attaches the session's JWT to
// every request through this client, but an access token that expired while the coach was
// reviewing (default ~1h) carries no valid auth.uid() — Postgres RLS then rejects the
// INSERT/UPDATE with 42501 even though the case is owned by the user. getSession() refreshes
// an expired token, so calling it right before a write guarantees the request carries a live
// JWT (or we fail loudly with an actionable message instead of a cryptic RLS error).
export async function requireSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw new Error(`Could not verify your sign-in: ${error.message}`)
  if (!data?.session) {
    throw new Error('Your session has expired — please sign in again, then retry the save.')
  }
  return data.session
}
