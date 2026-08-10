import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { playerLabel, useGameSetup } from '../context/gameSetup';
import Board from '../components/Board';
import { getPieceDef } from '../game/moveEngine';
import { getPromotionOptions, isPromotionMove } from '../game/promotion';
import { canUseScocca, getScoccaTargets } from '../game/scocca';
import { canSwap, getSwapTargets } from '../game/swap';
import { canSwapperSwap, getSwapperCandidateSquares } from '../game/swapper';
import { canRevive, getRevivalSquares, getRevivableSiglas } from '../game/necromancy';
import { canMimic, getOrphanThreats } from '../game/orphan';
import { canSdoppiare, canRiunire, getSdoppiamentoSquares, getRiunioneSquares, isRealMirage } from '../game/mirage';
import { createInitialGameState, applyTurn, applyScocca, applySwap, applySwapperSwap, applyRevive, applySdoppiamento, applyRiunione, getLegalMovesForTurn, skipExtraMove, stopRabbitChain, type GameState } from '../game/turnManager';
import { chooseBotAction, applyBotAction, formatMovesAhead, BOT_DIFFICULTY_MAX } from '../game/bot';
import { pieces, sortSiglasByPunti } from '../data/pieces';
import type { Coord, Owner } from '../game/board';
import '../App.css';

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

interface PendingMimicChoice {
  from: Coord;
  threats: Coord[];
}

interface PendingSdoppiamento {
  from: Coord;
  cloneSquare: Coord;
}

