import { describe, expect, it } from 'vitest';
import { isExplosive } from './bomb';
import {
  createInitialGameState,
  applyTurn,
  applyScocca,
  stopRabbitChain,
  getLegalMovesForTurn,
  type GameState,
} from './turnManager';
import { createEmptyBoard, createPieceInstance, getPieceAt, setPieceAt, type BoardState } from './board';
import { getPieceDef } from './moveEngine';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A') {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

/** A: RE a1, BO d4. B: RE h8, TO e4 — the TO captures the BO sliding one square west. */
function bombPosition(): BoardState {
  let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
  board = place(board, 'd4', 'BO', 'A');
  board = place(board, 'h8', 'RE', 'B');
  board = place(board, 'e4', 'TO', 'B');
  return board;
}

describe('isExplosive', () => {
  it('is true only for the Bomba', () => {
    expect(isExplosive(getPieceDef('BO'))).toBe(true);
    for (const sigla of ['RE', 'TO', 'TT', 'RP', 'ST', 'PE', 'GR', 'MA']) {
      expect(isExplosive(getPieceDef(sigla))).toBe(false);
    }
  });
});

describe('melee capture of a Bomba', () => {
  it('destroys the capturer too, records the explosion and graveyards both pieces', () => {
    const state = createInitialGameState(bombPosition(), 'B');
    // The TO's e4→d4 capture is legal (the blast is a consequence, not a refusal).
    expect(getLegalMovesForTurn(state, 'e4').some((m) => m.to === 'd4')).toBe(true);

    const result = applyTurn(state, 'e4', 'd4');
    expect(result.ok).toBe(true);
    const next = result.state!;

    expect(getPieceAt(next.board, 'd4')).toBeUndefined(); // BO gone (captured)
    expect(getPieceAt(next.board, 'e4')).toBeUndefined(); // TO gone too (blast)
    expect(next.captured.A.map((p) => p.sigla)).toEqual(['BO']); // B's BO lands in A's gains...
    expect(next.captured.B.map((p) => p.sigla)).toEqual(['TO']); // ...and B lost its own TO to the blast

    const entry = next.history[next.history.length - 1];
    expect(entry.isCapture).toBe(true);
    expect(entry.capturedSigla).toBe('BO');
    expect(entry.isExplosion).toBe(true);
    expect(entry.explodedAt).toBe('d4'); // the blast destroys the TO on the square it captured onto
    expect(next.turnsSinceProgress).toBe(0); // a capture — progress
  });

  it('never destroys the King capturer', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'd4', 'BO', 'A');
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'e5', 'RE', 'B'); // the King itself captures the BO
    const state = createInitialGameState(board, 'B');

    const result = applyTurn(state, 'e5', 'd4');
    expect(result.ok).toBe(true);
    const next = result.state!;

    expect(getPieceAt(next.board, 'd4')?.sigla).toBe('RE'); // the King now stands on the BO's square
    expect(getPieceAt(next.board, 'e5')).toBeUndefined(); // it left e5
    expect(next.captured.A.map((p) => p.sigla)).toEqual(['BO']); // BO belonged to A
    expect(next.captured.B).toEqual([]); // King survived — nothing of B's was lost
    expect(next.history[next.history.length - 1].isExplosion).toBeUndefined();
  });

  it('suppresses the blast when it would expose the capturer own King', () => {
    // The TO's King sits on e1 on the same rank as the capture square e5 — removing the TO
    // would expose it to the BO's King on d4's diagonal... use a direct pin instead: A's TO
    // is pinned along the e-file by B's TO on e8; capturing the BO on e5 would leave A's King
    // on e1 facing B's TO on e8.
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e5', 'BO', 'B'); // the Bomba, on the same file as A's King
    board = place(board, 'e8', 'TO', 'B'); // the pinning piece
    board = place(board, 'h1', 'RE', 'B');
    board = place(board, 'd5', 'TO', 'A'); // the capturer — pinned on the e-file
    const state = createInitialGameState(board, 'A');

    const result = applyTurn(state, 'd5', 'e5');
    expect(result.ok).toBe(true);
    const next = result.state!;

    expect(getPieceAt(next.board, 'e5')?.sigla).toBe('TO'); // capturer survived (blast suppressed)
    expect(getPieceAt(next.board, 'd5')).toBeUndefined(); // the TO now stands on e5
    expect(next.captured.B.map((p) => p.sigla)).toEqual(['BO']); // BO belonged to B
    expect(next.captured.A).toEqual([]);
    expect(next.history[next.history.length - 1].isExplosion).toBeUndefined();
  });
});

