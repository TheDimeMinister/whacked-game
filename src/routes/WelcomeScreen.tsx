import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RulesModal } from '../components/RulesModal'

export function WelcomeScreen() {
  const navigate = useNavigate()
  const [rulesOpen, setRulesOpen] = useState(false)

  return (
    <div className="welcome-screen brand-stage">
      <div className="welcome-stack">
        <h1 className="welcome-brand">
          <img
            src="/brand/whacked-logo-no-bg.svg"
            alt="Whacked!"
            className="welcome-brand__img"
            decoding="async"
          />
        </h1>
        <div className="welcome-inner welcome-inner--glass">
          <p className="tagline welcome-tagline">The Office Assassination Game</p>
          <p className="muted small welcome-blurb">
            Become a secret agent. Accept your contract. Eliminate your target.
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
      </div>
      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  )
}
