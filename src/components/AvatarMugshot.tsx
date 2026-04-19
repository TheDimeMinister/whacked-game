import type { CSSProperties } from 'react'

type AvatarMugshotProps = {
  url?: string | null
  label: string
  size?: number
  className?: string
}

function initialsFrom(label: string) {
  const t = label.trim()
  if (!t) return '?'
  const parts = t.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return t.slice(0, 2).toUpperCase()
}

export function AvatarMugshot({
  url,
  label,
  size = 88,
  className = '',
}: AvatarMugshotProps) {
  const style = { '--mug-size': `${size}px` } as CSSProperties
  const initials = initialsFrom(label)

  return (
    <div
      className={`avatar-mugshot ${className}`.trim()}
      style={style}
      aria-hidden={url ? undefined : true}
    >
      {url ? (
        <img src={url} alt="" referrerPolicy="no-referrer" />
      ) : (
        initials
      )}
    </div>
  )
}