function GameScreen() {
  const navigate = useNavigate();
  const { mode, humanOwner, botDifficulty, deployedBoard, boardDimensions, setMatchResult } = useGameSetup();
  const ownerLabel = (owner: Owner) => playerLabel(owner, mode, humanOwner);

  const [gameState, setGameState] = useState<GameState | null>(() => (deployedBoard ? createInitialGameState(deployedBoard, 'A', boardDimensions) : null));
  const [selected, setSelected] = useState<Coord | null>(null);
  const [orientation, setOrientation] = useState<Owner>('A');
  const [error, setError] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [pendingRevival, setPendingRevival] = useState<PendingRevival | null>(null);
  const [pendingMimicChoice, setPendingMimicChoice] = useState<PendingMimicChoice | null>(null);
  const [orphanMimicSource, setOrphanMimicSource] = useState<Coord | null>(null);
  const [actionMode, setActionMode] = useState<'scocca' | 'swap' | 'revive' | 'swapperSwap' | 'sdoppiamento' | 'riunione' | null>(null);
  const [swapperFirstSquare, setSwapperFirstSquare] = useState<Coord | null>(null);
  const [pendingSdoppiamento, setPendingSdoppiamento] = useState<PendingSdoppiamento | null>(null);
  const [revealRealMirage, setRevealRealMirage] = useState(false);

  const effectiveSelected = gameState?.pendingExtraMove ?? gameState?.pendingRabbitChain?.at ?? selected;

  const botOwner: Owner | null = mode === 'pvc' ? (humanOwner === 'A' ? 'B' : 'A') : null;
  const isGameOver = (state: GameState) => state.status === 'checkmate' || state.status === 'stalemate' || state.status === 'anti_stalemate';
  const isBotTurn = !!botOwner && !!gameState && gameState.turn === botOwner && !isGameOver(gameState);

  useEffect(() => {
    if (!isBotTurn || !gameState || !botOwner) return;
    const action = chooseBotAction(gameState, botOwner, botDifficulty);
    if (!action) return;
    const result = applyBotAction(gameState, action);
    if (result.ok) {
      setGameState(result.state);
      setOrientation(result.state.turn);
      setSelected(null);
      setActionMode(null);
      setSwapperFirstSquare(null);
      setOrphanMimicSource(null);
      setPendingMimicChoice(null);
      setPendingSdoppiamento(null);
      setError(null);
    }
  }, [isBotTurn, gameState, botOwner, botDifficulty]);

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
      return mover ? getRevivalSquares(gameState.board, effectiveSelected, mover.owner) : [];
    }
    if (actionMode === 'swapperSwap') {
      if (!mover) return [];
      const candidates = getSwapperCandidateSquares(gameState.board, effectiveSelected, mover.owner);
      return swapperFirstSquare ? candidates.filter((c) => c !== swapperFirstSquare) : candidates;
    }
    if (actionMode === 'sdoppiamento') {
      return mover && canSdoppiare(getPieceDef(mover.sigla))
        ? getSdoppiamentoSquares(gameState.board, effectiveSelected, mover.owner, getPieceDef, gameState.dimensions)
        : [];
    }
    if (actionMode === 'riunione') {
      return mover && canRiunire(getPieceDef(mover.sigla))
        ? getRiunioneSquares(gameState.board, effectiveSelected, mover.owner, getPieceDef, gameState.dimensions)
        : [];
    }
    return getLegalMovesForTurn(gameState, effectiveSelected, orphanMimicSource ?? undefined).map((m) => m.to);
  }, [gameState, effectiveSelected, actionMode, orphanMimicSource, swapperFirstSquare]);

  /** Squares holding the REAL half of a split Miraggio — rendered with a marker only while the
   *  reveal toggle is on, and only for the player whose turn it is (hot-seat compromise: whoever
   *  is at the screen verifies their own pieces; the opponent's stays hidden). */
  const mirageRealSquares = useMemo(() => {
    if (!gameState || !revealRealMirage) return [];
    return [...gameState.board]
      .filter(([, p]) => isRealMirage(p) && p.owner === gameState.turn)
      .map(([coord]) => coord);
  }, [gameState, revealRealMirage]);

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

  const gameOver = gameState.status === 'checkmate' || gameState.status === 'stalemate' || gameState.status === 'anti_stalemate';

  const lastHistoryEntry = gameState.history.at(-1);
  const lastMoveFlashSquares = lastHistoryEntry
    ? [...new Set([lastHistoryEntry.from, lastHistoryEntry.to, lastHistoryEntry.capturedCoord, ...(lastHistoryEntry.areaDamageCoords ?? [])].filter((c): c is Coord => Boolean(c)))]
    : [];

  const commitPlainMove = (from: Coord, to: Coord, promotionChoice?: string) => {
    const result = applyTurn(gameState, from, to, promotionChoice, orphanMimicSource ?? undefined);
    if (result.ok) {
      setGameState(result.state);
      setOrientation(result.state.turn);
      setSelected(null);
      setError(null);
      setPendingPromotion(null);
      setOrphanMimicSource(null);
      setPendingMimicChoice(null);
      setPendingSdoppiamento(null);
    } else {
      setError(result.reason);
    }
  };

  /** Selects a piece, resetting any in-progress action, and — for a threatened Orfano — sets up which threat it mimics (README, "copia_poteri"). */
  const selectPiece = (coord: Coord) => {
    setSelected(coord);
    setActionMode(null);
    setSwapperFirstSquare(null);
    setError(null);
    setOrphanMimicSource(null);
    setPendingMimicChoice(null);
    setPendingSdoppiamento(null);

    const piece = gameState.board.get(coord);
    if (piece && canMimic(getPieceDef(piece.sigla))) {
      const threats = getOrphanThreats(gameState.board, coord, piece.owner);
      if (threats.length === 1) {
        setOrphanMimicSource(threats[0]);
      } else if (threats.length > 1) {
        setPendingMimicChoice({ from: coord, threats });
      }
    }
  };

  const attemptMove = (from: Coord, to: Coord) => {
    const mover = gameState.board.get(from);
    if (!mover) return;
    const pieceDef = getPieceDef(mover.sigla);

    if (isPromotionMove(pieceDef, mover.owner, to, gameState.dimensions)) {
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
      setSwapperFirstSquare(null);
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
      setSwapperFirstSquare(null);
      setError(null);
    } else {
      setError(result.reason);
    }
  };

  const commitSwapperSwap = (from: Coord, squareA: Coord, squareB: Coord) => {
    const result = applySwapperSwap(gameState, from, squareA, squareB);
    if (result.ok) {
      setGameState(result.state);
      setOrientation(result.state.turn);
      setSelected(null);
      setActionMode(null);
      setSwapperFirstSquare(null);
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
      setSwapperFirstSquare(null);
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

  const commitSdoppiamento = (from: Coord, cloneSquare: Coord, realSquare: Coord) => {
    const result = applySdoppiamento(gameState, from, cloneSquare, realSquare);
    if (result.ok) {
      setGameState(result.state);
      setOrientation(result.state.turn);
      setSelected(null);
      setActionMode(null);
      setSwapperFirstSquare(null);
      setPendingSdoppiamento(null);
      setError(null);
    } else {
      setError(result.reason);
    }
  };

  const commitRiunione = (from: Coord, mergeSquare: Coord) => {
    const result = applyRiunione(gameState, from, mergeSquare);
    if (result.ok) {
      setGameState(result.state);
      setOrientation(result.state.turn);
      setSelected(null);
      setActionMode(null);
      setSwapperFirstSquare(null);
      setPendingSdoppiamento(null);
      setError(null);
    } else {
      setError(result.reason);
    }
  };

  const handleSquareClick = (coord: Coord) => {
    if (gameOver || isBotTurn || pendingPromotion || pendingRevival || pendingMimicChoice || pendingSdoppiamento) return;

    if (gameState.pendingExtraMove) {
      if (legalDestinations.includes(coord)) {
        attemptMove(gameState.pendingExtraMove, coord);
      }
      return; // no other square is selectable while the Berserker's bonus move is pending
    }

    if (gameState.pendingRabbitChain) {
      if (legalDestinations.includes(coord)) {
        attemptMove(gameState.pendingRabbitChain.at, coord);
      }
      return; // no other square is selectable while the Coniglio's jump-chain is pending
    }

    if (actionMode === 'swapperSwap' && selected) {
      if (legalDestinations.includes(coord)) {
        if (!swapperFirstSquare) {
          setSwapperFirstSquare(coord); // first pick — no commit yet
        } else {
          commitSwapperSwap(selected, swapperFirstSquare, coord);
        }
      }
      return;
    }

    if (actionMode && selected) {
      if (legalDestinations.includes(coord)) {
        if (actionMode === 'scocca') commitScocca(selected, coord);
        else if (actionMode === 'swap') commitSwap(selected, coord);
        else if (actionMode === 'sdoppiamento') setPendingSdoppiamento({ from: selected, cloneSquare: coord });
        else if (actionMode === 'riunione') commitRiunione(selected, coord);
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
      if (coord === selected) {
        setSelected(null);
        setActionMode(null);
        setSwapperFirstSquare(null);
        setOrphanMimicSource(null);
        setPendingMimicChoice(null);
        setPendingSdoppiamento(null);
      } else {
        selectPiece(coord);
      }
      return;
    }

    setSelected(null);
    setActionMode(null);
    setSwapperFirstSquare(null);
    setOrphanMimicSource(null);
    setPendingMimicChoice(null);
    setPendingSdoppiamento(null);
  };

  const handleDragStart = (coord: Coord) => {
    if (gameOver || isBotTurn || pendingPromotion || pendingRevival || pendingMimicChoice || pendingSdoppiamento) return;
    if (gameState.pendingExtraMove) return; // the bonus square is already the effective selection
    if (gameState.pendingRabbitChain) return; // the chain's current square is already the effective selection
    const pieceHere = gameState.board.get(coord);
    if (pieceHere && pieceHere.owner === gameState.turn) {
      selectPiece(coord);
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

  const handleStopRabbitChain = () => {
    const result = stopRabbitChain(gameState);
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
    if (gameState.status === 'checkmate' || gameState.status === 'stalemate' || gameState.status === 'anti_stalemate') {
      setMatchResult({ status: gameState.status, winner: gameState.winner });
    }
    navigate('/game-over');
  };

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>♟️ Partita</h1>
          <p className="subtitle">Modalità: {mode === 'pvc' ? 'PvC' : 'PvP locale'}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {mode === 'pvc' && (
            <span className="status-badge status-badge-difficulty" title="Livello di difficoltà del PC (1–50)">
              🤖 PC: difficoltà {botDifficulty}/{BOT_DIFFICULTY_MAX} — vede {formatMovesAhead(botDifficulty)} avanti
            </span>
          )}
          <span className={`turn-badge ${isBotTurn ? 'turn-badge-bot' : 'turn-badge-human'}`}>
            Turno: {ownerLabel(gameState.turn)}
          </span>
          {gameState.status === 'check' && <span className="status-badge status-badge-check">⚠️ Scacco!</span>}
          {isBotTurn && <span className="status-badge status-badge-thinking">🤖 Il PC sta pensando...</span>}
        </div>
      </header>

      <div className="main main-board-layout" style={{ paddingTop: '1rem' }}>
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', position: 'relative', overflowX: 'auto' }}>
          <Board
            pieces={gameState.board}
            orientation={orientation}
            dimensions={gameState.dimensions}
            onSquareClick={handleSquareClick}
            highlightedSquares={legalDestinations}
            selectedSquare={effectiveSelected}
            onPieceDragStart={gameOver || isBotTurn || pendingPromotion || pendingRevival || pendingMimicChoice || gameState.pendingExtraMove || gameState.pendingRabbitChain || actionMode ? undefined : handleDragStart}
            onSquareDrop={gameOver || isBotTurn || pendingPromotion || pendingRevival || pendingMimicChoice || actionMode ? undefined : handleSquareClick}
            flashSquares={lastMoveFlashSquares}
            flashVersion={gameState.history.length}
            mirageRealSquares={mirageRealSquares}
          />
          <div className="actions">
            <button className="btn-improve" onClick={() => setOrientation((o) => (o === 'A' ? 'B' : 'A'))}>
              🔄 Gira scacchiera (vista: {ownerLabel(orientation)})
            </button>
            <button className="btn-improve" onClick={() => setRevealRealMirage((r) => !r)}>
              {revealRealMirage ? '🙈 Nascondi Miraggi veri' : '👁 Vedi i Miraggi veri (tuo turno)'}
            </button>
            {selected && !gameState.pendingExtraMove && !gameState.pendingRabbitChain && canUseScocca(getPieceDef(gameState.board.get(selected)!.sigla))
              && getScoccaTargets(gameState.board, selected, gameState.board.get(selected)!.owner).length > 0 && (
              <button className="btn-auto" onClick={() => setActionMode((m) => (m === 'scocca' ? null : 'scocca'))}>
                {actionMode === 'scocca' ? '↩️ Annulla Scoccare' : '🏹 Scoccare'}
              </button>
            )}
            {selected && !gameState.pendingExtraMove && !gameState.pendingRabbitChain && canSwap(getPieceDef(gameState.board.get(selected)!.sigla))
              && getSwapTargets(gameState.board, selected, gameState.board.get(selected)!.owner).length > 0 && (
              <button className="btn-auto" onClick={() => setActionMode((m) => (m === 'swap' ? null : 'swap'))}>
                {actionMode === 'swap' ? '↩️ Annulla Scambio' : '🔀 Scambia posizione'}
              </button>
            )}
            {selected && !gameState.pendingExtraMove && !gameState.pendingRabbitChain && canSwapperSwap(getPieceDef(gameState.board.get(selected)!.sigla))
              && getSwapperCandidateSquares(gameState.board, selected, gameState.board.get(selected)!.owner).length > 1 && (
              <button className="btn-auto" onClick={() => { setActionMode((m) => (m === 'swapperSwap' ? null : 'swapperSwap')); setSwapperFirstSquare(null); }}>
                {actionMode === 'swapperSwap' ? '↩️ Annulla Scambio' : '🔁 Scambia due alleati'}
              </button>
            )}
            {selected && !gameState.pendingExtraMove && !gameState.pendingRabbitChain && canRevive(getPieceDef(gameState.board.get(selected)!.sigla))
              && getRevivableSiglas(gameState.captured[gameState.board.get(selected)!.owner]).length > 0
              && getRevivalSquares(gameState.board, selected, gameState.board.get(selected)!.owner).length > 0 && (
              <button className="btn-auto" onClick={() => setActionMode((m) => (m === 'revive' ? null : 'revive'))}>
                {actionMode === 'revive' ? '↩️ Annulla Rianimazione' : '🧟 Rianima alleato'}
              </button>
            )}
            {selected && !gameState.pendingExtraMove && !gameState.pendingRabbitChain && canSdoppiare(getPieceDef(gameState.board.get(selected)!.sigla))
              && getSdoppiamentoSquares(gameState.board, selected, gameState.board.get(selected)!.owner, getPieceDef, gameState.dimensions).length > 0 && (
              <button className="btn-auto" onClick={() => setActionMode((m) => (m === 'sdoppiamento' ? null : 'sdoppiamento'))}>
                {actionMode === 'sdoppiamento' ? '↩️ Annulla Sdoppiamento' : '🌫️ Sdoppia'}
              </button>
            )}
            {selected && !gameState.pendingExtraMove && !gameState.pendingRabbitChain && canRiunire(getPieceDef(gameState.board.get(selected)!.sigla))
              && getRiunioneSquares(gameState.board, selected, gameState.board.get(selected)!.owner, getPieceDef, gameState.dimensions).length > 0 && (
              <button className="btn-auto" onClick={() => setActionMode((m) => (m === 'riunione' ? null : 'riunione'))}>
                {actionMode === 'riunione' ? '↩️ Annulla Riunione' : '🔗 Riunisci'}
              </button>
            )}
          </div>
          {actionMode === 'scocca' && <p>🏹 Modalità Scoccare: seleziona un bersaglio nemico a 3-4 caselle.</p>}
          {actionMode === 'swap' && <p>🔀 Modalità Scambio: seleziona un alleato in linea di vista libera (riga, colonna o diagonale).</p>}
          {actionMode === 'revive' && <p>🧟 Modalità Rianimazione: seleziona una casella vuota adiacente.</p>}
          {actionMode === 'swapperSwap' && !swapperFirstSquare && <p>🔁 Scambio: seleziona la prima casella (un alleato adiacente, o lo Swapper stesso).</p>}
          {actionMode === 'swapperSwap' && swapperFirstSquare && <p>🔁 Scambio: seleziona la seconda casella da scambiare con {swapperFirstSquare}.</p>}
          {actionMode === 'sdoppiamento' && <p>🌫️ Modalità Sdoppiamento: scegli una casella vuota adiacente dove materializzare il clone.</p>}
          {actionMode === 'riunione' && <p>🔗 Modalità Riunione: scegli la casella (quella del vero o quella del clone) dove ricompare il Miraggio unico.</p>}
          {revealRealMirage && <p>👁 I Miraggi veri del giocatore di turno sono contrassegnati da un punto giallo.</p>}
          {orphanMimicSource && (
            <p>🎭 L'Orfano è sotto scacco: imita {gameState.board.get(orphanMimicSource)?.sigla} da {orphanMimicSource}.</p>
          )}
          {error && <p style={{ color: '#f87171' }}>{error}</p>}

          {gameState.pendingExtraMove && !pendingPromotion && !isBotTurn && (
            <div className="panel" style={{ textAlign: 'center' }}>
              <p>⚔️ Movimento extra Berserker disponibile (senza cattura).</p>
              <button className="btn-reset" onClick={handleSkipExtraMove}>Salta movimento extra</button>
            </div>
          )}

          {gameState.pendingRabbitChain && !isBotTurn && (
            <div className="panel" style={{ textAlign: 'center' }}>
              <p>
                🐇 Catena di salti del Coniglio: continua saltando un altro nemico, oppure fermati per catturare{' '}
                {gameState.board.get(gameState.pendingRabbitChain.lastHurdle)?.sigla} in {gameState.pendingRabbitChain.lastHurdle}.
              </p>
              <button className="btn-reset" onClick={handleStopRabbitChain}>Ferma la catena e cattura</button>
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

          {pendingMimicChoice && (
            <div
              style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '1rem',
                background: 'rgba(15, 15, 20, 0.85)', borderRadius: '0.5rem',
              }}
            >
              <h2>🎭 Chi imitare?</h2>
              <div className="actions" style={{ flexDirection: 'column' }}>
                {[...pendingMimicChoice.threats]
                  .sort((a, b) => {
                    const siglaA = gameState.board.get(a)!.sigla;
                    const siglaB = gameState.board.get(b)!.sigla;
                    return getPieceDef(siglaA).punti - getPieceDef(siglaB).punti || siglaA.localeCompare(siglaB);
                  })
                  .map((threatCoord) => {
                  const threatSigla = gameState.board.get(threatCoord)?.sigla ?? '?';
                  return (
                    <button
                      key={threatCoord}
                      className="btn-save"
                      onClick={() => {
                        setOrphanMimicSource(threatCoord);
                        setPendingMimicChoice(null);
                      }}
                    >
                      {threatSigla} — {pieceDescription(threatSigla)} ({threatCoord})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {pendingSdoppiamento && (
            <div
              style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '1rem',
                background: 'rgba(15, 15, 20, 0.85)', borderRadius: '0.5rem',
              }}
            >
              <h2>🌫️ Dove sta il Miraggio vero?</h2>
              <p style={{ maxWidth: 420, textAlign: 'center' }}>
                I due pezzi sono indistinguibili. L'avversario deve catturare quello vero: se cattura il clone,
                l'illusione si dissolve e il Miraggio vero sopravvive.
              </p>
              <div className="actions" style={{ flexDirection: 'column' }}>
                <button
                  className="btn-save"
                  onClick={() => commitSdoppiamento(pendingSdoppiamento.from, pendingSdoppiamento.cloneSquare, pendingSdoppiamento.from)}
                >
                  Il vero resta in {pendingSdoppiamento.from} (clone in {pendingSdoppiamento.cloneSquare})
                </button>
                <button
                  className="btn-save"
                  onClick={() => commitSdoppiamento(pendingSdoppiamento.from, pendingSdoppiamento.cloneSquare, pendingSdoppiamento.cloneSquare)}
                >
                  Il vero è in {pendingSdoppiamento.cloneSquare} (clone in {pendingSdoppiamento.from})
                </button>
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
              <h2>
                {gameState.status === 'checkmate' && `🏆 Scacco matto! Vince ${ownerLabel(gameState.winner!)}`}
                {gameState.status === 'stalemate' && '🤝 Stallo — Patta'}
                {gameState.status === 'anti_stalemate' && (
                  gameState.winner
                    ? `⏱️ Limite di 20 turni senza progressi — vince ${ownerLabel(gameState.winner)} per punteggio`
                    : '⏱️ Limite di 20 turni senza progressi — Patta per punteggio pari'
                )}
              </h2>
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
                    {ownerLabel(entry.owner)}: {entry.sigla} {entry.from} → {entry.to}
                    {entry.isCapture && ` (cattura ${entry.capturedSigla})`}
                    {entry.promotedTo && ` → promosso a ${entry.promotedTo}`}
                    {entry.isExtraMove && ' (movimento extra)'}
                    {entry.isRangedAttack && ' (scocca)'}
                    {entry.isSwap && ' (scambio)'}
                    {entry.isRevival && ` (rianimato ${entry.revivedSigla})`}
                    {entry.isSdoppiamento && ` (sdoppiamento: vero in ${entry.realSquare}, clone in ${entry.cloneSquare})`}
                    {entry.isMerge && ' (riunione)'}
                    {entry.isCloneCapture && ' (clone eliminato — nessun punto)'}
                    {entry.dispelledClone && ' (clone dissolto)'}
                    {entry.areaDamageCoords && entry.areaDamageCoords.length > 0 && ` 💥 area: ${entry.areaDamageCoords.join(', ')}`}
                  </li>
                ))}
              </ol>
            )}
          </div>

          <h2>💀 Pezzi catturati</h2>
          <p><strong>{ownerLabel('A')}:</strong> {sortSiglasByPunti(gameState.captured.A.map((p) => p.sigla)).join(', ') || '—'}</p>
          <p><strong>{ownerLabel('B')}:</strong> {sortSiglasByPunti(gameState.captured.B.map((p) => p.sigla)).join(', ') || '—'}</p>
        </div>
      </div>
    </div>
  );
}

export default GameScreen;
