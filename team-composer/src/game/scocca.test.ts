import { describe, expect, it } from 'vitest';
import { canUseScocca, getScoccaTargets } from './scocca';
import { getPieceDef } from './moveEngine';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState } from './board';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A') {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

describe('canUseScocca', () => {
  it('is true only for the Arciere', () => {
    expect(canUseScocca(getPieceDef('AR'))).toBe(true);
    expect(canUseScocca(getPieceDef('TO'))).toBe(false);
  });
});

describe('getScoccaTargets', () => {
  it('finds an enemy exactly 3 squares away with a clear trajectory', () => {
    let board = place(createEmptyBoard(), 'd4', 'AR', 'A');
    board = place(board, 'd7', 'PE', 'B'); // 3 squares north
    expect(getScoccaTargets(board, 'd4', 'A')).toEqual(['d7']);
  });

  it('finds an enemy exactly 4 squares away with a clear trajectory', () => {
    let board = place(createEmptyBoard(), 'd4', 'AR', 'A');
    board = place(board, 'd8', 'PE', 'B'); // 4 squares north
    expect(getScoccaTargets(board, 'd4', 'A')).toEqual(['d8']);
  });

  it('does not include an enemy only 2 squares away', () => {
    let board = place(createEmptyBoard(), 'd4', 'AR', 'A');
    board = place(board, 'd6', 'PE', 'B');
    expect(getScoccaTargets(board, 'd4', 'A')).toEqual([]);
  });

  it('does not include an enemy 5 squares away', () => {
    let board = place(createEmptyBoard(), 'a4', 'AR', 'A');
    board = place(board, 'f4', 'PE', 'B'); // 5 squares east
    expect(getScoccaTargets(board, 'a4', 'A')).toEqual([]);
  });

  it('is blocked by a piece interposed along the trajectory', () => {
    let board = place(createEmptyBoard(), 'd4', 'AR', 'A');
    board = place(board, 'd7', 'PE', 'B');
    board = place(board, 'd6', 'CA', 'A'); // interposes at distance 2
    expect(getScoccaTargets(board, 'd4', 'A')).toEqual([]);
  });

  it('does not target friendly pieces', () => {
    let board = place(createEmptyBoard(), 'd4', 'AR', 'A');
    board = place(board, 'd7', 'PE', 'A');
    expect(getScoccaTargets(board, 'd4', 'A')).toEqual([]);
  });

  it('never targets the King, even at a valid distance with a clear trajectory', () => {
    let board = place(createEmptyBoard(), 'd4', 'AR', 'A');
    board = place(board, 'd7', 'RE', 'B');
    expect(getScoccaTargets(board, 'd4', 'A')).toEqual([]);
  });

  it('checks all 8 directions, not just orthogonal', () => {
    let board = place(createEmptyBoard(), 'd4', 'AR', 'A');
    board = place(board, 'g7', 'PE', 'B'); // 3 squares northeast
    expect(getScoccaTargets(board, 'd4', 'A')).toEqual(['g7']);
  });

  it('can find multiple simultaneous targets in different directions', () => {
    let board = place(createEmptyBoard(), 'd4', 'AR', 'A');
    board = place(board, 'd7', 'PE', 'B');
    board = place(board, 'a4', 'CA', 'B'); // 3 squares west
    expect(getScoccaTargets(board, 'd4', 'A').sort()).toEqual(['a4', 'd7']);
  });
});
