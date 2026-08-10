import { describe, expect, it } from 'vitest';
import { canSdoppiare, getSdoppiamentoSquares, isMirageClone, isRealMirage, removeWithMirageFallout, findCloneOf } from './mirage';
import { getPieceDef } from './moveEngine';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState, type PieceInstance } from './board';
import { createInitialGameState, applyTurn, applySdoppiamento, applyScocca } from './turnManager';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A'): BoardState {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

function placeMirage(board: BoardState, coord: string, owner: 'A' | 'B', id: string, isClone: boolean): BoardState {
  return setPieceAt(board, coord, { ...createPieceInstance('MG', owner), mirage: { id, isClone } });
}

/** Kings far apart + the pieces under test, ready for turnManager calls. */
function gameWith(extraPieces: Array<[string, string, 'A' | 'B']>, firstTurn: 'A' | 'B' = 'A') {
  let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
  board = place(board, 'h8', 'RE', 'B');
  for (const [coord, sigla, owner] of extraPieces) board = place(board, coord, sigla, owner);
  return createInitialGameState(board, firstTurn);
}

describe('canSdoppiare', () => {
  it('is true only for the Miraggio', () => {
    expect(canSdoppiare(getPieceDef('MG'))).toBe(true);
    expect(canSdoppiare(getPieceDef('RE'))).toBe(false);
    expect(canSdoppiare(getPieceDef('SW'))).toBe(false);
  });
});

describe('getSdoppiamentoSquares', () => {
  it('lists every adjacent empty square for an unsplit Miraggio', () => {
    const board = place(createEmptyBoard(), 'd4', 'MG', 'A');
    expect(getSdoppiamentoSquares(board, 'd4', 'A', getPieceDef).sort()).toEqual(
      ['c3', 'c4', 'c5', 'd3', 'd5', 'e3', 'e4', 'e5'].sort(),
    );
  });

  it('excludes occupied squares and squares off the board edge', () => {
    let board = place(createEmptyBoard(), 'd4', 'MG', 'A');
    board = place(board, 'd5', 'PE', 'B');
    board = place(board, 'c4', 'PE', 'A');
    const squares = getSdoppiamentoSquares(board, 'd4', 'A', getPieceDef).sort();
    expect(squares).not.toContain('d5');
    expect(squares).not.toContain('c4');
    expect(squares).toContain('e5');
  });

  it('returns [] for a Miraggio whose clone is still alive (max 2 on the board)', () => {
    let board = placeMirage(createEmptyBoard(), 'd4', 'A', 'm1', false);
    board = placeMirage(board, 'd5', 'A', 'm1', true);
    expect(getSdoppiamentoSquares(board, 'd4', 'A', getPieceDef)).toEqual([]);
  });

  it('returns [] for a clone — illusions do not spawn more illusions', () => {
    let board = placeMirage(createEmptyBoard(), 'd4', 'A', 'm1', true);
    board = placeMirage(board, 'd5', 'A', 'm1', false);
    expect(getSdoppiamentoSquares(board, 'd4', 'A', getPieceDef)).toEqual([]);
  });

  it('returns [] when the Miraggio is frozen by an adjacent enemy Stunner', () => {
    let board = place(createEmptyBoard(), 'd4', 'MG', 'A');
    board = place(board, 'd5', 'ST', 'B');
    expect(getSdoppiamentoSquares(board, 'd4', 'A', getPieceDef)).toEqual([]);
  });
});

describe('removeWithMirageFallout', () => {
  it('removes a clone with no fallout (killing the illusion is a wasted capture)', () => {
    let board = placeMirage(createEmptyBoard(), 'd4', 'A', 'm1', true);
    board = placeMirage(board, 'd5', 'A', 'm1', false);
    const { board: next, fallout } = removeWithMirageFallout(board, 'd4');
    expect(next.has('d4')).toBe(false);
    expect(next.has('d5')).toBe(true); // the real one survives
    expect(fallout).toBeNull();
  });

  it('removing the real Miraggio dissolves its clone as fallout', () => {
    let board = placeMirage(createEmptyBoard(), 'd4', 'A', 'm1', false);
    board = placeMirage(board, 'd5', 'A', 'm1', true);
    const { board: next, fallout } = removeWithMirageFallout(board, 'd4');
    expect(next.has('d4')).toBe(false);
    expect(next.has('d5')).toBe(false); // the illusion cannot outlive its source
    expect(fallout?.mirage?.isClone).toBe(true);
  });

  it('is a no-op fallback for ordinary pieces', () => {
    const board = place(createEmptyBoard(), 'd4', 'PE', 'A');
    const { board: next, fallout } = removeWithMirageFallout(board, 'd4');
    expect(next.has('d4')).toBe(false);
    expect(fallout).toBeNull();
  });
});

