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
  coordToFileRank,
  fileRankToCoord,
  indexToFile,
  fileToIndex,
  type BoardDimensions,
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

  it('throws when setting a piece on a malformed coordinate', () => {
    const board = createEmptyBoard();
    expect(() => setPieceAt(board, 'e0', createPieceInstance('RE', 'A'))).toThrow(); // rank must be >= 1
    expect(() => setPieceAt(board, 'zz', createPieceInstance('RE', 'A'))).toThrow(); // no rank at all
  });

  it("does not bound-check against the default 8×8 board — BoardState carries no size of its own, so a coordinate beyond it is fine to store", () => {
    const board = createEmptyBoard();
    const next = setPieceAt(board, 'j12', createPieceInstance('RE', 'A'));
    expect(getPieceAt(next, 'j12')?.sigla).toBe('RE');
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

  it('throws on a malformed destination', () => {
    const board = setPieceAt(createEmptyBoard(), 'e2', createPieceInstance('PE', 'A'));
    expect(() => movePiece(board, 'e2', 'e0')).toThrow();
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

describe('indexToFile / fileToIndex — spreadsheet-style multi-letter files', () => {
  it('matches the classic single-letter scheme for indices 0-25', () => {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    for (let i = 0; i < 26; i++) {
      expect(indexToFile(i)).toBe(letters[i]);
    }
  });

  it('rolls over to double letters starting at index 26', () => {
    expect(indexToFile(26)).toBe('aa');
    expect(indexToFile(27)).toBe('ab');
    expect(indexToFile(51)).toBe('az');
    expect(indexToFile(52)).toBe('ba');
    expect(indexToFile(701)).toBe('zz'); // 26 + 26*26 - 1
    expect(indexToFile(702)).toBe('aaa');
  });

  it('round-trips a wide range of indices through fileToIndex', () => {
    for (const index of [0, 1, 7, 25, 26, 27, 100, 701, 702, 5000]) {
      expect(fileToIndex(indexToFile(index))).toBe(index);
    }
  });
});

describe('fileRankToCoord / coordToFileRank — dimension-aware bounds', () => {
  it('returns null past the given width/height instead of the default 8×8', () => {
    const dims: BoardDimensions = { width: 10, height: 6 };
    expect(fileRankToCoord(9, 6, dims)).toBe('j6'); // in-bounds on the 10×6 board
    expect(fileRankToCoord(10, 6, dims)).toBeNull(); // width exceeded
    expect(fileRankToCoord(9, 7, dims)).toBeNull(); // height exceeded
  });

  it('still defaults to the classic 8×8 bounds when dimensions are omitted', () => {
    expect(fileRankToCoord(7, 8)).toBe('h8');
    expect(fileRankToCoord(8, 8)).toBeNull();
  });

  it('decodes a double-letter coordinate correctly', () => {
    expect(coordToFileRank('aa5')).toEqual({ file: 26, rank: 5 });
    expect(fileRankToCoord(26, 5, { width: 30, height: 8 })).toBe('aa5');
  });
});

describe('isValidCoord / allCoords — custom board dimensions', () => {
  it('accepts a coordinate within a custom size and rejects one beyond it', () => {
    const dims: BoardDimensions = { width: 4, height: 4 };
    expect(isValidCoord('d4', dims)).toBe(true);
    expect(isValidCoord('e4', dims)).toBe(false); // width exceeded
    expect(isValidCoord('d5', dims)).toBe(false); // height exceeded
  });

  it('generates the right number of coordinates, including double-letter files for wide boards', () => {
    const dims: BoardDimensions = { width: 30, height: 4 };
    const coords = allCoords(dims);
    expect(coords).toHaveLength(120);
    expect(coords).toContain('aa1');
    expect(coords).toContain('ad4');
    expect(new Set(coords).size).toBe(120);
  });

  it('a 4×4 board (the minimum playable size) produces exactly 16 unique coordinates', () => {
    const coords = allCoords({ width: 4, height: 4 });
    expect(coords).toHaveLength(16);
    expect(new Set(coords).size).toBe(16);
  });
});
