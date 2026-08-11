import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { emptyTeam, playerLabel, useGameSetup } from '../context/gameSetup';
import Board from '../components/Board';
import {
  autoPlaceBoth,
  autoPlaceRemaining,
  createDeploymentState,
  isDeploymentComplete,
  ownDeploymentRanks,
  placePiece,
  type DeploymentState,
} from '../game/deployment';
import { allCoords, coordToFileRank, type Owner } from '../game/board';
import { pieces, sortSiglasByPunti } from '../data/pieces';
import Button from '../components/ui/Button';
import PageShell from '../components/ui/PageShell';
import Panel from '../components/ui/Panel';
import PieceCard from '../components/ui/PieceCard';

function pickCoinToss(): Owner {
  return Math.random() < 0.5 ? 'A' : 'B';
}

function DeploymentScreen() {
  const navigate = useNavigate();
  const { mode, humanOwner, teamA, teamB, boardDimensions, setDeployedBoard } = useGameSetup();
  const [coinToss, setCoinToss] = useState<Owner | null>(null);
  const [deployment, setDeployment] = useState<DeploymentState | null>(null);
  const [selectedSigla, setSelectedSigla] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<Owner>('A');
  const [error, setError] = useState<string | null>(null);

  const teamAResolved = teamA ?? emptyTeam();
  const teamBResolved = teamB ?? emptyTeam();

  const emptyOwnRankSquares = useMemo(() => {
    if (!deployment || !selectedSigla) return [];
    const ranks = ownDeploymentRanks(deployment.currentPlacer, deployment.dimensions);
    return allCoords(deployment.dimensions).filter((coord) => ranks.includes(coordToFileRank(coord).rank) && !deployment.board.has(coord));
  }, [deployment, selectedSigla]);

  const handleCoinToss = () => {
    const winner = pickCoinToss();
    setCoinToss(winner);
    setDeployment(createDeploymentState(teamAResolved, teamBResolved, winner, boardDimensions));
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

  const handleAutoPlaceMine = () => {
    if (!deployment) return;
    setDeployment(autoPlaceRemaining(deployment, deployment.currentPlacer));
    setSelectedSigla(null);
    setError(null);
  };

  const handleAutoPlaceBoth = () => {
    if (!deployment) return;
    setDeployment(autoPlaceBoth(deployment));
    setSelectedSigla(null);
    setError(null);
  };

  if (!coinToss || !deployment) {
    return (
      <PageShell title="🏳️ Schieramento" subtitle={`Modalità: ${mode === 'pvc' ? 'PvC' : 'PvP locale'}`} layout="center">
        <Panel title="🪙 Tiro a sorte" className="w-full max-w-[480px] text-center">
          <p className="text-sm text-slate-700 dark:text-slate-300">Chi vince tira a sorte decide chi schiera per primo.</p>
          <div className="mt-4">
            <Button variant="primary" onClick={handleCoinToss}>Tira la moneta</Button>
          </div>
        </Panel>
      </PageShell>
    );
  }

  const complete = isDeploymentComplete(deployment);
  const currentRoster = deployment.remaining[deployment.currentPlacer];
  const currentPlacerLabel = playerLabel(deployment.currentPlacer, mode, humanOwner);

  return (
    <PageShell
      title="🏳️ Schieramento"
      subtitle={
        <>
          Ha vinto il tiro a sorte: {playerLabel(deployment.firstPlacer, mode, humanOwner)}.
          {' '}Le posizioni sono visibili a entrambi.
        </>
      }
      layout="board"
    >
      <Panel className="flex flex-col items-center gap-4 overflow-x-auto">
        <Board
          pieces={deployment.board}
          orientation={orientation}
          dimensions={deployment.dimensions}
          onSquareClick={handleSquareClick}
          onSquareDrop={handleSquareClick}
          highlightedSquares={emptyOwnRankSquares}
        />
        <Button variant="improve" onClick={() => setOrientation((o) => (o === 'A' ? 'B' : 'A'))}>
          🔄 Gira scacchiera (vista: {playerLabel(orientation, mode, humanOwner)})
        </Button>
      </Panel>

      <Panel>
        {complete ? (
          <>
            <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">✅ Schieramento completo</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Entrambi gli eserciti sono stati posizionati.</p>
            <Button variant="primary" className="mt-4" onClick={handleContinue}>Vai alla partita →</Button>
          </>
        ) : (
          <>
            <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">Turno: {currentPlacerLabel}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Seleziona (o trascina) un pezzo, poi indica una casella libera nelle tue 2 traverse.</p>
            <div className="mb-4 mt-3 flex flex-col gap-2">
              <Button variant="auto" onClick={handleAutoPlaceMine}>
                🤖 Piazza automaticamente i miei pezzi
              </Button>
              <Button variant="auto" onClick={handleAutoPlaceBoth}>
                ⚡ Piazza automaticamente entrambi gli eserciti
              </Button>
            </div>
            <div className="piece-grid grid grid-cols-1 gap-2.5">
              {sortSiglasByPunti([...currentRoster.keys()]).map((sigla) => {
                const count = currentRoster.get(sigla)!;
                const pieceDef = pieces.find((p) => p.sigla === sigla);
                if (!pieceDef) return null;
                return (
                  <PieceCard
                    key={sigla}
                    piece={pieceDef}
                    costLabel={`×${count}`}
                    selected={selectedSigla === sigla}
                    showMoves={false}
                    showFlags={false}
                    role="button"
                    tabIndex={0}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData('text/plain', sigla); setSelectedSigla(sigla); }}
                    onClick={() => setSelectedSigla(sigla)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedSigla(sigla); } }}
                    className="cursor-grab"
                  />
                );
              })}
            </div>
            {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
          </>
        )}
      </Panel>
    </PageShell>
  );
}

export default DeploymentScreen;
