import { KING_SIGLA } from '../data/pieces';
import type { Piece } from '../types';
import {
  getPieceAt,
  DEFAULT_BOARD_DIMENSIONS,
  type BoardDimensions,
  type BoardState,
  type Coord,
  type Owner,
} from './board';
import { castRay, type Vector } from './lineOfSight';
import { isSilenced } from './auras';
import { isAdjacentToEnemyStunner } from './stun';
import { getPieceDef } from './moveEngine';

/** Same 8-direction table as moveEngine.ts's ABSOLUTE_DIRECTION_VECTORS, duplicated here per the
 *  codebase's existing convention of not sharing this kind of small constant across modules. */
const ALL_8_VECTORS: Vector[] = [
  { df: 0, dr: 1 }, { df: 0, dr: -1 }, { df: 1, dr: 0 }, { df: -1, dr: 0 },
  { df: 1, dr: 1 }, { df: -1, dr: 1 }, { df: 1, dr: -1 }, { df: -1, dr: -1 },
];

export function canSwap(pieceDef: Piece): boolean {
  return Boolean(pieceDef.scambiaPosizioneConAlleato);
}

/**
 * Squares the Mistico at `from` could swap places with: any allied piece with a clear line of
 * sight (same row, column, or diagonal, no piece — ally or enemy — in between, at any distance,
 * exactly like a Queen's reach), excluding the King (README, Mistico's alternativeActions:
 * "esclusi": ["re"]). Empty if the Mistico itself is silenced by an enemy Inquisitore's aura
 * (README §7.3).
 */
export function getSwapTargets(board: BoardState, from: Coord, owner: Owner, dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS): Coord[] {
  if (isSilenced(board, from, owner, dimensions)) return [];
  if (isAdjacentToEnemyStunner(board, from, owner, getPieceDef, dimensions)) return [];

  const results: Coord[] = [];

  for (const vector of ALL_8_VECTORS) {
    const ray = castRay(board, from, vector, 99, dimensions);
    if (!ray.blockedBy) continue;

    const occupant = getPieceAt(board, ray.blockedBy);
    if (!occupant || occupant.owner !== owner || occupant.sigla === KING_SIGLA) continue;

    results.push(ray.blockedBy);
  }

  return results;
}
