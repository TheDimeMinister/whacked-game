import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuth } from '../providers/AuthProvider'

type PackRow = {
  id: string
  slug: string
  name: string
  description: string | null
  is_premium: boolean
  stripe_price_id: string | null
}

export function StoreScreen() {
  const { supabase } = useAuth()
  const [msg, setMsg] = useState<string | null>(null)

  const packsQ = useQuery({
    queryKey: ['weapon_packs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weapon_packs')
        .select('id, slug, name, description, is_premium, stripe_price_id')
        .order('sort_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as PackRow[]
    },
  })

  async function tryCheckout(pack: PackRow) {
    setMsg(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId: pack.id, slug: pack.slug }),
      })
      if (res.status === 501) {
        setMsg(
          'Checkout is not enabled yet (Stripe keys on Vercel). Cosmetic only — no pay-to-win.',
        )
        return
      }
      const body = await res.json().catch(() => ({}))
      if (!res.ok) setMsg(body.message ?? `Error ${res.status}`)
      else setMsg(body.message ?? 'Unexpected response')
    } catch {
      setMsg('Network error — API routes run on Vercel deploys.')
    }
  }

  return (
    <div className="screen store-screen">
      <h1>Store</h1>
      <p className="muted">
        Weapon theme packs are cosmetic only. Free players keep the standard pool.
      </p>
      {msg ? <p className="form-msg">{msg}</p> : null}
      <ul className="pack-list">
        {packsQ.data?.map((pack) => (
          <li key={pack.id} className="card pack-card">
            <div>
              <h2>{pack.name}</h2>
              {pack.description ? <p className="muted small">{pack.description}</p> : null}
              <p className="muted small">
                {pack.is_premium ? 'Premium (Stripe)' : 'Included'}
              </p>
            </div>
            <button
              type="button"
              className="btn"
              disabled={!pack.is_premium}
              onClick={() => void tryCheckout(pack)}
            >
              {pack.is_premium ? 'Unlock (soon)' : 'Owned'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
