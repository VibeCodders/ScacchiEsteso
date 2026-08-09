import { KING_SIGLA } from '../data/pieces';
import type { CaptureMode } from '../types';
import { allCoords, getPieceAt, type BoardState, type Coord, type Owner } from './board';
import { applyMove, generatePseudoLegalMoves, type GeneratedMove } from './moveEngine';

/**
 * README §3.3: the King can only be captured by melee. Non-physical captures (ranged shots,
 * area damage — delivered via alternativeActions, not yet implemented) can never take the King.
 * Landing-based captures (leap/jump pieces like the Knight or Cavalletta, which physically move
 * onto the target square) count as a real threat just like melee; only "action at a distance"
 * capture modes are excluded.
 */
const CAPTURE_MODES_THAT_CANNOT_THREATEN_THE_KING: ReadonlySet<CaptureMode> = new Set(['ranged', 'area', 'none']);

export function findKingCoord(board: BoardState, owner: Owner): Coord | undefined {
  for (const coord of allCoords()) {
    const piece = getPieceAt(board, coord);
    if (piece && piece.owner === owner && piece.sigla === KING_SIGLA) return coord;
  }
  return undefined;
}

/** True if `owner`'s King is currently under a threat that could actually capture it. */
export function isKingInCheck(board: BoardState, owner: Owner): boolean {
  const kingCoord = findKingCoord(board, owner);
  if (!kingCoord) return false;

  for (const coord of allCoords()) {
    const piece = getPieceAt(board, coord);
    if (!piece || piece.owner === owner) continue;

    const moves = generatePseudoLegalMoves(board, coord);
    if (moves.some((m) => m.isCapture && m.capturedCoord === kingCoord && !CAPTURE_MODES_THAT_CANNOT_THREATEN_THE_KING.has(m.captureMode))) {
      return true;
    }
  }
  return false;
}

/** Pseudo-legal moves for the piece at `from`, minus any that would leave its own King in check. */
export function getLegalMoves(board: BoardState, from: Coord): GeneratedMove[] {
  const piece = getPieceAt(board, from);
  if (!piece) return [];

  return generatePseudoLegalMoves(board, from).filter((move) => !applyingMoveLeavesOwnKingInCheck(board, piece.owner, move));
}

function applyingMoveLeavesOwnKingInCheck(board: BoardState, owner: Owner, move: GeneratedMove): boolean {
  const resultingBoard = applyMove(board, move);
  return isKingInCheck(resultingBoard, owner);
}

/** All legal moves for every piece `owner` currently has on the board. */
export function getAllLegalMoves(board: BoardState, owner: Owner): GeneratedMove[] {
  const moves: GeneratedMove[] = [];
  for (const coord of allCoords()) {
    const piece = getPieceAt(board, coord);
    if (piece && piece.owner === owner) {
      moves.push(...getLegalMoves(board, coord));
    }
  }
  return moves;
}

export function isCheckmate(board: BoardState, owner: Owner): boolean {
  return isKingInCheck(board, owner) && getAllLegalMoves(board, owner).length === 0;
}

export function isStalemate(board: BoardState, owner: Owner): boolean {
  return !isKingInCheck(board, owner) && getAllLegalMoves(board, owner).length === 0;
}
