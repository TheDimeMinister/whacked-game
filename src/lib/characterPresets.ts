/**
 * Drop preset portraits here as `some-character-name.png` (slug = filename without .png).
 * Vite bundles them; URLs are stable per build via import.meta.glob.
 */
const modules = import.meta.glob(
  '../assets/character-presets/*.png',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>

function idFromPath(path: string): string {
  const base = path.split('/').pop() ?? ''
  return base.replace(/\.png$/i, '')
}

export function presetLabelFromId(id: string): string {
  return id
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export type CharacterPreset = { id: string; label: string; src: string }

export const CHARACTER_PRESETS: CharacterPreset[] = Object.entries(modules)
  .map(([path, url]) => {
    const id = idFromPath(path)
    return { id, label: presetLabelFromId(id), src: url }
  })
  .sort((a, b) => a.label.localeCompare(b.label))

export function getPresetPortraitUrl(id: string | null | undefined): string | null {
  if (!id) return null
  return CHARACTER_PRESETS.find((p) => p.id === id)?.src ?? null
}
