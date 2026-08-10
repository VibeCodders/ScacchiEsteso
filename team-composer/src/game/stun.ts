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

const ADJACENT_OFFSETS: Array<{ df: number; dr: number }> = [
  { df: 0, dr: 1 }, { df: 0, dr: -1 }, { df: 1, dr: 0 }, { df: -1, dr: 0 },
  { df: 1, dr: 1 }, { df: -1, dr: 1 }, { df: 1, dr: -1 }, { df: -1, dr: -1 },
];

/**
 * True if `coord` (owned by `owner`) currently sits adjacent to an enemy Stunner (`stunAura`).
 * `getDef` is injected rather than imported from moveEngine.ts — moveEngine.ts's
 * generatePseudoLegalMoves needs to call this function, so this module must not import back from
 * moveEngine.ts (that would be a circular import, the same trap auras.ts already sits in for a
 * different reason). Every caller (moveEngine.ts, and the alternative-action modules that already
 * import getPieceDef from moveEngine.ts for other reasons) passes its own getPieceDef in.
 */
export function isAdjacentToEnemyStunner(
  board: BoardState,
  coord: Coord,
  owner: Owner,
  getDef: (sigla: string) => { stunAura?: boolean },
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
): boolean {
  const { file, rank } = coordToFileRank(coord);
  for (const { df, dr } of ADJACENT_OFFSETS) {
    const neighbor = fileRankToCoord(file + df, rank + dr, dimensions);
    if (!neighbor) continue;
    const occupant = getPieceAt(board, neighbor);
    if (occupant && occupant.owner !== owner && getDef(occupant.sigla).stunAura) return true;
  }
  return false;
}
