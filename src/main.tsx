import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { createSupabase } from './lib/supabase.ts'
import { parseEnv } from './lib/env.ts'
import { AuthProvider } from './providers/AuthProvider.tsx'
import { GameSessionProvider } from './providers/GameSessionProvider.tsx'
import { QueryProvider } from './providers/QueryProvider.tsx'
import { UiToneProvider } from './providers/UiToneProvider.tsx'
import { MissingConfig } from './routes/MissingConfig.tsx'

const env = parseEnv()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {env ? (
      <QueryProvider>
        <AuthProvider supabase={createSupabase(env)}>
          <GameSessionProvider>
            <BrowserRouter>
              <UiToneProvider>
                <App />
              </UiToneProvider>
            </BrowserRouter>
          </GameSessionProvider>
        </AuthProvider>
      </QueryProvider>
    ) : (
      <MissingConfig />
    )}
  </StrictMode>,
)
