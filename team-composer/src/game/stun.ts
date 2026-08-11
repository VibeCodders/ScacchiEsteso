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
import { adjacentCoords } from './directions';

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
  for (const neighbor of adjacentCoords(coord, dimensions)) {
    const occupant = getPieceAt(board, neighbor);
    if (occupant && occupant.owner !== owner && getDef(occupant.sigla).stunAura) return true;
  }
  return false;
}

/** How far ahead (in squares) the Basilisco's petrifying gaze reaches. */
export const BASILISK_GAZE_RANGE = 3;

/**
 * True if `coord` (owned by `owner`) currently lies in the petrifying gaze of an enemy Basilisco
 * (`congelaDirezione`): the 3 squares directly in FRONT of the Basilisco, where "forward" is the
 * Basilisco's owner-relative direction (toward the opponent) — equivalently, the 3 squares
 * directly behind `coord` from its own owner's point of view (forward × 1..3). The gaze pierces
 * through pieces in between (it is a stare, not a ray that blocks). `getDef` is injected for the
 * same circular-import reason as `isAdjacentToEnemyStunner`.
 */
export function isInEnemyBasiliskGaze(
  board: BoardState,
  coord: Coord,
  owner: Owner,
  getDef: (sigla: string) => { congelaDirezione?: boolean },
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
): boolean {
  const { file, rank } = coordToFileRank(coord);
  const forward = owner === 'A' ? 1 : -1;
  for (let dist = 1; dist <= BASILISK_GAZE_RANGE; dist++) {
    const gaze = fileRankToCoord(file, rank + forward * dist, dimensions);
    if (!gaze) continue; // the ray ran off the board
    const occupant = getPieceAt(board, gaze);
    if (occupant && occupant.owner !== owner && getDef(occupant.sigla).congelaDirezione) return true;
  }
  return false;
}

/**
 * True when the piece at `coord` (owned by `owner`) is frozen by ANY enemy freezing aura: an
 * adjacent Stunner (all 8 directions) or a Basilisco whose gaze covers it (the 3 squares in
 * front of the Basilisco). This is the single freeze predicate used by moveEngine.ts's
 * generatePseudoLegalMoves and by every special-action module — a frozen piece may only act to
 * capture the freezer itself.
 */
export function isFrozenByEnemyAura(
  board: BoardState,
  coord: Coord,
  owner: Owner,
  getDef: (sigla: string) => { stunAura?: boolean; congelaDirezione?: boolean },
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
): boolean {
  return isAdjacentToEnemyStunner(board, coord, owner, getDef, dimensions)
    || isInEnemyBasiliskGaze(board, coord, owner, getDef, dimensions);
}
