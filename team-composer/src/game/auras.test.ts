import { describe, expect, it } from 'vitest';
import { isShieldedByEgida, isSilenced } from './auras';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState } from './board';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A') {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

describe('isSilenced — Inquisitore aura (README §7.3)', () => {
  it('is true for an enemy piece adjacent to an Inquisitore', () => {
    let board = place(createEmptyBoard(), 'd4', 'AR', 'A');
    board = place(board, 'd5', 'IQ', 'B');
    expect(isSilenced(board, 'd4', 'A')).toBe(true);
  });

  it('is false for an allied Inquisitore (aura only affects enemies)', () => {
    let board = place(createEmptyBoard(), 'd4', 'AR', 'A');
    board = place(board, 'd5', 'IQ', 'A');
    expect(isSilenced(board, 'd4', 'A')).toBe(false);
  });

  it('is false when no Inquisitore is adjacent', () => {
    let board = place(createEmptyBoard(), 'd4', 'AR', 'A');
    board = place(board, 'd6', 'IQ', 'B'); // 2 squares away, not adjacent
    expect(isSilenced(board, 'd4', 'A')).toBe(false);
  });

  it('checks all 8 adjacent squares', () => {
    let board = place(createEmptyBoard(), 'd4', 'AR', 'A');
    board = place(board, 'c3', 'IQ', 'B'); // diagonal neighbor
    expect(isSilenced(board, 'd4', 'A')).toBe(true);
  });
});

describe('isShieldedByEgida — Paladino shield (README §7)', () => {
  it('is true for an allied piece adjacent to a Paladino', () => {
    let board = place(createEmptyBoard(), 'd4', 'PE', 'A');
    board = place(board, 'd5', 'PA', 'A');
    expect(isShieldedByEgida(board, 'd4', 'A')).toBe(true);
  });

  it('is false for an enemy piece adjacent to the opponent\'s Paladino', () => {
    let board = place(createEmptyBoard(), 'd4', 'PE', 'B');
    board = place(board, 'd5', 'PA', 'A');
    expect(isShieldedByEgida(board, 'd4', 'B')).toBe(false);
  });

  it('is false when no Paladino is adjacent', () => {
    const board = place(createEmptyBoard(), 'd4', 'PE', 'A');
    expect(isShieldedByEgida(board, 'd4', 'A')).toBe(false);
  });

  it('priority: lapses when the Paladino itself is silenced by an enemy Inquisitore', () => {
    let board = place(createEmptyBoard(), 'd4', 'PE', 'A');
    board = place(board, 'd5', 'PA', 'A');
    board = place(board, 'd6', 'IQ', 'B'); // adjacent to the Paladino at d5, silencing it
    expect(isShieldedByEgida(board, 'd4', 'A')).toBe(false);
  });
});
