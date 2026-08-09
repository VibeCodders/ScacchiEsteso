import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameSetup } from '../context/gameSetup';
import Board from '../components/Board';
import { buildClassicStartingBoard } from '../game/samplePositions';
import type { Owner } from '../game/board';
import '../App.css';

function GameScreen() {
  const navigate = useNavigate();
  const { mode } = useGameSetup();
  const [orientation, setOrientation] = useState<Owner>('A');
  const demoBoard = useMemo(() => buildClassicStartingBoard(), []);

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>♟️ Partita</h1>
          <p className="subtitle">
            Modalità: {mode === 'pvc' ? 'PvC' : 'PvP locale'} — schieramento di esempio, il motore di
            gioco reale arriva allo Step 3 del piano
          </p>
        </div>
      </header>
      <div className="main" style={{ gridTemplateColumns: '1fr', justifyItems: 'center', paddingTop: '1.5rem' }}>
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <Board pieces={demoBoard} orientation={orientation} />
          <button className="btn-improve" onClick={() => setOrientation((o) => (o === 'A' ? 'B' : 'A'))}>
            🔄 Gira scacchiera (vista: {orientation === 'A' ? 'Giocatore 1' : 'Giocatore 2'})
          </button>
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
