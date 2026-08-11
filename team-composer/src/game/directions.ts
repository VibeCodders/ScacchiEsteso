import type { Direction, Move, Piece } from '../types';
import {
  coordToFileRank,
  fileRankToCoord,
  getPieceAt,
  DEFAULT_BOARD_DIMENSIONS,
  type BoardDimensions,
  type BoardState,
  type Coord,
  type Owner,
} from './board';

/** A (file, rank) delta used to step from one square to another. */
export interface DirectionOffset {
  df: number;
  dr: number;
}

/**
 * The 8 adjacent directions (N/S/E/W + the four diagonals). Previously copy-pasted into every
 * special-action module as ADJACENT_OFFSETS / ATTRACT_OFFSETS / ALL_DIRECTIONS / ... with the
 * comment "duplicated per convention" — this is now the single source of truth.
 */
export const DIRECTIONS_8: readonly DirectionOffset[] = [
  { df: 0, dr: 1 }, { df: 0, dr: -1 }, { df: 1, dr: 0 }, { df: -1, dr: 0 },
  { df: 1, dr: 1 }, { df: -1, dr: 1 }, { df: 1, dr: -1 }, { df: -1, dr: -1 },
];

/** The 4 orthogonal directions (the Colosso's area damage, etc.). First half of DIRECTIONS_8. */
export const DIRECTIONS_ORTHOGONAL: readonly DirectionOffset[] = DIRECTIONS_8.slice(0, 4);

/** The 8 knight L-offsets (moveEngine.ts and pieceInfo.ts used identical copies). */
export const KNIGHT_OFFSETS: readonly DirectionOffset[] = [
  { df: 1, dr: 2 }, { df: 2, dr: 1 }, { df: 2, dr: -1 }, { df: 1, dr: -2 },
  { df: -1, dr: -2 }, { df: -2, dr: -1 }, { df: -2, dr: 1 }, { df: -1, dr: 2 },
];

export const ABSOLUTE_DIRECTION_VECTORS: Record<Direction, DirectionOffset> = {
  n: { df: 0, dr: 1 },
  s: { df: 0, dr: -1 },
  e: { df: 1, dr: 0 },
  w: { df: -1, dr: 0 },
  ne: { df: 1, dr: 1 },
  nw: { df: -1, dr: 1 },
  se: { df: 1, dr: -1 },
  sw: { df: -1, dr: -1 },
};

/**
 * Directions in piece data are relative to the owner ("n" = forward, toward the opponent).
 * Player B sits on rank 8 and faces the opposite way, so their forward direction is a vertical
 * mirror of Player A's: only the rank component flips, the file component (left/right) does not —
 * the same reason Black's pawns capture diagonally "downward" in standard chess.
 */
export const OWNER_B_DIRECTION_MIRROR: Record<Direction, Direction> = {
  n: 's', s: 'n',
  ne: 'se', se: 'ne',
  nw: 'sw', sw: 'nw',
  e: 'e', w: 'w',
};

export function toAbsoluteDirection(direction: Direction, owner: Owner): Direction {
  return owner === 'A' ? direction : OWNER_B_DIRECTION_MIRROR[direction];
}

export const DIAGONAL_DIRECTIONS: readonly Direction[] = ['ne', 'nw', 'se', 'sw'];

/**
 * Standard chess convention (not an explicit field in pieces.json): a pawn-category piece's
 * diagonal move entry is capture-only — it cannot step onto an empty diagonal square. Every
 * other capturing entry in the data (King, Rook, ...) can land on an empty square as a normal
 * move, so this only applies where the piece is a pawn (categoria "pedone") and the entry's
 * directions are purely diagonal. Shared by moveEngine.ts (generation) and pieceInfo.ts
 * (illustration), which previously kept identical private copies.
 */
export function isPawnDiagonalCaptureOnly(pieceDef: Piece, moveEntry: Move): boolean {
  return (
    pieceDef.categoria === 'pedone' &&
    moveEntry.capture &&
    moveEntry.directions.length > 0 &&
    moveEntry.directions.every((d) => DIAGONAL_DIRECTIONS.includes(d))
  );
}

/** Matches Board.tsx's square coloring: a1 is dark, h1 is light, as in standard chess. */
export function squareColorOf(coord: Coord): 'chiara' | 'scura' {
  const { file, rank } = coordToFileRank(coord);
  return (file + rank) % 2 === 0 ? 'chiara' : 'scura';
}

/** The 8 squares adjacent to `from` that lie on the board (8-neighbor). */
export function adjacentCoords(from: Coord, dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS): Coord[] {
  const { file, rank } = coordToFileRank(from);
  const coords: Coord[] = [];
  for (const { df, dr } of DIRECTIONS_8) {
    const coord = fileRankToCoord(file + df, rank + dr, dimensions);
    if (coord) coords.push(coord);
  }
  return coords;
}

/** The 8 adjacent squares that are on the board AND empty (the Necromante's revival squares and
 *  the Miraggio's sdoppiamento squares walked this same loop independently). */
export function emptyAdjacentCoords(board: BoardState, from: Coord, dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS): Coord[] {
  return adjacentCoords(from, dimensions).filter((coord) => !getPieceAt(board, coord));
}
