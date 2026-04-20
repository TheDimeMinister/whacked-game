/* eslint-disable react-refresh/only-export-components -- hook colocated with provider */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAuthRedirectBase } from '../lib/siteUrl'

export type SignUpExtra = {
  /** Saved to `profiles.avatar_key` via signup metadata + `handle_new_user`. */
  avatarKey?: string | null
}

type AuthCtx = {
  supabase: SupabaseClient
  session: Session | null
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (
    email: string,
    password: string,
    extra?: SignUpExtra,
  ) => Promise<{ error: Error | null }>
  resetPasswordForEmail: (
    email: string,
  ) => Promise<{ error: Error | null }>
  updatePassword: (password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({
  supabase,
  children,
}: {
  supabase: SupabaseClient
  children: ReactNode
}) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => subscription.unsubscribe()
  }, [supabase])

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      return { error: error as Error | null }
    },
    [supabase],
  )

  const signUp = useCallback(
    async (email: string, password: string, extra?: SignUpExtra) => {
      const key = extra?.avatarKey?.trim()
      const base = getAuthRedirectBase()
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: base ? `${base}/auth` : undefined,
          ...(key ? { data: { avatar_key: key } } : {}),
        },
      })
      return { error: error as Error | null }
    },
    [supabase],
  )

  const resetPasswordForEmail = useCallback(
    async (email: string) => {
      const base = getAuthRedirectBase()
      if (!base) {
        return {
          error: new Error('Missing site URL — open the app from your live domain.'),
        }
      }
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${base}/auth/reset-password`,
      })
      return { error: error as Error | null }
    },
    [supabase],
  )

  const updatePassword = useCallback(
    async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password })
      return { error: error as Error | null }
    },
    [supabase],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [supabase])

  const value = useMemo(
    () => ({
      supabase,
      session,
      user: session?.user ?? null,
      loading,
      signIn,
      signUp,
      resetPasswordForEmail,
      updatePassword,
      signOut,
    }),
    [
      supabase,
      session,
      loading,
      signIn,
      signUp,
      resetPasswordForEmail,
      updatePassword,
      signOut,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth outside AuthProvider')
  return v
}
