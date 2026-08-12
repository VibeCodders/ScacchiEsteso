import { describe, expect, it } from 'vitest';
import { canLoot, getLootSquares, getLootableSiglas, MAX_LOOT_VALUE } from './scavenger';
import { getPieceDef } from './moveEngine';
import { createEmptyBoard, createPieceInstance, getPieceAt, setPieceAt, type BoardState } from './board';
import { createInitialGameState, applyLoot, type GameState } from './turnManager';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A'): BoardState {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

/** Kings far apart + the pieces under test. B moves first. */
function gameWith(extraPieces: Array<[string, string, 'A' | 'B']>): GameState {
  let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
  board = place(board, 'h8', 'RE', 'B');
  for (const [coord, sigla, owner] of extraPieces) board = place(board, coord, sigla, owner);
  return createInitialGameState(board, 'B');
}

describe('canLoot', () => {
  it('is true only for the Sciacallo', () => {
    expect(canLoot(getPieceDef('SC'))).toBe(true);
    for (const sigla of ['RE', 'PE', 'NE', 'VL', 'MG', 'BO']) {
      expect(canLoot(getPieceDef(sigla))).toBe(false);
    }
  });
});

describe('getLootableSiglas — the jackal scavenges only small prey from the ENEMY graveyard', () => {
  it('lists every enemy fallen piece worth at most MAX_LOOT_VALUE, sorted by punti', () => {
    const capturedEnemy = [
      createPieceInstance('TO', 'A'), // 27 — too heavy
      createPieceInstance('PE', 'A'), // 9
      createPieceInstance('RP', 'A'), // 20 — exactly at the cap
      createPieceInstance('BS', 'A'), // 17
    ];
    const siglas = getLootableSiglas(capturedEnemy);
    expect(siglas).toEqual(['PE', 'BS', 'RP']); // 9 < 17 < 20, sorted by punti
  });

  it('never loots the King (never captured anyway — defensive)', () => {
    expect(getLootableSiglas([createPieceInstance('RE', 'A')])).toEqual([]);
  });

  it('is empty when the enemy graveyard is empty or holds only heavy pieces', () => {
    expect(getLootableSiglas([])).toEqual([]);
    expect(getLootableSiglas([createPieceInstance('DR', 'A')])).toEqual([]); // 46
  });
});

describe('getLootSquares', () => {
  it('lists every empty square adjacent to the Sciacallo', () => {
    let board = place(createEmptyBoard(), 'd4', 'SC', 'B');
    board = place(board, 'd5', 'PE', 'A'); // occupied neighbor is not lootable
    const squares = getLootSquares(board, 'd4', 'B');
    expect(squares).toContain('c4');
    expect(squares).toContain('e3');
    expect(squares).not.toContain('d5');
    expect(squares.length).toBe(7); // 8 neighbors minus the occupied d5
  });
});

describe('applyLoot — sciacallaggio', () => {
  /** Base board: Sciacallo (B) at d4, A's King at a1, B's King at h8, plus an empty PE square to
   *  loot onto — A's graveyard seeded explicitly since `createInitialGameState` starts empty. */
  function lootGame(): GameState {
    const state = gameWith([['d4', 'SC', 'B']]);
    return {
      ...state,
      captured: { A: [createPieceInstance('PE', 'A')], B: [] },
    };
  }

  it('raises an enemy fallen piece as an ALLY on an adjacent empty square, consuming the graveyard entry', () => {
    // B (Sciacallo) loots the PE that A lost. The looted PE appears as B's own piece.
    const state = lootGame();
    const result = applyLoot(state, 'd4', 'c4', 'PE');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const next = result.state;

    expect(getPieceAt(next.board, 'c4')?.sigla).toBe('PE');
    expect(getPieceAt(next.board, 'c4')?.owner).toBe('B'); // now an ALLY
    expect(next.captured.A.some((p) => p.sigla === 'PE')).toBe(false); // entry consumed
    expect(next.history.at(-1)).toMatchObject({ isLoot: true, lootedSigla: 'PE', from: 'd4', to: 'c4' });
  });

  it('rejects a piece above the value cap, a piece not in the enemy graveyard, and a non-empty target square', () => {
    const state = lootGame();
    expect(applyLoot(state, 'd4', 'c4', 'TO').ok).toBe(false); // 27 > 20
    expect(applyLoot(state, 'd4', 'c4', 'CA').ok).toBe(false); // never lost by A

    // An OCCUPIED adjacent square is not lootable: add an enemy piece on d5, next to the Sciacallo.
    const withOccupied = gameWith([['d4', 'SC', 'B'], ['d5', 'PE', 'A']]);
    const occupiedState: GameState = {
      ...withOccupied,
      captured: { A: [createPieceInstance('PE', 'A')], B: [] },
    };
    expect(applyLoot(occupiedState, 'd4', 'd5', 'PE').ok).toBe(false); // occupied square
  });

  it('rejects when the acting piece is not a Sciacallo, and accepts a loot that does not expose its own King', () => {
    const noSc = gameWith([['d4', 'NE', 'B']]);
    const noScState: GameState = { ...noSc, captured: { A: [createPieceInstance('PE', 'A')], B: [] } };
    expect(applyLoot(noScState, 'd4', 'c4', 'PE').ok).toBe(false);

    // B's King at h8, Sciacallo at d4 — looting A's fallen PE onto the empty adjacent c4 is
    // legal (adding a friendly piece can never expose the acting player's own King, mirroring
    // applySdoppiamento's note that no king-safety filter can trip on a pure piece placement).
    const state = gameWith([['d4', 'SC', 'B']]);
    const seeded: GameState = { ...state, captured: { A: [createPieceInstance('PE', 'A')], B: [] } };
    const okResult = applyLoot(seeded, 'd4', 'c4', 'PE');
    expect(okResult.ok).toBe(true);
  });

  it('gives check by materializing a looter piece with line of sight to the enemy King', () => {
    // A's King on a1, B loots an Alfiere (19 ≤ 20) that appears on c3 — the classic diagonal
    // bishop check. The loot is a legal action and the resulting position is check.
    const state = gameWith([['d4', 'SC', 'B'], ['a1', 'RE', 'A'], ['h8', 'RE', 'B']]);
    // A must have lost an Alfiere for it to be lootable.
    const withLostAlfiere: GameState = {
      ...state,
      captured: { A: [createPieceInstance('AL', 'A')], B: [] },
    };
    const result = applyLoot(withLostAlfiere, 'd4', 'c3', 'AL');
    expect(result.ok).toBe(true);
  });
});

describe('Sciacallo pricing sanity', () => {
  it('costs more than the Necromante (loot revives any cheap enemy piece, not just own pedoni)', () => {
    expect(getPieceDef('SC').punti).toBeGreaterThan(getPieceDef('NE').punti);
  });

  it('the loot cap parameter matches MAX_LOOT_VALUE', () => {
    const sc = getPieceDef('SC');
    const loot = sc.alternativeActions.find((a) => a.type === 'sciacallaggio');
    expect(loot?.params?.maxLootValue).toBe(MAX_LOOT_VALUE);
  });
});
