import { describe, expect, it } from 'vitest';
import { canSwap, getSwapTargets } from './swap';
import { getPieceDef } from './moveEngine';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState } from './board';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A') {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

describe('canSwap', () => {
  it('is true only for the Mistico', () => {
    expect(canSwap(getPieceDef('MI'))).toBe(true);
    expect(canSwap(getPieceDef('TO'))).toBe(false);
  });
});

describe('getSwapTargets', () => {
  it('finds an adjacent allied piece', () => {
    let board = place(createEmptyBoard(), 'd4', 'MI', 'A');
    board = place(board, 'd5', 'CA', 'A');
    expect(getSwapTargets(board, 'd4', 'A')).toEqual(['d5']);
  });

  it('checks all 8 adjacent squares', () => {
    let board = place(createEmptyBoard(), 'd4', 'MI', 'A');
    board = place(board, 'c3', 'PE', 'A');
    board = place(board, 'e5', 'TO', 'A');
    expect(getSwapTargets(board, 'd4', 'A').sort()).toEqual(['c3', 'e5']);
  });

  it('does not include enemy pieces', () => {
    let board = place(createEmptyBoard(), 'd4', 'MI', 'A');
    board = place(board, 'd5', 'PE', 'B');
    expect(getSwapTargets(board, 'd4', 'A')).toEqual([]);
  });

  it('does not include empty squares', () => {
    const board = place(createEmptyBoard(), 'd4', 'MI', 'A');
    expect(getSwapTargets(board, 'd4', 'A')).toEqual([]);
  });

  it('excludes the King even though it is an adjacent ally', () => {
    let board = place(createEmptyBoard(), 'd4', 'MI', 'A');
    board = place(board, 'd5', 'RE', 'A');
    expect(getSwapTargets(board, 'd4', 'A')).toEqual([]);
  });

  it('does not include a piece 2 squares away (only direct adjacency)', () => {
    let board = place(createEmptyBoard(), 'd4', 'MI', 'A');
    board = place(board, 'd6', 'PE', 'A');
    expect(getSwapTargets(board, 'd4', 'A')).toEqual([]);
  });

  it('is empty when the Mistico itself is silenced by an adjacent enemy Inquisitore (README §7.3)', () => {
    let board = place(createEmptyBoard(), 'd4', 'MI', 'A');
    board = place(board, 'd5', 'CA', 'A');
    board = place(board, 'e4', 'IQ', 'B');
    expect(getSwapTargets(board, 'd4', 'A')).toEqual([]);
  });
});
