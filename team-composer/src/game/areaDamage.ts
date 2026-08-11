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
} from './board';
import type { GeneratedMove } from './moveEngine';
import { DIRECTIONS_ORTHOGONAL } from './directions';

/**
 * README §4/§7 — the Colosso's "danno ad area" triggers automatically after a successful melee
 * capture (never a separate player choice, and never triggerable by capturing an ally — our move
 * engine only ever lets a piece capture enemies in the first place, so that prohibition is already
 * structurally guaranteed).
 */
export function triggersAreaDamage(pieceDef: Piece, move: GeneratedMove): boolean {
  return Boolean(pieceDef.dannoAdArea) && move.isCapture && move.captureMode === 'melee';
}

/**
 * Squares orthogonally adjacent to the landing square that get destroyed — both allied and enemy
 * pieces (README: "alleati e nemici"). The King is immune to collateral damage (README §3.3).
 */
export function getAreaDamageVictims(board: BoardState, landingSquare: Coord, dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS): Coord[] {
  const { file, rank } = coordToFileRank(landingSquare);
  const victims: Coord[] = [];

  for (const { df, dr } of DIRECTIONS_ORTHOGONAL) {
    const coord = fileRankToCoord(file + df, rank + dr, dimensions);
    if (!coord) continue;
    const occupant = getPieceAt(board, coord);
    if (occupant && occupant.sigla !== KING_SIGLA) victims.push(coord);
  }

  return victims;
}
