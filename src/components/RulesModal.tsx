type RulesModalProps = {
  open: boolean
  onClose: () => void
}

export function RulesModal({ open, onClose }: RulesModalProps) {
  if (!open) return null

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal rules-modal" onClick={(e) => e.stopPropagation()}>
        <h2 id="rules-title">Field manual</h2>
        <p className="muted small">
          Whacked! is a real-world party game: keep it harmless, consensual, and
          ridiculous.
        </p>
        <div className="rules-scroll">
          <h3 className="rules-h">The room</h3>
          <p>
            Someone opens a <strong>room</strong> and shares the invite code.
            Everyone joins, marks ready, and the host starts the round when you
            have enough players.
          </p>
          <h3 className="rules-h">The contract</h3>
          <p>
            Each player gets a random <strong>piece</strong> (prop) and a{' '}
            <strong>mark</strong> (another player). That is secret until you
            choose to reveal it on your phone.
          </p>
          <h3 className="rules-h">The hit</h3>
          <p>
            In real life you &quot;transfer&quot; the prop to your mark however
            your table agrees (pass it, plant it, trade). When the handoff is
            done, the <strong>hitter</strong> taps <strong>Whacked!</strong> on
            their device.
          </p>
          <h3 className="rules-h">Accept or decline</h3>
          <p>
            The <strong>mark</strong> gets a prompt: accept the hit or decline.
            Accept ends the round and files the story. Decline keeps the game
            going — settle ties however your crew likes.
          </p>
          <h3 className="rules-h">Play again</h3>
          <p>
            The host can start a fresh round from the same room. New props, new
            marks, same chaos.
          </p>
        </div>
        <button type="button" className="btn btn--primary" onClick={onClose}>
          Understood
        </button>
      </div>
    </div>
  )
}
