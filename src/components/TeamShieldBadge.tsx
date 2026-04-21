import type { TeamShieldKey } from '../lib/teamShields'

type Props = {
  shieldKey: TeamShieldKey
  title?: string
  size?: number
  className?: string
}

/** Compact heraldic mark for lobby rows and profile. */
export function TeamShieldBadge({
  shieldKey,
  title,
  size = 28,
  className = '',
}: Props) {
  const s = size
  const stroke = 'currentColor'
  const fill = 'color-mix(in srgb, var(--accent) 35%, transparent)'

  const inner = (() => {
    switch (shieldKey) {
      case 'vault':
        return (
          <>
            <rect x="7" y="9" width="10" height="8" rx="1" fill={fill} stroke={stroke} strokeWidth="1.2" />
            <circle cx="12" cy="13" r="1.8" fill="none" stroke={stroke} strokeWidth="1" />
          </>
        )
      case 'blade':
        return (
          <path
            d="M12 5 L17 18 L12 15 L7 18 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        )
      case 'skull':
        return (
          <>
            <ellipse cx="12" cy="13" rx="5" ry="6" fill={fill} stroke={stroke} strokeWidth="1.2" />
            <circle cx="9.5" cy="12" r="1" fill={stroke} />
            <circle cx="14.5" cy="12" r="1" fill={stroke} />
            <path d="M9 16 Q12 18 15 16" fill="none" stroke={stroke} strokeWidth="1" />
          </>
        )
      case 'scope':
        return (
          <>
            <circle cx="12" cy="12" r="6" fill="none" stroke={stroke} strokeWidth="1.4" />
            <circle cx="12" cy="12" r="2.5" fill={fill} stroke={stroke} strokeWidth="1" />
            <line x1="16" y1="16" x2="19" y2="19" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
          </>
        )
      case 'crown':
        return (
          <path
            d="M6 16 L8 9 L12 12 L16 9 L18 16 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        )
      case 'serpent':
        return (
          <path
            d="M7 8 Q12 6 17 9 Q14 14 9 15 Q11 18 15 17"
            fill="none"
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        )
      default:
        return null
    }
  })()

  return (
    <span
      className={`team-shield-badge ${className}`.trim()}
      style={{ width: s, height: s }}
      title={title}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title ?? undefined}
    >
      <svg viewBox="0 0 24 24" width={s} height={s} aria-hidden>
        <path
          d="M12 2 L20 5 V12 Q20 18 12 22 Q4 18 4 12 V5 Z"
          fill="color-mix(in srgb, var(--bg-elevated) 55%, transparent)"
          stroke={stroke}
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
        <g transform="translate(0,0)">{inner}</g>
      </svg>
    </span>
  )
}
