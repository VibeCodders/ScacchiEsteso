import type { MirageMarker } from '../types';

export type Coord = string; // algebraic coordinate, e.g. "e4" (file a-h, rank 1-8 by default)
export type Owner = 'A' | 'B';

export interface BoardDimensions {
  width: number;
  height: number;
}

/** The game's original, and still default, board size — every dimensions-aware function below falls back to this when none is given. */
export const DEFAULT_BOARD_DIMENSIONS: BoardDimensions = { width: 8, height: 8 };

/** Smallest playable board per side — enough room to deploy 2 ranks per player plus maneuver. */
export const MIN_BOARD_DIMENSION = 4;

/**
 * Spreadsheet-style file naming (0-indexed): 0→"a", 25→"z", 26→"aa", 27→"ab", ... — supports
 * arbitrary board widths while staying identical to the classic single-letter scheme for the
 * first 26 files (i.e. every board up to width 26 renders exactly as it always has).
 */
export function indexToFile(index: number): string {
  let n = index + 1;
  let result = '';
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(97 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

/** Inverse of `indexToFile`. */
export function fileToIndex(file: string): number {
  let n = 0;
  for (let i = 0; i < file.length; i++) {
    n = n * 26 + (file.charCodeAt(i) - 96);
  }
  return n - 1;
}

const COORD_PATTERN = /^([a-z]+)(\d+)$/;

export interface PieceInstance {
  id: string;
  sigla: string;
  owner: Owner;
  hasMoved: boolean;
  resistenzaCorrente: number;
  /** Set only on Miraggio pieces that have split: links the real piece to its clone (shared `id`,
   *  `isClone: false` on the real, true on the illusion). Absent on a Miraggio that hasn't split
   *  yet and on every other piece. */
  mirage?: MirageMarker;
}

export type BoardState = Map<Coord, PieceInstance>;

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export const RANKS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export function createEmptyBoard(): BoardState {
  return new Map();
}

export function isValidCoord(coord: string, dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS): coord is Coord {
  const match = COORD_PATTERN.exec(coord);
  if (!match) return false;
  const file = fileToIndex(match[1]);
  const rank = Number(match[2]);
  return file >= 0 && file < dimensions.width && rank >= 1 && rank <= dimensions.height;
}

/** All coordinates of a board of the given size, top rank first (top of a standard-orientation board) down to rank 1. */
export function allCoords(dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS): Coord[] {
  const coords: Coord[] = [];
  for (let rank = dimensions.height; rank >= 1; rank--) {
    for (let file = 0; file < dimensions.width; file++) {
      coords.push(`${indexToFile(file)}${rank}`);
    }
  }
  return coords;
}

/**
 * Loose, dimensions-independent sanity check ("is this string even shaped like a coordinate"),
 * used only as a typo guard on board-mutation functions below. Real gameplay bounds-checking
 * (does this square exist on THIS board) is `isValidCoord`'s job, which does take dimensions —
 * these CRUD helpers don't have a board size to check against, since `BoardState` itself carries
 * none (see the plan's rationale for keeping it a plain Map).
 */
function isWellFormedCoord(coord: string): boolean {
  const match = COORD_PATTERN.exec(coord);
  if (!match) return false;
  return fileToIndex(match[1]) >= 0 && Number(match[2]) >= 1;
}

export function getPieceAt(board: BoardState, coord: Coord): PieceInstance | undefined {
  return board.get(coord);
}

export function setPieceAt(board: BoardState, coord: Coord, piece: PieceInstance): BoardState {
  if (!isWellFormedCoord(coord)) throw new Error(`Invalid coordinate: ${coord}`);
  const next = new Map(board);
  next.set(coord, piece);
  return next;
}

export function removePieceAt(board: BoardState, coord: Coord): BoardState {
  if (!isWellFormedCoord(coord)) throw new Error(`Invalid coordinate: ${coord}`);
  const next = new Map(board);
  next.delete(coord);
  return next;
}

export function movePiece(board: BoardState, from: Coord, to: Coord): BoardState {
  if (!isWellFormedCoord(from) || !isWellFormedCoord(to)) {
    throw new Error(`Invalid coordinate in move: ${from} -> ${to}`);
  }
  const piece = board.get(from);
  if (!piece) throw new Error(`No piece at ${from}`);
  const next = new Map(board);
  next.delete(from);
  next.set(to, { ...piece, hasMoved: true });
  return next;
}

/** Swaps two occupied squares' pieces in place (e.g. the Mistico's "scambio di posizione"). Both squares mark hasMoved. */
export function swapPieces(board: BoardState, coordA: Coord, coordB: Coord): BoardState {
  if (!isWellFormedCoord(coordA) || !isWellFormedCoord(coordB)) {
    throw new Error(`Invalid coordinate in swap: ${coordA} <-> ${coordB}`);
  }
  const pieceA = board.get(coordA);
  const pieceB = board.get(coordB);
  if (!pieceA || !pieceB) throw new Error(`Both squares must be occupied to swap: ${coordA}, ${coordB}`);

  const next = new Map(board);
  next.set(coordA, { ...pieceB, hasMoved: true });
  next.set(coordB, { ...pieceA, hasMoved: true });
  return next;
}

let instanceCounter = 0;

export function createPieceInstance(sigla: string, owner: Owner, resistenzaCorrente = 0): PieceInstance {
  instanceCounter += 1;
  return {
    id: `${owner}-${sigla}-${instanceCounter}`,
    sigla,
    owner,
    hasMoved: false,
    resistenzaCorrente,
  };
}

/** Row/column for rendering: row 0 is the top rank (top when Player A looks at the board), col 0 is file a. */
export function coordToDisplayPosition(coord: Coord, dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS): { row: number; col: number } {
  if (!isValidCoord(coord, dimensions)) throw new Error(`Invalid coordinate: ${coord}`);
  const { file, rank } = coordToFileRank(coord);
  return { row: dimensions.height - rank, col: file };
}

export function displayPositionToCoord(row: number, col: number, dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS): Coord {
  if (row < 0 || row > dimensions.height - 1 || col < 0 || col > dimensions.width - 1) {
    throw new Error(`Invalid display position: row=${row}, col=${col}`);
  }
  const rank = dimensions.height - row;
  return `${indexToFile(col)}${rank}`;
}

/** File (0-based) and rank (1-based) for coordinate arithmetic — the "logical" counterpart to the display row/col above. */
export function coordToFileRank(coord: Coord): { file: number; rank: number } {
  const match = COORD_PATTERN.exec(coord);
  if (!match) return { file: -1, rank: -1 };
  return { file: fileToIndex(match[1]), rank: Number(match[2]) };
}

export function fileRankToCoord(file: number, rank: number, dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS): Coord | null {
  if (file < 0 || file >= dimensions.width || rank < 1 || rank > dimensions.height) return null;
  return `${indexToFile(file)}${rank}`;
}
