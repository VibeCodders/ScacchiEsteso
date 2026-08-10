import { describe, expect, it } from 'vitest';
import { isAdjacentToEnemyStunner } from './stun';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState } from './board';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A') {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

/** Mock piece-def lookup: only 'ST' carries stunAura, mirroring the real Stunner without depending
 *  on the live roster (isAdjacentToEnemyStunner's `getDef` is injected precisely for this reason). */
const getDef = (sigla: string) => ({ stunAura: sigla === 'ST' });

describe('isAdjacentToEnemyStunner', () => {
  it('is true for an enemy piece adjacent to a Stunner', () => {
    let board = place(createEmptyBoard(), 'd4', 'PE', 'A');
    board = place(board, 'd5', 'ST', 'B');
    expect(isAdjacentToEnemyStunner(board, 'd4', 'A', getDef)).toBe(true);
  });

  it('is false for an allied Stunner (aura only affects enemies)', () => {
    let board = place(createEmptyBoard(), 'd4', 'PE', 'A');
    board = place(board, 'd5', 'ST', 'A');
    expect(isAdjacentToEnemyStunner(board, 'd4', 'A', getDef)).toBe(false);
  });

  it('is false when no Stunner is adjacent', () => {
    let board = place(createEmptyBoard(), 'd4', 'PE', 'A');
    board = place(board, 'd6', 'ST', 'B'); // 2 squares away, not adjacent
    expect(isAdjacentToEnemyStunner(board, 'd4', 'A', getDef)).toBe(false);
  });

  it('checks all 8 adjacent squares', () => {
    const offsets: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    const files = 'abcdefgh';
    for (const [df, dr] of offsets) {
      let board = place(createEmptyBoard(), 'd4', 'PE', 'A');
      const coord = `${files[3 + df]}${4 + dr}`;
      board = place(board, coord, 'ST', 'B');
      expect(isAdjacentToEnemyStunner(board, 'd4', 'A', getDef)).toBe(true);
    }
  });

  it('is false with no piece at all adjacent', () => {
    const board = place(createEmptyBoard(), 'd4', 'PE', 'A');
    expect(isAdjacentToEnemyStunner(board, 'd4', 'A', getDef)).toBe(false);
  });
});
