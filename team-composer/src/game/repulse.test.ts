import { describe, expect, it } from 'vitest';
import { canRepulse, getRepulseTargets } from './repulse';
import { createInitialGameState, applyRepulse, getLegalMovesForTurn, type GameState } from './turnManager';
import { createEmptyBoard, createPieceInstance, getPieceAt, setPieceAt, type BoardState } from './board';
import { getPieceDef } from './moveEngine';
import { chooseBotAction, generateBotActions, applyBotAction, actionKey, type BotAction } from './bot';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A') {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

/** Standard repulse test position: RP d4 can push TO e5 → f6 (landing empty). */
function repulsePosition(): BoardState {
  let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
  board = place(board, 'd4', 'RP', 'A');
  board = place(board, 'h8', 'RE', 'B');
  board = place(board, 'e5', 'TO', 'B'); // NE of d4; f6 (behind it) is empty
  return board;
}

describe('canRepulse', () => {
  it('is true only for the Repulsore', () => {
    expect(canRepulse(getPieceDef('RP'))).toBe(true);
    for (const sigla of ['RE', 'TO', 'AR', 'ST', 'SW', 'GR', 'MA', 'DR']) {
      expect(canRepulse(getPieceDef(sigla))).toBe(false);
    }
  });
});

describe('getRepulseTargets', () => {
  it('lists an adjacent enemy whose landing square (directly behind it) is empty', () => {
    const targets = getRepulseTargets(repulsePosition(), 'd4', 'A');
    expect(targets).toEqual(['e5']);
  });

  it('offers a push in every open direction', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'd4', 'RP', 'A');
    board = place(board, 'h8', 'RE', 'B');
    for (const coord of ['d5', 'd3', 'e4', 'c4', 'e5', 'c5', 'e3', 'c3']) {
      board = place(board, coord, 'PE', 'B');
    }
    const targets = getRepulseTargets(board, 'd4', 'A');
    expect(targets.sort()).toEqual(['c3', 'c4', 'c5', 'd3', 'd5', 'e3', 'e4', 'e5'].sort());
  });

  it('excludes enemies pushed off the board edge (no landing square)', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'b2', 'RP', 'A');
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'a2', 'PE', 'B'); // landing a0 is off the board
    board = place(board, 'b3', 'PE', 'B'); // landing b4 is fine
    expect(getRepulseTargets(board, 'b2', 'A')).toEqual(['b3']);
  });

  it('excludes enemies whose landing square is occupied', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'd4', 'RP', 'A');
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'e5', 'PE', 'B'); // landing f6 blocked
    board = place(board, 'f6', 'PE', 'A'); // an ally sits behind the target
    expect(getRepulseTargets(board, 'd4', 'A')).toEqual([]);
  });

  it('never pushes allies or the King', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'd4', 'RP', 'A');
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'e5', 'CA', 'A'); // ally — never pushable
    board = place(board, 'd5', 'RE', 'B'); // the enemy King — immune to forced displacement
    expect(getRepulseTargets(board, 'd4', 'A')).toEqual([]);
  });

  it('is empty when the Repulsore is silenced by an enemy Inquisitore', () => {
    let board = repulsePosition();
    board = place(board, 'c4', 'IQ', 'B'); // adjacent enemy Inquisitore silences the RP
    expect(getRepulseTargets(board, 'd4', 'A')).toEqual([]);
  });

  it('is empty when the Repulsore is frozen by an enemy Stunner', () => {
    let board = repulsePosition();
    board = place(board, 'c4', 'ST', 'B'); // adjacent enemy Stunner freezes the RP
    expect(getRepulseTargets(board, 'd4', 'A')).toEqual([]);
  });
});

describe('applyRepulse', () => {
  it('pushes the enemy one square away, records the action, passes the turn and resets the progress counter', () => {
    const state = createInitialGameState(repulsePosition(), 'A');
    expect(state.status).toBe('ongoing');

    const result = applyRepulse(state, 'd4', 'e5');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(getPieceAt(result.state.board, 'd4')?.sigla).toBe('RP'); // the Repulsore never moves
    expect(getPieceAt(result.state.board, 'e5')).toBeUndefined(); // the enemy left its square
    expect(getPieceAt(result.state.board, 'f6')?.sigla).toBe('TO'); // ...and landed one square away
    expect(getPieceAt(result.state.board, 'f6')?.owner).toBe('B');

    expect(result.state.turn).toBe('B');
    expect(result.state.turnsSinceProgress).toBe(0); // a repulse is board-changing progress
    expect(result.state.history[0]).toMatchObject({
      sigla: 'RP',
      from: 'd4',
      to: 'e5',
      isCapture: false,
      isRepulse: true,
      repulsedTo: 'f6',
    });
  });

  it('rejects a repulse from a piece that cannot repulse', () => {
    let board = repulsePosition();
    board = place(board, 'd4', 'TO', 'A'); // a Torre instead of the Repulsore
    const result = applyRepulse(createInitialGameState(board, 'A'), 'd4', 'e5');
    expect(result.ok).toBe(false);
  });

  it('rejects a target that is not a valid repulse target', () => {
    let board = repulsePosition();
    board = place(board, 'e4', 'CA', 'A'); // adjacent ALLY — never pushable
    const state = createInitialGameState(board, 'A');
    expect(applyRepulse(state, 'd4', 'e4').ok).toBe(false); // ally
    expect(applyRepulse(state, 'd4', 'f6').ok).toBe(false); // not even adjacent to the RP
  });

  it('rejects a repulse that would leave its own King in check (pushing a blocker away)', () => {
    // A's King at f1 is shielded along the f-file by the enemy Paggio at f4. Pushing f4 → g4 (the
    // RP at e4 pushes it east) unblocks the file — the enemy Torre at f6 then attacks straight down
    // to f1. Pushing the blocker away must be rejected (README §3.2).
    let board = place(createEmptyBoard(), 'f1', 'RE', 'A');
    board = place(board, 'e4', 'RP', 'A');
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'f4', 'PE', 'B'); // blocker on the f-file, adjacent east of the RP
    board = place(board, 'f6', 'TO', 'B'); // ranged threat behind the blocker
    const state = createInitialGameState(board, 'A');
    expect(state.status).toBe('ongoing'); // the blocker keeps the King safe for now
    expect(getRepulseTargets(state.board, 'e4', 'A')).toEqual(['f4']); // geometrically available

    const result = applyRepulse(state, 'e4', 'f4');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/scacco/i);
  });

  it('rejects once the game has ended', () => {
    const state = { ...createInitialGameState(repulsePosition(), 'A'), status: 'checkmate' as const, winner: 'A' as const };
    expect(applyRepulse(state, 'd4', 'e5').ok).toBe(false);
  });
});

