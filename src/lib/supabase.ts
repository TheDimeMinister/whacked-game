import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Env } from './env'

export function createSupabase(env: Env): SupabaseClient {
  return createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  })
}
