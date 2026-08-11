import { KING_SIGLA } from '../data/pieces';
import type { Piece } from '../types';
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
import { isActionBlocked } from './actionGuards';
import { DIRECTIONS_8 } from './directions';
import { getPieceDef } from './moveEngine';

export function canRepulse(pieceDef: Piece): boolean {
  return Boolean(pieceDef.respingeNemici);
}

/**
 * Squares of the adjacent enemies the Repulsore at `from` could push with "respingi" (README,
 * Repulsore's alternativeActions): the enemy is displaced exactly one square directly AWAY from
 * the Repulsore, so the landing square (the enemy's square mirrored past the Repulsore's own) must
 * be on the board and empty. The push captures nothing. The King can never be pushed — it is
 * immune to forced displacement, mirroring the no-pushing-the-King-into-check rule (README §3.2).
 * Empty if the Repulsore itself is silenced by an enemy Inquisitore's aura (README §7.3) or frozen
 * by an enemy Stunner's aura.
 */
export function getRepulseTargets(board: BoardState, from: Coord, owner: Owner, dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS): Coord[] {
  if (isActionBlocked(board, from, owner, getPieceDef, dimensions)) return [];

  const { file, rank } = coordToFileRank(from);
  const results: Coord[] = [];

  for (const { df, dr } of DIRECTIONS_8) {
    const enemy = fileRankToCoord(file + df, rank + dr, dimensions);
    if (!enemy) continue;
    const occupant = getPieceAt(board, enemy);
    if (!occupant || occupant.owner === owner || occupant.sigla === KING_SIGLA) continue;

    const landing = fileRankToCoord(file + df * 2, rank + dr * 2, dimensions);
    if (!landing) continue; // the enemy is against the board edge — no room to push it
    if (getPieceAt(board, landing)) continue; // the landing square must be empty

    results.push(enemy);
  }

  return results;
}
