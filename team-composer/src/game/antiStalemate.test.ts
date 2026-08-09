import { describe, expect, it } from 'vitest';
import { computeMaterialScore, resolveAntiStalemateWinner } from './antiStalemate';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState } from './board';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A') {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

describe('computeMaterialScore', () => {
  it('sums the punti of every piece the owner has on the board', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A'); // 0pt
    board = place(board, 'a1', 'TO', 'A'); // 15pt
    board = place(board, 'b1', 'PE', 'A'); // 4pt
    expect(computeMaterialScore(board, 'A')).toBe(19);
  });

  it('is 0 when the owner has no pieces at all', () => {
    expect(computeMaterialScore(createEmptyBoard(), 'A')).toBe(0);
  });

  it('ignores the opponent\'s pieces', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'a8', 'RA', 'B'); // 48pt, but owned by B
    expect(computeMaterialScore(board, 'A')).toBe(0);
  });
});

describe('resolveAntiStalemateWinner', () => {
  it('picks the owner with the higher remaining material score', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'a1', 'TO', 'A'); // 15pt
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'a8', 'PE', 'B'); // 4pt
    expect(resolveAntiStalemateWinner(board)).toBe('A');
  });

  it('returns undefined (draw) when scores are equal', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'a1', 'TO', 'A'); // 15pt
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'a8', 'TO', 'B'); // 15pt
    expect(resolveAntiStalemateWinner(board)).toBeUndefined();
  });

  it('is a draw between two bare Kings (0 vs 0)', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    expect(resolveAntiStalemateWinner(board)).toBeUndefined();
  });
});
