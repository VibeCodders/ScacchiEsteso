import { useNavigate } from 'react-router-dom';
import { useGameSetup } from '../context/gameSetup';
import type { Owner } from '../game/board';
import '../App.css';

function Home() {
  const navigate = useNavigate();
  const { setMode, setHumanOwner, reset } = useGameSetup();

  const startPvp = () => {
    reset();
    setMode('pvp');
    navigate('/game-settings');
  };

  const startPvc = (owner: Owner) => {
    reset();
    setMode('pvc');
    setHumanOwner(owner);
    navigate('/game-settings');
  };

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>♟️ Scacchi Esteso</h1>
          <p className="subtitle">Scegli come giocare</p>
        </div>
      </header>
      <div className="main" style={{ gridTemplateColumns: '1fr', justifyItems: 'center', paddingTop: '2rem' }}>
        <div className="panel" style={{ maxWidth: 480 }}>
          <h2>🎮 Modalità</h2>
          <div className="actions" style={{ flexDirection: 'column' }}>
            <button className="btn-save" onClick={startPvp}>
              PvP locale (stesso dispositivo)
            </button>
            <button className="btn-auto" onClick={() => startPvc('A')}>
              PvC — gioco come Giocatore A (muovo per primo)
            </button>
            <button className="btn-auto" onClick={() => startPvc('B')}>
              PvC — gioco come Giocatore B (muovo per secondo)
            </button>
          </div>
        </div>
        <div className="panel" style={{ maxWidth: 480 }}>
          <h2>📖 Impara</h2>
          <div className="actions" style={{ flexDirection: 'column' }}>
            <button className="btn-improve" onClick={() => navigate('/pieces')}>
              Enciclopedia dei pezzi
            </button>
            <button className="btn-improve" onClick={() => navigate('/punti-estimator')}>
              📊 Stima punti pezzi
            </button>
            <button className="btn-improve" onClick={() => navigate('/pezzi-simili')}>
              🧬 Pezzi simili
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
