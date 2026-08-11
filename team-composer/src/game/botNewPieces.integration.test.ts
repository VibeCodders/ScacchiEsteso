import { describe, expect, it } from 'vitest';
import { chooseBotAction, generateBotActions, applyBotAction, type BotAction } from './bot';
import { createInitialGameState, getLegalMovesForTurn, type GameState } from './turnManager';
import { createEmptyBoard, createPieceInstance, getPieceAt, setPieceAt, type BoardState } from './board';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A'): BoardState {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

const TERMINAL: ReadonlySet<GameState['status']> = new Set(['checkmate', 'stalemate', 'anti_stalemate']);

interface PlayedMove {
  before: GameState;
  action: BotAction;
}

/**
 * Plays a bot-vs-bot game from `state` at difficulty 5 (1 ply — fast and fully deterministic,
 * since a depth-0 minimax never touches the random transposition table) until a terminal status.
 * Asserts that every chosen action applies cleanly and that neither King is ever removed
 * (README §3.3 — the King is never an actual capture target). When `trackPieces` is given,
 * additionally asserts that every move those pieces make is engine-legal in the exact position it
 * was played from (via getLegalMovesForTurn), and that each tracked sigla actually moves at least
 * once before the game ends.
 */
function playFullGame(state: GameState, trackPieces: string[] = [], maxPlies = 120): { final: GameState; moves: PlayedMove[] } {
  const moves: PlayedMove[] = [];
  let current = state;
  let plies = 0;

  while (!TERMINAL.has(current.status) && plies < maxPlies) {
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

  expect(TERMINAL.has(current.status)).toBe(true); // the game actually completed
  if (current.status === 'checkmate') expect(current.winner).toBeDefined();

  const moved = new Set<string>();
  for (const { before, action } of moves) {
    if (action.kind !== 'move') continue;
    const piece = getPieceAt(before.board, action.from);
    if (!piece || !trackPieces.includes(piece.sigla)) continue;
    moved.add(piece.sigla);
    const legalTos = getLegalMovesForTurn(before, action.from).map((m) => m.to);
    expect(legalTos).toContain(action.to);
  }
  for (const sigla of trackPieces) expect(moved.has(sigla)).toBe(true);

  return { final: current, moves };
}

function moveTos(state: GameState, from: string): string[] {
  return generateBotActions(state, 'A')
    .filter((a) => a.kind === 'move' && a.from === from)
    .map((a) => (a.kind === 'move' ? a.to : ''));
}

describe('bot integration — Grifone (GR) in complete games', () => {
  function gryphonPosition(): GameState {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'd4', 'GR', 'A');
    board = place(board, 'a8', 'RE', 'B');
    board = place(board, 'h5', 'TO', 'B'); // reachable: d4 → e5 (diagonal pivot, empty) → f5..h5 (E slide)
    return createInitialGameState(board, 'A');
  }

  it('enumerates and plays the bent-slide capture, then finishes the game', () => {
    const state = gryphonPosition();
    expect(state.status).toBe('ongoing'); // no starting check — the position is legal

    // The bot sees the capture over the diagonal pivot.
    expect(getLegalMovesForTurn(state, 'd4').map((m) => m.to)).toContain('h5');
    expect(generateBotActions(state, 'A')).toContainEqual({ kind: 'move', from: 'd4', to: 'h5' });

    // A free 27pt capture is the only capture on the board — the 1-ply bot takes it.
    expect(chooseBotAction(state, 'A', 5)).toEqual({ kind: 'move', from: 'd4', to: 'h5' });
    const played = applyBotAction(state, { kind: 'move', from: 'd4', to: 'h5' });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.history[0]).toMatchObject({
      sigla: 'GR',
      from: 'd4',
      to: 'h5',
      isCapture: true,
      capturedSigla: 'TO',
    });

    // The rest of the game plays out to completion; the GR keeps moving legally throughout.
    playFullGame(played.state, ['GR'], 60);
  });

  it('never offers a bent-slide capture whose diagonal pivot is occupied', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'd4', 'GR', 'A');
    board = place(board, 'a8', 'RE', 'B');
    board = place(board, 'e5', 'FG', 'B'); // occupies the NE pivot — d4→h5 becomes impossible
    board = place(board, 'h5', 'TO', 'B');
    const state = createInitialGameState(board, 'A');

    const tos = moveTos(state, 'd4');
    expect(tos).not.toContain('h5');
    // the other three pivots still work, so the Grifone is far from frozen
    expect(tos.length).toBeGreaterThan(0);
  });
});

