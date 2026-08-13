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

export interface Portal {
  id: string;
  owner: Owner;
  coord: Coord;
  creatorCoord: Coord; // where the Portale piece was when it created this portal
}

export interface GameStateWithPortals {
  portals: Portal[];
}

export function canCreatePortals(pieceDef: Piece): boolean {
  return Boolean(pieceDef.creaPortali);
}

/**
 * Empty adjacent squares where a Portale could create a portal.
 * The portal is created on an empty square adjacent to the Portale.
 * Returns empty if the piece is silenced or frozen.
 */
export function getPortalCreationSquares(
  board: BoardState,
  from: Coord,
  owner: Owner,
  getPieceDefFn: (sigla: string) => Piece,
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS
): Coord[] {
  if (isActionBlocked(board, from, owner, getPieceDefFn, dimensions)) return [];

  const { file, rank } = coordToFileRank(from);
  const results: Coord[] = [];

  for (const { df, dr } of DIRECTIONS_8) {
    const target = fileRankToCoord(file + df, rank + dr, dimensions);
    if (!target) continue; // off the board
    if (getPieceAt(board, target)) continue; // must be empty
    results.push(target);
  }

  return results;
}

/**
 * Get all portals belonging to a specific owner.
 */
export function getOwnerPortals(portals: Portal[], owner: Owner): Portal[] {
  return portals.filter(p => p.owner === owner);
}

/**
 * Check if a piece can traverse portals (i.e., if there are exactly 2 portals for the owner).
 */
export function canTraversePortals(portals: Portal[], owner: Owner): boolean {
  return getOwnerPortals(portals, owner).length === 2;
}

/**
 * When a piece moves onto a portal, calculate where it would emerge.
 * The piece emerges from the other portal in the same direction of entry.
 * Returns null if traversal is not possible.
 */
export function getPortalExit(
  entryCoord: Coord,
  entryDirection: { df: number; dr: number },
  portals: Portal[],
  owner: Owner,
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS
): Coord | null {
  const ownerPortals = getOwnerPortals(portals, owner);
  if (ownerPortals.length !== 2) return null;

  const entryPortal = ownerPortals.find(p => p.coord === entryCoord);
  if (!entryPortal) return null;

  const exitPortal = ownerPortals.find(p => p.coord !== entryCoord);
  if (!exitPortal) return null;

  // Calculate exit position: from exit portal, continue in the same direction
  const { file, rank } = coordToFileRank(exitPortal.coord);
  const exitCoord = fileRankToCoord(file + entryDirection.df, rank + entryDirection.dr, dimensions);
  
  return exitCoord || null;
}

/**
 * Remove all portals created by a specific Portale piece when it is captured or creates new ones.
 */
export function removePortalsByCreator(portals: Portal[], creatorCoord: Coord): Portal[] {
  return portals.filter(p => p.creatorCoord !== creatorCoord);
}

/**
 * Generate a unique portal ID.
 */
export function generatePortalId(): string {
  return `portal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
