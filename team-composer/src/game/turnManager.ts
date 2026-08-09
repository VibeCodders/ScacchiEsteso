import { createPieceInstance, coordToFileRank, fileRankToCoord, getPieceAt, removePieceAt, setPieceAt, swapPieces, type BoardState, type Coord, type Owner, type PieceInstance } from './board';
import { applyMove, getPieceDef, type GeneratedMove } from './moveEngine';
import { getLegalMoves, isCheckmate, isKingInCheck, isStalemate } from './check';
import { getPromotionOptions, isPromotionMove } from './promotion';
import { canUseScocca, getScoccaTargets } from './scocca';
import { canSwap, getSwapTargets } from './swap';
import { canRevive, getRevivalSquares, getRevivableSiglas } from './necromancy';
import { getAreaDamageVictims, triggersAreaDamage } from './areaDamage';
import { canMimic, getMimicMoves, getOrphanThreats } from './orphan';
import { ANTI_STALEMATE_TURN_LIMIT, resolveAntiStalemateWinner } from './antiStalemate';

export type GameStatus = 'ongoing' | 'check' | 'checkmate' | 'stalemate' | 'anti_stalemate';

export interface HistoryEntry {
  turnNumber: number;
  owner: Owner;
  from: Coord;
  to: Coord;
  sigla: string;
  isCapture: boolean;
  capturedCoord?: Coord;
  capturedSigla?: string;
  /** Set when this move promoted the piece (e.g. PE → AL, or DA → DM). */
  promotedTo?: string;
  /** True for a Berserker's bonus non-capturing move after a melee capture (README §4.2). */
  isExtraMove?: boolean;
  /** True for an Arciere's "scocca" — a ranged elimination that doesn't move the attacker. */
  isRangedAttack?: boolean;
  /** True for a Mistico's "scambio di posizione" with an adjacent ally. */
  isSwap?: boolean;
  /** True for a Necromante's "rianimazione" of a fallen ally onto an adjacent empty square. */
  isRevival?: boolean;
  /** Sigla of the piece revived from the graveyard, when `isRevival` is true. */
  revivedSigla?: string;
  /** Squares destroyed by a Colosso's "danno ad area" triggered by this capture, if any. */
  areaDamageCoords?: Coord[];
}

export interface GameState {
  board: BoardState;
  /** Whose turn it is to move now. */
  turn: Owner;
  /** 1-based count of turns completed so far, plus the one currently in progress. */
  turnNumber: number;
  history: HistoryEntry[];
  /** Pieces removed from the board, keyed by the owner they belonged to (i.e. that owner's losses). */
  captured: Record<Owner, PieceInstance[]>;
  status: GameStatus;
  /** Set once `status` becomes 'checkmate'. */
  winner?: Owner;
  /**
   * README §6 — the square a pawn skipped over on a double first move, capturable en passant by
   * an adjacent enemy pawn on the very next move only. Cleared after every move unless that move
   * itself is a fresh double step.
   */
  enPassantTarget: Coord | null;
  /**
   * README §4.2 — set right after a Berserker's melee capture: that same piece (now at this
   * square) may make one more non-capturing move before the turn actually passes. `applyTurn`
   * only accepts moves from this square while it's set; `skipExtraMove` declines it.
   */
  pendingExtraMove: Coord | null;
  /**
   * README §8.1 — consecutive turns (plies) with no capture and no pawn-category move. Resets to
   * 0 on any capture, any "pedone"-category piece move, a Mistico swap, or a Necromante revival
   * (per the user's clarification: any board-changing special action counts as progress, not just
   * literal captures/pawn-pushes). Reaching `ANTI_STALEMATE_TURN_LIMIT` ends the game.
   */
  turnsSinceProgress: number;
}

export type ApplyTurnResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: string };

function computeStatus(board: BoardState, playerToMove: Owner, turnsSinceProgress: number): GameStatus {
  if (isCheckmate(board, playerToMove)) return 'checkmate';
  if (isStalemate(board, playerToMove)) return 'stalemate';
  if (turnsSinceProgress >= ANTI_STALEMATE_TURN_LIMIT) return 'anti_stalemate';
  if (isKingInCheck(board, playerToMove)) return 'check';
  return 'ongoing';
}

