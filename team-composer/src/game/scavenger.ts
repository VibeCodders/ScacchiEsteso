import type { Piece } from '../types';
import { KING_SIGLA, sortSiglasByPunti } from '../data/pieces';
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

/** Value cap of the Sciacallo's loot: the jackal can only drag off small prey (README, Sciacallo's
 *  sciacallaggio) — never the heavy pieces, and never the King. Kept in sync with the
 *  `maxLootValue` param in the SC alternativeAction in pieces.json. */
export const MAX_LOOT_VALUE = 20;

export function canLoot(pieceDef: Piece): boolean {
  return Boolean(pieceDef.sciacallaggio);
}

/**
 * Empty squares adjacent (8-neighbor) to `from` where a looted piece could materialize. Empty if
 * the Sciacallo itself is silenced by an enemy Inquisitore's aura (README §7.3) or frozen by an
 * enemy Stunner's aura.
 */
export function getLootSquares(board: BoardState, from: Coord, owner: Owner, dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS): Coord[] {
  if (isActionBlocked(board, from, owner, getPieceDef, dimensions)) return [];
  return emptyAdjacentCoords(board, from, dimensions);
}

/**
 * Siglas of the pieces `owner` could loot from the OPPONENT's graveyard: the enemy's fallen
 * pieces worth at most `MAX_LOOT_VALUE` punti (the jackal only scavenges small prey) — never the
 * King, which is never captured anyway. Unlike the Necromante (which revives only \"pedone\"-
 * category pieces from its OWN losses), the Sciacallo can raise any cheap piece the enemy lost.
 */
export function getLootableSiglas(capturedEnemy: PieceInstance[]): string[] {
  const siglas = new Set<string>();
  for (const piece of capturedEnemy) {
    if (piece.sigla === KING_SIGLA) continue;
    if (getPieceDef(piece.sigla).punti > MAX_LOOT_VALUE) continue;
    siglas.add(piece.sigla);
  }
  return sortSiglasByPunti([...siglas]);
}
