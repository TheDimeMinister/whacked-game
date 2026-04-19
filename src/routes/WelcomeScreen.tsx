import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RulesModal } from '../components/RulesModal'

export function WelcomeScreen() {
  const navigate = useNavigate()
  const [rulesOpen, setRulesOpen] = useState(false)

  return (
    <div className="welcome-screen">
      <div className="welcome-inner">
        <h1 className="brand welcome-brand">Whacked!</h1>
        <p className="tagline welcome-tagline">
          Off-the-books transfers. On-the-record nonsense.
        </p>
        <p className="muted small welcome-blurb">
          A social stealth game: draw a harmless &quot;piece,&quot; pick up your
          mark in the room, and file the hit when the handoff is done. No
          spreadsheets. No alibis.
        </p>
        <div className="btn-row welcome-actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => navigate('/auth')}
          >
            Enter
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setRulesOpen(true)}
          >
            Field manual
          </button>
        </div>
      </div>
      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  )
}
