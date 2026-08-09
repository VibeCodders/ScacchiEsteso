import { KING_SIGLA } from '../data/pieces';
import type { Piece } from '../types';
import { coordToFileRank, fileRankToCoord, getPieceAt, type BoardState, type Coord, type Owner } from './board';
import { isSilenced } from './auras';

const ADJACENT_OFFSETS: Array<{ df: number; dr: number }> = [
  { df: 0, dr: 1 }, { df: 0, dr: -1 }, { df: 1, dr: 0 }, { df: -1, dr: 0 },
  { df: 1, dr: 1 }, { df: -1, dr: 1 }, { df: 1, dr: -1 }, { df: -1, dr: -1 },
];

export function canSwap(pieceDef: Piece): boolean {
  return Boolean(pieceDef.scambiaPosizioneConAlleato);
}

/**
 * Squares the Mistico at `from` could swap places with: an adjacent (8-neighbor) allied piece,
 * excluding the King (README, Mistico's alternativeActions: "esclusi": ["re"]). Empty if the
 * Mistico itself is silenced by an enemy Inquisitore's aura (README §7.3).
 */
export function getSwapTargets(board: BoardState, from: Coord, owner: Owner): Coord[] {
  if (isSilenced(board, from, owner)) return [];

  const { file, rank } = coordToFileRank(from);
  const results: Coord[] = [];

  for (const { df, dr } of ADJACENT_OFFSETS) {
    const coord = fileRankToCoord(file + df, rank + dr);
    if (!coord) continue;

    const occupant = getPieceAt(board, coord);
    if (!occupant || occupant.owner !== owner || occupant.sigla === KING_SIGLA) continue;

    results.push(coord);
  }

  return results;
}
