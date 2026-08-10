import { describe, expect, it } from 'vitest';
import { chooseBotAction, generateBotActions, applyBotAction, difficultyToDepth, difficultyTimeBudgetMs } from './bot';
import { createInitialGameState } from './turnManager';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState } from './board';
import { buildClassicStartingBoard } from './samplePositions';
import { isKingInCheck } from './check';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A') {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

describe('generateBotActions', () => {
  it('lists move actions for every piece the owner has, plus special abilities when applicable', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'AR', 'A'); // Arciere: normal moves + scocca
    board = place(board, 'd7', 'PE', 'B');
    const state = createInitialGameState(board, 'A');

    const actions = generateBotActions(state, 'A');
    expect(actions.some((a) => a.kind === 'move' && a.from === 'd4')).toBe(true);
    expect(actions.some((a) => a.kind === 'scocca' && a.from === 'd4' && a.target === 'd7')).toBe(true);
  });

  it('offers only moves from the pending square plus skipExtraMove during a Berserker bonus phase', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'BE', 'A');
    board = place(board, 'd5', 'PE', 'B');
    let state = createInitialGameState(board, 'A');
    const captureResult = applyBotAction(state, { kind: 'move', from: 'd4', to: 'd5' });
    expect(captureResult.ok).toBe(true);
    if (!captureResult.ok) return;
    state = captureResult.state;
    expect(state.pendingExtraMove).toBe('d5');

    const actions = generateBotActions(state, 'A');
    expect(actions.every((a) => a.kind === 'skipExtraMove' || (a.kind === 'move' && a.from === 'd5'))).toBe(true);
    expect(actions.some((a) => a.kind === 'skipExtraMove')).toBe(true);
  });

  it('enumerates one move action per Orfano mimic threat', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'OR', 'A');
    board = place(board, 'd8', 'TO', 'B'); // one threat
    const state = createInitialGameState(board, 'A');

    const orphanActions = generateBotActions(state, 'A').filter((a) => a.kind === 'move' && a.from === 'd4');
    expect(orphanActions.length).toBeGreaterThan(0);
    expect(orphanActions.every((a) => a.kind === 'move' && a.orphanMimicSource === 'd8')).toBe(true);
  });

  it('enumerates one move action per promotion option when a Pawn reaches the back rank', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd7', 'PE', 'A');
    const state = createInitialGameState(board, 'A');

    const promotionActions = generateBotActions(state, 'A').filter((a) => a.kind === 'move' && a.to === 'd8');
    expect(promotionActions).toHaveLength(4); // PE, AL, CA, SP
    const choices = promotionActions.map((a) => (a.kind === 'move' ? a.promotionChoice : undefined)).sort();
    expect(choices).toEqual(['AL', 'CA', 'PE', 'SP'].sort());
  });

  it('enumerates swapperSwap actions for a Swapper with eligible allies, and applyBotAction dispatches them', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'SW', 'A');
    board = place(board, 'd5', 'CA', 'A');
    board = place(board, 'c3', 'PE', 'A');
    const state = createInitialGameState(board, 'A');

    const swapActions = generateBotActions(state, 'A').filter((a) => a.kind === 'swapperSwap');
    expect(swapActions.length).toBeGreaterThan(0);

    const action = swapActions[0];
    if (action.kind !== 'swapperSwap') throw new Error('expected swapperSwap');
    const result = applyBotAction(state, action);
    expect(result.ok).toBe(true);
  });

  it('a piece frozen by an enemy Stunner contributes only its Stunner-capture action, if any', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'TO', 'A');
    board = place(board, 'd5', 'ST', 'B'); // adjacent Stunner, directly capturable by the Rook
    const state = createInitialGameState(board, 'A');

    const actions = generateBotActions(state, 'A').filter((a) => a.kind === 'move' && a.from === 'd4');
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ kind: 'move', from: 'd4', to: 'd5' });
  });

  it('offers sdoppiamento before a Miraggio splits and riunione afterwards, never both at once', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'MG', 'A');
    const state = createInitialGameState(board, 'A');

    // Unsplit Miraggio: splitting is possible, merging is not (nothing to merge).
    const beforeSplit = generateBotActions(state, 'A');
    expect(beforeSplit.some((a) => a.kind === 'sdoppiamento' && a.from === 'd4')).toBe(true);
    expect(beforeSplit.some((a) => a.kind === 'riunione')).toBe(false);

    const split = applyBotAction(state, beforeSplit.find((a) => a.kind === 'sdoppiamento')!);
    expect(split.ok).toBe(true);
    if (!split.ok) return;

    // Split Miraggio (clone alive): merging is possible; re-splitting is not (max 2 on the board).
    const afterSplit = generateBotActions(split.state, 'A');
    expect(afterSplit.some((a) => a.kind === 'riunione')).toBe(true);
    expect(afterSplit.some((a) => a.kind === 'sdoppiamento')).toBe(false);
  });

  it('applies bot sdoppiamento and a later riunione, ending with a single unsplit Miraggio', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'MG', 'A');
    let state = createInitialGameState(board, 'A');

    // A's bot splits: the clone materializes on an adjacent empty square.
    const splitActions = generateBotActions(state, 'A').filter((a) => a.kind === 'sdoppiamento' && a.from === 'd4');
    expect(splitActions.length).toBeGreaterThan(0);
    const split = applyBotAction(state, splitActions[0]);
    expect(split.ok).toBe(true);
    if (!split.ok) return;
    state = split.state;

    const mgAfterSplit = [...state.board.values()].filter((p) => p.sigla === 'MG');
    expect(mgAfterSplit).toHaveLength(2); // real + clone
    expect(mgAfterSplit.some((p) => p.mirage?.isClone)).toBe(true);
    expect(mgAfterSplit.some((p) => p.mirage && !p.mirage.isClone)).toBe(true);

    // B's bot replies with a quiet king move, handing the turn back to A.
    const bAction = chooseBotAction(state, 'B', 5);
    expect(bAction).not.toBeNull();
    const bMove = applyBotAction(state, bAction!);
    expect(bMove.ok).toBe(true);
    if (!bMove.ok) return;
    state = bMove.state;
    expect(state.turn).toBe('A');

    // A's bot merges the pair back into a single piece.
    const mergeActions = generateBotActions(state, 'A').filter((a) => a.kind === 'riunione');
    expect(mergeActions.length).toBeGreaterThan(0);
    const merge = applyBotAction(state, mergeActions[0]);
    expect(merge.ok).toBe(true);
    if (!merge.ok) return;

    const mgAfterMerge = [...merge.state.board.values()].filter((p) => p.sigla === 'MG');
    expect(mgAfterMerge).toHaveLength(1);
    expect(mgAfterMerge[0].mirage).toBeUndefined(); // unsplit again
  });
});

