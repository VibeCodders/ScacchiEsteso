import { describe, expect, it } from 'vitest';
import { canTeleport, getTeleportTargets } from './teleport';
import { createInitialGameState, applyTeleport, getLegalMovesForTurn, type GameState } from './turnManager';
import { createEmptyBoard, createPieceInstance, getPieceAt, setPieceAt, type BoardState } from './board';
import { getPieceDef } from './moveEngine';
import { chooseBotAction, generateBotActions, applyBotAction, actionKey, type BotAction } from './bot';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A') {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

/** Standard teleport test position: TT d4 can jump to any empty square at distance 3. The A King
 *  sits on b1 so it never occupies a ring landing (a1 would be one). */
function teleportPosition(): BoardState {
  let board = place(createEmptyBoard(), 'b1', 'RE', 'A');
  board = place(board, 'd4', 'TT', 'A');
  board = place(board, 'h8', 'RE', 'B');
  return board;
}

describe('canTeleport', () => {
  it('is true only for the Teletrasporto', () => {
    expect(canTeleport(getPieceDef('TT'))).toBe(true);
    for (const sigla of ['RE', 'TO', 'AR', 'RP', 'ST', 'SW', 'GR', 'MA', 'DR']) {
      expect(canTeleport(getPieceDef(sigla))).toBe(false);
    }
  });
});

describe('getTeleportTargets', () => {
  it('lists every empty square at exactly 3 squares in the 8 straight directions', () => {
    const targets = getTeleportTargets(teleportPosition(), 'd4', 'A');
    expect(targets.sort()).toEqual(['a1', 'a4', 'a7', 'd1', 'd7', 'g1', 'g4', 'g7'].sort());
  });

  it('excludes landings off the board and occupied landings', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'c2', 'TT', 'A'); // from c2: only n (c5), e (f2), ne (f5) land on the board
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'c5', 'PE', 'B'); // occupies the n landing
    expect(getTeleportTargets(board, 'c2', 'A').sort()).toEqual(['f2', 'f5'].sort());
  });

  it('jumps over intervening pieces (a teleport, not a slide)', () => {
    let board = place(createEmptyBoard(), 'b1', 'RE', 'A');
    board = place(board, 'd4', 'TT', 'A');
    board = place(board, 'h8', 'RE', 'B');
    for (const coord of ['d5', 'd6', 'e5', 'c5', 'a4', 'a5', 'a6']) {
      board = place(board, coord, 'PE', 'B'); // block every path to the landings
    }
    // Only a4 is truly unreachable (occupied): every other ring landing is jumped over freely.
    expect(getTeleportTargets(board, 'd4', 'A').sort()).toEqual(['a1', 'a7', 'd1', 'd7', 'g1', 'g4', 'g7'].sort());
  });

  it('is disabled while silenced by an enemy Inquisitore', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'd4', 'TT', 'A');
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'e4', 'IQ', 'B'); // adjacent to d4 — silences the Teletrasporto
    expect(getTeleportTargets(board, 'd4', 'A')).toEqual([]);
  });
});