describe('applySdoppiamento', () => {
  it('materializes a clone on the chosen square and marks the two pieces real/clone', () => {
    const state = gameWith([['d4', 'MG', 'A']]);
    const result = applySdoppiamento(state, 'd4', 'd5', 'd4'); // the real stays at d4
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const real = result.state.board.get('d4');
    const clone = result.state.board.get('d5');
    expect(real?.sigla).toBe('MG');
    expect(clone?.sigla).toBe('MG');
    expect(isRealMirage(real!)).toBe(true);
    expect(isMirageClone(clone!)).toBe(true);
    expect(real!.mirage!.id).toBe(clone!.mirage!.id);
    expect(result.state.turn).toBe('B');
    expect(result.state.history.at(-1)).toMatchObject({
      isSdoppiamento: true,
      cloneSquare: 'd5',
      realSquare: 'd4',
    });
  });

  it('can designate the new square as the real one (the original square becomes the clone)', () => {
    const state = gameWith([['d4', 'MG', 'A']]);
    const result = applySdoppiamento(state, 'd4', 'd5', 'd5');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(isRealMirage(result.state.board.get('d5')!)).toBe(true);
    expect(isMirageClone(result.state.board.get('d4')!)).toBe(true);
  });

  it('rejects a non-Miraggio piece, a wrong clone square, and an invalid real-square choice', () => {
    const state = gameWith([['d4', 'TO', 'A']]);
    expect(applySdoppiamento(state, 'd4', 'd5', 'd4').ok).toBe(false); // not a Miraggio

    const state2 = gameWith([['d4', 'MG', 'A']]);
    expect(applySdoppiamento(state2, 'd4', 'f6', 'd4').ok).toBe(false); // not adjacent

    const state3 = gameWith([['d4', 'MG', 'A']]);
    expect(applySdoppiamento(state3, 'd4', 'd5', 'e6').ok).toBe(false); // neither of the two squares
  });

  it('a split Miraggio cannot split again while its clone is alive', () => {
    const state = gameWith([['d4', 'MG', 'A']]);
    const split = applySdoppiamento(state, 'd4', 'd5', 'd4');
    if (!split.ok) throw new Error('initial split failed');
    expect(applySdoppiamento(split.state, 'd4', 'e5', 'd4').ok).toBe(false);
  });

  it('a clone can never split', () => {
    const state = gameWith([['d4', 'MG', 'A']]);
    const split = applySdoppiamento(state, 'd4', 'd5', 'd4');
    if (!split.ok) throw new Error('initial split failed');
    // Hand the turn back to player A so the clone at d5 is the acting piece.
    const bMove = applyTurn(split.state, 'h8', 'h7');
    if (!bMove.ok) throw new Error('B quiet move failed');
    expect(applySdoppiamento(bMove.state, 'd5', 'e5', 'd5').ok).toBe(false);
  });

  it('counts as progress for the anti-stalemate counter', () => {
    const state = gameWith([['d4', 'MG', 'A']]);
    const result = applySdoppiamento({ ...state, turnsSinceProgress: 19 }, 'd4', 'd5', 'd4');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.turnsSinceProgress).toBe(0);
  });
});