function resolveWinner(status: GameStatus, board: BoardState, actingOwner: Owner): Owner | undefined {
  if (status === 'checkmate') return actingOwner;
  if (status === 'anti_stalemate') return resolveAntiStalemateWinner(board);
  return undefined;
}

/** README §8.1 — does this history entry count as "progress" (resets the anti-stalemate counter)? */
function isProgressEntry(entry: HistoryEntry): boolean {
  if (entry.isCapture) return true;
  if (entry.isSwap) return true;
  if (entry.isRevival) return true;
  return getPieceDef(entry.sigla).categoria === 'pedone';
}

export function createInitialGameState(board: BoardState, firstTurn: Owner = 'A'): GameState {
  return {
    board,
    turn: firstTurn,
    turnNumber: 1,
    history: [],
    captured: { A: [], B: [] },
    status: computeStatus(board, firstTurn, 0),
    enPassantTarget: null,
    pendingExtraMove: null,
    turnsSinceProgress: 0,
  };
}

const GAME_OVER_STATUSES: ReadonlySet<GameStatus> = new Set(['checkmate', 'stalemate', 'anti_stalemate']);

/** README §6 — en passant is only between Pedoni (PE), not the checkers-style Pedone di Dama. */
const EN_PASSANT_SIGLA = 'PE';

function computeEnPassantCapture(board: BoardState, from: Coord, piece: PieceInstance, enPassantTarget: Coord): GeneratedMove | null {
  if (piece.sigla !== EN_PASSANT_SIGLA) return null;
  if (getPieceAt(board, enPassantTarget)) return null; // destination must be empty

  const { file: fromFile, rank: fromRank } = coordToFileRank(from);
  const { file: targetFile, rank: targetRank } = coordToFileRank(enPassantTarget);
  const forwardDelta = piece.owner === 'A' ? 1 : -1;
  if (targetRank !== fromRank + forwardDelta || Math.abs(targetFile - fromFile) !== 1) return null;

  const capturedCoord = fileRankToCoord(targetFile, fromRank);
  if (!capturedCoord) return null;
  const capturedPiece = getPieceAt(board, capturedCoord);
  if (!capturedPiece || capturedPiece.sigla !== EN_PASSANT_SIGLA || capturedPiece.owner === piece.owner) return null;

  return { from, to: enPassantTarget, isCapture: true, capturedCoord, captureMode: 'melee', movementType: 'step' };
}

/**
 * Legal moves for the piece at `from`, including the en passant capture when currently available.
 * If the piece is an Orfano currently threatened (README: "ha tutti i poteri di chi lo tiene in
 * scacco"), its move set instead comes entirely from mimicking `orphanMimicSource` — one of the
 * pieces returned by `getOrphanThreats` — chosen by the player when there's more than one threat.
 * Passing no (or an invalid) mimic source while threatened yields no moves, forcing the caller to
 * collect a choice first (mirroring the promotion-dialog pattern).
 */
export function getLegalMovesForTurn(state: GameState, from: Coord, orphanMimicSource?: Coord): GeneratedMove[] {
  const piece = getPieceAt(state.board, from);
  if (!piece) return [];

  if (canMimic(getPieceDef(piece.sigla))) {
    const threats = getOrphanThreats(state.board, from, piece.owner);
    if (threats.length > 0) {
      if (!orphanMimicSource || !threats.includes(orphanMimicSource)) return [];
      return getMimicMoves(state.board, from, orphanMimicSource).filter((move) => {
        const resultingBoard = applyMove(state.board, move);
        return !isKingInCheck(resultingBoard, piece.owner);
      });
    }
  }

  const baseMoves = getLegalMoves(state.board, from);
  if (!state.enPassantTarget) return baseMoves;

  const enPassantMove = computeEnPassantCapture(state.board, from, piece, state.enPassantTarget);
  if (!enPassantMove) return baseMoves;

  const resultingBoard = applyMove(state.board, enPassantMove);
  if (isKingInCheck(resultingBoard, piece.owner)) return baseMoves;

  return [...baseMoves, enPassantMove];
}

