import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { GameSetupProvider } from './context/GameSetupContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <GameSetupProvider>
        <App />
      </GameSetupProvider>
    </BrowserRouter>
  </StrictMode>,
)
