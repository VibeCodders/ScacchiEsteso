import { describe, expect, it } from 'vitest';
import { computePieceRangeSquares } from './pieceInfo';
import { getPieceDef } from './moveEngine';

describe('computePieceRangeSquares — step piece (Re)', () => {
  it('reports all 8 adjacent squares as both move and capture squares from a central square', () => {
    const { moveSquares, captureSquares } = computePieceRangeSquares(getPieceDef('RE'), 'A', 'e4');
    const expected = ['d3', 'd4', 'd5', 'e3', 'e5', 'f3', 'f4', 'f5'];
    expect([...moveSquares].sort()).toEqual(expected.sort());
    expect([...captureSquares].sort()).toEqual(expected.sort());
  });
});

describe('computePieceRangeSquares — pawn-style capture-only diagonals (Pedone)', () => {
  it('separates the forward move squares from the diagonal capture-only squares', () => {
    const { moveSquares, captureSquares, exampleCapture } = computePieceRangeSquares(getPieceDef('PE'), 'A', 'd4');

    expect([...moveSquares].sort()).toEqual(['d5', 'd6']);
    expect([...captureSquares].sort()).toEqual(['c5', 'e5']);
    expect(exampleCapture?.enemyAt).toBe('e5');
  });

  it('mirrors forward direction for owner B', () => {
    const { moveSquares, captureSquares } = computePieceRangeSquares(getPieceDef('PE'), 'B', 'd5');
    expect([...moveSquares].sort()).toEqual(['d3', 'd4']);
    expect([...captureSquares].sort()).toEqual(['c4', 'e4']);
  });
});

describe('computePieceRangeSquares — slide piece (Torre)', () => {
  it('covers the whole file and rank from a central square, stopping at the board edge', () => {
    const { moveSquares, captureSquares } = computePieceRangeSquares(getPieceDef('TO'), 'A', 'd4');
    const expected = ['d1', 'd2', 'd3', 'd5', 'd6', 'd7', 'd8', 'a4', 'b4', 'c4', 'e4', 'f4', 'g4', 'h4'];
    expect(moveSquares).toHaveLength(14);
    expect([...moveSquares].sort()).toEqual(expected.sort());
    expect([...captureSquares].sort()).toEqual(expected.sort());
  });
});

describe('computePieceRangeSquares — knight-pattern leap (Cavallo)', () => {
  it('lists all 8 L-shaped destinations from a central square', () => {
    const { moveSquares, captureSquares } = computePieceRangeSquares(getPieceDef('CA'), 'A', 'd4');
    const expected = ['c2', 'e2', 'b3', 'f3', 'b5', 'f5', 'c6', 'e6'];
    expect([...moveSquares].sort()).toEqual(expected.sort());
    expect([...captureSquares].sort()).toEqual(expected.sort());
  });
});

describe('computePieceRangeSquares — grasshopper leap (Cavalletta)', () => {
  it('illustrates a landing 2 squares away in each direction, assuming an adjacent hurdle', () => {
    const { moveSquares, captureSquares } = computePieceRangeSquares(getPieceDef('CV'), 'A', 'd4');
    const expected = ['d2', 'd6', 'b4', 'f4', 'b2', 'b6', 'f2', 'f6'];
    expect([...moveSquares].sort()).toEqual(expected.sort());
    expect([...captureSquares].sort()).toEqual(expected.sort());
  });
});

describe('computePieceRangeSquares — checkers-style jump (Pedone di Dama)', () => {
  it('lands 2 diagonal squares away while capturing the hurdle 1 square away, plus its plain forward step', () => {
    const { moveSquares, captureSquares, exampleCapture } = computePieceRangeSquares(getPieceDef('DA'), 'A', 'd4');

    expect([...moveSquares].sort()).toEqual(['b6', 'd5', 'f6'].sort());
    expect([...captureSquares].sort()).toEqual(['c5', 'e5'].sort());
    expect(exampleCapture?.enemyAt).toBe('e5'); // "ne" is listed before "nw" in the piece data
  });
});

describe('computePieceRangeSquares — color-restricted entries (Camaleonte)', () => {
  it('only applies the move entry matching the color of the starting square', () => {
    // d4 is a dark square ("scura"): the diagonal 4-step ("chiare") entry must not contribute,
    // while the orthogonal 3-step ("scure") entry and the unrestricted 1-step entry both apply.
    const { moveSquares } = computePieceRangeSquares(getPieceDef('CM'), 'A', 'd4');

    expect(moveSquares).not.toContain('g7'); // 3 diagonal steps ne — only reachable via the chiare-only entry
    expect(moveSquares).toContain('d7'); // 3 orthogonal steps n — reachable via the scure entry
    expect(moveSquares).toContain('e5'); // 1 diagonal step — reachable via the unrestricted entry
  });
});
