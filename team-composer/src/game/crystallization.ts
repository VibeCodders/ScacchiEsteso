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

export interface CrystallizedSquare {
  id: string;
  owner: Owner;
  coord: Coord;
  creatorCoord: Coord; // where the Smeraldo piece was when it created this crystallization
  remainingTurns: number; // how many full turns remain until it dissolves
}

export interface GameStateWithCrystallizations {
  crystallizations: CrystallizedSquare[];
}

export function canCrystallize(pieceDef: Piece): boolean {
  return Boolean(pieceDef.cristallizzaCaselle);
}

/**
 * Empty squares within range 2 where a Smeraldo could crystallize.
 * The crystallization is created on an empty square within 2 steps in any direction.
 * Returns empty if the piece is silenced or frozen.
 */
export function getCrystallizationSquares(
  board: BoardState,
  from: Coord,
  owner: Owner,
  getPieceDefFn: (sigla: string) => Piece,
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS
): Coord[] {
  if (isActionBlocked(board, from, owner, getPieceDefFn, dimensions)) return [];

  const { file, rank } = coordToFileRank(from);
  const results: Coord[] = [];

  // Check all squares within Chebyshev distance 2 (max of |df| and |dr| <= 2)
  for (let df = -2; df <= 2; df++) {
    for (let dr = -2; dr <= 2; dr++) {
      if (df === 0 && dr === 0) continue; // skip the square the piece is on
      if (Math.max(Math.abs(df), Math.abs(dr)) > 2) continue; // skip squares beyond range 2
      
      const target = fileRankToCoord(file + df, rank + dr, dimensions);
      if (!target) continue; // off the board
      if (getPieceAt(board, target)) continue; // must be empty
      results.push(target);
    }
  }

  return results;
}

/**
 * Get all crystallizations belonging to a specific owner.
 */
export function getOwnerCrystallizations(crystallizations: CrystallizedSquare[], owner: Owner): CrystallizedSquare[] {
  return crystallizations.filter(c => c.owner === owner);
}

/**
 * Check if a square is currently crystallized (inaccessible to both players).
 */
export function isSquareCrystallized(crystallizations: CrystallizedSquare[], coord: Coord): boolean {
  return crystallizations.some(c => c.coord === coord && c.remainingTurns > 0);
}

/**
 * Check if a specific owner can create more crystallizations (max 2 active at a time).
 */
export function canCreateMoreCrystallizations(crystallizations: CrystallizedSquare[], owner: Owner): boolean {
  const activeCrystallizations = getOwnerCrystallizations(crystallizations, owner).filter(c => c.remainingTurns > 0);
  return activeCrystallizations.length < 2;
}

/**
 * Decrement remaining turns for all crystallizations and remove expired ones.
 * This should be called at the end of each full turn (after both players have moved).
 */
export function decrementCrystallizationTurns(crystallizations: CrystallizedSquare[]): CrystallizedSquare[] {
  return crystallizations
    .map(c => ({ ...c, remainingTurns: c.remainingTurns - 1 }))
    .filter(c => c.remainingTurns > 0);
}

/**
 * Remove all crystallizations created by a specific Smeraldo piece when it is captured or creates new ones.
 */
export function removeCrystallizationsByCreator(crystallizations: CrystallizedSquare[], creatorCoord: Coord): CrystallizedSquare[] {
  return crystallizations.filter(c => c.creatorCoord !== creatorCoord);
}

/**
 * Generate a unique crystallization ID.
 */
export function generateCrystallizationId(): string {
  return `cryst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if a square is accessible for movement/capture (not crystallized).
 * The King cannot enter crystallized squares (special restriction).
 */
export function isSquareAccessible(
  crystallizations: CrystallizedSquare[],
  coord: Coord,
  isKing: boolean = false
): boolean {
  if (isKing && isSquareCrystallized(crystallizations, coord)) {
    return false; // King cannot enter crystallized squares
  }
  return !isSquareCrystallized(crystallizations, coord);
}