function computeEnPassantTargetAfter(piece: PieceInstance, move: GeneratedMove): Coord | null {
  if (piece.sigla !== EN_PASSANT_SIGLA || move.isCapture) return null;
  const { file: fromFile, rank: fromRank } = coordToFileRank(move.from);
  const { rank: toRank } = coordToFileRank(move.to);
  if (Math.abs(toRank - fromRank) !== 2) return null;
  return fileRankToCoord(fromFile, (fromRank + toRank) / 2);
}

interface MoveOutcome {
  nextBoard: BoardState;
  nextCaptured: Record<Owner, PieceInstance[]>;
  historyEntry: HistoryEntry;
}

function resolveMove(state: GameState, piece: PieceInstance, move: GeneratedMove, promotionChoice: string | undefined, isExtraMove: boolean): MoveOutcome {
  const capturedPiece = move.capturedCoord ? getPieceAt(state.board, move.capturedCoord) : undefined;
  let nextBoard = applyMove(state.board, move);

  if (promotionChoice) {
    nextBoard = setPieceAt(nextBoard, move.to, createPieceInstance(promotionChoice, piece.owner));
  }

  const nextCaptured: Record<Owner, PieceInstance[]> = { A: state.captured.A, B: state.captured.B };
  if (capturedPiece) {
    nextCaptured[capturedPiece.owner] = [...nextCaptured[capturedPiece.owner], capturedPiece];
  }

  let areaDamageCoords: Coord[] | undefined;
  const pieceDef = getPieceDef(piece.sigla);
  if (triggersAreaDamage(pieceDef, move)) {
    const victims = getAreaDamageVictims(nextBoard, move.to);
    if (victims.length > 0) {
      areaDamageCoords = victims;
      for (const coord of victims) {
        const victim = getPieceAt(nextBoard, coord)!;
        nextBoard = removePieceAt(nextBoard, coord);
        nextCaptured[victim.owner] = [...nextCaptured[victim.owner], victim];
      }
    }
  }

  const historyEntry: HistoryEntry = {
    turnNumber: state.turnNumber,
    owner: piece.owner,
    from: move.from,
    to: move.to,
    sigla: piece.sigla,
    isCapture: move.isCapture,
    capturedCoord: move.capturedCoord,
    capturedSigla: capturedPiece?.sigla,
    promotedTo: promotionChoice,
    isExtraMove: isExtraMove || undefined,
    areaDamageCoords,
  };

  return { nextBoard, nextCaptured, historyEntry };
}

/**
 * Finalizes the turn: flips whose move it is, advances the turn counter, computes status for the
 * opponent. `forcedProgress` is true when a capture already happened earlier in this compound
 * turn (a Berserker's bonus-move resolution) — the anti-stalemate counter resets regardless of
 * what the final action of the turn was.
 */
function finalizeTurn(state: GameState, piece: PieceInstance, move: GeneratedMove, outcome: MoveOutcome, forcedProgress: boolean): GameState {
  const nextTurn: Owner = piece.owner === 'A' ? 'B' : 'A';
  const turnsSinceProgress = forcedProgress || isProgressEntry(outcome.historyEntry) ? 0 : state.turnsSinceProgress + 1;
  const status = computeStatus(outcome.nextBoard, nextTurn, turnsSinceProgress);

  return {
    board: outcome.nextBoard,
    turn: nextTurn,
    turnNumber: state.turnNumber + 1,
    history: [...state.history, outcome.historyEntry],
    captured: outcome.nextCaptured,
    status,
    winner: resolveWinner(status, outcome.nextBoard, piece.owner),
    enPassantTarget: computeEnPassantTargetAfter(piece, move),
    pendingExtraMove: null,
    turnsSinceProgress,
  };
}

/** README §4.2 — the acting player keeps the move (turn doesn't pass yet); the Berserker owes a bonus move. */
function enterExtraMovePhase(state: GameState, piece: PieceInstance, outcome: MoveOutcome): GameState {
  return {
    board: outcome.nextBoard,
    turn: piece.owner,
    turnNumber: state.turnNumber,
    history: [...state.history, outcome.historyEntry],
    captured: outcome.nextCaptured,
    status: computeStatus(outcome.nextBoard, piece.owner, state.turnsSinceProgress),
    winner: undefined,
    enPassantTarget: null,
    pendingExtraMove: outcome.historyEntry.to,
    turnsSinceProgress: state.turnsSinceProgress, // the turn isn't finalized yet — resolved once the bonus move (or a skip) completes it
  };
}

