import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { playerLabel, useGameSetup } from '../context/gameSetup';
import Board from '../components/Board';
import PieceIcon from '../assets/pieces/pieceIcons';
import { getPieceDef } from '../game/moveEngine';
import { getPromotionOptions, isPromotionMove } from '../game/promotion';
import { canUseScocca, getScoccaTargets } from '../game/scocca';
import { canRepulse, getRepulseTargets } from '../game/repulse';
import { canSwap, getSwapTargets } from '../game/swap';
import { canSwapperSwap, getSwapperCandidateSquares } from '../game/swapper';
import { canRevive, getRevivalSquares, getRevivableSiglas } from '../game/necromancy';
import { canMimic, getOrphanThreats } from '../game/orphan';
import { canSdoppiare, canRiunire, getSdoppiamentoSquares, getRiunioneSquares, isRealMirage } from '../game/mirage';
import { createInitialGameState, applyTurn, applyScocca, applyRepulse, applySwap, applySwapperSwap, applyRevive, applySdoppiamento, applyRiunione, getLegalMovesForTurn, skipExtraMove, stopRabbitChain, type GameState } from '../game/turnManager';
import { chooseBotAction, applyBotAction, formatMovesAhead, BOT_DIFFICULTY_MAX } from '../game/bot';
import { sortSiglasByPunti } from '../data/pieces';
import type { Coord, Owner } from '../game/board';
import { pieceDescription } from '../lib/pieceFormat';
import { cn } from '../lib/cn';
import { useShowNames } from '../lib/useShowNames';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import PageShell from '../components/ui/PageShell';
import Panel from '../components/ui/Panel';
import PieceDetail from '../components/ui/PieceDetail';

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
  const [actionMode, setActionMode] = useState<'scocca' | 'repulse' | 'swap' | 'revive' | 'swapperSwap' | 'sdoppiamento' | 'riunione' | null>(null);
  const [swapperFirstSquare, setSwapperFirstSquare] = useState<Coord | null>(null);
  const [pendingSdoppiamento, setPendingSdoppiamento] = useState<PendingSdoppiamento | null>(null);
  const [revealRealMirage, setRevealRealMirage] = useState(false);
  const [infoSigla, setInfoSigla] = useState<string | null>(null);
  const { showNames, namesToggled, setNamesToggled, namesKeyHeld } = useShowNames();

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
    if (actionMode === 'repulse') {
      return mover ? getRepulseTargets(gameState.board, effectiveSelected, mover.owner) : [];
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

  /** Distinct piece siglas currently on the board, with their on-board count, per owner — the
   *  "Pezzi in gioco" sidebar list (per-type, so the info button shows how the piece moves). */
  const boardPiecesByOwner = useMemo(() => {
    const byOwner: Record<Owner, Map<string, number>> = { A: new Map(), B: new Map() };
    if (!gameState) return byOwner;
    for (const [, piece] of gameState.board) {
      const counts = byOwner[piece.owner];
      counts.set(piece.sigla, (counts.get(piece.sigla) ?? 0) + 1);
    }
    return byOwner;
  }, [gameState]);

  /** Distinct piece siglas of each owner that have been captured (no longer on the board), with
   *  their captured count — the "captured" half of the "Pezzi in gioco" sidebar list. Miraggio
   *  clones never reach `captured` (they leave the board but assign no punti), so this is exact. */
  const capturedPiecesByOwner = useMemo(() => {
    const byOwner: Record<Owner, Map<string, number>> = { A: new Map(), B: new Map() };
    if (!gameState) return byOwner;
    for (const piece of gameState.captured.A) {
      const counts = byOwner.A;
      counts.set(piece.sigla, (counts.get(piece.sigla) ?? 0) + 1);
    }
    for (const piece of gameState.captured.B) {
      const counts = byOwner.B;
      counts.set(piece.sigla, (counts.get(piece.sigla) ?? 0) + 1);
    }
    return byOwner;
  }, [gameState]);

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
      <PageShell title="♟️ Partita" layout="center">
        <Panel className="w-full max-w-[480px] text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">Nessuno schieramento trovato. Torna alla Home per iniziare una nuova partita.</p>
          <Button variant="primary" className="mt-4" onClick={() => navigate('/')}>Torna alla Home</Button>
        </Panel>
      </PageShell>
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

  const commitRepulse = (from: Coord, target: Coord) => {
    const result = applyRepulse(gameState, from, target);
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
        else if (actionMode === 'repulse') commitRepulse(selected, coord);
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

  const selectedPiece = selected ? gameState.board.get(selected) : undefined;

  return (
    <PageShell
      title="♟️ Partita"
      subtitle={`Modalità: ${mode === 'pvc' ? 'PvC' : 'PvP locale'}`}
      layout="board"
      actions={
        <>
          {mode === 'pvc' && (
            <Badge tone="info" title="Livello di difficoltà del PC (1–50)">
              🤖 PC: difficoltà {botDifficulty}/{BOT_DIFFICULTY_MAX} — vede {formatMovesAhead(botDifficulty)} avanti
            </Badge>
          )}
          <Badge className={cn('turn-badge-human', isBotTurn && 'turn-badge-bot border-amber-300 dark:border-amber-800 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400')}>
            Turno: {ownerLabel(gameState.turn)}
          </Badge>
          {gameState.status === 'check' && (
            <span className="animate-pulse rounded-lg border border-red-300 dark:border-red-800 bg-red-100 dark:bg-red-950/60 px-4 py-2 text-sm font-bold text-red-600 dark:text-red-400">
              ⚠️ Scacco!
            </span>
          )}
          {isBotTurn && (
            <span className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-100 dark:bg-amber-950/60 px-4 py-2 text-sm font-bold text-amber-600 dark:text-amber-400">
              🤖 Il PC sta pensando...
            </span>
          )}
        </>
      }
    >
      <Panel className="relative flex flex-col items-center gap-4 overflow-x-auto">
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
          showNames={showNames}
        />
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="improve" onClick={() => setOrientation((o) => (o === 'A' ? 'B' : 'A'))}>
            🔄 Gira scacchiera (vista: {ownerLabel(orientation)})
          </Button>
          <Button variant="improve" onClick={() => setNamesToggled((v) => !v)}>
            {namesToggled ? '🙈 Nascondi i nomi' : '🏷 Mostra i nomi (tieni H)'}
          </Button>
          <Button variant="improve" onClick={() => setRevealRealMirage((r) => !r)}>
            {revealRealMirage ? '🙈 Nascondi Miraggi veri' : '👁 Vedi i Miraggi veri (tuo turno)'}
          </Button>
          {selected && selectedPiece && !gameState.pendingExtraMove && !gameState.pendingRabbitChain && canUseScocca(getPieceDef(selectedPiece.sigla))
            && getScoccaTargets(gameState.board, selected, selectedPiece.owner).length > 0 && (
            <Button variant="auto" onClick={() => setActionMode((m) => (m === 'scocca' ? null : 'scocca'))}>
              {actionMode === 'scocca' ? '↩️ Annulla Scoccare' : '🏹 Scoccare'}
            </Button>
          )}
          {selected && selectedPiece && !gameState.pendingExtraMove && !gameState.pendingRabbitChain && canRepulse(getPieceDef(selectedPiece.sigla))
            && getRepulseTargets(gameState.board, selected, selectedPiece.owner).length > 0 && (
            <Button variant="auto" onClick={() => setActionMode((m) => (m === 'repulse' ? null : 'repulse'))}>
              {actionMode === 'repulse' ? '↩️ Annulla Respingi' : '💨 Respingi'}
            </Button>
          )}
          {selected && selectedPiece && !gameState.pendingExtraMove && !gameState.pendingRabbitChain && canSwap(getPieceDef(selectedPiece.sigla))
            && getSwapTargets(gameState.board, selected, selectedPiece.owner).length > 0 && (
            <Button variant="auto" onClick={() => setActionMode((m) => (m === 'swap' ? null : 'swap'))}>
              {actionMode === 'swap' ? '↩️ Annulla Scambio' : '🔀 Scambia posizione'}
            </Button>
          )}
          {selected && selectedPiece && !gameState.pendingExtraMove && !gameState.pendingRabbitChain && canSwapperSwap(getPieceDef(selectedPiece.sigla))
            && getSwapperCandidateSquares(gameState.board, selected, selectedPiece.owner).length > 1 && (
            <Button variant="auto" onClick={() => { setActionMode((m) => (m === 'swapperSwap' ? null : 'swapperSwap')); setSwapperFirstSquare(null); }}>
              {actionMode === 'swapperSwap' ? '↩️ Annulla Scambio' : '🔁 Scambia due alleati'}
            </Button>
          )}
          {selected && selectedPiece && !gameState.pendingExtraMove && !gameState.pendingRabbitChain && canRevive(getPieceDef(selectedPiece.sigla))
            && getRevivableSiglas(gameState.captured[selectedPiece.owner]).length > 0
            && getRevivalSquares(gameState.board, selected, selectedPiece.owner).length > 0 && (
            <Button variant="auto" onClick={() => setActionMode((m) => (m === 'revive' ? null : 'revive'))}>
              {actionMode === 'revive' ? '↩️ Annulla Rianimazione' : '🧟 Rianima alleato'}
            </Button>
          )}
          {selected && selectedPiece && !gameState.pendingExtraMove && !gameState.pendingRabbitChain && canSdoppiare(getPieceDef(selectedPiece.sigla))
            && getSdoppiamentoSquares(gameState.board, selected, selectedPiece.owner, getPieceDef, gameState.dimensions).length > 0 && (
            <Button variant="auto" onClick={() => setActionMode((m) => (m === 'sdoppiamento' ? null : 'sdoppiamento'))}>
              {actionMode === 'sdoppiamento' ? '↩️ Annulla Sdoppiamento' : '🌫️ Sdoppia'}
            </Button>
          )}
          {selected && selectedPiece && !gameState.pendingExtraMove && !gameState.pendingRabbitChain && canRiunire(getPieceDef(selectedPiece.sigla))
            && getRiunioneSquares(gameState.board, selected, selectedPiece.owner, getPieceDef, gameState.dimensions).length > 0 && (
            <Button variant="auto" onClick={() => setActionMode((m) => (m === 'riunione' ? null : 'riunione'))}>
              {actionMode === 'riunione' ? '↩️ Annulla Riunione' : '🔗 Riunisci'}
            </Button>
          )}
        </div>
        {showNames && <p className="text-sm text-slate-600 dark:text-slate-400">🏷 Nomi visibili {namesKeyHeld ? '(H premuto)' : '(toggle attivo)'}.</p>}
        {actionMode === 'scocca' && <p className="text-sm text-slate-600 dark:text-slate-400">🏹 Modalità Scoccare: seleziona un bersaglio nemico a 3-4 caselle.</p>}
        {actionMode === 'repulse' && <p className="text-sm text-slate-600 dark:text-slate-400">💨 Modalità Respingi: seleziona un nemico adiacente da spingere via di una casella (la casella dietro deve essere libera).</p>}
        {actionMode === 'swap' && <p className="text-sm text-slate-600 dark:text-slate-400">🔀 Modalità Scambio: seleziona un alleato in linea di vista libera (riga, colonna o diagonale).</p>}
        {actionMode === 'revive' && <p className="text-sm text-slate-600 dark:text-slate-400">🧟 Modalità Rianimazione: seleziona una casella vuota adiacente.</p>}
        {actionMode === 'swapperSwap' && !swapperFirstSquare && <p className="text-sm text-slate-600 dark:text-slate-400">🔁 Scambio: seleziona la prima casella (un alleato adiacente, o lo Swapper stesso).</p>}
        {actionMode === 'swapperSwap' && swapperFirstSquare && <p className="text-sm text-slate-600 dark:text-slate-400">🔁 Scambio: seleziona la seconda casella da scambiare con {swapperFirstSquare}.</p>}
        {actionMode === 'sdoppiamento' && <p className="text-sm text-slate-600 dark:text-slate-400">🌫️ Modalità Sdoppiamento: scegli una casella vuota adiacente dove materializzare il clone.</p>}
        {actionMode === 'riunione' && <p className="text-sm text-slate-600 dark:text-slate-400">🔗 Modalità Riunione: scegli la casella (quella del vero o quella del clone) dove ricompare il Miraggio unico.</p>}
        {revealRealMirage && <p className="text-sm text-slate-600 dark:text-slate-400">👁 I Miraggi veri del giocatore di turno sono contrassegnati da un punto giallo.</p>}
        {orphanMimicSource && (
          <p className="text-sm text-slate-600 dark:text-slate-400">🎭 L'Orfano è sotto scacco: imita {gameState.board.get(orphanMimicSource)?.sigla} da {orphanMimicSource}.</p>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {gameState.pendingExtraMove && !pendingPromotion && !isBotTurn && (
          <Panel className="w-full text-center">
            <p className="text-sm text-slate-700 dark:text-slate-300">⚔️ Movimento extra Berserker disponibile (senza cattura).</p>
            <Button variant="secondary" className="mt-3" onClick={handleSkipExtraMove}>Salta movimento extra</Button>
          </Panel>
        )}

        {gameState.pendingRabbitChain && !isBotTurn && (
          <Panel className="w-full text-center">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              🐇 Catena di salti del Coniglio: continua saltando un altro nemico, oppure fermati per catturare{' '}
              {gameState.board.get(gameState.pendingRabbitChain.lastHurdle)?.sigla} in {gameState.pendingRabbitChain.lastHurdle}.
            </p>
            <Button variant="secondary" className="mt-3" onClick={handleStopRabbitChain}>Ferma la catena e cattura</Button>
          </Panel>
        )}

        {pendingPromotion && (
          <Modal title="🎖️ Scegli la promozione" onClose={() => setPendingPromotion(null)}>
            {pendingPromotion.options.map((sigla) => (
              <Button
                key={sigla}
                variant="primary"
                onClick={() => commitPlainMove(pendingPromotion.from, pendingPromotion.to, sigla)}
              >
                {sigla} — {pieceDescription(sigla)}
              </Button>
            ))}
          </Modal>
        )}

        {pendingRevival && (
          <Modal title="🧟 Chi rianimare?" onClose={() => setPendingRevival(null)}>
            {pendingRevival.options.map((sigla) => (
              <Button
                key={sigla}
                variant="primary"
                onClick={() => commitRevive(pendingRevival.from, pendingRevival.target, sigla)}
              >
                {sigla} — {pieceDescription(sigla)}
              </Button>
            ))}
          </Modal>
        )}

        {pendingMimicChoice && (
          <Modal title="🎭 Chi imitare?" onClose={() => setPendingMimicChoice(null)}>
            {[...pendingMimicChoice.threats]
              .sort((a, b) => {
                const siglaA = gameState.board.get(a)!.sigla;
                const siglaB = gameState.board.get(b)!.sigla;
                return getPieceDef(siglaA).punti - getPieceDef(siglaB).punti || siglaA.localeCompare(siglaB);
              })
              .map((threatCoord) => {
                const threatSigla = gameState.board.get(threatCoord)?.sigla ?? '?';
                return (
                  <Button
                    key={threatCoord}
                    variant="primary"
                    onClick={() => {
                      setOrphanMimicSource(threatCoord);
                      setPendingMimicChoice(null);
                    }}
                  >
                    {threatSigla} — {pieceDescription(threatSigla)} ({threatCoord})
                  </Button>
                );
              })}
          </Modal>
        )}

        {pendingSdoppiamento && (
          <Modal title="🌫️ Dove sta il Miraggio vero?" onClose={() => setPendingSdoppiamento(null)}>
            <p className="text-center text-sm text-slate-600 dark:text-slate-400">
              I due pezzi sono indistinguibili. L'avversario deve catturare quello vero: se cattura il clone,
              l'illusione si dissolve e il Miraggio vero sopravvive.
            </p>
            <Button
              variant="primary"
              onClick={() => commitSdoppiamento(pendingSdoppiamento.from, pendingSdoppiamento.cloneSquare, pendingSdoppiamento.from)}
            >
              Il vero resta in {pendingSdoppiamento.from} (clone in {pendingSdoppiamento.cloneSquare})
            </Button>
            <Button
              variant="primary"
              onClick={() => commitSdoppiamento(pendingSdoppiamento.from, pendingSdoppiamento.cloneSquare, pendingSdoppiamento.cloneSquare)}
            >
              Il vero è in {pendingSdoppiamento.cloneSquare} (clone in {pendingSdoppiamento.from})
            </Button>
          </Modal>
        )}

        {/* The end-of-match dialog is deliberately non-dismissible: the only action is seeing the result. */}
        {gameOver && (
          <Modal
            title={
              gameState.status === 'checkmate'
                ? `🏆 Scacco matto! Vince ${ownerLabel(gameState.winner!)}`
                : gameState.status === 'stalemate'
                  ? '🤝 Stallo — Patta'
                  : gameState.winner
                    ? `⏱️ Limite di 20 turni senza progressi — vince ${ownerLabel(gameState.winner)} per punteggio`
                    : '⏱️ Limite di 20 turni senza progressi — Patta per punteggio pari'
            }
          >
            <Button variant="primary" onClick={handleContinueToResult}>Vedi risultato →</Button>
          </Modal>
        )}
      </Panel>

      <Panel title="♟️ Pezzi in gioco">
        <p className="mb-2 text-xs text-slate-500">Premi "🔍 Info" per rileggere come si muove un pezzo, come nell'enciclopedia. I pezzi catturati sono segnati in grigio.</p>
        {(['A', 'B'] as const).map((owner) => {
          const onBoardSiglas = sortSiglasByPunti([...boardPiecesByOwner[owner].keys()]);
          const capturedSiglas = sortSiglasByPunti([...capturedPiecesByOwner[owner].keys()]);
          if (onBoardSiglas.length === 0 && capturedSiglas.length === 0) return null;
          return (
            <div key={owner} className="mb-3 last:mb-0">
              <h3 className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-200">{ownerLabel(owner)}</h3>
              <div className="flex flex-col gap-1">
                {onBoardSiglas.map((sigla) => {
                  const count = boardPiecesByOwner[owner].get(sigla)!;
                  const def = getPieceDef(sigla);
                  return (
                    <div key={sigla} data-piece-row={sigla} className="flex items-center justify-between gap-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="board-sidebar-piece-icon size-5 shrink-0 text-slate-700 dark:text-slate-300">
                          <PieceIcon sigla={sigla} className="size-full" />
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-50">{sigla}</span>
                        <span className="truncate text-[0.7rem] text-slate-500" title={`${def.descrizione} — ${def.punti} pt`}>
                          {def.descrizione}
                          {count > 1 && ` ×${count}`}
                        </span>
                      </div>
                      <Button variant="auto" className="shrink-0 px-2 py-0.5 text-[0.68rem]" onClick={() => setInfoSigla(sigla)}>
                        🔍 Info
                      </Button>
                    </div>
                  );
                })}
                {capturedSiglas.map((sigla) => {
                  const count = capturedPiecesByOwner[owner].get(sigla)!;
                  const def = getPieceDef(sigla);
                  return (
                    <div
                      key={`captured-${sigla}`}
                      data-captured-row={sigla}
                      className="flex items-center justify-between gap-2 rounded-md border border-dashed border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950/60 px-2 py-1 opacity-70"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="board-sidebar-piece-icon size-5 shrink-0 text-slate-400 dark:text-slate-500">
                          <PieceIcon sigla={sigla} className="size-full" />
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-400 line-through dark:text-slate-500">{sigla}</span>
                        <span className="truncate text-[0.7rem] text-slate-400 dark:text-slate-500" title={`${def.descrizione} — ${def.punti} pt`}>
                          {def.descrizione}
                          {count > 1 && ` ×${count}`}
                        </span>
                        <span className="shrink-0 rounded bg-red-100 px-1 py-0.5 text-[0.6rem] font-semibold text-red-600 dark:bg-red-950/60 dark:text-red-400">💀 catturato</span>
                      </div>
                      <Button variant="auto" className="shrink-0 px-2 py-0.5 text-[0.68rem]" onClick={() => setInfoSigla(sigla)}>
                        🔍 Info
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Panel>

      <Panel title="📜 Storico mosse">
        <div className="max-h-[200px] overflow-y-auto text-sm">
          {gameState.history.length === 0 ? (
            <p className="text-sm text-slate-500">Nessuna mossa ancora.</p>
          ) : (
            <ol className="list-inside list-decimal space-y-0.5">
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

        <h2 className="mb-2 mt-5 border-b border-slate-300 dark:border-slate-700 pb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">💀 Pezzi catturati</h2>
        <p className="text-sm"><strong>{ownerLabel('A')}:</strong> {sortSiglasByPunti(gameState.captured.A.map((p) => p.sigla)).join(', ') || '—'}</p>
        <p className="mt-1 text-sm"><strong>{ownerLabel('B')}:</strong> {sortSiglasByPunti(gameState.captured.B.map((p) => p.sigla)).join(', ') || '—'}</p>
      </Panel>

      {infoSigla && <PieceDetail piece={getPieceDef(infoSigla)} onClose={() => setInfoSigla(null)} />}
    </PageShell>
  );
}

export default GameScreen;
