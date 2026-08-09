import { useNavigate } from 'react-router-dom';
import { playerLabel, useGameSetup } from '../context/gameSetup';
import '../App.css';

function GameOverScreen() {
  const navigate = useNavigate();
  const { mode, humanOwner, matchResult, reset } = useGameSetup();
  const ownerLabel = (owner: 'A' | 'B') => playerLabel(owner, mode, humanOwner);

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
              {matchResult.status === 'checkmate' && `Scacco matto — vince ${ownerLabel(matchResult.winner!)}`}
              {matchResult.status === 'stalemate' && 'Stallo — partita patta'}
              {matchResult.status === 'anti_stalemate' && (
                matchResult.winner
                  ? `Limite di 20 turni senza progressi — vince ${ownerLabel(matchResult.winner)} per punteggio`
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
