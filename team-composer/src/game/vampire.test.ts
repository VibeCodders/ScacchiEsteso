import { describe, expect, it } from 'vitest';
import { GHOUL_SIGLA, canConvertOnCapture, getGhoulPlacementSquares } from './vampire';
import { getPieceDef } from './moveEngine';
import { createEmptyBoard, createPieceInstance, getPieceAt, setPieceAt, type BoardState } from './board';
import { createInitialGameState, applyTurn, type GameState } from './turnManager';
import { computeMaterialTrend } from './materialTrend';
import { pickablePieces } from '../data/pieces';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A'): BoardState {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

/** Kings far apart + the pieces under test, ready for turnManager calls. B moves first. */
function gameWith(extraPieces: Array<[string, string, 'A' | 'B']>): GameState {
  let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
  board = place(board, 'h8', 'RE', 'B');
  for (const [coord, sigla, owner] of extraPieces) board = place(board, coord, sigla, owner);
  return createInitialGameState(board, 'B');
}

describe('canConvertOnCapture', () => {
  it('is true only for the Vampiro Lunare', () => {
    expect(canConvertOnCapture(getPieceDef('VL'))).toBe(true);
    for (const sigla of ['RE', 'PE', 'MG', 'CO', 'BO', 'GH']) {
      expect(canConvertOnCapture(getPieceDef(sigla))).toBe(false);
    }
  });

  it('lists every free square adjacent to the captured piece (post-capture board)', () => {
    const state = gameWith([['e4', 'VL', 'B'], ['d5', 'PE', 'A']]);
    const result = applyTurn(state, 'e4', 'd5');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const next = result.state;
    const options = getGhoulPlacementSquares(next.board, 'd5', next.dimensions);
    expect(options).toContain('e4'); // the VL's own origin square, empty after the capture
    expect(options.length).toBeGreaterThan(1);
  });

  it('is empty when every neighbor is occupied (defensive: the engine then captures normally)', () => {
    let board = createEmptyBoard();
    for (const coord of ['c4', 'c5', 'c6', 'd4', 'd6', 'e4', 'e5', 'e6']) {
      board = place(board, coord, 'PE', 'A');
    }
    // In legal play the VL's own origin/path square is always free and adjacent, so this only
    // guards the engine's fallback branch.
    expect(getGhoulPlacementSquares(board, 'd5')).toEqual([]);
  });
});

describe('Vampiro Lunare conversion', () => {
  it('converts the captured enemy into an allied Ghoul instead of eliminating it', () => {
    const state = gameWith([['e4', 'VL', 'B'], ['d5', 'PE', 'A']]);
    const result = applyTurn(state, 'e4', 'd5');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const next = result.state;

    expect(getPieceAt(next.board, 'd5')?.sigla).toBe('VL'); // the VL now stands on the captured square
    expect(next.captured.A).toEqual([]); // the PE was converted, never eliminated
    expect(next.captured.B).toEqual([]);

    // A Ghoul for B materialized on a free square adjacent to d5.
    const ghoul = [...next.board].find(([, p]) => p.sigla === GHOUL_SIGLA);
    expect(ghoul).toBeDefined();
    expect(ghoul![1].owner).toBe('B');

    const entry = next.history[next.history.length - 1];
    expect(entry.isCapture).toBe(true);
    expect(entry.capturedSigla).toBe('PE');
    expect(entry.isConversion).toBe(true);
    expect(entry.ghoulSquare).toBe(ghoul![0]);
    expect(next.turnsSinceProgress).toBe(0); // the conversion is progress
  });

  it('honors an explicit placement square and auto-picks one otherwise', () => {
    const state = gameWith([['e4', 'VL', 'B'], ['d5', 'PE', 'A']]);

    const chosen = applyTurn(state, 'e4', 'd5', undefined, undefined, 'e4');
    expect(chosen.ok).toBe(true);
    if (!chosen.ok) return;
    expect(getPieceAt(chosen.state.board, 'e4')?.sigla).toBe(GHOUL_SIGLA);

    const auto = applyTurn(state, 'e4', 'd5');
    expect(auto.ok).toBe(true);
    if (!auto.ok) return;
    const ghoul = [...auto.state.board].find(([, p]) => p.sigla === GHOUL_SIGLA)!;
    expect(ghoul[0]).not.toBe('e4'); // auto-pick goes for the first option, not necessarily the origin
    expect(getGhoulPlacementSquares(auto.state.board, 'd5', state.dimensions)).not.toContain(ghoul[0]);
  });

  it('rejects an explicit square that is not a free adjacent square', () => {
    const state = gameWith([['e4', 'VL', 'B'], ['d5', 'PE', 'A']]);
    const result = applyTurn(state, 'e4', 'd5', undefined, undefined, 'a8'); // occupied by B's King
    expect(result.ok).toBe(false);
  });

  it('a converted Bomba does not explode (it was not destroyed)', () => {
    const state = gameWith([['e4', 'VL', 'B'], ['d5', 'BO', 'A']]);
    const result = applyTurn(state, 'e4', 'd5');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const next = result.state;

    expect(getPieceAt(next.board, 'd5')?.sigla).toBe('VL'); // the VL survives the "capture"
    expect(next.history[next.history.length - 1].isExplosion).toBeUndefined();
    expect(next.captured.A).toEqual([]); // the Bomba was converted, not captured
    expect([...next.board.values()].some((p) => p.sigla === GHOUL_SIGLA)).toBe(true);
  });

  it('converting the real half of a Miraggio still dissolves its clone', () => {
    const state = gameWith([['e4', 'VL', 'B'], ['d5', 'MG', 'A'], ['c5', 'MG', 'A']]);
    const real = getPieceAt(state.board, 'd5')!;
    const clone = getPieceAt(state.board, 'c5')!;
    real.mirage = { id: 'm1', isClone: false };
    clone.mirage = { id: 'm1', isClone: true };

    const result = applyTurn(state, 'e4', 'd5');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const next = result.state;

    expect(getPieceAt(next.board, 'd5')?.sigla).toBe('VL');
    expect(getPieceAt(next.board, 'c5')).toBeUndefined(); // clone dissolved
    expect(next.captured.A).toEqual([]); // the real was converted, not captured
    expect([...next.board.values()].some((p) => p.sigla === GHOUL_SIGLA)).toBe(true);
  });
});

describe('Vampiro Lunare — material trend', () => {
  it('the opponent loses the converted piece and the capturer gains the Ghoul', () => {
    const state = gameWith([['e4', 'VL', 'B'], ['d5', 'PE', 'A']]);
    const result = applyTurn(state, 'e4', 'd5');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const next = result.state;

    const trend = computeMaterialTrend(next);
    expect(trend[1].A).toBe(trend[0].A - getPieceDef('PE').punti); // A lost the PE (9 pt)
    expect(trend[1].B).toBe(trend[0].B + getPieceDef(GHOUL_SIGLA).punti); // B gained the Ghoul (estimator-priced)
    expect(trend.at(-1)!.A).toBeGreaterThan(0);
    expect(trend.at(-1)!.B).toBeGreaterThan(0);
  });
});

describe('roster', () => {
  it('the Vampiro Lunare is pickable, the Ghoul only via conversion', () => {
    expect(pickablePieces.some((p) => p.sigla === 'VL')).toBe(true);
    expect(pickablePieces.some((p) => p.sigla === GHOUL_SIGLA)).toBe(false);
    expect(getPieceDef(GHOUL_SIGLA).punti).toBe(15); // the estimator's score for the king-step Ghoul
  });
});
