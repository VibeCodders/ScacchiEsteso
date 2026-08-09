import { describe, expect, it } from 'vitest';
import { castRay, directionBetween, isPathClear } from './lineOfSight';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState } from './board';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A') {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

describe('directionBetween', () => {
  it('returns the unit vector for horizontal, vertical, and diagonal alignments', () => {
    expect(directionBetween('d4', 'g4')).toEqual({ df: 1, dr: 0 }); // east
    expect(directionBetween('d4', 'd1')).toEqual({ df: 0, dr: -1 }); // south
    expect(directionBetween('d4', 'g7')).toEqual({ df: 1, dr: 1 }); // northeast
    expect(directionBetween('d4', 'b2')).toEqual({ df: -1, dr: -1 }); // southwest
  });

  it('returns null for coordinates that are not on a straight line', () => {
    expect(directionBetween('d4', 'f5')).toBeNull(); // knight-shaped offset
  });

  it('returns null for identical coordinates', () => {
    expect(directionBetween('d4', 'd4')).toBeNull();
  });
});

describe('castRay', () => {
  it('returns every empty square up to maxSteps when nothing blocks the way', () => {
    const ray = castRay(createEmptyBoard(), 'd4', { df: 1, dr: 0 }, 3);
    expect(ray.emptySquares).toEqual(['e4', 'f4', 'g4']);
    expect(ray.blockedBy).toBeNull();
  });

  it('stops at the first occupied square, excluding it from emptySquares', () => {
    const board = place(createEmptyBoard(), 'g4', 'TO', 'B');
    const ray = castRay(board, 'd4', { df: 1, dr: 0 }, 8);
    expect(ray.emptySquares).toEqual(['e4', 'f4']);
    expect(ray.blockedBy).toBe('g4');
  });

  it('stops at the board edge when maxSteps would go further', () => {
    const ray = castRay(createEmptyBoard(), 'g4', { df: 1, dr: 0 }, 8);
    expect(ray.emptySquares).toEqual(['h4']);
    expect(ray.blockedBy).toBeNull();
  });
});

describe('isPathClear — README §7.1 interposition', () => {
  it('is true when nothing sits between two aligned squares', () => {
    expect(isPathClear(createEmptyBoard(), 'd1', 'd8')).toBe(true);
  });

  it('is false when a single piece interposes', () => {
    const board = place(createEmptyBoard(), 'd5', 'PE', 'A');
    expect(isPathClear(board, 'd1', 'd8')).toBe(false);
  });

  it('is false when multiple pieces interpose along the line', () => {
    let board = place(createEmptyBoard(), 'd3', 'PE', 'A');
    board = place(board, 'd6', 'PE', 'B');
    expect(isPathClear(board, 'd1', 'd8')).toBe(false);
  });

  it('ignores pieces standing on the endpoints themselves', () => {
    let board = place(createEmptyBoard(), 'd1', 'TO', 'A');
    board = place(board, 'd8', 'RE', 'B');
    expect(isPathClear(board, 'd1', 'd8')).toBe(true);
  });

  it('works diagonally, not just orthogonally', () => {
    const board = place(createEmptyBoard(), 'c3', 'PE', 'A');
    expect(isPathClear(board, 'a1', 'e5')).toBe(false);
    expect(isPathClear(createEmptyBoard(), 'a1', 'e5')).toBe(true);
  });

  it('is false for two squares that are not aligned at all', () => {
    expect(isPathClear(createEmptyBoard(), 'd4', 'f5')).toBe(false);
  });

  it('is true for adjacent squares (nothing can interpose)', () => {
    expect(isPathClear(createEmptyBoard(), 'd4', 'd5')).toBe(true);
  });
});
