import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { emptyTeam, playerLabel, useGameSetup } from '../context/gameSetup';
import Board from '../components/Board';
import {
  createDeploymentState,
  isDeploymentComplete,
  ownDeploymentRanks,
  placePiece,
  type DeploymentState,
} from '../game/deployment';
import { allCoords, type Owner } from '../game/board';
import { pieces } from '../data/pieces';
import '../App.css';

function pickCoinToss(): Owner {
  return Math.random() < 0.5 ? 'A' : 'B';
}

function DeploymentScreen() {
  const navigate = useNavigate();
  const { mode, humanOwner, teamA, teamB, setDeployedBoard } = useGameSetup();
  const [coinToss, setCoinToss] = useState<Owner | null>(null);
  const [deployment, setDeployment] = useState<DeploymentState | null>(null);
  const [selectedSigla, setSelectedSigla] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<Owner>('A');
  const [error, setError] = useState<string | null>(null);

  const teamAResolved = teamA ?? emptyTeam();
  const teamBResolved = teamB ?? emptyTeam();

  const emptyOwnRankSquares = useMemo(() => {
    if (!deployment || !selectedSigla) return [];
    const ranks = ownDeploymentRanks(deployment.currentPlacer);
    return allCoords().filter((coord) => ranks.includes(Number(coord[1])) && !deployment.board.has(coord));
  }, [deployment, selectedSigla]);

  const handleCoinToss = () => {
    const winner = pickCoinToss();
    setCoinToss(winner);
    setDeployment(createDeploymentState(teamAResolved, teamBResolved, winner));
  };

  const handleSquareClick = (coord: string) => {
    if (!deployment || !selectedSigla) return;
    const result = placePiece(deployment, selectedSigla, coord);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setError(null);
    setDeployment(result.state);
    setSelectedSigla(null);
  };

  const handleContinue = () => {
    if (!deployment) return;
    setDeployedBoard(deployment.board);
    navigate('/game');
  };

  if (!coinToss || !deployment) {
    return (
      <div className="app">
        <header className="header">
          <div>
            <h1>🏳️ Schieramento</h1>
            <p className="subtitle">Modalità: {mode === 'pvc' ? 'PvC' : 'PvP locale'}</p>
          </div>
        </header>
        <div className="main" style={{ gridTemplateColumns: '1fr', justifyItems: 'center', paddingTop: '2rem' }}>
          <div className="panel" style={{ maxWidth: 480, textAlign: 'center' }}>
            <h2>🪙 Tiro a sorte</h2>
            <p>Chi vince tira a sorte decide chi schiera per primo (README §2.2).</p>
            <button className="btn-save" onClick={handleCoinToss}>Tira la moneta</button>
          </div>
        </div>
      </div>
    );
  }

  const complete = isDeploymentComplete(deployment);
  const currentRoster = deployment.remaining[deployment.currentPlacer];
  const currentPlacerLabel = playerLabel(deployment.currentPlacer, mode, humanOwner);

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>🏳️ Schieramento</h1>
          <p className="subtitle">
            Ha vinto il tiro a sorte: {playerLabel(deployment.firstPlacer, mode, humanOwner)}.
            {' '}Le posizioni sono visibili a entrambi (README §2.4).
          </p>
        </div>
      </header>

      <div className="main" style={{ gridTemplateColumns: '1fr 320px', paddingTop: '1rem' }}>
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <Board
            pieces={deployment.board}
            orientation={orientation}
            onSquareClick={handleSquareClick}
            onSquareDrop={handleSquareClick}
            highlightedSquares={emptyOwnRankSquares}
          />
          <button className="btn-improve" onClick={() => setOrientation((o) => (o === 'A' ? 'B' : 'A'))}>
            🔄 Gira scacchiera (vista: {playerLabel(orientation, mode, humanOwner)})
          </button>
        </div>

        <div className="panel">
          {complete ? (
            <>
              <h2>✅ Schieramento completo</h2>
              <p>Entrambi gli eserciti sono stati posizionati.</p>
              <button className="btn-save" onClick={handleContinue}>Vai alla partita →</button>
            </>
          ) : (
            <>
              <h2>Turno: {currentPlacerLabel}</h2>
              <p>Seleziona (o trascina) un pezzo, poi indica una casella libera nelle tue 2 traverse.</p>
              <div className="piece-grid" style={{ gridTemplateColumns: '1fr' }}>
                {[...currentRoster.entries()].map(([sigla, count]) => {
                  const pieceDef = pieces.find((p) => p.sigla === sigla);
                  return (
                    <div
                      key={sigla}
                      className={`piece-card ${selectedSigla === sigla ? 'selected' : ''}`}
                      role="button"
                      tabIndex={0}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', sigla); setSelectedSigla(sigla); }}
                      onClick={() => setSelectedSigla(sigla)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedSigla(sigla); } }}
                      style={{ cursor: 'grab' }}
                    >
                      <div className="piece-header">
                        <span className="sigla">{sigla}</span>
                        <span className="cost">×{count}</span>
                      </div>
                      <span className="desc">{pieceDef?.descrizione ?? sigla}</span>
                    </div>
                  );
                })}
              </div>
              {error && <p style={{ color: '#f87171' }}>{error}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default DeploymentScreen;
