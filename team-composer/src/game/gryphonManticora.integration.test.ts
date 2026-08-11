import { describe, expect, it } from 'vitest';
import { createInitialGameState, applyTurn, getLegalMovesForTurn, type GameState } from './turnManager';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState, type Coord } from './board';
import { computeMaterialScore, resolveAntiStalemateWinner, ANTI_STALEMATE_TURN_LIMIT } from './antiStalemate';

// GR = 32 pt, MA = 26 pt, RE = 15 pt (from pieces.json).
const GR_PUNTI = 32;
const MA_PUNTI = 26;
const RE_PUNTI = 15;

function place(board: BoardState, coord: Coord, sigla: string, owner: 'A' | 'B' = 'A'): BoardState {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

/** Kings far apart + the extra pieces, A to move — ready for applyTurn. */
function gameWith(extraPieces: Array<[Coord, string, 'A' | 'B']>): GameState {
  let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
  board = place(board, 'h8', 'RE', 'B');
  for (const [coord, sigla, owner] of extraPieces) board = place(board, coord, sigla, owner);
  return createInitialGameState(board, 'A');
}

function score(state: GameState, owner: 'A' | 'B'): number {
  return computeMaterialScore(state.board, owner, state.dimensions);
}

/** Applies a turn, failing loudly (not just silently returning) on an illegal move. */
function play(state: GameState, from: Coord, to: Coord): GameState {
  const result = applyTurn(state, from, to);
  expect(result.ok, `move ${from}->${to} must be legal`).toBe(true);
  if (!result.ok) throw new Error(`illegal move ${from}->${to}`);
  return result.state;
}

/**
 * Plays `ANTI_STALEMATE_TURN_LIMIT` quiet (non-capturing, non-pawn) plies — the two Kings
 * shuffling back and forth — so the game ends by anti-stalemate (README §8.1). `movesA`/`movesB`
 * are cyclic [from, to] pairs for each side; plies alternate A (even), B (odd).
 */
function driveToAntiStalemate(
  state: GameState,
  movesA: Array<[Coord, Coord]>,
  movesB: Array<[Coord, Coord]>,
): GameState {
  let current = state;
  for (let ply = 0; ply < ANTI_STALEMATE_TURN_LIMIT; ply++) {
    const isA = ply % 2 === 0;
    const pool = isA ? movesA : movesB;
    const [from, to] = pool[Math.floor(ply / 2) % pool.length];
    current = play(current, from, to);
  }
  expect(current.turnsSinceProgress).toBe(ANTI_STALEMATE_TURN_LIMIT);
  expect(current.status).toBe('anti_stalemate');
  return current;
}

describe('integration — Grifone and Manticora capture each other with their bent-slide moves', () => {
  it('GR (A) captures MA (B) over its diagonal pivot, then B\'s MA recaptures the GR over its own orthogonal pivot; anti-stalemate goes to B on material', () => {
    // A: GR d4 — captures h5 via the NE pivot e5 (diagonal first leg, empty) and the E slide.
    // B: MA h5 (the bait) + MA f4 (the recapture: f4 → g4 E pivot → h5 on the NE leg).
    const state = gameWith([['d4', 'GR', 'A'], ['h5', 'MA', 'B'], ['f4', 'MA', 'B']]);
    expect(state.status).toBe('ongoing'); // no starting check in either direction

    // Initial material (README §8.2 counts only what is still on the board).
    expect(score(state, 'A')).toBe(RE_PUNTI + GR_PUNTI); // 47
    expect(score(state, 'B')).toBe(RE_PUNTI + 2 * MA_PUNTI); // 67

    // 1. A: GR d4 → h5 — the bent-slide capture, offered by the engine and applied by the turn manager.
    expect(getLegalMovesForTurn(state, 'd4').map((m) => m.to)).toContain('h5');
    const afterGrCapture = play(state, 'd4', 'h5');
    expect(afterGrCapture.board.get('h5')?.sigla).toBe('GR');
    expect(afterGrCapture.board.get('h5')?.owner).toBe('A');
    expect(afterGrCapture.board.has('d4')).toBe(false);
    expect(afterGrCapture.captured.B.map((p) => p.sigla)).toEqual(['MA']);
    expect(afterGrCapture.history[0]).toMatchObject({
      sigla: 'GR', from: 'd4', to: 'h5', isCapture: true, capturedSigla: 'MA',
    });
    expect(afterGrCapture.turnsSinceProgress).toBe(0); // the capture resets the anti-stalemate counter

    // Material after the first capture: B lost the MA's 26 punti.
    expect(score(afterGrCapture, 'A')).toBe(RE_PUNTI + GR_PUNTI); // 47
    expect(score(afterGrCapture, 'B')).toBe(RE_PUNTI + MA_PUNTI); // 41

    // 2. B: MA f4 → h5 — the mirror bent move (orthogonal pivot g4, then the NE diagonal leg).
    expect(getLegalMovesForTurn(afterGrCapture, 'f4').map((m) => m.to)).toContain('h5');
    const afterMaRecapture = play(afterGrCapture, 'f4', 'h5');
    expect(afterMaRecapture.board.get('h5')?.sigla).toBe('MA');
    expect(afterMaRecapture.board.get('h5')?.owner).toBe('B');
    expect(afterMaRecapture.captured.A.map((p) => p.sigla)).toEqual(['GR']);
    expect(afterMaRecapture.history[1]).toMatchObject({
      sigla: 'MA', from: 'f4', to: 'h5', isCapture: true, capturedSigla: 'GR',
    });

    // Material after the mutual exchange: both bent-slide pieces are gone.
    expect(score(afterMaRecapture, 'A')).toBe(RE_PUNTI); // 15 — only the King survives
    expect(score(afterMaRecapture, 'B')).toBe(RE_PUNTI + MA_PUNTI); // 41 — the surviving MA
    expect(resolveAntiStalemateWinner(afterMaRecapture.board, afterMaRecapture.dimensions)).toBe('B');

    // 3. Twenty quiet King-shuffle plies end the game by anti-stalemate; B wins on material.
    const final = driveToAntiStalemate(
      afterMaRecapture,
      [['a1', 'b1'], ['b1', 'a1']],
      [['h8', 'h7'], ['h7', 'h8']],
    );
    expect(final.status).toBe('anti_stalemate');
    expect(final.winner).toBe('B');
    expect(score(final, 'A')).toBe(RE_PUNTI);
    expect(score(final, 'B')).toBe(RE_PUNTI + MA_PUNTI);
    expect(resolveAntiStalemateWinner(final.board, final.dimensions)).toBe('B');
  });

  it('MA (A) captures GR (B) over its orthogonal pivot, then B\'s GR recaptures the MA over its own diagonal pivot; anti-stalemate goes to B on material', () => {
    // A: MA d4 — captures h7 via the E pivot e4 (orthogonal first leg, empty) and the NE diagonal slide.
    // B: GR h7 (the bait) + GR g5 (the recapture: g5 → h6 NE diagonal pivot → h7 on the N slide).
    const state = gameWith([['d4', 'MA', 'A'], ['h7', 'GR', 'B'], ['g5', 'GR', 'B']]);
    expect(state.status).toBe('ongoing');

    expect(score(state, 'A')).toBe(RE_PUNTI + MA_PUNTI); // 41
    expect(score(state, 'B')).toBe(RE_PUNTI + 2 * GR_PUNTI); // 79

    // 1. A: MA d4 → h7 — the bent-slide capture over the E pivot.
    expect(getLegalMovesForTurn(state, 'd4').map((m) => m.to)).toContain('h7');
    const afterMaCapture = play(state, 'd4', 'h7');
    expect(afterMaCapture.board.get('h7')?.sigla).toBe('MA');
    expect(afterMaCapture.board.get('h7')?.owner).toBe('A');
    expect(afterMaCapture.captured.B.map((p) => p.sigla)).toEqual(['GR']);
    expect(afterMaCapture.history[0]).toMatchObject({
      sigla: 'MA', from: 'd4', to: 'h7', isCapture: true, capturedSigla: 'GR',
    });
    expect(afterMaCapture.turnsSinceProgress).toBe(0);

    expect(score(afterMaCapture, 'A')).toBe(RE_PUNTI + MA_PUNTI); // 41
    expect(score(afterMaCapture, 'B')).toBe(RE_PUNTI + GR_PUNTI); // 47 — one GR gone

    // 2. B: GR g5 → h7 — the mirror bent move (NE diagonal pivot h6, then the N slide).
    expect(getLegalMovesForTurn(afterMaCapture, 'g5').map((m) => m.to)).toContain('h7');
    const afterGrRecapture = play(afterMaCapture, 'g5', 'h7');
    expect(afterGrRecapture.board.get('h7')?.sigla).toBe('GR');
    expect(afterGrRecapture.board.get('h7')?.owner).toBe('B');
    expect(afterGrRecapture.captured.A.map((p) => p.sigla)).toEqual(['MA']);
    expect(afterGrRecapture.history[1]).toMatchObject({
      sigla: 'GR', from: 'g5', to: 'h7', isCapture: true, capturedSigla: 'MA',
    });

    expect(score(afterGrRecapture, 'A')).toBe(RE_PUNTI); // 15
    expect(score(afterGrRecapture, 'B')).toBe(RE_PUNTI + GR_PUNTI); // 47 — the surviving GR
    expect(resolveAntiStalemateWinner(afterGrRecapture.board, afterGrRecapture.dimensions)).toBe('B');

    // 3. Anti-stalemate after twenty quiet plies; B wins on material.
    const final = driveToAntiStalemate(
      afterGrRecapture,
      [['a1', 'b1'], ['b1', 'a1']],
      [['h8', 'g8'], ['g8', 'h8']],
    );
    expect(final.status).toBe('anti_stalemate');
    expect(final.winner).toBe('B');
    expect(score(final, 'A')).toBe(RE_PUNTI);
    expect(score(final, 'B')).toBe(RE_PUNTI + GR_PUNTI);
    expect(resolveAntiStalemateWinner(final.board, final.dimensions)).toBe('B');
  });

  it('each bent-slide capture resets the anti-stalemate counter (they count as progress), so the 20-turn clock only starts after the exchange', () => {
    const state = gameWith([['d4', 'GR', 'A'], ['h5', 'MA', 'B'], ['f4', 'MA', 'B']]);
    let current = play(state, 'd4', 'h5'); // GR captures the MA
    expect(current.turnsSinceProgress).toBe(0);
    current = play(current, 'f4', 'h5'); // MA recaptures the GR
    expect(current.turnsSinceProgress).toBe(0);

    // From here on every ply is quiet — the counter climbs one at a time.
    current = play(current, 'a1', 'b1');
    expect(current.turnsSinceProgress).toBe(1);
    current = play(current, 'h8', 'h7');
    expect(current.turnsSinceProgress).toBe(2);
    expect(current.status).toBe('ongoing'); // far from the 20-turn limit
  });
});
