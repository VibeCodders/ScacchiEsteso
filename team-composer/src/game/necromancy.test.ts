import { describe, expect, it } from 'vitest';
import { canRevive, getRevivalSquares, getRevivableSiglas } from './necromancy';
import { getPieceDef } from './moveEngine';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState } from './board';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A') {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

describe('canRevive', () => {
  it('is true only for the Necromante', () => {
    expect(canRevive(getPieceDef('NE'))).toBe(true);
    expect(canRevive(getPieceDef('TO'))).toBe(false);
  });
});

describe('getRevivalSquares', () => {
  it('lists all 8 adjacent squares when empty', () => {
    const board = place(createEmptyBoard(), 'd4', 'NE', 'A');
    expect(getRevivalSquares(board, 'd4', 'A').sort()).toEqual(
      ['c3', 'c4', 'c5', 'd3', 'd5', 'e3', 'e4', 'e5'].sort(),
    );
  });

  it('excludes occupied adjacent squares', () => {
    let board = place(createEmptyBoard(), 'd4', 'NE', 'A');
    board = place(board, 'd5', 'CA', 'A');
    board = place(board, 'e4', 'PE', 'B');
    const squares = getRevivalSquares(board, 'd4', 'A');
    expect(squares).not.toContain('d5');
    expect(squares).not.toContain('e4');
    expect(squares).toHaveLength(6);
  });

  it('excludes off-board neighbors from a corner', () => {
    const board = place(createEmptyBoard(), 'a1', 'NE', 'A');
    expect(getRevivalSquares(board, 'a1', 'A').sort()).toEqual(['a2', 'b1', 'b2'].sort());
  });

  it('is empty when the Necromante itself is silenced by an adjacent enemy Inquisitore (README §7.3)', () => {
    let board = place(createEmptyBoard(), 'd4', 'NE', 'A');
    board = place(board, 'e4', 'IQ', 'B');
    expect(getRevivalSquares(board, 'd4', 'A')).toEqual([]);
  });

  it('is empty when the Necromante itself is adjacent to an enemy Stunner', () => {
    let board = place(createEmptyBoard(), 'd4', 'NE', 'A');
    board = place(board, 'e4', 'ST', 'B');
    expect(getRevivalSquares(board, 'd4', 'A')).toEqual([]);
  });
});

describe('getRevivableSiglas', () => {
  it('includes every distinct "pedone"-category sigla in the graveyard (PE, PG, FG — not just PE), sorted by point cost', () => {
    const graveyard = [
      createPieceInstance('PE', 'A'), // 4pt — captured/listed first, but not the cheapest
      createPieceInstance('PG', 'A'), // 2pt
      createPieceInstance('FG', 'A'), // 3pt
    ];
    expect(getRevivableSiglas(graveyard)).toEqual(['PG', 'FG', 'PE']); // ascending by point cost, not graveyard order
  });

  it('excludes non-"pedone"-category pieces even if captured', () => {
    const graveyard = [createPieceInstance('TO', 'A'), createPieceInstance('CA', 'A')];
    expect(getRevivableSiglas(graveyard)).toEqual([]);
  });

  it('deduplicates repeated siglas', () => {
    const graveyard = [createPieceInstance('PE', 'A'), createPieceInstance('PE', 'A')];
    expect(getRevivableSiglas(graveyard)).toEqual(['PE']);
  });

  it('is empty for an empty graveyard', () => {
    expect(getRevivableSiglas([])).toEqual([]);
  });
});