function triggersExtraMove(pieceDef: ReturnType<typeof getPieceDef>, move: GeneratedMove): boolean {
  return Boolean(pieceDef.secondoMovimentoPostCattura) && move.isCapture && move.captureMode === 'melee';
}

/**
 * Attempts to play one move as the current player's action for the turn (README §4.1 — normally
 * a single movement/capture; the Berserker's bonus move after a melee capture, README §4.2, is
 * the one built-in exception, tracked via `pendingExtraMove`). Rejects moves from the wrong
 * player, illegal moves, and any move once the game has already ended. If the move promotes the
 * piece, `promotionChoice` (one of the piece's `promotionTypes`) is required — omitting it when
 * promotion applies returns a rejection asking the caller to collect a choice and retry.
 * `orphanMimicSource` selects which threatening piece an Orfano imitates when under threat (see
 * `getLegalMovesForTurn`) — required in that situation, ignored otherwise.
 */
export function applyTurn(state: GameState, from: Coord, to: Coord, promotionChoice?: string, orphanMimicSource?: Coord): ApplyTurnResult {
  if (GAME_OVER_STATUSES.has(state.status)) {
    return { ok: false, reason: 'La partita è terminata.' };
  }

  const piece = getPieceAt(state.board, from);
  if (!piece) {
    return { ok: false, reason: `Nessun pezzo in ${from}.` };
  }
  if (piece.owner !== state.turn) {
    return { ok: false, reason: 'Non è il turno di questo giocatore.' };
  }

  if (state.pendingExtraMove) {
    if (from !== state.pendingExtraMove) {
      return { ok: false, reason: 'Devi prima completare (o saltare) il movimento extra del Berserker.' };
    }
    const move = getLegalMovesForTurn(state, from).find((m) => m.to === to);
    if (!move) {
      return { ok: false, reason: `Mossa non legale: ${from} → ${to}.` };
    }
    if (move.isCapture) {
      return { ok: false, reason: 'Il movimento extra del Berserker non può includere una cattura.' };
    }
    const outcome = resolveMove(state, piece, move, undefined, true);
    // forcedProgress: true — reaching pendingExtraMove already required a capture earlier this turn.
    return { ok: true, state: finalizeTurn(state, piece, move, outcome, true) };
  }

  const move = getLegalMovesForTurn(state, from, orphanMimicSource).find((m) => m.to === to);
  if (!move) {
    return { ok: false, reason: `Mossa non legale: ${from} → ${to}.` };
  }

  const pieceDef = getPieceDef(piece.sigla);
  if (isPromotionMove(pieceDef, piece.owner, to)) {
    const options = getPromotionOptions(pieceDef);
    if (!promotionChoice) {
      return { ok: false, reason: 'Scegli il pezzo di promozione.' };
    }
    if (!options.includes(promotionChoice)) {
      return { ok: false, reason: `Opzione di promozione non valida: ${promotionChoice}.` };
    }
    const outcome = resolveMove(state, piece, move, promotionChoice, false);
    return { ok: true, state: finalizeTurn(state, piece, move, outcome, false) };
  }

  const outcome = resolveMove(state, piece, move, undefined, false);
  if (triggersExtraMove(pieceDef, move)) {
    return { ok: true, state: enterExtraMovePhase(state, piece, outcome) };
  }
  return { ok: true, state: finalizeTurn(state, piece, move, outcome, false) };
}

/** Declines a pending Berserker bonus move (README §4.2 makes it available, not mandatory), passing the turn. */
export function skipExtraMove(state: GameState): ApplyTurnResult {
  if (!state.pendingExtraMove) {
    return { ok: false, reason: 'Nessun movimento extra da saltare.' };
  }

  const nextTurn: Owner = state.turn === 'A' ? 'B' : 'A';
  // forcedProgress: the capture that opened this bonus phase already counts as progress this turn.
  const turnsSinceProgress = 0;
  const status = computeStatus(state.board, nextTurn, turnsSinceProgress);

  return {
    ok: true,
    state: {
      ...state,
      turn: nextTurn,
      turnNumber: state.turnNumber + 1,
      status,
      winner: resolveWinner(status, state.board, state.turn),
      pendingExtraMove: null,
      turnsSinceProgress,
    },
  };
}

