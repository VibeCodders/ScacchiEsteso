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

describe('getSwapTargets — Queen-style line of sight', () => {
  it('finds an adjacent allied piece', () => {
    let board = place(createEmptyBoard(), 'd4', 'MI', 'A');
    board = place(board, 'd5', 'CA', 'A');
    expect(getSwapTargets(board, 'd4', 'A')).toEqual(['d5']);
  });

  it('finds an allied piece many squares away along a rank, file, or diagonal', () => {
    let board = place(createEmptyBoard(), 'd4', 'MI', 'A');
    board = place(board, 'd8', 'PE', 'A'); // file, far
    board = place(board, 'a4', 'TO', 'A'); // rank, far
    board = place(board, 'h8', 'CA', 'A'); // diagonal, far
    expect(getSwapTargets(board, 'd4', 'A').sort()).toEqual(['a4', 'd8', 'h8'].sort());
  });

  it('does not find an allied piece beyond a blocking piece (ally or enemy) in between', () => {
    let board = place(createEmptyBoard(), 'd4', 'MI', 'A');
    board = place(board, 'd6', 'PE', 'B'); // enemy blocker — not itself a valid target
    board = place(board, 'd8', 'PE', 'A'); // ally behind the blocker — unreachable
    expect(getSwapTargets(board, 'd4', 'A')).toEqual([]);
  });

  it('does not find an allied piece off any of the 8 straight lines (e.g. a knight-shaped offset)', () => {
    let board = place(createEmptyBoard(), 'd4', 'MI', 'A');
    board = place(board, 'e6', 'PE', 'A'); // knight offset from d4, not on a rank/file/diagonal
    expect(getSwapTargets(board, 'd4', 'A')).toEqual([]);
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

  it('excludes the King even at long range', () => {
    let board = place(createEmptyBoard(), 'd4', 'MI', 'A');
    board = place(board, 'd8', 'RE', 'A');
    expect(getSwapTargets(board, 'd4', 'A')).toEqual([]);
  });

  it('is empty when the Mistico itself is silenced by an adjacent enemy Inquisitore (README §7.3)', () => {
    let board = place(createEmptyBoard(), 'd4', 'MI', 'A');
    board = place(board, 'd8', 'CA', 'A');
    board = place(board, 'e4', 'IQ', 'B');
    expect(getSwapTargets(board, 'd4', 'A')).toEqual([]);
  });

  it('is empty when the Mistico itself is adjacent to an enemy Stunner', () => {
    let board = place(createEmptyBoard(), 'd4', 'MI', 'A');
    board = place(board, 'd8', 'CA', 'A');
    board = place(board, 'e4', 'ST', 'B');
    expect(getSwapTargets(board, 'd4', 'A')).toEqual([]);
  });
});
