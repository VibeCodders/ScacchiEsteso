import { describe, expect, it } from 'vitest';
import { triggersAreaDamage, getAreaDamageVictims } from './areaDamage';
import { getPieceDef, generatePseudoLegalMoves } from './moveEngine';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState } from './board';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A') {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

describe('triggersAreaDamage', () => {
  it('is true for a Colosso\'s melee capture', () => {
    let board = place(createEmptyBoard(), 'd4', 'CO', 'A');
    board = place(board, 'd5', 'PE', 'B');
    const move = generatePseudoLegalMoves(board, 'd4').find((m) => m.to === 'd5')!;
    expect(triggersAreaDamage(getPieceDef('CO'), move)).toBe(true);
  });

  it('is false for a Colosso\'s non-capturing move', () => {
    let board = place(createEmptyBoard(), 'd4', 'CO', 'A');
    const move = generatePseudoLegalMoves(board, 'd4').find((m) => m.to === 'd5')!;
    expect(triggersAreaDamage(getPieceDef('CO'), move)).toBe(false);
  });

  it('is false for a piece without dannoAdArea, even on a melee capture', () => {
    let board = place(createEmptyBoard(), 'd4', 'TO', 'A');
    board = place(board, 'd5', 'PE', 'B');
    const move = generatePseudoLegalMoves(board, 'd4').find((m) => m.to === 'd5')!;
    expect(triggersAreaDamage(getPieceDef('TO'), move)).toBe(false);
  });
});

describe('getAreaDamageVictims', () => {
  it('destroys pieces in all 4 orthogonally adjacent squares, both allied and enemy', () => {
    let board = place(createEmptyBoard(), 'd4', 'CO', 'A');
    board = place(board, 'd5', 'PE', 'B');
    board = place(board, 'd3', 'CA', 'A'); // ally
    board = place(board, 'e4', 'RI', 'B'); // enemy
    board = place(board, 'c4', 'CR', 'A'); // ally
    expect(getAreaDamageVictims(board, 'd4').sort()).toEqual(['c4', 'd3', 'd5', 'e4'].sort());
  });

  it('does not include diagonal neighbors', () => {
    let board = place(createEmptyBoard(), 'd4', 'CO', 'A');
    board = place(board, 'e5', 'PE', 'B'); // diagonal, not orthogonal
    expect(getAreaDamageVictims(board, 'd4')).toEqual([]);
  });

  it('excludes empty adjacent squares', () => {
    const board = place(createEmptyBoard(), 'd4', 'CO', 'A');
    expect(getAreaDamageVictims(board, 'd4')).toEqual([]);
  });

  it('the King is immune to collateral damage (README §3.3)', () => {
    let board = place(createEmptyBoard(), 'd4', 'CO', 'A');
    board = place(board, 'd5', 'RE', 'B');
    expect(getAreaDamageVictims(board, 'd4')).toEqual([]);
  });

  it('only considers squares adjacent to the landing square, not the whole board', () => {
    let board = place(createEmptyBoard(), 'd4', 'CO', 'A');
    board = place(board, 'd6', 'PE', 'B'); // 2 squares away
    expect(getAreaDamageVictims(board, 'd4')).toEqual([]);
  });
});
