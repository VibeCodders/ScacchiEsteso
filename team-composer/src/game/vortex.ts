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
import { isSilenced } from './auras';
import { isAdjacentToEnemyStunner } from './stun';
import { getPieceDef } from './moveEngine';

/** Same 8-direction table as the other alternative-action modules, duplicated per convention. */
const ATTRACT_OFFSETS: Array<{ df: number; dr: number }> = [
  { df: 0, dr: 1 }, { df: 0, dr: -1 }, { df: 1, dr: 0 }, { df: -1, dr: 0 },
  { df: 1, dr: 1 }, { df: -1, dr: 1 }, { df: 1, dr: -1 }, { df: -1, dr: -1 },
];

export function canAttract(pieceDef: Piece): boolean {
  return Boolean(pieceDef.attiraNemici);
}

/**
 * Squares of the enemies at exactly 2 squares in a straight line from the Vortice at `from` that
 * \"attira\" could pull: the enemy is dragged 1 square CLOSER (onto the empty square in between),
 * so the intermediate square must be on the board and empty. The pull captures nothing. The King
 * can never be pulled — it is immune to forced displacement, mirroring the Repulsore's rule
 * (README §3.2). Empty if the Vortice itself is silenced by an enemy Inquisitore's aura
 * (README §7.3) or frozen by an enemy Stunner's aura.
 */
export function getAttractTargets(board: BoardState, from: Coord, owner: Owner, dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS): Coord[] {
  if (isSilenced(board, from, owner, dimensions)) return [];
  if (isAdjacentToEnemyStunner(board, from, owner, getPieceDef, dimensions)) return [];

  const { file, rank } = coordToFileRank(from);
  const results: Coord[] = [];

  for (const { df, dr } of ATTRACT_OFFSETS) {
    const landing = fileRankToCoord(file + df, rank + dr, dimensions);
    if (!landing) continue; // off the board
    if (getPieceAt(board, landing)) continue; // the intermediate square must be empty

    const enemy = fileRankToCoord(file + df * 2, rank + dr * 2, dimensions);
    if (!enemy) continue; // the enemy would be off the board
    const occupant = getPieceAt(board, enemy);
    if (!occupant || occupant.owner === owner || occupant.sigla === KING_SIGLA) continue;

    results.push(enemy);
  }

  return results;
}
