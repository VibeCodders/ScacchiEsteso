import type { Piece } from '../types';
import { sortSiglasByPunti } from '../data/pieces';
import {
  DEFAULT_BOARD_DIMENSIONS,
  type BoardDimensions,
  type BoardState,
  type Coord,
  type Owner,
  type PieceInstance,
} from './board';
import { getPieceDef } from './moveEngine';
import { isActionBlocked } from './actionGuards';
import { emptyAdjacentCoords } from './directions';

export function canRevive(pieceDef: Piece): boolean {
  return Boolean(pieceDef.rianimaPedoni);
}

/**
 * Empty squares adjacent (8-neighbor) to `from` where a revived piece could be placed. Empty if
 * the Necromante itself is silenced by an enemy Inquisitore's aura (README §7.3).
 */
export function getRevivalSquares(board: BoardState, from: Coord, owner: Owner, dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS): Coord[] {
  if (isActionBlocked(board, from, owner, getPieceDef, dimensions)) return [];
  return emptyAdjacentCoords(board, from, dimensions);
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
  return sortSiglasByPunti([...siglas]);
}
