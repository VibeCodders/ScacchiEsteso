import { describe, expect, it } from 'vitest';
import { canCreatePortals, getPortalCreationSquares, removePortalsByCreator, generatePortalId, getOwnerPortals, canTraversePortals, getPortalExit, type Portal } from './portal';
import { getPieceDef } from './moveEngine';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState } from './board';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A'): BoardState {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

describe('canCreatePortals', () => {
  it('is true only for the Portale', () => {
    expect(canCreatePortals(getPieceDef('PT'))).toBe(true);
    for (const sigla of ['RE', 'TO', 'AL', 'CA', 'TT', 'MG', 'SW']) {
      expect(canCreatePortals(getPieceDef(sigla))).toBe(false);
    }
  });
});

describe('getPortalCreationSquares', () => {
  it('lists every adjacent empty square for a Portale', () => {
    const board = place(createEmptyBoard(), 'd4', 'PT', 'A');
    expect(getPortalCreationSquares(board, 'd4', 'A', getPieceDef).sort()).toEqual(
      ['c3', 'c4', 'c5', 'd3', 'd5', 'e3', 'e4', 'e5'].sort(),
    );
  });

  it('excludes occupied squares and squares off the board edge', () => {
    let board = place(createEmptyBoard(), 'a1', 'PT', 'A');
    board = place(board, 'a2', 'PE', 'B');
    board = place(board, 'b1', 'PE', 'A');
    const squares = getPortalCreationSquares(board, 'a1', 'A', getPieceDef).sort();
    expect(squares).not.toContain('a2');
    expect(squares).not.toContain('b1');
    expect(squares).toContain('b2');
  });

  it('returns [] when the Portale is frozen by an adjacent enemy Stunner', () => {
    let board = place(createEmptyBoard(), 'd4', 'PT', 'A');
    board = place(board, 'd5', 'ST', 'B');
    expect(getPortalCreationSquares(board, 'd4', 'A', getPieceDef)).toEqual([]);
  });
});

describe('removePortalsByCreator', () => {
  it('removes all portals created by a specific Portale piece', () => {
    const portals: Portal[] = [
      { id: 'p1', owner: 'A', coord: 'd4', creatorCoord: 'd4' },
      { id: 'p2', owner: 'A', coord: 'e5', creatorCoord: 'd4' },
      { id: 'p3', owner: 'B', coord: 'f6', creatorCoord: 'e6' },
    ];
    const filtered = removePortalsByCreator(portals, 'd4');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('p3');
  });

  it('returns unchanged array when no portals match the creator', () => {
    const portals: Portal[] = [
      { id: 'p1', owner: 'A', coord: 'd4', creatorCoord: 'd4' },
      { id: 'p2', owner: 'B', coord: 'f6', creatorCoord: 'e6' },
    ];
    const filtered = removePortalsByCreator(portals, 'a1');
    expect(filtered).toHaveLength(2);
  });
});

describe('generatePortalId', () => {
  it('generates unique IDs', () => {
    const id1 = generatePortalId();
    const id2 = generatePortalId();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^portal_/);
  });
});

describe('getOwnerPortals', () => {
  it('filters portals by owner', () => {
    const portals: Portal[] = [
      { id: 'p1', owner: 'A', coord: 'd4', creatorCoord: 'd4' },
      { id: 'p2', owner: 'A', coord: 'e5', creatorCoord: 'd4' },
      { id: 'p3', owner: 'B', coord: 'f6', creatorCoord: 'e6' },
    ];
    expect(getOwnerPortals(portals, 'A')).toHaveLength(2);
    expect(getOwnerPortals(portals, 'B')).toHaveLength(1);
  });
});

describe('canTraversePortals', () => {
  it('returns true only when exactly 2 portals exist for the owner', () => {
    const portals: Portal[] = [
      { id: 'p1', owner: 'A', coord: 'd4', creatorCoord: 'd4' },
      { id: 'p2', owner: 'A', coord: 'e5', creatorCoord: 'd4' },
    ];
    expect(canTraversePortals(portals, 'A')).toBe(true);
    expect(canTraversePortals(portals, 'B')).toBe(false);

    const singlePortal = [portals[0]];
    expect(canTraversePortals(singlePortal, 'A')).toBe(false);
  });
});

describe('getPortalExit', () => {
  it('calculates the exit position when entering a portal', () => {
    const portals: Portal[] = [
      { id: 'p1', owner: 'A', coord: 'd4', creatorCoord: 'd4' },
      { id: 'p2', owner: 'A', coord: 'e5', creatorCoord: 'd4' },
    ];
    
    // Entering d4 from south (moving north), should exit e5 continuing north
    const exit = getPortalExit('d4', { df: 0, dr: 1 }, portals, 'A');
    expect(exit).toBe('e6'); // e5 + north = e6
  });

  it('returns null when portals are not properly configured', () => {
    const singlePortal: Portal[] = [
      { id: 'p1', owner: 'A', coord: 'd4', creatorCoord: 'd4' },
    ];
    expect(getPortalExit('d4', { df: 0, dr: 1 }, singlePortal, 'A')).toBeNull();
    
    const noMatch: Portal[] = [
      { id: 'p1', owner: 'A', coord: 'd4', creatorCoord: 'd4' },
      { id: 'p2', owner: 'A', coord: 'e5', creatorCoord: 'd4' },
    ];
    expect(getPortalExit('a1', { df: 0, dr: 1 }, noMatch, 'A')).toBeNull();
  });

  it('returns null when exit would be off the board', () => {
    const portals: Portal[] = [
      { id: 'p1', owner: 'A', coord: 'a8', creatorCoord: 'a8' },
      { id: 'p2', owner: 'A', coord: 'b8', creatorCoord: 'a8' },
    ];
    // Entering a8 from south, would exit b8 continuing north (off board)
    const exit = getPortalExit('a8', { df: 0, dr: 1 }, portals, 'A');
    expect(exit).toBeNull();
  });
});
