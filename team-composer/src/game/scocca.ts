import { KING_SIGLA } from '../data/pieces';
import type { Piece } from '../types';
import { coordToFileRank, fileRankToCoord, getPieceAt, type BoardState, type Coord, type Owner } from './board';
import { isPathClear } from './lineOfSight';
import { isShieldedByEgida, isSilenced } from './auras';

const SCOCCA_DISTANCES = [3, 4] as const;

const ALL_DIRECTIONS: Array<{ df: number; dr: number }> = [
  { df: 0, dr: 1 }, { df: 0, dr: -1 }, { df: 1, dr: 0 }, { df: -1, dr: 0 },
  { df: 1, dr: 1 }, { df: -1, dr: 1 }, { df: 1, dr: -1 }, { df: -1, dr: -1 },
];

export function canUseScocca(pieceDef: Piece): boolean {
  return Boolean(pieceDef.scocca);
}

/**
 * Squares the Arciere at `from` could eliminate with "scocca" (README, Arciere's alternativeActions):
 * an enemy exactly 3 or 4 squares away in a straight line, with a clear trajectory, no movement
 * involved. The King is immune (only melee can capture it — see check.ts's threat filtering).
 * Empty if the Arciere itself is silenced by an enemy Inquisitore's aura (README §7.3); targets
 * shielded by an (unsilenced) allied Paladino's egida are excluded (README §7).
 */
export function getScoccaTargets(board: BoardState, from: Coord, owner: Owner): Coord[] {
  if (isSilenced(board, from, owner)) return [];

  const { file, rank } = coordToFileRank(from);
  const results: Coord[] = [];

  for (const vector of ALL_DIRECTIONS) {
    for (const dist of SCOCCA_DISTANCES) {
      const coord = fileRankToCoord(file + vector.df * dist, rank + vector.dr * dist);
      if (!coord) continue;

      const occupant = getPieceAt(board, coord);
      if (!occupant || occupant.owner === owner || occupant.sigla === KING_SIGLA) continue;
      if (!isPathClear(board, from, coord)) continue;
      if (isShieldedByEgida(board, coord, occupant.owner)) continue;

      results.push(coord);
    }
  }

  return results;
}
