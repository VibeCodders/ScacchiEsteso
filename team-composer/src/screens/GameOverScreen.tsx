import { useNavigate } from 'react-router-dom';
import { useGameSetup } from '../context/gameSetup';
import '../App.css';

function ownerLabel(owner: 'A' | 'B', mode: 'pvp' | 'pvc' | null): string {
  if (owner === 'A') return 'Giocatore 1';
  return mode === 'pvc' ? 'PC' : 'Giocatore 2';
}

function GameOverScreen() {
  const navigate = useNavigate();
  const { mode, matchResult, reset } = useGameSetup();

  const backToHome = () => {
    reset();
    navigate('/');
  };

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>🏁 Fine Partita</h1>
          {matchResult ? (
            <p className="subtitle">
              {matchResult.status === 'checkmate' && `Scacco matto — vince ${ownerLabel(matchResult.winner!, mode)}`}
              {matchResult.status === 'stalemate' && 'Stallo — partita patta'}
              {matchResult.status === 'anti_stalemate' && (
                matchResult.winner
                  ? `Limite di 20 turni senza progressi — vince ${ownerLabel(matchResult.winner, mode)} per punteggio`
                  : 'Limite di 20 turni senza progressi — partita patta per punteggio pari'
              )}
            </p>
          ) : (
            <p className="subtitle">Nessun risultato disponibile.</p>
          )}
        </div>
      </header>
      <div className="actions" style={{ justifyContent: 'center', padding: '1rem' }}>
        <button className="btn-save" onClick={backToHome}>
          Torna alla Home
        </button>
      </div>
    </div>
  );
}

export default GameOverScreen;
