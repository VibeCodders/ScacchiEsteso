import { useNavigate } from 'react-router-dom';
import { useGameSetup } from '../context/gameSetup';
import '../App.css';

function GameOverScreen() {
  const navigate = useNavigate();
  const { reset } = useGameSetup();

  const backToHome = () => {
    reset();
    navigate('/');
  };

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>🏁 Fine Partita</h1>
          <p className="subtitle">Schermata di vittoria/pareggio in arrivo (Step 5+ del piano)</p>
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
