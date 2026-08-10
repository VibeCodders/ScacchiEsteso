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
  it('illustrates every square from distance 2 to the board edge in each direction, since a hurdle could sit anywhere along the way', () => {
    const { moveSquares, captureSquares } = computePieceRangeSquares(getPieceDef('CV'), 'A', 'd4');
    const expected = ['a1', 'a4', 'a7', 'b2', 'b4', 'b6', 'd1', 'd2', 'd6', 'd7', 'd8', 'f2', 'f4', 'f6', 'g1', 'g4', 'g7', 'h4', 'h8'];
    expect([...moveSquares].sort()).toEqual(expected.sort());
    expect([...captureSquares].sort()).toEqual(expected.sort());
  });

  it('no longer resembles a fixed-offset leaper: distance-3 and distance-4 squares are reachable, not just distance-2', () => {
    const { moveSquares } = computePieceRangeSquares(getPieceDef('CV'), 'A', 'd4');
    expect(moveSquares).toContain('d7'); // distance 3 north
    expect(moveSquares).toContain('d8'); // distance 4 north
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

describe('computePieceRangeSquares — diagonal 1-step (Duca)', () => {
  it('reports the 4 diagonal squares from a central square', () => {
    const { moveSquares, captureSquares } = computePieceRangeSquares(getPieceDef('DU'), 'A', 'd4');
    const expected = ['c3', 'c5', 'e3', 'e5'];
    expect([...moveSquares].sort()).toEqual(expected.sort());
    expect([...captureSquares].sort()).toEqual(expected.sort());
  });
});

describe('computePieceRangeSquares — diagonal 1-2 jump ignoring intervening piece (Spettro)', () => {
  it('reports both distance-1 and distance-2 diagonal squares from a central square', () => {
    const { moveSquares, captureSquares } = computePieceRangeSquares(getPieceDef('SP'), 'A', 'd4');
    const expected = ['c3', 'c5', 'e3', 'e5', 'b2', 'b6', 'f2', 'f6'];
    expect([...moveSquares].sort()).toEqual(expected.sort());
    expect([...captureSquares].sort()).toEqual(expected.sort());
  });
});

describe('computePieceRangeSquares — union of 1-step and knight-leap (Generale)', () => {
  it('combines both move sets into 16 destinations from a central square', () => {
    const { moveSquares } = computePieceRangeSquares(getPieceDef('GE'), 'A', 'd4');
    expect(moveSquares).toHaveLength(16);
  });
});

describe('computePieceRangeSquares — union of 1-step and rook-slide (Tigre)', () => {
  it('combines both move sets into 18 destinations from a central square', () => {
    const { moveSquares } = computePieceRangeSquares(getPieceDef('TI'), 'A', 'd4');
    expect(moveSquares).toHaveLength(18);
  });
});

describe('computePieceRangeSquares — union of 1-step and bishop-slide (Rinoceronte)', () => {
  it('combines both move sets into 17 destinations from a central square', () => {
    const { moveSquares } = computePieceRangeSquares(getPieceDef('RN'), 'A', 'd4');
    expect(moveSquares).toHaveLength(17);
  });
});

describe('computePieceRangeSquares — jump-chain illustration (Coniglio)', () => {
  it('shows the 8 king-step squares plus every even-distance chain-hop landing square in each direction', () => {
    const { moveSquares } = computePieceRangeSquares(getPieceDef('CN'), 'A', 'd4');
    const expected = ['b2', 'b4', 'b6', 'c3', 'c4', 'c5', 'd2', 'd3', 'd5', 'd6', 'd8', 'e3', 'e4', 'e5', 'f2', 'f4', 'f6', 'h4', 'h8'];
    expect([...moveSquares].sort()).toEqual(expected.sort());
  });

  it('captures the last hurdle jumped, not the landing square, for every reachable chain length', () => {
    const { captureSquares } = computePieceRangeSquares(getPieceDef('CN'), 'A', 'd4');
    const expected = ['c3', 'c4', 'c5', 'd3', 'd5', 'd7', 'e3', 'e4', 'e5', 'g4', 'g7'];
    expect([...captureSquares].sort()).toEqual(expected.sort());
  });

  it('is no longer mobility-indistinguishable from a knight-leap piece like Generale: reaches distance-4 squares a fixed leaper cannot', () => {
    const { moveSquares } = computePieceRangeSquares(getPieceDef('CN'), 'A', 'd4');
    expect(moveSquares).toContain('d8'); // 4 squares north, via a 2-hop chain
  });
});

describe('computePieceRangeSquares — bounce slide, edge-bounce only (Rimbalzatore)', () => {
  it('illustrates the single-edge reflection from a near-edge square', () => {
    // from d6, "ne" hits the top edge after e7,f8, then reflects to "se": g7, h6.
    const { moveSquares } = computePieceRangeSquares(getPieceDef('RB'), 'A', 'd6');
    expect(moveSquares).toEqual(expect.arrayContaining(['e7', 'f8', 'g7', 'h6']));
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
