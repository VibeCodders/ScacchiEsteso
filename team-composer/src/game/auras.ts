import { coordToFileRank, fileRankToCoord, getPieceAt, type BoardState, type Coord, type Owner } from './board';
import { getPieceDef } from './moveEngine';

const ADJACENT_OFFSETS: Array<{ df: number; dr: number }> = [
  { df: 0, dr: 1 }, { df: 0, dr: -1 }, { df: 1, dr: 0 }, { df: -1, dr: 0 },
  { df: 1, dr: 1 }, { df: -1, dr: 1 }, { df: 1, dr: -1 }, { df: -1, dr: -1 },
];

function hasAdjacentPieceMatching(board: BoardState, coord: Coord, predicate: (occupantSigla: string, occupantOwner: Owner) => boolean): boolean {
  const { file, rank } = coordToFileRank(coord);
  for (const { df, dr } of ADJACENT_OFFSETS) {
    const neighbor = fileRankToCoord(file + df, rank + dr);
    if (!neighbor) continue;
    const occupant = getPieceAt(board, neighbor);
    if (occupant && predicate(occupant.sigla, occupant.owner)) return true;
  }
  return false;
}

/**
 * README §7.3 — a piece is "silenced" (loses every special ability, not just ranged attacks —
 * confirmed with the user) while an enemy Inquisitore sits in one of the 8 adjacent squares.
 */
export function isSilenced(board: BoardState, coord: Coord, owner: Owner): boolean {
  return hasAdjacentPieceMatching(board, coord, (sigla, occupantOwner) => occupantOwner !== owner && getPieceDef(sigla).silenzioAttacchiADistanza === true);
}

/**
 * README §7 — a piece is shielded from ranged attacks (only capturable in melee) while an
 * adjacent allied Paladino grants "egida" — unless that Paladino is itself silenced by an enemy
 * Inquisitore, in which case the Silenzio takes priority (README §7.3) and the shield lapses.
 */
export function isShieldedByEgida(board: BoardState, coord: Coord, owner: Owner): boolean {
  const { file, rank } = coordToFileRank(coord);
  for (const { df, dr } of ADJACENT_OFFSETS) {
    const neighbor = fileRankToCoord(file + df, rank + dr);
    if (!neighbor) continue;
    const occupant = getPieceAt(board, neighbor);
    if (occupant && occupant.owner === owner && getPieceDef(occupant.sigla).egida && !isSilenced(board, neighbor, occupant.owner)) {
      return true;
    }
  }
  return false;
}
