import { createPieceInstance, getPieceAt, setPieceAt, type BoardState, type Coord, type Owner, type PieceInstance } from './board';
import { applyMove, coordToFileRank, fileRankToCoord, getPieceDef, type GeneratedMove } from './moveEngine';
import { getLegalMoves, isCheckmate, isKingInCheck, isStalemate } from './check';
import { getPromotionOptions, isPromotionMove } from './promotion';

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

/**
 * Attempts to play one move as the current player's single action for the turn (README §4.1 —
 * only piece movement/capture for now; special abilities arrive with `alternativeActions` in a
 * later step). Rejects moves from the wrong player, illegal moves, and any move once the game
 * has already ended. If the move promotes the piece, `promotionChoice` (one of the piece's
 * `promotionTypes`) is required — omitting it when promotion applies returns a rejection asking
 * the caller to collect a choice (e.g. via a UI dialog) and retry.
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
    return { ok: true, state: commitMove(state, piece, move, promotionChoice) };
  }

  return { ok: true, state: commitMove(state, piece, move) };
}

function computeEnPassantTargetAfter(piece: PieceInstance, move: GeneratedMove): Coord | null {
  if (piece.sigla !== EN_PASSANT_SIGLA || move.isCapture) return null;
  const { file: fromFile, rank: fromRank } = coordToFileRank(move.from);
  const { rank: toRank } = coordToFileRank(move.to);
  if (Math.abs(toRank - fromRank) !== 2) return null;
  return fileRankToCoord(fromFile, (fromRank + toRank) / 2);
}

function commitMove(state: GameState, piece: PieceInstance, move: GeneratedMove, promotionChoice?: string): GameState {
  const capturedPiece = move.capturedCoord ? getPieceAt(state.board, move.capturedCoord) : undefined;
  let nextBoard = applyMove(state.board, move);
  const nextTurn: Owner = piece.owner === 'A' ? 'B' : 'A';

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
  };

  const nextCaptured: Record<Owner, PieceInstance[]> = { A: state.captured.A, B: state.captured.B };
  if (capturedPiece) {
    nextCaptured[capturedPiece.owner] = [...nextCaptured[capturedPiece.owner], capturedPiece];
  }

  const status = computeStatus(nextBoard, nextTurn);

  return {
    board: nextBoard,
    turn: nextTurn,
    turnNumber: state.turnNumber + 1,
    history: [...state.history, historyEntry],
    captured: nextCaptured,
    status,
    winner: status === 'checkmate' ? piece.owner : undefined,
    enPassantTarget: computeEnPassantTargetAfter(piece, move),
  };
}