describe('chooseBotAction', () => {
  it('always chooses a legal action, applying cleanly, across several positions', () => {
    const boards: BoardState[] = [
      buildClassicStartingBoard(),
      (() => {
        let b = place(createEmptyBoard(), 'e1', 'RE', 'A');
        b = place(b, 'e8', 'RE', 'B');
        b = place(b, 'd4', 'TO', 'A');
        b = place(b, 'd7', 'PE', 'B');
        return b;
      })(),
    ];

    for (const board of boards) {
      const state = createInitialGameState(board, 'A');
      const action = chooseBotAction(state, 'A', 5);
      expect(action).not.toBeNull();
      if (!action) continue;
      const result = applyBotAction(state, action);
      expect(result.ok).toBe(true);
    }
  });

  it('picks a free capture when one is available (greedy material gain)', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'TO', 'A');
    board = place(board, 'd7', 'RA', 'B'); // an undefended Regina — a huge, obvious capture
    const state = createInitialGameState(board, 'A');

    const action = chooseBotAction(state, 'A', 5);
    expect(action).toEqual({ kind: 'move', from: 'd4', to: 'd7' });
  });

  it('prefers a Miraggio split whose clone guards its own King (positional bonus)', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'e2', 'MG', 'A');
    const state = createInitialGameState(board, 'A');

    const action = chooseBotAction(state, 'A', 5);
    expect(action).not.toBeNull();
    if (!action) return;
    expect(action.kind).toBe('sdoppiamento');
    if (action.kind !== 'sdoppiamento') return;
    // The clone should land on a square adjacent to A's King (e1) — d1/d2/f1/f2 — where it shields
    // the King (an enemy capture there is wasted: no punti), rather than on e3/d3/f3, which sit one
    // square further away and earn no guard bonus.
    expect(['d1', 'd2', 'f1', 'f2']).toContain(action.cloneSquare);
  });

  it('iterative deepening: a 1-ply bot hangs its Queen on a defended Pawn; a 2-ply bot keeps it', () => {
    // A: RE e1, RA d1 · B: RE e8, PE d7 (defended by B's King). RAxd7 looks like +7 to a 1-ply
    // search, but B's King recaptures — the 2-ply search sees the Queen (37) go for a Pawn (7)
    // and prefers a quiet Queen move instead.
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd1', 'RA', 'A');
    board = place(board, 'd7', 'PE', 'B');
    const state = createInitialGameState(board, 'A');

    const shallow = chooseBotAction(state, 'A', 5); // 1 ply
    expect(shallow).toEqual({ kind: 'move', from: 'd1', to: 'd7' });

    const deep = chooseBotAction(state, 'A', 10); // 2 plies
    expect(deep).not.toEqual({ kind: 'move', from: 'd1', to: 'd7' });
  });

  it('never leaves its own King in check', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e5', 'TO', 'A'); // blocks a check along the e-file
    board = place(board, 'e8', 'TO', 'B');
    board = place(board, 'a8', 'RE', 'B');
    const state = createInitialGameState(board, 'A');

    const action = chooseBotAction(state, 'A', 10);
    expect(action).not.toBeNull();
    if (!action) return;
    const result = applyBotAction(state, action);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(isKingInCheck(result.state.board, 'A')).toBe(false);
  });

  it('returns null when there is nothing legal to do', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'a8', 'TO', 'B');
    board = place(board, 'b8', 'TO', 'B');
    board = place(board, 'h8', 'RE', 'B');
    const state = createInitialGameState(board, 'A'); // checkmate
    expect(chooseBotAction(state, 'A', 5)).toBeNull();
  });

  it('completes within a reasonable time at difficulty 10 on a busy board', () => {
    const board = buildClassicStartingBoard();
    const state = createInitialGameState(board, 'A');

    const start = Date.now();
    const action = chooseBotAction(state, 'A', 10);
    const elapsed = Date.now() - start;

    expect(action).not.toBeNull();
    expect(elapsed).toBeLessThan(10000);
  });
});

