import { z } from 'zod'

const schema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(20),
  /** Optional: server/build only; browser auth uses window.location.origin */
  VITE_SITE_URL: z.string().url().optional(),
})

export function parseEnv() {
  const r = schema.safeParse(import.meta.env)
  if (!r.success) return null
  return r.data
}

export type Env = z.infer<typeof schema>