describe('applyTeleport', () => {
  it('relocates the piece to the chosen empty landing, passes the turn and records the teleport', () => {
    const state = createInitialGameState(teleportPosition(), 'A');
    const result = applyTeleport(state, 'd4', 'g7');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(getPieceAt(result.state.board, 'g7')?.sigla).toBe('TT');
    expect(getPieceAt(result.state.board, 'd4')).toBeUndefined();
    expect(result.state.turn).toBe('B');
    expect(result.state.turnsSinceProgress).toBe(0); // a board-changing special action counts as progress
    const entry = result.state.history[0];
    expect(entry.sigla).toBe('TT');
    expect(entry.isTeleport).toBe(true);
    expect(entry.from).toBe('d4');
    expect(entry.to).toBe('g7');
  });

  it('rejects a landing that is not a valid teleport target', () => {
    const state = createInitialGameState(teleportPosition(), 'A');
    const result = applyTeleport(state, 'd4', 'd6'); // distance 2 — not a teleport distance
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/Destinazione non valida/);
  });

  it('rejects a teleport that would leave the King in check (leaving a shielding square)', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e4', 'TT', 'A'); // shields the King from the enemy Regina on the e-file
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'e8', 'RA', 'B'); // pins along the e-file: e4 → h4 opens it
    const state = createInitialGameState(board, 'A');
    const result = applyTeleport(state, 'e4', 'h4');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/Re sotto scacco/);
  });

  it('rejects an action from a non-TT piece and a game that is already over', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'd4', 'TO', 'A'); // a Torre — no teleport
    board = place(board, 'h8', 'RE', 'B');
    const state = createInitialGameState(board, 'A');
    expect(applyTeleport(state, 'd4', 'd7').ok).toBe(false);
  });
});

describe('bot integration', () => {
  it('enumerates teleport actions, applies them through applyBotAction, and keys them distinctly', () => {
    const state = createInitialGameState(teleportPosition(), 'A');
    const actions = generateBotActions(state, 'A').filter((a) => a.kind === 'teleport');
    expect(actions).toContainEqual({ kind: 'teleport', from: 'd4', to: 'g7' });

    const applied = applyBotAction(state, { kind: 'teleport', from: 'd4', to: 'g7' });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(getPieceAt(applied.state.board, 'g7')?.sigla).toBe('TT');

    expect(actionKey({ kind: 'teleport', from: 'd4', to: 'g7' })).toBe('teleport:d4:g7');
    expect(actionKey({ kind: 'teleport', from: 'd4', to: 'g7' })).not.toBe(actionKey({ kind: 'teleport', from: 'd4', to: 'd7' }));
  });

  it('the bot chooses a teleport when it is the best legal move (the only way to reach a center square)', () => {
    // The 1-ply bot scores material + a +3 center-control bonus. TT a1 can only reach the d4
    // center square by teleporting (its King-step moves and the King's own moves all stay off
    // center), so the teleport is the deterministic best action.
    let board = place(createEmptyBoard(), 'h1', 'RE', 'A');
    board = place(board, 'a1', 'TT', 'A');
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'h7', 'PE', 'B'); // B's quiet reply
    const state = createInitialGameState(board, 'A');
    expect(state.status).toBe('ongoing');

    expect(chooseBotAction(state, 'A', 5)).toEqual({ kind: 'teleport', from: 'a1', to: 'd4' });
    const applied = applyBotAction(state, { kind: 'teleport', from: 'a1', to: 'd4' });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(getPieceAt(applied.state.board, 'd4')?.sigla).toBe('TT');
  });

  it('plays a complete bot-vs-bot game with the Teletrasporto in the army, moving it legally throughout', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'd4', 'TT', 'A');
    board = place(board, 'c3', 'GR', 'A');
    board = place(board, 'f3', 'DR', 'A');
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'd5', 'MA', 'B');
    board = place(board, 'c6', 'TO', 'B');
    board = place(board, 'f6', 'AL', 'B');
    const state = createInitialGameState(board, 'A');
    expect(state.status).toBe('ongoing');

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

    // Every Teletrasporto action the bot played must be engine-legal in its exact position.
    let ttActions = 0;
    for (const { before, action } of moves) {
      if (action.kind !== 'move' && action.kind !== 'teleport') continue;
      const piece = getPieceAt(before.board, action.from);
      if (!piece || piece.sigla !== 'TT') continue;
      ttActions++;
      if (action.kind === 'move') {
        expect(getLegalMovesForTurn(before, action.from).map((m) => m.to)).toContain(action.to);
      } else {
        expect(getTeleportTargets(before.board, action.from, piece.owner, before.dimensions)).toContain(action.to);
      }
    }
    expect(ttActions).toBeGreaterThan(0); // the bot actually played the Teletrasporto
  }, 30000);
});
