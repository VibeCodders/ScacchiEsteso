import { describe, expect, it } from 'vitest';
import {
  createEmptyBoard,
  createPieceInstance,
  isValidCoord,
  allCoords,
  getPieceAt,
  setPieceAt,
  removePieceAt,
  movePiece,
  coordToDisplayPosition,
  displayPositionToCoord,
} from './board';

describe('createEmptyBoard', () => {
  it('starts with no pieces', () => {
    const board = createEmptyBoard();
    expect(board.size).toBe(0);
  });
});

describe('isValidCoord', () => {
  it('accepts all 64 standard algebraic coordinates', () => {
    for (const coord of allCoords()) {
      expect(isValidCoord(coord)).toBe(true);
    }
  });

  it.each(['i1', 'a0', 'a9', 'h', '', 'aa', '11', 'e4 '])('rejects invalid coordinate %s', (coord) => {
    expect(isValidCoord(coord)).toBe(false);
  });
});

describe('allCoords', () => {
  it('returns exactly 64 unique coordinates', () => {
    const coords = allCoords();
    expect(coords).toHaveLength(64);
    expect(new Set(coords).size).toBe(64);
  });

  it('lists rank 8 first and rank 1 last', () => {
    const coords = allCoords();
    expect(coords[0]).toBe('a8');
    expect(coords[coords.length - 1]).toBe('h1');
  });
});

describe('get/set/remove piece', () => {
  it('places and retrieves a piece without mutating the original board', () => {
    const board = createEmptyBoard();
    const king = createPieceInstance('RE', 'A');
    const next = setPieceAt(board, 'e1', king);

    expect(getPieceAt(board, 'e1')).toBeUndefined();
    expect(getPieceAt(next, 'e1')).toBe(king);
  });

  it('throws when setting a piece on an invalid coordinate', () => {
    const board = createEmptyBoard();
    expect(() => setPieceAt(board, 'z9', createPieceInstance('RE', 'A'))).toThrow();
  });

  it('removes a piece without mutating the original board', () => {
    const board = setPieceAt(createEmptyBoard(), 'e1', createPieceInstance('RE', 'A'));
    const next = removePieceAt(board, 'e1');

    expect(getPieceAt(board, 'e1')).toBeDefined();
    expect(getPieceAt(next, 'e1')).toBeUndefined();
  });
});

describe('movePiece', () => {
  it('moves a piece from one square to another and marks it as moved', () => {
    const board = setPieceAt(createEmptyBoard(), 'e2', createPieceInstance('PE', 'A'));
    const next = movePiece(board, 'e2', 'e4');

    expect(getPieceAt(next, 'e2')).toBeUndefined();
    const moved = getPieceAt(next, 'e4');
    expect(moved?.sigla).toBe('PE');
    expect(moved?.hasMoved).toBe(true);
  });

  it('throws when there is no piece at the origin', () => {
    const board = createEmptyBoard();
    expect(() => movePiece(board, 'e2', 'e4')).toThrow();
  });

  it('throws on an invalid destination', () => {
    const board = setPieceAt(createEmptyBoard(), 'e2', createPieceInstance('PE', 'A'));
    expect(() => movePiece(board, 'e2', 'z9')).toThrow();
  });
});

describe('createPieceInstance', () => {
  it('assigns unique ids to each instance', () => {
    const a = createPieceInstance('PE', 'A');
    const b = createPieceInstance('PE', 'A');
    expect(a.id).not.toBe(b.id);
  });

  it('starts with hasMoved false', () => {
    expect(createPieceInstance('PE', 'A').hasMoved).toBe(false);
  });
});

describe('coordToDisplayPosition / displayPositionToCoord', () => {
  it('maps a8 to the top-left cell (row 0, col 0)', () => {
    expect(coordToDisplayPosition('a8')).toEqual({ row: 0, col: 0 });
  });

  it('maps h1 to the bottom-right cell (row 7, col 7)', () => {
    expect(coordToDisplayPosition('h1')).toEqual({ row: 7, col: 7 });
  });

  it('round-trips every coordinate through row/col and back', () => {
    for (const coord of allCoords()) {
      const { row, col } = coordToDisplayPosition(coord);
      expect(displayPositionToCoord(row, col)).toBe(coord);
    }
  });

  it('throws for an out-of-range display position', () => {
    expect(() => displayPositionToCoord(-1, 0)).toThrow();
    expect(() => displayPositionToCoord(0, 8)).toThrow();
  });
});