/**
 * Plays an Arciere's "scocca" as the turn's action: eliminates an enemy 3-4 squares away with a
 * clear trajectory, without moving the Arciere itself (README, Arciere's alternativeActions —
 * an alternative to a normal move, not something that can be combined with one). Like any action,
 * it's rejected if it would leave the acting player's own King in check (README §3.2).
 */
export function applyScocca(state: GameState, from: Coord, target: Coord): ApplyTurnResult {
  if (GAME_OVER_STATUSES.has(state.status)) {
    return { ok: false, reason: 'La partita è terminata.' };
  }
  if (state.pendingExtraMove) {
    return { ok: false, reason: 'Devi prima completare (o saltare) il movimento extra del Berserker.' };
  }

  const piece = getPieceAt(state.board, from);
  if (!piece) {
    return { ok: false, reason: `Nessun pezzo in ${from}.` };
  }
  if (piece.owner !== state.turn) {
    return { ok: false, reason: 'Non è il turno di questo giocatore.' };
  }

  const pieceDef = getPieceDef(piece.sigla);
  if (!canUseScocca(pieceDef)) {
    return { ok: false, reason: 'Questo pezzo non può scoccare.' };
  }

  const targets = getScoccaTargets(state.board, from, piece.owner);
  if (!targets.includes(target)) {
    return { ok: false, reason: `Bersaglio non valido per lo scoccare: ${target}.` };
  }

  const targetPiece = getPieceAt(state.board, target)!;
  const nextBoard = removePieceAt(state.board, target);

  if (isKingInCheck(nextBoard, piece.owner)) {
    return { ok: false, reason: 'Questa azione lascerebbe il tuo Re sotto scacco.' };
  }

  const nextTurn: Owner = piece.owner === 'A' ? 'B' : 'A';
  const turnsSinceProgress = 0; // a capture — always progress
  const status = computeStatus(nextBoard, nextTurn, turnsSinceProgress);

  const historyEntry: HistoryEntry = {
    turnNumber: state.turnNumber,
    owner: piece.owner,
    from,
    to: from, // scocca never moves the attacker
    sigla: piece.sigla,
    isCapture: true,
    capturedCoord: target,
    capturedSigla: targetPiece.sigla,
    isRangedAttack: true,
  };

  const nextCaptured: Record<Owner, PieceInstance[]> = { A: state.captured.A, B: state.captured.B };
  nextCaptured[targetPiece.owner] = [...nextCaptured[targetPiece.owner], targetPiece];

  return {
    ok: true,
    state: {
      board: nextBoard,
      turn: nextTurn,
      turnNumber: state.turnNumber + 1,
      history: [...state.history, historyEntry],
      captured: nextCaptured,
      status,
      winner: resolveWinner(status, nextBoard, piece.owner),
      enPassantTarget: null,
      pendingExtraMove: null,
      turnsSinceProgress,
    },
  };
}

/**
 * Plays a Mistico's "scambio di posizione" as the turn's action: instantly swaps places with an
 * adjacent ally (never the King), as an alternative to a normal move. Like any action, it's
 * rejected if it would leave the acting player's own King in check (README §3.2).
 */
export function applySwap(state: GameState, from: Coord, target: Coord): ApplyTurnResult {
  if (GAME_OVER_STATUSES.has(state.status)) {
    return { ok: false, reason: 'La partita è terminata.' };
  }
  if (state.pendingExtraMove) {
    return { ok: false, reason: 'Devi prima completare (o saltare) il movimento extra del Berserker.' };
  }

  const piece = getPieceAt(state.board, from);
  if (!piece) {
    return { ok: false, reason: `Nessun pezzo in ${from}.` };
  }
  if (piece.owner !== state.turn) {
    return { ok: false, reason: 'Non è il turno di questo giocatore.' };
  }

  const pieceDef = getPieceDef(piece.sigla);
  if (!canSwap(pieceDef)) {
    return { ok: false, reason: 'Questo pezzo non può scambiare posizione.' };
  }

  const targets = getSwapTargets(state.board, from, piece.owner);
  if (!targets.includes(target)) {
    return { ok: false, reason: `Scambio non valido con: ${target}.` };
  }

  const nextBoard = swapPieces(state.board, from, target);

  if (isKingInCheck(nextBoard, piece.owner)) {
    return { ok: false, reason: 'Questa azione lascerebbe il tuo Re sotto scacco.' };
  }

  const nextTurn: Owner = piece.owner === 'A' ? 'B' : 'A';
  const turnsSinceProgress = 0; // a swap — always progress, per the user's clarification
  const status = computeStatus(nextBoard, nextTurn, turnsSinceProgress);

  const historyEntry: HistoryEntry = {
    turnNumber: state.turnNumber,
    owner: piece.owner,
    from,
    to: target,
    sigla: piece.sigla,
    isCapture: false,
    isSwap: true,
  };

  return {
    ok: true,
    state: {
      board: nextBoard,
      turn: nextTurn,
      turnNumber: state.turnNumber + 1,
      history: [...state.history, historyEntry],
      captured: state.captured,
      status,
      winner: resolveWinner(status, nextBoard, piece.owner),
      enPassantTarget: null,
      pendingExtraMove: null,
      turnsSinceProgress,
    },
  };
}