describe('bot integration — Manticora (MA) in complete games', () => {
  function manticoraPosition(): GameState {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'd4', 'MA', 'A');
    board = place(board, 'a8', 'RE', 'B');
    board = place(board, 'f5', 'TO', 'B'); // reachable: d4 → e4 (orthogonal pivot, empty) → f5 (NE slide)
    return createInitialGameState(board, 'A');
  }

  it('enumerates and plays the bent-slide capture, then finishes the game', () => {
    const state = manticoraPosition();
    expect(state.status).toBe('ongoing');

    expect(getLegalMovesForTurn(state, 'd4').map((m) => m.to)).toContain('f5');
    expect(generateBotActions(state, 'A')).toContainEqual({ kind: 'move', from: 'd4', to: 'f5' });

    expect(chooseBotAction(state, 'A', 5)).toEqual({ kind: 'move', from: 'd4', to: 'f5' });
    const played = applyBotAction(state, { kind: 'move', from: 'd4', to: 'f5' });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.history[0]).toMatchObject({
      sigla: 'MA',
      from: 'd4',
      to: 'f5',
      isCapture: true,
      capturedSigla: 'TO',
    });

    playFullGame(played.state, ['MA'], 60);
  });

  it('never offers a bent-slide capture whose orthogonal pivot is occupied', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'd4', 'MA', 'A');
    board = place(board, 'a8', 'RE', 'B');
    board = place(board, 'e4', 'FG', 'B'); // occupies the E pivot — d4→f5 becomes impossible
    board = place(board, 'f5', 'TO', 'B');
    const state = createInitialGameState(board, 'A');

    const tos = moveTos(state, 'd4');
    expect(tos).not.toContain('f5');
    expect(tos.length).toBeGreaterThan(0);
  });
});

describe('bot integration — Drago (DR) in complete games', () => {
  it('plays the compound: rook slide and knight leap, preferring the higher-value capture', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'd4', 'DR', 'A');
    board = place(board, 'a8', 'RE', 'B');
    board = place(board, 'h4', 'TO', 'B'); // rook slide along rank 4 (27pt)
    board = place(board, 'f5', 'RA', 'B'); // knight landing from d4 (37pt)
    const state = createInitialGameState(board, 'A');
    expect(state.status).toBe('ongoing');

    const actions = generateBotActions(state, 'A');
    expect(actions).toContainEqual({ kind: 'move', from: 'd4', to: 'h4' }); // rook leg
    expect(actions).toContainEqual({ kind: 'move', from: 'd4', to: 'f5' }); // knight leg

    // Both captures are free; the bot correctly prefers the knight capture of the Regina.
    expect(chooseBotAction(state, 'A', 5)).toEqual({ kind: 'move', from: 'd4', to: 'f5' });
    const played = applyBotAction(state, { kind: 'move', from: 'd4', to: 'f5' });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.history[0]).toMatchObject({
      sigla: 'DR',
      from: 'd4',
      to: 'f5',
      isCapture: true,
      capturedSigla: 'RA',
    });

    playFullGame(played.state, ['DR'], 60);
  });

  it('respects interposition on the rook leg while the knight leg still leaps over pieces', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'd4', 'DR', 'A');
    board = place(board, 'e4', 'PG', 'A'); // own blocker: cuts off the rook slide to h4
    board = place(board, 'a8', 'RE', 'B');
    board = place(board, 'h4', 'TO', 'B');
    board = place(board, 'f5', 'RA', 'B');
    const state = createInitialGameState(board, 'A');

    const tos = moveTos(state, 'd4');
    expect(tos).not.toContain('h4'); // rook line blocked by the Paggio
    expect(tos).toContain('f5'); // the knight jump ignores the interposed piece entirely

    expect(chooseBotAction(state, 'A', 5)).toEqual({ kind: 'move', from: 'd4', to: 'f5' });
    const played = applyBotAction(state, { kind: 'move', from: 'd4', to: 'f5' });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    playFullGame(played.state, ['DR'], 60);
  });
});

describe('bot integration — a full army of Grifone, Manticora and Drago', () => {
  it('plays a complete game where both sides field all three new pieces', () => {
    let board = createEmptyBoard();
    // A: King sheltered behind a pawn-rank of the new pieces (the bent slides are long-range).
    board = place(board, 'a1', 'RE', 'A');
    board = place(board, 'd4', 'GR', 'A');
    board = place(board, 'c3', 'MA', 'A');
    board = place(board, 'f3', 'DR', 'A');
    // B (mirror).
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'd5', 'GR', 'B');
    board = place(board, 'c6', 'MA', 'B');
    board = place(board, 'f6', 'DR', 'B');
    const state = createInitialGameState(board, 'A');
    expect(state.status).toBe('ongoing'); // no starting check in either direction

    // The bot enumerates moves for all three pieces from the very first turn.
    const firstActions = generateBotActions(state, 'A');
    expect(firstActions.some((a) => a.kind === 'move' && a.from === 'd4')).toBe(true); // GR
    expect(firstActions.some((a) => a.kind === 'move' && a.from === 'c3')).toBe(true); // MA
    expect(firstActions.some((a) => a.kind === 'move' && a.from === 'f3')).toBe(true); // DR

    // The whole game plays out to a terminal state, with every GR/MA/DR move engine-legal in its
    // exact position and each of the three pieces actually moving at least once.
    playFullGame(state, ['GR', 'MA', 'DR'], 150);
  }, 30000);
});
