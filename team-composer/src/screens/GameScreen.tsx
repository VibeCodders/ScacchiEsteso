import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameSetup } from '../context/gameSetup';
import Board from '../components/Board';
import { getPieceDef } from '../game/moveEngine';
import { getPromotionOptions, isPromotionMove } from '../game/promotion';
import { canUseScocca, getScoccaTargets } from '../game/scocca';
import { canSwap, getSwapTargets } from '../game/swap';
import { canRevive, getRevivalSquares, getRevivableSiglas } from '../game/necromancy';
import { createInitialGameState, applyTurn, applyScocca, applySwap, applyRevive, getLegalMovesForTurn, skipExtraMove, type GameState } from '../game/turnManager';
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

interface PendingRevival {
  from: Coord;
  target: Coord;
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
  const [pendingRevival, setPendingRevival] = useState<PendingRevival | null>(null);
  const [actionMode, setActionMode] = useState<'scocca' | 'swap' | 'revive' | null>(null);

  const effectiveSelected = gameState?.pendingExtraMove ?? selected;

  const legalDestinations = useMemo(() => {
    if (!gameState || !effectiveSelected) return [];
    const mover = gameState.board.get(effectiveSelected);
    if (actionMode === 'scocca') {
      return mover ? getScoccaTargets(gameState.board, effectiveSelected, mover.owner) : [];
    }
    if (actionMode === 'swap') {
      return mover ? getSwapTargets(gameState.board, effectiveSelected, mover.owner) : [];
    }
    if (actionMode === 'revive') {
      return getRevivalSquares(gameState.board, effectiveSelected);
    }
    return getLegalMovesForTurn(gameState, effectiveSelected).map((m) => m.to);
  }, [gameState, effectiveSelected, actionMode]);

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

  const commitScocca = (from: Coord, target: Coord) => {
    const result = applyScocca(gameState, from, target);
    if (result.ok) {
      setGameState(result.state);
      setOrientation(result.state.turn);
      setSelected(null);
      setActionMode(null);
      setError(null);
    } else {
      setError(result.reason);
    }
  };

  const commitSwap = (from: Coord, target: Coord) => {
    const result = applySwap(gameState, from, target);
    if (result.ok) {
      setGameState(result.state);
      setOrientation(result.state.turn);
      setSelected(null);
      setActionMode(null);
      setError(null);
    } else {
      setError(result.reason);
    }
  };

  const commitRevive = (from: Coord, target: Coord, sigla: string) => {
    const result = applyRevive(gameState, from, target, sigla);
    if (result.ok) {
      setGameState(result.state);
      setOrientation(result.state.turn);
      setSelected(null);
      setActionMode(null);
      setPendingRevival(null);
      setError(null);
    } else {
      setError(result.reason);
    }
  };

  const attemptRevive = (from: Coord, target: Coord) => {
    const mover = gameState.board.get(from);
    if (!mover) return;
    const options = getRevivableSiglas(gameState.captured[mover.owner]);
    if (options.length === 1) {
      commitRevive(from, target, options[0]);
    } else {
      setPendingRevival({ from, target, options });
    }
  };

  const handleSquareClick = (coord: Coord) => {
    if (gameOver || pendingPromotion || pendingRevival) return;

    if (gameState.pendingExtraMove) {
      if (legalDestinations.includes(coord)) {
        attemptMove(gameState.pendingExtraMove, coord);
      }
      return; // no other square is selectable while the Berserker's bonus move is pending
    }

    if (actionMode && selected) {
      if (legalDestinations.includes(coord)) {
        if (actionMode === 'scocca') commitScocca(selected, coord);
        else if (actionMode === 'swap') commitSwap(selected, coord);
        else attemptRevive(selected, coord);
      }
      return;
    }

    const pieceHere = gameState.board.get(coord);

    if (selected && legalDestinations.includes(coord)) {
      attemptMove(selected, coord);
      return;
    }

    if (pieceHere && pieceHere.owner === gameState.turn) {
      setSelected(coord === selected ? null : coord);
      setActionMode(null);
      setError(null);
      return;
    }

    setSelected(null);
    setActionMode(null);
  };

