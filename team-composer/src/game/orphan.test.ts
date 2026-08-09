import { describe, expect, it } from 'vitest';
import { canMimic, getOrphanThreats, getMimicMoves } from './orphan';
import { getPieceDef } from './moveEngine';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState } from './board';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A') {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

describe('canMimic', () => {
  it('is true only for the Orfano', () => {
    expect(canMimic(getPieceDef('OR'))).toBe(true);
    expect(canMimic(getPieceDef('TO'))).toBe(false);
  });
});

describe('getOrphanThreats', () => {
  it('finds an enemy piece that could capture the Orfano', () => {
    let board = place(createEmptyBoard(), 'd4', 'OR', 'A');
    board = place(board, 'd5', 'PE', 'B'); // pawn captures diagonally forward — not d4 from d5 though
    board = place(board, 'e5', 'PE', 'B'); // this one CAN capture d4 (diagonal forward for B is toward lower ranks)
    expect(getOrphanThreats(board, 'd4', 'A')).toEqual(['e5']);
  });

  it('counts a leap threat (e.g. a Knight), not just melee', () => {
    let board = place(createEmptyBoard(), 'd4', 'OR', 'A');
    board = place(board, 'c6', 'CA', 'B'); // knight move c6 -> d4
    expect(getOrphanThreats(board, 'd4', 'A')).toEqual(['c6']);
  });

  it('is empty when nothing threatens the Orfano', () => {
    const board = place(createEmptyBoard(), 'd4', 'OR', 'A');
    expect(getOrphanThreats(board, 'd4', 'A')).toEqual([]);
  });

  it('ignores allied pieces that could "capture" the square (they cannot, but sanity check)', () => {
    let board = place(createEmptyBoard(), 'd4', 'OR', 'A');
    board = place(board, 'e5', 'PE', 'A'); // ally, not a threat
    expect(getOrphanThreats(board, 'd4', 'A')).toEqual([]);
  });

  it('lists multiple simultaneous threats', () => {
    let board = place(createEmptyBoard(), 'd4', 'OR', 'A');
    board = place(board, 'e5', 'PE', 'B');
    board = place(board, 'c6', 'CA', 'B');
    expect(getOrphanThreats(board, 'd4', 'A').sort()).toEqual(['c6', 'e5'].sort());
  });
});

describe('getMimicMoves', () => {
  it('gives the Orfano the mimicked piece\'s movement pattern, still as its own owner', () => {
    let board = place(createEmptyBoard(), 'd4', 'OR', 'A');
    board = place(board, 'a1', 'TO', 'B'); // Torre — long-range slide, very different from Orfano's own 1-step
    const moves = getMimicMoves(board, 'd4', 'a1');
    expect(moves.map((m) => m.to)).toHaveLength(14); // Torre's move count from d4 on an empty board
    expect(moves.every((m) => m.from === 'd4')).toBe(true);
  });

  it('returns an empty array when either square is empty', () => {
    const board = place(createEmptyBoard(), 'd4', 'OR', 'A');
    expect(getMimicMoves(board, 'd4', 'a1')).toEqual([]);
  });
});
