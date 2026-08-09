import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameSetup } from '../context/gameSetup';
import Board from '../components/Board';
import { getPieceDef } from '../game/moveEngine';
import { getPromotionOptions, isPromotionMove } from '../game/promotion';
import { createInitialGameState, applyTurn, getLegalMovesForTurn, type GameState } from '../game/turnManager';
import { pieces } from '../data/pieces';
import type { Coord, Owner } from '../game/board';
import '../App.css';

function ownerLabel(owner: Owner, mode: 'pvp' | 'pvc' | null): string {
  if (owner === 'A') return 'Giocatore 1';
  return mode === 'pvc' ? 'PC' : 'Giocatore 2';
}

function pieceDescription(sigla: string): string {
  return pieces.find((p) => p.sigla === sigla)?.descrizione ?? sigla;
}

interface PendingPromotion {
  from: Coord;
  to: Coord;
  options: string[];
}

function GameScreen() {
  const navigate = useNavigate();
  const { mode, deployedBoard, setMatchResult } = useGameSetup();

  const [gameState, setGameState] = useState<GameState | null>(() => (deployedBoard ? createInitialGameState(deployedBoard, 'A') : null));
  const [selected, setSelected] = useState<Coord | null>(null);
  const [orientation, setOrientation] = useState<Owner>('A');
  const [error, setError] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);

  const legalDestinations = useMemo(() => {
    if (!gameState || !selected) return [];
    return getLegalMovesForTurn(gameState, selected).map((m) => m.to);
  }, [gameState, selected]);

  if (!deployedBoard || !gameState) {
    return (
      <div className="app">
        <header className="header">
          <div>
            <h1>♟️ Partita</h1>
          </div>
        </header>
        <div className="main" style={{ gridTemplateColumns: '1fr', justifyItems: 'center', paddingTop: '2rem' }}>
          <div className="panel" style={{ maxWidth: 480, textAlign: 'center' }}>
            <p>Nessuno schieramento trovato. Torna alla Home per iniziare una nuova partita.</p>
            <button className="btn-save" onClick={() => navigate('/')}>Torna alla Home</button>
          </div>
        </div>
      </div>
    );
  }

  const gameOver = gameState.status === 'checkmate' || gameState.status === 'stalemate';

  const commitPlainMove = (from: Coord, to: Coord, promotionChoice?: string) => {
    const result = applyTurn(gameState, from, to, promotionChoice);
    if (result.ok) {
      setGameState(result.state);
      setOrientation(result.state.turn);
      setSelected(null);
      setError(null);
      setPendingPromotion(null);
    } else {
      setError(result.reason);
    }
  };

  const attemptMove = (from: Coord, to: Coord) => {
    const mover = gameState.board.get(from);
    if (!mover) return;
    const pieceDef = getPieceDef(mover.sigla);

    if (isPromotionMove(pieceDef, mover.owner, to)) {
      const options = getPromotionOptions(pieceDef);
      if (options.length === 1) {
        commitPlainMove(from, to, options[0]);
      } else {
        setPendingPromotion({ from, to, options });
      }
      return;
    }

    commitPlainMove(from, to);
  };

  const handleSquareClick = (coord: Coord) => {
    if (gameOver || pendingPromotion) return;
    const pieceHere = gameState.board.get(coord);

    if (selected && legalDestinations.includes(coord)) {
      attemptMove(selected, coord);
      return;
    }

    if (pieceHere && pieceHere.owner === gameState.turn) {
      setSelected(coord === selected ? null : coord);
      setError(null);
      return;
    }

    setSelected(null);
  };

  const handleDragStart = (coord: Coord) => {
    if (gameOver || pendingPromotion) return;
    const pieceHere = gameState.board.get(coord);
    if (pieceHere && pieceHere.owner === gameState.turn) {
      setSelected(coord);
      setError(null);
    }
  };

  const handleContinueToResult = () => {
    if (gameState.status === 'checkmate' || gameState.status === 'stalemate') {
      setMatchResult({ status: gameState.status, winner: gameState.winner });
    }
    navigate('/game-over');
  };

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>♟️ Partita</h1>
          <p className="subtitle">
            Modalità: {mode === 'pvc' ? 'PvC' : 'PvP locale'} — Turno: {ownerLabel(gameState.turn, mode)}
            {gameState.status === 'check' && ' — Scacco!'}
          </p>
        </div>
      </header>

      <div className="main" style={{ gridTemplateColumns: '1fr 320px', paddingTop: '1rem' }}>
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', position: 'relative' }}>
          <Board
            pieces={gameState.board}
            orientation={orientation}
            onSquareClick={handleSquareClick}
            highlightedSquares={legalDestinations}
            selectedSquare={selected}
            onPieceDragStart={gameOver || pendingPromotion ? undefined : handleDragStart}
            onSquareDrop={gameOver || pendingPromotion ? undefined : handleSquareClick}
          />
          <button className="btn-improve" onClick={() => setOrientation((o) => (o === 'A' ? 'B' : 'A'))}>
            🔄 Gira scacchiera (vista: {ownerLabel(orientation, mode)})
          </button>
          {error && <p style={{ color: '#f87171' }}>{error}</p>}

          {pendingPromotion && (
            <div
              style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '1rem',
                background: 'rgba(15, 15, 20, 0.85)', borderRadius: '0.5rem',
              }}
            >
              <h2>🎖️ Scegli la promozione</h2>
              <div className="actions" style={{ flexDirection: 'column' }}>
                {pendingPromotion.options.map((sigla) => (
                  <button
                    key={sigla}
                    className="btn-save"
                    onClick={() => commitPlainMove(pendingPromotion.from, pendingPromotion.to, sigla)}
                  >
                    {sigla} — {pieceDescription(sigla)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {gameOver && (
            <div
              style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '1rem',
                background: 'rgba(15, 15, 20, 0.85)', borderRadius: '0.5rem',
              }}
            >
              <h2>{gameState.status === 'checkmate' ? `🏆 Scacco matto! Vince ${ownerLabel(gameState.winner!, mode)}` : '🤝 Stallo — Patta'}</h2>
              <button className="btn-save" onClick={handleContinueToResult}>Vedi risultato →</button>
            </div>
          )}
        </div>

        <div className="panel">
          <h2>📜 Storico mosse</h2>
          <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: '0.85rem' }}>
            {gameState.history.length === 0 ? (
              <p>Nessuna mossa ancora.</p>
            ) : (
              <ol>
                {gameState.history.map((entry, idx) => (
                  <li key={idx}>
                    {ownerLabel(entry.owner, mode)}: {entry.sigla} {entry.from} → {entry.to}
                    {entry.isCapture && ` (cattura ${entry.capturedSigla})`}
                    {entry.promotedTo && ` → promosso a ${entry.promotedTo}`}
                  </li>
                ))}
              </ol>
            )}
          </div>

          <h2>💀 Pezzi catturati</h2>
          <p><strong>{ownerLabel('A', mode)}:</strong> {gameState.captured.A.map((p) => p.sigla).join(', ') || '—'}</p>
          <p><strong>{ownerLabel('B', mode)}:</strong> {gameState.captured.B.map((p) => p.sigla).join(', ') || '—'}</p>
        </div>
      </div>
    </div>
  );
}

export default GameScreen;
