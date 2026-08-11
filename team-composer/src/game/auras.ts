import {
  getPieceAt,
  DEFAULT_BOARD_DIMENSIONS,
  type BoardDimensions,
  type BoardState,
  type Coord,
  type Owner,
} from './board';
import { getPieceDef } from './moveEngine';
import { adjacentCoords } from './directions';

function hasAdjacentPieceMatching(
  board: BoardState,
  coord: Coord,
  predicate: (occupantSigla: string, occupantOwner: Owner) => boolean,
  dimensions: BoardDimensions,
): boolean {
  for (const neighbor of adjacentCoords(coord, dimensions)) {
    const occupant = getPieceAt(board, neighbor);
    if (occupant && predicate(occupant.sigla, occupant.owner)) return true;
  }
  return false;
}

/**
 * README §7.3 — a piece is "silenced" (loses every special ability, not just ranged attacks —
 * confirmed with the user) while an enemy Inquisitore sits in one of the 8 adjacent squares.
 */
export function isSilenced(board: BoardState, coord: Coord, owner: Owner, dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS): boolean {
  return hasAdjacentPieceMatching(
    board, coord,
    (sigla, occupantOwner) => occupantOwner !== owner && getPieceDef(sigla).silenzioAttacchiADistanza === true,
    dimensions,
  );
}

/**
 * README §7 — a piece is shielded from ranged attacks (only capturable in melee) while an
 * adjacent allied Paladino grants "egida" — unless that Paladino is itself silenced by an enemy
 * Inquisitore, in which case the Silenzio takes priority (README §7.3) and the shield lapses.
 */
export function isShieldedByEgida(board: BoardState, coord: Coord, owner: Owner, dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS): boolean {
  for (const neighbor of adjacentCoords(coord, dimensions)) {
    const occupant = getPieceAt(board, neighbor);
    if (occupant && occupant.owner === owner && getPieceDef(occupant.sigla).egida && !isSilenced(board, neighbor, occupant.owner, dimensions)) {
      return true;
    }
  }
  return false;
}
