import { describe, expect, it } from 'vitest';
import { canSwapperSwap, getSwapperCandidateSquares, getSwapperCandidatePairs } from './swapper';
import { getPieceDef } from './moveEngine';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState } from './board';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A') {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

describe('canSwapperSwap', () => {
  it('is true only for the Swapper', () => {
    expect(canSwapperSwap(getPieceDef('SW'))).toBe(true);
    expect(canSwapperSwap(getPieceDef('MI'))).toBe(false);
    expect(canSwapperSwap(getPieceDef('TO'))).toBe(false);
  });
});

describe('getSwapperCandidateSquares', () => {
  it('includes the Swapper\'s own square', () => {
    const board = place(createEmptyBoard(), 'd4', 'SW', 'A');
    expect(getSwapperCandidateSquares(board, 'd4', 'A')).toContain('d4');
  });

  it('includes 8-neighbor allies', () => {
    let board = place(createEmptyBoard(), 'd4', 'SW', 'A');
    board = place(board, 'd5', 'PE', 'A');
    board = place(board, 'c3', 'CA', 'A');
    const candidates = getSwapperCandidateSquares(board, 'd4', 'A');
    expect(candidates).toContain('d5');
    expect(candidates).toContain('c3');
  });

  it('excludes enemy pieces and empty squares', () => {
    let board = place(createEmptyBoard(), 'd4', 'SW', 'A');
    board = place(board, 'd5', 'PE', 'B'); // enemy
    const candidates = getSwapperCandidateSquares(board, 'd4', 'A');
    expect(candidates).not.toContain('d5');
    expect(candidates).not.toContain('e5'); // empty
    expect(candidates).toEqual(['d4']); // only its own square
  });

  it('is empty when the Swapper itself is adjacent to an enemy Stunner', () => {
    let board = place(createEmptyBoard(), 'd4', 'SW', 'A');
    board = place(board, 'd5', 'PE', 'A');
    board = place(board, 'e4', 'ST', 'B');
    expect(getSwapperCandidateSquares(board, 'd4', 'A')).toEqual([]);
  });
});

describe('getSwapperCandidatePairs', () => {
  it('returns N*(N-1)/2 pairs with no self-pairs, for N candidates', () => {
    let board = place(createEmptyBoard(), 'd4', 'SW', 'A');
    board = place(board, 'd5', 'PE', 'A');
    board = place(board, 'c3', 'CA', 'A');
    // candidates: d4 (self), d5, c3 -> 3 candidates -> 3 pairs
    const pairs = getSwapperCandidatePairs(board, 'd4', 'A');
    expect(pairs).toHaveLength(3);
    for (const [a, b] of pairs) {
      expect(a).not.toBe(b);
    }
  });

  it('is empty when there are fewer than 2 candidates (impossible in practice, but degenerate-safe)', () => {
    // Not actually reachable since the Swapper's own square is always a candidate, but confirms
    // the pairing logic doesn't error on a 1-element input.
    const board = place(createEmptyBoard(), 'd4', 'SW', 'A');
    expect(getSwapperCandidatePairs(board, 'd4', 'A')).toEqual([]);
  });
});
