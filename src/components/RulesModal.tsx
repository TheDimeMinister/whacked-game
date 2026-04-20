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
        <div className="rules-modal__brand">
          <img
            src="/brand/whacked-logo-no-bg.svg"
            alt=""
            width={40}
            height={40}
            decoding="async"
          />
          <h2 id="rules-title">Field manual</h2>
        </div>
        <p className="muted small">
          Whacked! is a real-world party game: a true test of loyalties,
          requiring a strong poker face, filled with hilarious tension.
        </p>
        <div className="rules-scroll">
        <h3 className="rules-h">Overview</h3>
          <p>
            Grab your weapon, acquire your target, fulfil the contract.
            The first to Whack! wins.
          </p>
          <h3 className="rules-h">The room</h3>
          <p>
            Someone opens a <strong>room</strong>, chooses a <strong>weapon pack</strong>{' '}
            that fits the setting (office, school, pub, family-friendly home, sports
            locker, shisha lounge, etc.), and shares the invite code. Everyone joins,
            marks ready, and the host can start with <strong>two or more</strong> players
            (bigger groups keep targets a mystery).
          </p>
          <h3 className="rules-h">The contract</h3>
          <p>
            Each player gets a random <strong>weapon</strong> and a{' '}
            <strong>target</strong> (another player). Shhhhhh... THIS MUST BE KEPT SECRET!
            I would advise keeping your Alias to yourself, too. You Just never know who may be watching.
            OR how many...
          </p>
          <h3 className="rules-h">The hit</h3>
          <p>
            In order to Whack! your target, you must &quot;transfer&quot; the weapon to your target however
            your team agrees (pass it, plant it on person, trade). 
            IMPORTANT: THE EXCHANGE MUST BE COMPLETED WILLINGLY AND CONSCIOUSLY - 
            <strong>Hitter</strong> to <strong>Target</strong>.
            The object MUST be COMPLETELY visible. It cannot be concealed inside another object, 
            or inside a closed fist, UNLESS agreed within the group prior to the game.
            After the exchange has taken place, you MUST LOUDLY DECLARE "WHACKED!" to your target.
            If the <strong>hitter</strong> does NOT declare <strong>"WHACKED!"</strong>, 
            the hit can be disputed and the round continues, and no kill was made.

            Otherwise, the <strong>Hitter</strong> can then complete the contract by tapping "Whacked!" on their device.
          </p>
          <h3 className="rules-h">Accept or decline</h3>
          <p>
            The <strong>mark</strong> gets a prompt: accept the hit or decline.
            Accept ends the round and files the story. Decline keeps the game
            going — settle ties however your crew likes.
          </p>
          <h3 className="rules-h">Play again</h3>
          <p>
            The host can start a fresh round from the same room. New weapons, new
            marks, same chaos.
          </p>
        </div>
        <div className="rules-modal__footer">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Understood
          </button>
        </div>
      </div>
    </div>
  )
}
