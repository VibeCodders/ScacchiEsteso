import { useNavigate } from 'react-router-dom';
import { useGameSetup } from '../context/gameSetup';
import { computeBudgetSpent } from '../data/validators';
import { pieces } from '../data/pieces';
import '../App.css';

function DeploymentScreen() {
  const navigate = useNavigate();
  const { mode, teamA, teamB } = useGameSetup();

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>🏳️ Schieramento</h1>
          <p className="subtitle">
            Modalità: {mode === 'pvc' ? 'PvC' : 'PvP locale'} — schieramento manuale in arrivo (Step 4 del piano)
          </p>
        </div>
      </header>
      <div className="main" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="panel">
          <h2>Giocatore 1</h2>
          <p>{teamA ? `${computeBudgetSpent(teamA, pieces)} punti, ${teamA.size} tipi di pezzo` : 'Nessun team'}</p>
        </div>
        <div className="panel">
          <h2>{mode === 'pvc' ? 'PC' : 'Giocatore 2'}</h2>
          <p>{teamB ? `${computeBudgetSpent(teamB, pieces)} punti, ${teamB.size} tipi di pezzo` : 'Nessun team'}</p>
        </div>
      </div>
      <div className="actions" style={{ justifyContent: 'center', padding: '1rem' }}>
        <button className="btn-save" onClick={() => navigate('/game')}>
          Avanti (placeholder) →
        </button>
      </div>
    </div>
  );
}

export default DeploymentScreen;