describe('Miraggio capture resolution', () => {
  it('killing the clone removes only the clone — the real survives and no points are awarded', () => {
    const state = gameWith([['d4', 'MG', 'A'], ['d7', 'TO', 'B']]);
    const split = applySdoppiamento(state, 'd4', 'd5', 'd4'); // real d4, clone d5
    if (!split.ok) throw new Error('split failed');

    const capture = applyTurn(split.state, 'd7', 'd5'); // B's Torre captures the clone
    expect(capture.ok).toBe(true);
    if (!capture.ok) return;

    expect(capture.state.board.get('d5')?.sigla).toBe('TO'); // the Torre sits on the dead clone's square
    const survivor = capture.state.board.get('d4');
    expect(survivor?.sigla).toBe('MG');
    expect(isRealMirage(survivor!)).toBe(true); // the real one was untouched
    expect(capture.state.captured.A).toHaveLength(0); // an illusion is worth no punti
    expect(capture.state.captured.B).toHaveLength(0);
    expect(capture.state.history.at(-1)?.isCloneCapture).toBe(true);
  });

  it('killing the real Miraggio removes it AND dissolves its clone — only the real scores', () => {
    const state = gameWith([['d4', 'MG', 'A'], ['d7', 'TO', 'B']]);
    const split = applySdoppiamento(state, 'd4', 'd5', 'd5'); // real d5, clone d4
    if (!split.ok) throw new Error('split failed');

    const capture = applyTurn(split.state, 'd7', 'd5'); // B's Torre captures the real
    expect(capture.ok).toBe(true);
    if (!capture.ok) return;

    expect(capture.state.board.get('d5')?.sigla).toBe('TO'); // the Torre sits on the dead real's square
    expect(capture.state.board.has('d4')).toBe(false); // clone dissolved with it
    expect(capture.state.captured.A).toHaveLength(1); // A lost its (real) Miraggio
    expect(capture.state.captured.A[0].sigla).toBe('MG');
    expect(capture.state.captured.B).toHaveLength(0); // the dissolved clone scored nothing
    expect(capture.state.history.at(-1)?.dispelledClone).toBe(true);
  });

  it('the real Miraggio can split again once its clone has been killed', () => {
    const state = gameWith([['d4', 'MG', 'A'], ['d7', 'TO', 'B']]);
    const split = applySdoppiamento(state, 'd4', 'd5', 'd4');
    if (!split.ok) throw new Error('split failed');
    const capture = applyTurn(split.state, 'd7', 'd5');
    if (!capture.ok) throw new Error('clone capture failed');

    // The capture ended B's turn, so it's A's turn again: the surviving real at d4 may split
    // once more onto an adjacent empty square (d5 now holds B's Torre, so pick e5).
    expect(capture.state.turn).toBe('A');
    const reSplit = applySdoppiamento(capture.state, 'd4', 'e5', 'd4');
    expect(reSplit.ok).toBe(true);
  });

  it('a Miraggio that split still moves like the King afterwards (clone included)', () => {
    const state = gameWith([['d4', 'MG', 'A']]);
    const split = applySdoppiamento(state, 'd4', 'd5', 'd4');
    if (!split.ok) throw new Error('split failed');
    const bQuiet = applyTurn(split.state, 'h8', 'h7');
    if (!bQuiet.ok) throw new Error('B quiet move failed');

    const realMove = applyTurn(bQuiet.state, 'd4', 'e4'); // one square, diagonally
    expect(realMove.ok).toBe(true);
    // Real moved (turn → B): B plays a quiet move, then A moves the clone as a normal piece.
    const bQuiet2 = applyTurn(realMove.ok ? realMove.state : bQuiet.state, 'h7', 'h8');
    expect(bQuiet2.ok).toBe(true);
    const cloneMove = applyTurn(bQuiet2.ok ? bQuiet2.state : bQuiet.state, 'd5', 'd6'); // one square
    expect(cloneMove.ok).toBe(true);
  });

  it('scocca on the real Miraggio dissolves its clone; only the real lands in the graveyard', () => {
    // Arciere at d4; B's Miraggio at d7 splits with its clone at c8 (diagonally adjacent — off
    // the Arciere's north ray, so it doesn't block the shot). The real at d7 is exactly 3 north.
    const state = gameWith([['d4', 'AR', 'A'], ['d7', 'MG', 'B']], 'B');
    const split = applySdoppiamento(state, 'd7', 'c8', 'd7');
    if (!split.ok) throw new Error('split failed');

    const shot = applyScocca(split.state, 'd4', 'd7');
    expect(shot.ok).toBe(true);
    if (!shot.ok) return;

    expect(shot.state.board.has('d7')).toBe(false);
    expect(shot.state.board.has('c8')).toBe(false); // clone dispelled by the ranged shot
    expect(shot.state.captured.B).toHaveLength(1); // B lost its (real) Miraggio
    expect(shot.state.captured.A).toHaveLength(0);
  });

  it('scocca on the clone is a wasted shot — no graveyard entry, real survives', () => {
    // Arciere at d4; B's Miraggio at d8 splits with its clone at d7 (3 north, on the Arciere's
    // ray — the clone shields the real behind it). The shot at d7 kills only the illusion.
    const state = gameWith([['d4', 'AR', 'A'], ['d8', 'MG', 'B']], 'B');
    const split = applySdoppiamento(state, 'd8', 'd7', 'd8');
    if (!split.ok) throw new Error('split failed');

    const shot = applyScocca(split.state, 'd4', 'd7');
    expect(shot.ok).toBe(true);
    if (!shot.ok) return;

    expect(shot.state.board.has('d7')).toBe(false);
    expect(shot.state.board.get('d8')?.sigla).toBe('MG'); // the real one survives
    expect(shot.state.captured.B).toHaveLength(0);
    expect(shot.state.history.at(-1)?.isCloneCapture).toBe(true);
  });

  it('area damage destroying the clone awards nothing and leaves the real standing', () => {
    // B's Colosso at e2 captures A's Pedone at e3 and lands there; the blast (orthogonal squares
    // of e3: d3, f3, e2, e4) hits the clone at d3 — an illusion, so it vanishes without points.
    const state = gameWith([['d4', 'MG', 'A'], ['e3', 'PE', 'A'], ['e2', 'CO', 'B']]);
    const split = applySdoppiamento(state, 'd4', 'd3', 'd4'); // real d4, clone d3
    if (!split.ok) throw new Error('split failed');

    const blast = applyTurn(split.state, 'e2', 'e3');
    expect(blast.ok).toBe(true);
    if (!blast.ok) return;

    expect(blast.state.board.has('d3')).toBe(false); // clone destroyed by the blast
    expect(blast.state.board.get('d4')?.sigla).toBe('MG'); // real survives
    expect(blast.state.captured.A).toHaveLength(1); // only the Pedone (A's loss) — the clone scored nothing
    expect(blast.state.captured.B).toHaveLength(0);
    expect(blast.state.history.at(-1)?.areaDamageCoords).toContain('d3');
  });

  it('area damage destroying the real Miraggio dissolves its clone as fallout', () => {
    // B's Colosso at e2 captures A's Pedone at e3 and lands there; the blast hits the REAL at d3,
    // which takes its clone at d4 down with it.
    const state = gameWith([['d4', 'MG', 'A'], ['e3', 'PE', 'A'], ['e2', 'CO', 'B']]);
    const split = applySdoppiamento(state, 'd4', 'd3', 'd3'); // real d3, clone d4
    if (!split.ok) throw new Error('split failed');

    const blast = applyTurn(split.state, 'e2', 'e3');
    expect(blast.ok).toBe(true);
    if (!blast.ok) return;

    expect(blast.state.board.has('d3')).toBe(false); // real destroyed
    expect(blast.state.board.has('d4')).toBe(false); // clone dissolved
    const mgGraveyard = blast.state.captured.A.filter((p) => p.sigla === 'MG');
    expect(mgGraveyard).toHaveLength(1); // only the real scores
    expect(blast.state.captured.B).toHaveLength(0);
  });
});

describe('findCloneOf', () => {
  it('locates the clone of a split Miraggio and nothing for an unsplit one', () => {
    let board = placeMirage(createEmptyBoard(), 'd4', 'A', 'm1', false);
    board = placeMirage(board, 'd5', 'A', 'm1', true);
    expect(findCloneOf(board, 'm1')?.coord).toBe('d5');

    const unsplit: PieceInstance = { ...createPieceInstance('MG', 'A'), mirage: undefined };
    board = setPieceAt(createEmptyBoard(), 'd4', unsplit);
    expect(findCloneOf(board, unsplit.id)).toBeNull();
  });
});