/**
 * Plays a Necromante's "rianimazione" as the turn's action: revives a fallen ally of "pedone"
 * category (PE, PG, or FG — the whole category, per the user's clarification, not just PE) from
 * the graveyard onto an adjacent empty square, as an alternative to a normal move. Like any
 * action, it's rejected if it would leave the acting player's own King in check (README §3.2).
 */
export function applyRevive(state: GameState, from: Coord, target: Coord, sigla: string): ApplyTurnResult {
  if (GAME_OVER_STATUSES.has(state.status)) {
    return { ok: false, reason: 'La partita è terminata.' };
  }
  if (state.pendingExtraMove) {
    return { ok: false, reason: 'Devi prima completare (o saltare) il movimento extra del Berserker.' };
  }

  const piece = getPieceAt(state.board, from);
  if (!piece) {
    return { ok: false, reason: `Nessun pezzo in ${from}.` };
  }
  if (piece.owner !== state.turn) {
    return { ok: false, reason: 'Non è il turno di questo giocatore.' };
  }

  const pieceDef = getPieceDef(piece.sigla);
  if (!canRevive(pieceDef)) {
    return { ok: false, reason: 'Questo pezzo non può rianimare alleati.' };
  }

  const revivalSquares = getRevivalSquares(state.board, from, piece.owner);
  if (!revivalSquares.includes(target)) {
    return { ok: false, reason: `Casella non valida per la rianimazione: ${target}.` };
  }

  const graveyard = state.captured[piece.owner];
  const revivableSiglas = getRevivableSiglas(graveyard);
  if (!revivableSiglas.includes(sigla)) {
    return { ok: false, reason: `Nessun pezzo "${sigla}" disponibile nel cimitero.` };
  }

  const indexToRevive = graveyard.findIndex((p) => p.sigla === sigla);
  const nextGraveyard = [...graveyard.slice(0, indexToRevive), ...graveyard.slice(indexToRevive + 1)];
  const nextCaptured: Record<Owner, PieceInstance[]> = { ...state.captured, [piece.owner]: nextGraveyard };

  const nextBoard = setPieceAt(state.board, target, createPieceInstance(sigla, piece.owner));

  if (isKingInCheck(nextBoard, piece.owner)) {
    return { ok: false, reason: 'Questa azione lascerebbe il tuo Re sotto scacco.' };
  }

  const nextTurn: Owner = piece.owner === 'A' ? 'B' : 'A';
  const turnsSinceProgress = 0; // a revival — always progress, per the user's clarification
  const status = computeStatus(nextBoard, nextTurn, turnsSinceProgress);

  const historyEntry: HistoryEntry = {
    turnNumber: state.turnNumber,
    owner: piece.owner,
    from,
    to: target,
    sigla: piece.sigla,
    isCapture: false,
    isRevival: true,
    revivedSigla: sigla,
  };

  return {
    ok: true,
    state: {
      board: nextBoard,
      turn: nextTurn,
      turnNumber: state.turnNumber + 1,
      history: [...state.history, historyEntry],
      captured: nextCaptured,
      status,
      winner: resolveWinner(status, nextBoard, piece.owner),
      enPassantTarget: null,
      pendingExtraMove: null,
      turnsSinceProgress,
    },
  };
}
