import { CHARACTER_PRESETS } from '../lib/characterPresets'

type CharacterPickerModalProps = {
  open: boolean
  onClose: () => void
  onPick: (presetId: string) => void
  title?: string
}

export function CharacterPickerModal({
  open,
  onClose,
  onPick,
  title = 'Choose your operative',
}: CharacterPickerModalProps) {
  if (!open) return null

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="character-picker-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="modal character-picker-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="character-picker-modal__head">
          <h2 id="character-picker-title">{title}</h2>
          <button
            type="button"
            className="linkish character-picker-modal__close"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        {CHARACTER_PRESETS.length === 0 ? (
          <p className="muted small">
            No preset operatives yet. Add matching PNG files under the
            character-presets asset folder, then rebuild the app.
          </p>
        ) : (
          <ul className="character-picker-modal__grid">
            {CHARACTER_PRESETS.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="character-picker-tile"
                  onClick={() => {
                    onPick(p.id)
                    onClose()
                  }}
                >
                  <span className="character-picker-tile__frame">
                    <img src={p.src} alt="" width={96} height={96} decoding="async" />
                  </span>
                  <span className="character-picker-tile__name">{p.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
