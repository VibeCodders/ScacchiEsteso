import { getPieceAt, type BoardState, type Coord, type Owner, type PieceInstance } from './board';
import { applyMove, type GeneratedMove } from './moveEngine';
import { getLegalMoves, isCheckmate, isKingInCheck, isStalemate } from './check';

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
  };
}

const GAME_OVER_STATUSES: ReadonlySet<GameStatus> = new Set(['checkmate', 'stalemate']);

/**
 * Attempts to play one move as the current player's single action for the turn (README §4.1 —
 * only piece movement/capture for now; special abilities arrive with `alternativeActions` in a
 * later step). Rejects moves from the wrong player, illegal moves, and any move once the game
 * has already ended.
 */
export function applyTurn(state: GameState, from: Coord, to: Coord): ApplyTurnResult {
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

  const move = getLegalMoves(state.board, from).find((m) => m.to === to);
  if (!move) {
    return { ok: false, reason: `Mossa non legale: ${from} → ${to}.` };
  }

  return { ok: true, state: commitMove(state, piece, move) };
}

function commitMove(state: GameState, piece: PieceInstance, move: GeneratedMove): GameState {
  const capturedPiece = move.capturedCoord ? getPieceAt(state.board, move.capturedCoord) : undefined;
  const nextBoard = applyMove(state.board, move);
  const nextTurn: Owner = piece.owner === 'A' ? 'B' : 'A';

  const historyEntry: HistoryEntry = {
    turnNumber: state.turnNumber,
    owner: piece.owner,
    from: move.from,
    to: move.to,
    sigla: piece.sigla,
    isCapture: move.isCapture,
    capturedCoord: move.capturedCoord,
    capturedSigla: capturedPiece?.sigla,
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
  };
}