describe('bot integration — Repulsore (RP)', () => {
  it('enumerates repulse actions and applies them through applyBotAction', () => {
    const state = createInitialGameState(repulsePosition(), 'A');
    const actions = generateBotActions(state, 'A').filter((a) => a.kind === 'repulse');
    expect(actions).toEqual([{ kind: 'repulse', from: 'd4', target: 'e5' }]);

    const applied = applyBotAction(state, { kind: 'repulse', from: 'd4', target: 'e5' });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(getPieceAt(applied.state.board, 'f6')?.sigla).toBe('TO');
  });

  it('actionKey distinguishes repulse actions', () => {
    expect(actionKey({ kind: 'repulse', from: 'd4', target: 'e5' })).toBe('repulse:d4:e5');
    expect(actionKey({ kind: 'repulse', from: 'd4', target: 'e5' })).not.toBe(actionKey({ kind: 'repulse', from: 'd4', target: 'f5' }));
  });

  it('the bot chooses the repulse when it is the best legal move (a pinned Repulsore pushes an enemy off a center square)', () => {
    // A's RP at e4 is pinned to the King along the e-file by B's Regina at e8 (the file is empty
    // behind it), so CAPTURING the adjacent enemy Regina at d4 would expose the King and is illegal.
    // The repulse d4 → c4 is legal (the RP never leaves the e-file), costs B its +3 center-control
    // bonus on d4, and beats every quiet move — a deterministic +3 for the 1-ply bot.
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e4', 'RP', 'A');
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'e8', 'RA', 'B'); // pins the RP along the e-file
    board = place(board, 'd4', 'RA', 'B'); // adjacent enemy on a center square — capturable in principle, but not legally
    const state = createInitialGameState(board, 'A');
    expect(state.status).toBe('ongoing');

    const actions = generateBotActions(state, 'A');
    expect(actions).toContainEqual({ kind: 'repulse', from: 'e4', target: 'd4' });
    expect(actions.some((a) => a.kind === 'move' && a.from === 'e4' && a.to === 'd4')).toBe(false); // the capture is pinned-illegal

    expect(chooseBotAction(state, 'A', 5)).toEqual({ kind: 'repulse', from: 'e4', target: 'd4' });
    const applied = applyBotAction(state, { kind: 'repulse', from: 'e4', target: 'd4' });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(getPieceAt(applied.state.board, 'c4')?.sigla).toBe('RA'); // the enemy Regina was displaced
  });

  it('plays a complete bot-vs-bot game with the Repulsore in the army, moving it legally throughout', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'd4', 'RP', 'A');
    board = place(board, 'c3', 'GR', 'A');
    board = place(board, 'f3', 'DR', 'A');
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'd5', 'MA', 'B');
    board = place(board, 'c6', 'TO', 'B');
    board = place(board, 'f6', 'AL', 'B');
    const state = createInitialGameState(board, 'A');
    expect(state.status).toBe('ongoing'); // no starting check in either direction

    const TERMINAL = new Set(['checkmate', 'stalemate', 'anti_stalemate']);
    const moves: Array<{ before: GameState; action: BotAction }> = [];
    let current = state;
    let plies = 0;
    while (!TERMINAL.has(current.status) && plies < 120) {
      const action = chooseBotAction(current, current.turn, 5);
      expect(action).not.toBeNull();
      if (!action) break;
      moves.push({ before: current, action });
      const result = applyBotAction(current, action);
      expect(result.ok).toBe(true);
      if (!result.ok) break;
      current = result.state;
      expect([...current.board.values()].some((p) => p.sigla === 'RE' && p.owner === 'A')).toBe(true);
      expect([...current.board.values()].some((p) => p.sigla === 'RE' && p.owner === 'B')).toBe(true);
      plies++;
    }
    expect(TERMINAL.has(current.status)).toBe(true);

    // Every Repulsore action the bot played must be engine-legal in its exact position.
    let rpActions = 0;
    for (const { before, action } of moves) {
      if (action.kind !== 'move' && action.kind !== 'repulse') continue;
      const piece = getPieceAt(before.board, action.from);
      if (!piece || piece.sigla !== 'RP') continue;
      rpActions++;
      if (action.kind === 'move') {
        expect(getLegalMovesForTurn(before, action.from).map((m) => m.to)).toContain(action.to);
      } else {
        expect(getRepulseTargets(before.board, action.from, piece.owner, before.dimensions)).toContain(action.target);
      }
    }
    expect(rpActions).toBeGreaterThan(0); // the bot actually played the Repulsore
  }, 30000);
});
