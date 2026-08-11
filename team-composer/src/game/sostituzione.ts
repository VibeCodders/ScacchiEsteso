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
import { isActionBlocked } from './actionGuards';
import { adjacentCoords } from './directions';
import { getPieceDef } from './moveEngine';

export function canSostituire(pieceDef: Piece): boolean {
  return Boolean(pieceDef.scambioConNemico);
}

/**
 * Squares of the adjacent ENEMIES (never the King) the Brigante at `from` could swap places with
 * ("sostituzione", its alternativeAction): the two pieces exchange squares — no capture, no
 * movement of either piece beyond the swap itself. The Brigante's own King-safety is enforced by
 * applySostituzione, not here. Empty if the Brigante itself is silenced by an enemy Inquisitore's
 * aura (README §7.3) or frozen by an enemy Stunner/Basilisco.
 */
export function getSostituzioneTargets(board: BoardState, from: Coord, owner: Owner, dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS): Coord[] {
  if (isActionBlocked(board, from, owner, getPieceDef, dimensions)) return [];

  return adjacentCoords(from, dimensions).filter((coord) => {
    const occupant = getPieceAt(board, coord);
    return Boolean(occupant && occupant.owner !== owner && occupant.sigla !== KING_SIGLA);
  });
}
