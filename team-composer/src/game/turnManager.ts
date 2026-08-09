import { createPieceInstance, coordToFileRank, fileRankToCoord, getPieceAt, removePieceAt, setPieceAt, type BoardState, type Coord, type Owner, type PieceInstance } from './board';
import { applyMove, getPieceDef, type GeneratedMove } from './moveEngine';
import { getLegalMoves, isCheckmate, isKingInCheck, isStalemate } from './check';
import { getPromotionOptions, isPromotionMove } from './promotion';
import { canUseScocca, getScoccaTargets } from './scocca';

export type GameStatus = 'ongoing' | 'check' | 'checkmate' | 'stalemate';

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
}

export type ApplyTurnResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: string };

function computeStatus(board: BoardState, playerToMove: Owner): GameStatus {
  if (isCheckmate(board, playerToMove)) return 'checkmate';
  if (isStalemate(board, playerToMove)) return 'stalemate';
  if (isKingInCheck(board, playerToMove)) return 'check';
  return 'ongoing';
}

export function createInitialGameState(board: BoardState, firstTurn: Owner = 'A'): GameState {
  return {
    board,
    turn: firstTurn,
    turnNumber: 1,
    history: [],
    captured: { A: [], B: [] },
    status: computeStatus(board, firstTurn),
    enPassantTarget: null,
    pendingExtraMove: null,
  };
}

const GAME_OVER_STATUSES: ReadonlySet<GameStatus> = new Set(['checkmate', 'stalemate']);

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

/** Legal moves for the piece at `from`, including the en passant capture when currently available. */
export function getLegalMovesForTurn(state: GameState, from: Coord): GeneratedMove[] {
  const piece = getPieceAt(state.board, from);
  if (!piece) return [];
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
  };

  const nextCaptured: Record<Owner, PieceInstance[]> = { A: state.captured.A, B: state.captured.B };
  if (capturedPiece) {
    nextCaptured[capturedPiece.owner] = [...nextCaptured[capturedPiece.owner], capturedPiece];
  }

  return { nextBoard, nextCaptured, historyEntry };
}

/** Finalizes the turn: flips whose move it is, advances the turn counter, computes status for the opponent. */
function finalizeTurn(state: GameState, piece: PieceInstance, move: GeneratedMove, outcome: MoveOutcome): GameState {
  const nextTurn: Owner = piece.owner === 'A' ? 'B' : 'A';
  const status = computeStatus(outcome.nextBoard, nextTurn);

  return {
    board: outcome.nextBoard,
    turn: nextTurn,
    turnNumber: state.turnNumber + 1,
    history: [...state.history, outcome.historyEntry],
    captured: outcome.nextCaptured,
    status,
    winner: status === 'checkmate' ? piece.owner : undefined,
    enPassantTarget: computeEnPassantTargetAfter(piece, move),
    pendingExtraMove: null,
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
    status: computeStatus(outcome.nextBoard, piece.owner),
    winner: undefined,
    enPassantTarget: null,
    pendingExtraMove: outcome.historyEntry.to,
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
 */
export function applyTurn(state: GameState, from: Coord, to: Coord, promotionChoice?: string): ApplyTurnResult {
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
    return { ok: true, state: finalizeTurn(state, piece, move, outcome) };
  }

  const move = getLegalMovesForTurn(state, from).find((m) => m.to === to);
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
    return { ok: true, state: finalizeTurn(state, piece, move, outcome) };
  }

  const outcome = resolveMove(state, piece, move, undefined, false);
  if (triggersExtraMove(pieceDef, move)) {
    return { ok: true, state: enterExtraMovePhase(state, piece, outcome) };
  }
  return { ok: true, state: finalizeTurn(state, piece, move, outcome) };
}

/** Declines a pending Berserker bonus move (README §4.2 makes it available, not mandatory), passing the turn. */
export function skipExtraMove(state: GameState): ApplyTurnResult {
  if (!state.pendingExtraMove) {
    return { ok: false, reason: 'Nessun movimento extra da saltare.' };
  }

  const nextTurn: Owner = state.turn === 'A' ? 'B' : 'A';
  const status = computeStatus(state.board, nextTurn);

  return {
    ok: true,
    state: {
      ...state,
      turn: nextTurn,
      turnNumber: state.turnNumber + 1,
      status,
      winner: status === 'checkmate' ? state.turn : undefined,
      pendingExtraMove: null,
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
  const status = computeStatus(nextBoard, nextTurn);

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
      winner: status === 'checkmate' ? piece.owner : undefined,
      enPassantTarget: null,
      pendingExtraMove: null,
    },
  };
}
