import type { Piece } from '../types';
import { coordToFileRank, type Coord, type Owner } from './board';

/**
 * `promotionRank` in pieces.json is owner-relative (always the far rank from that owner's own
 * side), matching the same convention as move directions: rank 8 for Player A (who starts on
 * ranks 1-2), mirrored to rank 1 for Player B (who starts on ranks 7-8).
 */
export function absolutePromotionRank(owner: Owner, promotionRank: number): number {
  return owner === 'A' ? promotionRank : 9 - promotionRank;
}

/** True if landing on `to` would trigger promotion for this piece/owner. */
export function isPromotionMove(pieceDef: Piece, owner: Owner, to: Coord): boolean {
  if (!pieceDef.promotable || !pieceDef.promotionRank) return false;
  return coordToFileRank(to).rank === absolutePromotionRank(owner, pieceDef.promotionRank);
}

/** The siglas a piece may promote into. Empty if the piece isn't promotable. */
export function getPromotionOptions(pieceDef: Piece): string[] {
  return pieceDef.promotionTypes ?? [];
}
