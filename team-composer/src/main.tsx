import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { GameSetupProvider } from './context/GameSetupContext'
import { ThemeProvider } from './context/ThemeContext'
import { applyStoredTheme } from './lib/theme'

// Apply the stored/OS theme synchronously, before the first render paints anything.
applyStoredTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <HashRouter>
        <GameSetupProvider>
          <App />
        </GameSetupProvider>
      </HashRouter>
    </ThemeProvider>
  </StrictMode>,
)
