import type { User } from '@supabase/supabase-js'
import { getPresetPortraitUrl } from './characterPresets'

/** Preset slug on `profiles.avatar_key` wins; otherwise Supabase/OAuth `avatar_url`. */
export function resolveProfileAvatarUrl(
  avatarKey: string | null | undefined,
  user: User | null,
): string | null {
  const preset = getPresetPortraitUrl(avatarKey ?? undefined)
  if (preset) return preset
  const meta = user?.user_metadata as { avatar_url?: string } | undefined
  return meta?.avatar_url?.trim() || null
}
