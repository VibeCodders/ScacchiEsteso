import { describe, expect, it } from 'vitest';
import { computeMatchStats } from './matchStats';
import { createInitialGameState, type GameState, type HistoryEntry } from './turnManager';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState } from './board';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A'): BoardState {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

/** A finished game built from a hand-made history + graveyards (like materialTrend.test). */
function finishedWith(history: HistoryEntry[], captured: Record<'A' | 'B', Array<{ sigla: string }>>): GameState {
  let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
  board = place(board, 'h8', 'RE', 'B');
  const state = createInitialGameState(board);
  return {
    ...state,
    history,
    captured: {
      A: captured.A.map((p) => createPieceInstance(p.sigla, 'B')),
      B: captured.B.map((p) => createPieceInstance(p.sigla, 'A')),
    },
  };
}

function entry(partial: Partial<HistoryEntry> & { owner: 'A' | 'B' }): HistoryEntry {
  return {
    turnNumber: 1,
    from: 'a1',
    to: 'a2',
    sigla: 'RE',
    isCapture: false,
    ...partial,
  };
}

describe('computeMatchStats', () => {
  it('counts moves, real captures, capture points and clone captures per player', () => {
    const state = finishedWith(
      [
        entry({ owner: 'A', sigla: 'CA', from: 'd4', to: 'e5', isCapture: true, capturedSigla: 'PE' }), // A: +9
        entry({ owner: 'B', sigla: 'TO', from: 'e5', to: 'd4', isCapture: true, capturedSigla: 'CA' }), // B: +15
        entry({ owner: 'A', sigla: 'MG', from: 'g2', to: 'h3', isCapture: true, capturedSigla: 'MG', isCloneCapture: true }), // wasted
      ],
      { A: [{ sigla: 'CA' }], B: [{ sigla: 'PE' }] },
    );

    const stats = computeMatchStats(state);
    expect(stats.plies).toBe(3);
    expect(stats.players.A.moves).toBe(2);
    expect(stats.players.B.moves).toBe(1);
    expect(stats.players.A.captures).toBe(1);
    expect(stats.players.A.capturePunti).toBe(9); // the PE
    expect(stats.players.A.cloneCaptures).toBe(1); // the wasted MG-clone capture
    expect(stats.players.B.captures).toBe(1);
    expect(stats.players.B.capturePunti).toBe(15); // the CA
    expect(stats.totalCaptures).toBe(2);
    expect(stats.totalCloneCaptures).toBe(1);
    expect(stats.totalCapturePunti).toBe(24);
  });

  it('counts a conversion as a removal worth the victim\'s punti (and never a clone capture)', () => {
    const state = finishedWith(
      [
        entry({ owner: 'B', sigla: 'VL', from: 'e4', to: 'd5', isCapture: true, capturedSigla: 'PE', isConversion: true, ghoulSquare: 'e5' }),
      ],
      { A: [], B: [] }, // converted pieces never reach the graveyard
    );

    const stats = computeMatchStats(state);
    expect(stats.players.B.captures).toBe(1);
    expect(stats.players.B.capturePunti).toBe(9);
    expect(stats.events.conversion).toBe(1);
    expect(stats.totalCaptures).toBe(1);
  });

  it('finds first blood, the best capture and the most active piece', () => {
    const state = finishedWith(
      [
        entry({ owner: 'A', turnNumber: 4, sigla: 'PE', from: 'd4', to: 'd5', isCapture: true, capturedSigla: 'FG' }), // 1 pt
        entry({ owner: 'B', turnNumber: 6, sigla: 'AR', from: 'h4', to: 'h4', isRangedAttack: true, isCapture: true, capturedSigla: 'PA' }), // 51 pt
        entry({ owner: 'A', turnNumber: 7, sigla: 'CA', from: 'd4', to: 'e5', isCapture: true, capturedSigla: 'PE' }), // 9 pt
        entry({ owner: 'A', turnNumber: 9, sigla: 'CA', from: 'e5', to: 'd4', isCapture: false }),
      ],
      { A: [{ sigla: 'PA' }], B: [{ sigla: 'FG' }, { sigla: 'PE' }] },
    );

    const stats = computeMatchStats(state);
    expect(stats.firstBlood).toEqual({ owner: 'A', sigla: 'PE', turnNumber: 4, capturedSigla: 'FG' });
    expect(stats.bestCapture).toEqual({ owner: 'B', sigla: 'AR', turnNumber: 6, capturedSigla: 'PA', punti: 51 });
    expect(stats.mostActivePiece).toEqual({ sigla: 'CA', owner: 'A', count: 2 }); // 1 capture + 1 move
  });

  it('builds the cumulative capture timeline (one step per real capture)', () => {
    const state = finishedWith(
      [
        entry({ owner: 'A', sigla: 'CA', from: 'd4', to: 'e5', isCapture: true, capturedSigla: 'PE' }),
        entry({ owner: 'B', sigla: 'TO', from: 'e5', to: 'd4', isCapture: true, capturedSigla: 'CA' }),
        entry({ owner: 'A', sigla: 'MG', from: 'g2', to: 'h3', isCapture: true, capturedSigla: 'MG', isCloneCapture: true }),
        entry({ owner: 'B', sigla: 'RE', from: 'h8', to: 'h7', isCapture: false }),
      ],
      { A: [{ sigla: 'CA' }], B: [{ sigla: 'PE' }] },
    );

    const stats = computeMatchStats(state);
    expect(stats.cumulativeCaptures).toEqual([
      { ply: 0, A: 0, B: 0 },
      { ply: 1, A: 1, B: 0 },
      { ply: 2, A: 1, B: 1 },
      { ply: 3, A: 1, B: 1 }, // clone capture adds nothing
      { ply: 4, A: 1, B: 1 },
    ]);
  });

  it('groups the graveyard by sigla (points = count × punti) and ranks piece activity', () => {
    const state = finishedWith(
      [
        entry({ owner: 'A', sigla: 'CA', from: 'd4', to: 'e5', isCapture: true, capturedSigla: 'PE' }),
        entry({ owner: 'A', sigla: 'CA', from: 'e5', to: 'd4', isCapture: true, capturedSigla: 'BO' }),
        entry({ owner: 'A', sigla: 'TO', from: 'a1', to: 'a2', isCapture: false }),
        entry({ owner: 'B', sigla: 'RE', from: 'h8', to: 'h7', isCapture: false }),
      ],
      { A: [{ sigla: 'BO' }, { sigla: 'PE' }, { sigla: 'PE' }], B: [] },
    );

    const stats = computeMatchStats(state);
    // A lost a BO (24 pt) and two PE (9 pt each → 18 pt): grouped by sigla, most valuable first.
    expect(stats.lostBySigla.A).toEqual([
      { sigla: 'BO', count: 1, punti: 24 },
      { sigla: 'PE', count: 2, punti: 18 },
    ]);
    expect(stats.activityBySigla.A[0]).toEqual({ sigla: 'CA', count: 2 });
  });

  it('tallies every special-event type from the history', () => {
    const state = finishedWith(
      [
        entry({ owner: 'A', sigla: 'AR', from: 'h4', to: 'h4', isRangedAttack: true, isCapture: true, capturedSigla: 'PE' }),
        entry({ owner: 'B', sigla: 'RP', from: 'd3', to: 'd4', isRepulse: true, repulsedTo: 'd5' }),
        entry({ owner: 'A', sigla: 'TT', from: 'c3', to: 'c6', isTeleport: true }),
        entry({ owner: 'B', sigla: 'VZ', from: 'e4', to: 'e6', isAttract: true, attractedTo: 'e5' }),
        entry({ owner: 'A', sigla: 'MI', from: 'b2', to: 'b3', isSwap: true }),
        entry({ owner: 'B', sigla: 'BR', from: 'f4', to: 'f5', isSostituzione: true, sostituitoCon: 'f5' }),
        entry({ owner: 'A', sigla: 'SW', from: 'a1', to: 'b1', isSwapperSwap: true, swapSquares: ['a1', 'b1'] }),
        entry({ owner: 'B', sigla: 'MG', from: 'g2', to: 'g2', isSdoppiamento: true, cloneSquare: 'h2', realSquare: 'g2' }),
        entry({ owner: 'A', sigla: 'MG', from: 'g2', to: 'g3', isMerge: true }),
        entry({ owner: 'B', sigla: 'NE', from: 'd4', to: 'd5', isRevival: true, revivedSigla: 'PE' }),
        entry({ owner: 'A', sigla: 'PE', from: 'd5', to: 'd6', isCapture: true, capturedSigla: 'BO', isExplosion: true, explodedAt: 'd6' }),
        entry({ owner: 'B', sigla: 'CO', from: 'c4', to: 'c5', isCapture: true, capturedSigla: 'PE', areaDamageCoords: ['c6'], areaDamage: [{ sigla: 'TO', owner: 'A' }] }),
        entry({ owner: 'A', sigla: 'VL', from: 'e4', to: 'd5', isCapture: true, capturedSigla: 'PE', isConversion: true, ghoulSquare: 'e5' }),
        entry({ owner: 'B', sigla: 'CA', from: 'd4', to: 'e5', isCapture: true, capturedSigla: 'MG', dispelledClone: true }),
      ],
      { A: [], B: [] },
    );

    const stats = computeMatchStats(state);
    expect(stats.events).toEqual({
      scocca: 1,
      repulse: 1,
      teleport: 1,
      attract: 1,
      swap: 1,
      sostituzione: 1,
      swapperSwap: 1,
      sdoppiamento: 1,
      riunione: 1,
      revival: 1,
      conversion: 1,
      dispelledClone: 1,
      explosion: 1,
      areaDamage: 1,
    });
    // Special actions: the first 10 entries are special actions; the last 4 are plain captures
    // (explosion, area damage, conversion, dispelled clone) — not special actions.
    expect(stats.players.A.specialActions + stats.players.B.specialActions).toBe(10);
    expect(stats.players.A.explosions).toBe(1);
    expect(stats.players.B.areaDamageVictims).toBe(1);
  });

  it('returns empty stats for a game with no moves', () => {
    const state = finishedWith([], { A: [], B: [] });
    const stats = computeMatchStats(state);
    expect(stats.plies).toBe(0);
    expect(stats.totalCaptures).toBe(0);
    expect(stats.firstBlood).toBeNull();
    expect(stats.bestCapture).toBeNull();
    expect(stats.mostActivePiece).toBeNull();
    expect(stats.cumulativeCaptures).toEqual([{ ply: 0, A: 0, B: 0 }]);
    expect(stats.lostBySigla.A).toEqual([]);
    expect(stats.activityBySigla.A).toEqual([]);
  });
});
