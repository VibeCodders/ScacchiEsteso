import type { Piece } from '../types';
import { coordToFileRank, fileRankToCoord, getPieceAt, type BoardState, type Coord, type PieceInstance } from './board';
import { getPieceDef } from './moveEngine';

const ADJACENT_OFFSETS: Array<{ df: number; dr: number }> = [
  { df: 0, dr: 1 }, { df: 0, dr: -1 }, { df: 1, dr: 0 }, { df: -1, dr: 0 },
  { df: 1, dr: 1 }, { df: -1, dr: 1 }, { df: 1, dr: -1 }, { df: -1, dr: -1 },
];

export function canRevive(pieceDef: Piece): boolean {
  return Boolean(pieceDef.rianimaPedoni);
}

/** Empty squares adjacent (8-neighbor) to `from` where a revived piece could be placed. */
export function getRevivalSquares(board: BoardState, from: Coord): Coord[] {
  const { file, rank } = coordToFileRank(from);
  const results: Coord[] = [];

  for (const { df, dr } of ADJACENT_OFFSETS) {
    const coord = fileRankToCoord(file + df, rank + dr);
    if (coord && !getPieceAt(board, coord)) results.push(coord);
  }

  return results;
}

/**
 * Siglas of "pedone"-category pieces (PE, PG, FG — the whole category, not just the classic
 * Pedone) available in `owner`'s own graveyard for the Necromante to revive.
 */
export function getRevivableSiglas(captured: PieceInstance[]): string[] {
  const siglas = new Set<string>();
  for (const piece of captured) {
    if (getPieceDef(piece.sigla).categoria === 'pedone') siglas.add(piece.sigla);
  }
  return [...siglas];
}