  const handleDragStart = (coord: Coord) => {
    if (gameOver || pendingPromotion || pendingRevival) return;
    if (gameState.pendingExtraMove) return; // the bonus square is already the effective selection
    const pieceHere = gameState.board.get(coord);
    if (pieceHere && pieceHere.owner === gameState.turn) {
      setSelected(coord);
      setActionMode(null);
      setError(null);
    }
  };

  const handleSkipExtraMove = () => {
    const result = skipExtraMove(gameState);
    if (result.ok) {
      setGameState(result.state);
      setOrientation(result.state.turn);
      setSelected(null);
      setError(null);
    } else {
      setError(result.reason);
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
            selectedSquare={effectiveSelected}
            onPieceDragStart={gameOver || pendingPromotion || pendingRevival || gameState.pendingExtraMove || actionMode ? undefined : handleDragStart}
            onSquareDrop={gameOver || pendingPromotion || pendingRevival || actionMode ? undefined : handleSquareClick}
          />
          <div className="actions">
            <button className="btn-improve" onClick={() => setOrientation((o) => (o === 'A' ? 'B' : 'A'))}>
              🔄 Gira scacchiera (vista: {ownerLabel(orientation, mode)})
            </button>
            {selected && !gameState.pendingExtraMove && canUseScocca(getPieceDef(gameState.board.get(selected)!.sigla)) && (
              <button className="btn-auto" onClick={() => setActionMode((m) => (m === 'scocca' ? null : 'scocca'))}>
                {actionMode === 'scocca' ? '↩️ Annulla Scoccare' : '🏹 Scoccare'}
              </button>
            )}
            {selected && !gameState.pendingExtraMove && canSwap(getPieceDef(gameState.board.get(selected)!.sigla)) && (
              <button className="btn-auto" onClick={() => setActionMode((m) => (m === 'swap' ? null : 'swap'))}>
                {actionMode === 'swap' ? '↩️ Annulla Scambio' : '🔀 Scambia posizione'}
              </button>
            )}
            {selected && !gameState.pendingExtraMove && canRevive(getPieceDef(gameState.board.get(selected)!.sigla))
              && getRevivableSiglas(gameState.captured[gameState.board.get(selected)!.owner]).length > 0 && (
              <button className="btn-auto" onClick={() => setActionMode((m) => (m === 'revive' ? null : 'revive'))}>
                {actionMode === 'revive' ? '↩️ Annulla Rianimazione' : '🧟 Rianima alleato'}
              </button>
            )}
          </div>
          {actionMode === 'scocca' && <p>🏹 Modalità Scoccare: seleziona un bersaglio nemico a 3-4 caselle.</p>}
          {actionMode === 'swap' && <p>🔀 Modalità Scambio: seleziona un alleato adiacente.</p>}
          {actionMode === 'revive' && <p>🧟 Modalità Rianimazione: seleziona una casella vuota adiacente.</p>}
          {error && <p style={{ color: '#f87171' }}>{error}</p>}

          {gameState.pendingExtraMove && !pendingPromotion && (
            <div className="panel" style={{ textAlign: 'center' }}>
              <p>⚔️ Movimento extra Berserker disponibile (senza cattura).</p>
              <button className="btn-reset" onClick={handleSkipExtraMove}>Salta movimento extra</button>
            </div>
          )}

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

          {pendingRevival && (
            <div
              style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '1rem',
                background: 'rgba(15, 15, 20, 0.85)', borderRadius: '0.5rem',
              }}
            >
              <h2>🧟 Chi rianimare?</h2>
              <div className="actions" style={{ flexDirection: 'column' }}>
                {pendingRevival.options.map((sigla) => (
                  <button
                    key={sigla}
                    className="btn-save"
                    onClick={() => commitRevive(pendingRevival.from, pendingRevival.target, sigla)}
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
                    {entry.isExtraMove && ' (movimento extra)'}
                    {entry.isRangedAttack && ' (scocca)'}
                    {entry.isSwap && ' (scambio)'}
                    {entry.isRevival && ` (rianimato ${entry.revivedSigla})`}
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