describe('ranged capture (scocca) of a Bomba', () => {
  it('detonates the Arciere too when it shoots the Bomba', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'd4', 'AR', 'A'); // Arciere
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'g4', 'BO', 'B'); // 4 squares west of the AR, clear trajectory
    const state = createInitialGameState(board, 'A');

    const result = applyScocca(state, 'd4', 'g4');
    expect(result.ok).toBe(true);
    const next = result.state!;

    expect(getPieceAt(next.board, 'g4')).toBeUndefined(); // BO gone
    expect(getPieceAt(next.board, 'd4')).toBeUndefined(); // AR gone too (blast)
    expect(next.captured.B.map((p) => p.sigla)).toEqual(['BO']);
    expect(next.captured.A.map((p) => p.sigla)).toEqual(['AR']);

    const entry = next.history[next.history.length - 1];
    expect(entry.isRangedAttack).toBe(true);
    expect(entry.isExplosion).toBe(true);
    expect(entry.explodedAt).toBe('d4');
  });
});

describe('chain capture (Coniglio) of a Bomba', () => {
  it('detonates the Coniglio when its last jump lands on the Bomba', () => {
    // CN on d4; hurdle on e5 (empty capture deferred), then final jump d4→f6 over e6? Simpler:
    // CN d4, hurdle e5, then CN f6 over e6? Let's use a straight 2-hop: CN d4 → f4 over e4
    // (first hurdle), then continue f4 → h4 over g4 which holds the BO — the chain's LAST
    // hurdle is the BO, and stopping the chain captures it → explosion.
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'd4', 'CN', 'A');
    board = place(board, 'e4', 'PE', 'B'); // first hurdle (not captured — stays on board)
    board = place(board, 'g4', 'BO', 'B'); // final hurdle — the Bomba
    board = place(board, 'h8', 'RE', 'B');
    const state = createInitialGameState(board, 'A');

    // Hop 1: d4 → f4 over e4
    const hop1 = applyTurn(state, 'd4', 'f4');
    expect(hop1.ok).toBe(true);
    const mid = hop1.state!;
    expect(mid.pendingRabbitChain).not.toBeNull();
    expect(getPieceAt(mid.board, 'e4')?.sigla).toBe('PE'); // first hurdle untouched

    // Hop 2: f4 → h4 over g4 (the BO) — still no capture yet
    const hop2 = applyTurn(mid, 'f4', 'h4');
    expect(hop2.ok).toBe(true);
    const after = hop2.state!;
    expect(getPieceAt(after.board, 'g4')?.sigla).toBe('BO'); // not captured mid-chain

    // Stop the chain: captures the BO → explosion destroys the CN too
    const stop = stopRabbitChain(after);
    expect(stop.ok).toBe(true);
    const next = stop.state!;
    expect(getPieceAt(next.board, 'g4')).toBeUndefined();
    expect(getPieceAt(next.board, 'h4')).toBeUndefined(); // CN destroyed by the blast
    expect(next.captured.B.map((p) => p.sigla)).toEqual(['BO']);
    expect(next.captured.A.map((p) => p.sigla)).toEqual(['CN']);

    const entry = next.history[next.history.length - 1];
    expect(entry.capturedSigla).toBe('BO');
    expect(entry.isExplosion).toBe(true);
    expect(entry.explodedAt).toBe('h4');
  });
});

describe('mirage interactions', () => {
  it('a clone of the Bomba does not explode (illusions are not live ordnance)', () => {
    // B's Miraggio sdoppiato: real on d4, clone on e5. A's TO captures the clone on e5.
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'd4', 'MG', 'B');
    board = place(board, 'e5', 'MG', 'B');
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'c5', 'TO', 'A');
    // Mark the pair: real d4, clone e5.
    const state0 = createInitialGameState(board, 'A');
    const real = getPieceAt(state0.board, 'd4')!;
    const clone = getPieceAt(state0.board, 'e5')!;
    real.mirage = { id: 'm1', isClone: false };
    clone.mirage = { id: 'm1', isClone: true };

    const result = applyTurn(state0, 'c5', 'e5');
    expect(result.ok).toBe(true);
    const next = result.state!;
    expect(getPieceAt(next.board, 'e5')?.sigla).toBe('TO'); // TO now stands on the clone's square
    expect(getPieceAt(next.board, 'c5')).toBeUndefined(); // it left c5
    expect(next.captured.A).toEqual([]); // clone capture awards no punti
    expect(next.captured.B).toEqual([]);
    expect(next.history[next.history.length - 1].isExplosion).toBeUndefined();
  });
});
