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

export function canSwapperSwap(pieceDef: Piece): boolean {
  return Boolean(pieceDef.scambioTraDueAlleati);
}

/**
 * Up to 9 squares eligible as one endpoint of a Swapper's two-target swap at `from`: the
 * Swapper's own square plus its allied (non-empty) 8-neighbors. Empty if the Swapper itself is
 * frozen by an enemy Stunner.
 */
export function getSwapperCandidateSquares(board: BoardState, from: Coord, owner: Owner, dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS): Coord[] {
  if (isActionBlocked(board, from, owner, getPieceDef, dimensions, { silenced: false })) return [];

  const results: Coord[] = [from];
  const { file, rank } = coordToFileRank(from);

  for (const { df, dr } of DIRECTIONS_8) {
    const coord = fileRankToCoord(file + df, rank + dr, dimensions);
    if (!coord) continue;

    const occupant = getPieceAt(board, coord);
    if (occupant && occupant.owner === owner) results.push(coord);
  }

  return results;
}

/**
 * All valid unordered {squareA, squareB} pairs the Swapper at `from` could swap — both drawn from
 * getSwapperCandidateSquares(from), excluding the degenerate same-square pairing. Consumed by
 * bot.ts's action enumeration.
 */
export function getSwapperCandidatePairs(board: BoardState, from: Coord, owner: Owner, dimensions?: BoardDimensions): [Coord, Coord][] {
  const squares = getSwapperCandidateSquares(board, from, owner, dimensions);
  const pairs: [Coord, Coord][] = [];
  for (let i = 0; i < squares.length; i++) {
    for (let j = i + 1; j < squares.length; j++) {
      pairs.push([squares[i], squares[j]]);
    }
  }
  return pairs;
}
