/** Must match `teams_shield_key_check` in Supabase migrations. */
export const TEAM_SHIELD_KEYS = [
  'vault',
  'blade',
  'skull',
  'scope',
  'crown',
  'serpent',
] as const

export type TeamShieldKey = (typeof TEAM_SHIELD_KEYS)[number]

export const TEAM_SHIELD_OPTIONS: { key: TeamShieldKey; label: string }[] = [
  { key: 'vault', label: 'The Vault' },
  { key: 'blade', label: 'Cold Steel' },
  { key: 'skull', label: 'Skull & Cross' },
  { key: 'scope', label: 'Long Sight' },
  { key: 'crown', label: 'Crown Asset' },
  { key: 'serpent', label: 'Serpent Cell' },
]

export function isTeamShieldKey(s: string): s is TeamShieldKey {
  return (TEAM_SHIELD_KEYS as readonly string[]).includes(s)
}
