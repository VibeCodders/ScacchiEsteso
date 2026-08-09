import { useNavigate } from 'react-router-dom';
import { useGameSetup } from '../context/gameSetup';
import '../App.css';

function Home() {
  const navigate = useNavigate();
  const { setMode, reset } = useGameSetup();

  const startPvp = () => {
    reset();
    setMode('pvp');
    navigate('/team/a');
  };

  const startPvc = () => {
    reset();
    setMode('pvc');
    navigate('/team/a');
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
            <button className="btn-auto" onClick={startPvc}>
              PvC (contro il PC)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
