import { useNavigate } from 'react-router-dom';
import { useGameSetup } from '../context/gameSetup';
import '../App.css';

function GameScreen() {
  const navigate = useNavigate();
  const { mode } = useGameSetup();

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>♟️ Partita</h1>
          <p className="subtitle">
            Modalità: {mode === 'pvc' ? 'PvC' : 'PvP locale'} — scacchiera e motore di gioco in arrivo (Step 2-3 del piano)
          </p>
        </div>
      </header>
      <div className="main" style={{ gridTemplateColumns: '1fr', justifyItems: 'center', paddingTop: '2rem' }}>
        <div className="panel" style={{ maxWidth: 480 }}>
          <p>Qui comparirà la scacchiera 8x8, con rotazione a 180° per il turno dell'avversario.</p>
        </div>
      </div>
      <div className="actions" style={{ justifyContent: 'center', padding: '1rem' }}>
        <button className="btn-save" onClick={() => navigate('/game-over')}>
          Termina partita (placeholder) →
        </button>
      </div>
    </div>
  );
}

export default GameScreen;
