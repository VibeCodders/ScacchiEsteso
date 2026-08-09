export type Coord = string; // algebraic coordinate, e.g. "e4" (file a-h, rank 1-8)
export type Owner = 'A' | 'B';

export interface PieceInstance {
  id: string;
  sigla: string;
  owner: Owner;
  hasMoved: boolean;
  resistenzaCorrente: number;
}

export type BoardState = Map<Coord, PieceInstance>;

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export const RANKS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export function createEmptyBoard(): BoardState {
  return new Map();
}

export function isValidCoord(coord: string): coord is Coord {
  return /^[a-h][1-8]$/.test(coord);
}

/** All 64 coordinates, rank 8 first (top of a standard-orientation board) down to rank 1. */
export function allCoords(): Coord[] {
  const coords: Coord[] = [];
  for (let rank = 8; rank >= 1; rank--) {
    for (const file of FILES) {
      coords.push(`${file}${rank}`);
    }
  }
  return coords;
}

export function getPieceAt(board: BoardState, coord: Coord): PieceInstance | undefined {
  return board.get(coord);
}

export function setPieceAt(board: BoardState, coord: Coord, piece: PieceInstance): BoardState {
  if (!isValidCoord(coord)) throw new Error(`Invalid coordinate: ${coord}`);
  const next = new Map(board);
  next.set(coord, piece);
  return next;
}

export function removePieceAt(board: BoardState, coord: Coord): BoardState {
  if (!isValidCoord(coord)) throw new Error(`Invalid coordinate: ${coord}`);
  const next = new Map(board);
  next.delete(coord);
  return next;
}

export function movePiece(board: BoardState, from: Coord, to: Coord): BoardState {
  if (!isValidCoord(from) || !isValidCoord(to)) {
    throw new Error(`Invalid coordinate in move: ${from} -> ${to}`);
  }
  const piece = board.get(from);
  if (!piece) throw new Error(`No piece at ${from}`);
  const next = new Map(board);
  next.delete(from);
  next.set(to, { ...piece, hasMoved: true });
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

/** Row/column for rendering: row 0 is rank 8 (top when Player A looks at the board), col 0 is file a. */
export function coordToDisplayPosition(coord: Coord): { row: number; col: number } {
  if (!isValidCoord(coord)) throw new Error(`Invalid coordinate: ${coord}`);
  const file = coord[0];
  const rank = Number(coord[1]);
  return { row: 8 - rank, col: FILES.indexOf(file as (typeof FILES)[number]) };
}

export function displayPositionToCoord(row: number, col: number): Coord {
  if (row < 0 || row > 7 || col < 0 || col > 7) {
    throw new Error(`Invalid display position: row=${row}, col=${col}`);
  }
  const rank = 8 - row;
  return `${FILES[col]}${rank}`;
}

/** File (0-7) and rank (1-8) for coordinate arithmetic — the "logical" counterpart to the display row/col above. */
export function coordToFileRank(coord: Coord): { file: number; rank: number } {
  return { file: FILES.indexOf(coord[0] as (typeof FILES)[number]), rank: Number(coord[1]) };
}

export function fileRankToCoord(file: number, rank: number): Coord | null {
  if (file < 0 || file > 7 || rank < 1 || rank > 8) return null;
  return `${FILES[file]}${rank}`;
}
