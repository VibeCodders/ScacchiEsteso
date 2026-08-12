import { describe, expect, it } from 'vitest';
import { computeMaterialTrend } from './materialTrend';
import { createInitialGameState, type GameState, type HistoryEntry } from './turnManager';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState } from './board';

// From pieces.json (post-estimator rebalance): RE 15, PE 9, AL 19, CA 15, TO 27, CO 34, BO 24,
// AR 34, MG 28.
const RE = 15;
const PE = 9;
const AL = 19;
const CA = 15;
const TO = 27;
const CO = 34;
const BO = 24;
const AR_PUNTI = 34;

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A'): BoardState {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

/** A finished game whose final board is just the two Kings plus any given extra pieces. */
function finishedWith(history: HistoryEntry[], extras: Array<[string, string, 'A' | 'B']> = []): GameState {
  let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
  board = place(board, 'h8', 'RE', 'B');
  for (const [coord, sigla, owner] of extras) board = place(board, coord, sigla, owner);
  const state = createInitialGameState(board);
  return { ...state, history, status: 'anti_stalemate', winner: 'A', captured: { A: [], B: [] } };
}

function entry(partial: Partial<HistoryEntry> & { owner: 'A' | 'B' }): HistoryEntry {
  return {
    turnNumber: 1,
    from: 'a1',
    to: 'a2',
    sigla: 'PE',
    isCapture: false,
    ...partial,
  };
}

describe('computeMaterialTrend', () => {
  it('starts at the initial material and ends exactly at the final board score for a plain capture', () => {
    const state = finishedWith([
      entry({ owner: 'A', sigla: 'PE', from: 'd4', to: 'd5', isCapture: true, capturedSigla: 'TO' }),
    ], [['d5', 'PE', 'A']]); // the capturer survives on d5
    // A: RE 15 + PE 7 = 22 (unchanged). B: RE 15 + TO 27 = 42 → 15.
    expect(computeMaterialTrend(state)).toEqual([
      { ply: 0, A: RE + PE, B: RE + TO },
      { ply: 1, A: RE + PE, B: RE },
    ]);
  });

  it('counts the Bomba blast destroying the capturer as well', () => {
    const state = finishedWith([
      entry({ owner: 'A', sigla: 'PE', from: 'd4', to: 'd5', isCapture: true, capturedSigla: 'BO', isExplosion: true, explodedAt: 'd5' }),
    ]);
    // A loses its own PE (9) in the blast: 24 → 15. B loses the BO (24): 39 → 15.
    expect(computeMaterialTrend(state)).toEqual([
      { ply: 0, A: RE + PE, B: RE + BO },
      { ply: 1, A: RE, B: RE },
    ]);
  });

  it('reflects a promotion swapping the piece punti', () => {
    const state = finishedWith([
      entry({ owner: 'A', sigla: 'PE', from: 'e7', to: 'e8', promotedTo: 'AL' }),
    ], [['e8', 'AL', 'A']]);
    // A: 22 → 15 + AL(19) = 34.
    expect(computeMaterialTrend(state)).toEqual([
      { ply: 0, A: RE + PE, B: RE },
      { ply: 1, A: RE + AL, B: RE },
    ]);
  });

  it('counts a Necromante revival as material coming back onto the board', () => {
    const state = finishedWith([
      entry({ owner: 'A', sigla: 'NE', from: 'd4', to: 'd4', isRevival: true, revivedSigla: 'TO' }),
    ], [['c3', 'TO', 'A']]);
    // The revived TO (27) is on the final board: initial 15 → final 42.
    expect(computeMaterialTrend(state)).toEqual([
      { ply: 0, A: RE, B: RE },
      { ply: 1, A: RE + TO, B: RE },
    ]);
  });

  it('counts a Sciacallo loot as material appearing out of the enemy graveyard', () => {
    const state = finishedWith([
      entry({ owner: 'A', sigla: 'SC', from: 'd4', to: 'd4', isLoot: true, lootedSigla: 'PE' }),
    ], [['c3', 'PE', 'A']]);
    // The looted PE (9) sits on the final board as an A piece: initial 15 → final 24.
    expect(computeMaterialTrend(state)).toEqual([
      { ply: 0, A: RE, B: RE },
      { ply: 1, A: RE + PE, B: RE },
    ]);
  });

  it('ignores Miraggio clone captures (illusions have no punti)', () => {
    const state = finishedWith([
      entry({ owner: 'A', sigla: 'CA', from: 'd4', to: 'e5', isCapture: true, capturedSigla: 'MG', isCloneCapture: true }),
    ], [['e5', 'CA', 'A']]); // the capturer survives; the clone was worth nothing
    expect(computeMaterialTrend(state)).toEqual([
      { ply: 0, A: RE + CA, B: RE },
      { ply: 1, A: RE + CA, B: RE },
    ]);
  });

  it('charges Colosso area damage to each victim owner (allies and enemies alike)', () => {
    const state = finishedWith([
      entry({
        owner: 'A', sigla: 'CA', from: 'c3', to: 'd4', isCapture: true, capturedSigla: 'CO',
        areaDamageCoords: ['d3', 'e4'],
        areaDamage: [{ sigla: 'PE', owner: 'B' }, { sigla: 'TO', owner: 'A' }],
      }),
    ], [['d4', 'CA', 'A']]); // the capturer survives on d4
    // A: 15 + CA 15 + TO 27 = 57 → loses TO 27 = 30. B: 15 + CO 34 + PE 9 = 58 → loses 34 + 9 = 15.
    expect(computeMaterialTrend(state)).toEqual([
      { ply: 0, A: RE + CA + TO, B: RE + CO + PE },
      { ply: 1, A: RE + CA, B: RE },
    ]);
  });

  it('treats a scocca like any other capture (the attacker never moves)', () => {
    const state = finishedWith([
      entry({ owner: 'B', sigla: 'AR', from: 'h4', to: 'h4', isCapture: true, capturedSigla: 'CA', isRangedAttack: true }),
    ], [['h4', 'AR', 'B']]); // the archer stays put on h4
    // B: RE 15 + AR 34 = 49 (unchanged). A: RE 15 + CA 15 = 30 → 15.
    expect(computeMaterialTrend(state)).toEqual([
      { ply: 0, A: RE + CA, B: RE + AR_PUNTI },
      { ply: 1, A: RE, B: RE + AR_PUNTI },
    ]);
  });

  it('returns a single point (the final board) when the game had no moves', () => {
    const state = finishedWith([]);
    expect(computeMaterialTrend(state)).toEqual([{ ply: 0, A: RE, B: RE }]);
  });
});
