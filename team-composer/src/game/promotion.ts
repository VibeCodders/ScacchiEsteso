import type { Piece } from '../types';
import { sortSiglasByPunti } from '../data/pieces';
import { coordToFileRank, DEFAULT_BOARD_DIMENSIONS, type BoardDimensions, type Coord, type Owner } from './board';

/**
 * The promotion rank is always the far rank from the owner's own side (matching the same
 * convention as move directions), regardless of board height: rank `height` for Player A (who
 * starts on ranks 1-2), rank 1 for Player B (who starts on the top 2 ranks). `pieces.json`'s
 * `promotionRank` field (always `8` today) predates configurable board sizes and only ever meant
 * "the classic 8×8 far rank" — the real height is what actually matters, so it's used here
 * instead of that stored (and now board-size-independent) number.
 */
export function absolutePromotionRank(owner: Owner, height: number): number {
  return owner === 'A' ? height : 1;
}

/** True if landing on `to` would trigger promotion for this piece/owner. */
export function isPromotionMove(pieceDef: Piece, owner: Owner, to: Coord, dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS): boolean {
  if (!pieceDef.promotable || !pieceDef.promotionRank) return false;
  return coordToFileRank(to).rank === absolutePromotionRank(owner, dimensions.height);
}

/** The siglas a piece may promote into, sorted by point cost. Empty if the piece isn't promotable. */
export function getPromotionOptions(pieceDef: Piece): string[] {
  return sortSiglasByPunti(pieceDef.promotionTypes ?? []);
}