describe('bot vs. bot self-play — PvC end-to-end (Step 12)', () => {
  it('plays a full game to completion across many consecutive turns without ever leaving a King capturable', () => {
    const MAX_PLIES = 60;
    let state = createInitialGameState(buildClassicStartingBoard(), 'A');
    let plies = 0;

    while (state.status !== 'checkmate' && state.status !== 'stalemate' && state.status !== 'anti_stalemate' && plies < MAX_PLIES) {
      const action = chooseBotAction(state, state.turn, 5); // difficulty 5 = 1 ply — keeps a 60-ply game fast
      expect(action).not.toBeNull();
      if (!action) break;

      const result = applyBotAction(state, action);
      expect(result.ok).toBe(true);
      if (!result.ok) break;

      state = result.state;
      // the King is never an actual capture target (check.ts filters out any move that would
      // allow it) — both Kings must remain on the board no matter how the game unfolds.
      expect([...state.board.values()].some((p) => p.sigla === 'RE' && p.owner === 'A')).toBe(true);
      expect([...state.board.values()].some((p) => p.sigla === 'RE' && p.owner === 'B')).toBe(true);
      plies++;
    }

    expect(['ongoing', 'check', 'checkmate', 'stalemate', 'anti_stalemate']).toContain(state.status);
    if (state.status === 'checkmate') {
      expect(state.winner).toBeDefined();
    }
  }, 30000); // difficulty 5 (1 ply) keeps each ply fast, but 60 of them still need more than the default 5s timeout
});

describe('chooseBotAction — custom board dimensions', () => {
  it('considers and plays moves beyond the default 8×8 bounds when the state carries wider dimensions', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'j4', 'RE', 'B'); // only a valid square with width >= 10
    board = place(board, 'a4', 'TO', 'A');
    board = place(board, 'j1', 'TO', 'B');
    const state = createInitialGameState(board, 'A', { width: 10, height: 8 });

    const action = chooseBotAction(state, 'A', 5);
    expect(action).not.toBeNull();
    if (!action) return;
    const result = applyBotAction(state, action);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.dimensions).toEqual({ width: 10, height: 8 });
  });
});

describe('chooseBotAction — max difficulty performance', () => {
  it('respects its wall-clock time budget (with slack for one in-flight branch) on the classic starting position', () => {
    const board = buildClassicStartingBoard();
    const state = createInitialGameState(board, 'A');
    const start = Date.now();
    const action = chooseBotAction(state, 'A', 50);
    const elapsed = Date.now() - start;
    expect(action).not.toBeNull();
    expect(elapsed).toBeLessThan(difficultyTimeBudgetMs(50) * 2.5);
  });
});

describe('difficultyToDepth — numeric difficulty maps to lookahead in plies', () => {
  it('10 → 1 mossa (2 plies), 20 → 2 mosse (4 plies), 50 → 5 mosse (10 plies)', () => {
    expect(difficultyToDepth(10)).toBe(2);
    expect(difficultyToDepth(20)).toBe(4);
    expect(difficultyToDepth(50)).toBe(10);
  });

  it('5 → 0.5 mosse (1 ply) and 1 → 0 mosse (0 plies)', () => {
    expect(difficultyToDepth(5)).toBe(1);
    expect(difficultyToDepth(1)).toBe(0);
  });

  it('never goes negative even below the documented minimum', () => {
    expect(difficultyToDepth(0)).toBe(0);
    expect(difficultyToDepth(-3)).toBe(0);
  });

  it('difficulty 1 (0 plies) still picks a legal action by static evaluation alone', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'TO', 'A');
    const state = createInitialGameState(board, 'A');

    const action = chooseBotAction(state, 'A', 1);
    expect(action).not.toBeNull();
    if (!action) return;
    const result = applyBotAction(state, action);
    expect(result.ok).toBe(true);
  });
});
