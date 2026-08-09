import { describe, expect, it } from 'vitest';
import { buildClassicStartingBoard } from './samplePositions';
import { getPieceAt } from './board';

describe('buildClassicStartingBoard', () => {
  it('places exactly 32 pieces, 16 per side', () => {
    const board = buildClassicStartingBoard();
    expect(board.size).toBe(32);

    let ownerA = 0;
    let ownerB = 0;
    board.forEach((piece) => {
      if (piece.owner === 'A') ownerA += 1;
      else ownerB += 1;
    });
    expect(ownerA).toBe(16);
    expect(ownerB).toBe(16);
  });

  it('places Player A back rank on rank 1 and pawns on rank 2', () => {
    const board = buildClassicStartingBoard();
    expect(getPieceAt(board, 'e1')?.sigla).toBe('RE');
    expect(getPieceAt(board, 'd1')?.sigla).toBe('RA');
    expect(getPieceAt(board, 'a1')?.sigla).toBe('TO');
    expect(getPieceAt(board, 'h1')?.sigla).toBe('TO');
    for (const file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      expect(getPieceAt(board, `${file}2`)?.sigla).toBe('PE');
      expect(getPieceAt(board, `${file}2`)?.owner).toBe('A');
    }
  });

  it('places Player B back rank on rank 8 and pawns on rank 7', () => {
    const board = buildClassicStartingBoard();
    expect(getPieceAt(board, 'e8')?.sigla).toBe('RE');
    expect(getPieceAt(board, 'd8')?.sigla).toBe('RA');
    for (const file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      expect(getPieceAt(board, `${file}7`)?.sigla).toBe('PE');
      expect(getPieceAt(board, `${file}7`)?.owner).toBe('B');
    }
  });

  it('leaves the middle ranks (3-6) empty', () => {
    const board = buildClassicStartingBoard();
    for (const rank of [3, 4, 5, 6]) {
      for (const file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
        expect(getPieceAt(board, `${file}${rank}`)).toBeUndefined();
      }
    }
  });
});
