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

export function canTeleport(pieceDef: Piece): boolean {
  return Boolean(pieceDef.teletrasporto);
}

/**
 * Empty squares the Teletrasporto at `from` could relocate to with \"teletrasporto\" (its
 * alternativeActions): every square at exactly 3 squares in one of the 8 straight directions.
 * The jump ignores interpositions (it's a teleport, not a slide) but lands on empty squares only
 * — never a capture. The Teletrasporto's own King-safety is enforced by applyTeleport, not here.
 * Empty if the piece itself is silenced by an enemy Inquisitore's aura (README §7.3) or frozen by
 * an enemy Stunner's aura.
 */
export function getTeleportTargets(board: BoardState, from: Coord, owner: Owner, dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS): Coord[] {
  if (isActionBlocked(board, from, owner, getPieceDef, dimensions)) return [];

  const { file, rank } = coordToFileRank(from);
  const results: Coord[] = [];

  // distance-3 offsets in the same 8 directions as the other action modules
  for (const { df, dr } of DIRECTIONS_8) {
    const landing = fileRankToCoord(file + df * 3, rank + dr * 3, dimensions);
    if (!landing) continue; // off the board
    if (getPieceAt(board, landing)) continue; // the landing square must be empty
    results.push(landing);
  }

  return results;
}
