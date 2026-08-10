import { allCoords, coordToFileRank, getPieceAt, type Coord, type Owner } from './board';
import { getPieceDef } from './moveEngine';
import { findKingCoord } from './check';
import { getPromotionOptions, isPromotionMove } from './promotion';
import { canUseScocca, getScoccaTargets } from './scocca';
import { canSwap, getSwapTargets } from './swap';
import { canSwapperSwap, getSwapperCandidatePairs } from './swapper';
import { canRevive, getRevivalSquares, getRevivableSiglas } from './necromancy';
import { canMimic, getOrphanThreats } from './orphan';
import { canSdoppiare, getSdoppiamentoSquares, canRiunire, getRiunioneSquares } from './mirage';
import { computeMaterialScore } from './antiStalemate';
import {
  applyTurn,
  applyScocca,
  applySwap,
  applySwapperSwap,
  applyRevive,
  applySdoppiamento,
  applyRiunione,
  skipExtraMove,
  stopRabbitChain,
  getLegalMovesForTurn,
  type ApplyTurnResult,
  type GameState,
} from './turnManager';

/** Bot difficulty is a plain number on the 1–50 scale: difficulty ÷ 10 = moves the bot looks
 *  ahead (10 → 1 mossa, 20 → 2 mosse, 50 → 5 mosse; 5 → 0.5 mosse, 1 → 0 mosse).
 *  A "mossa" is a full turn, so the search depth in plies is difficulty ÷ 5. */
export type BotDifficulty = number;

export const BOT_DIFFICULTY_MIN = 1;
export const BOT_DIFFICULTY_MAX = 50;
/** 10 → the bot sees 1 mossa ahead — a reasonable default between pure greed and deep search. */
export const DEFAULT_BOT_DIFFICULTY: BotDifficulty = 10;

/**
 * Search depth in plies for a numeric difficulty. Each "ply" is one resolved action (not strictly
 * one full turn — see bot.ts's notes on the Berserker bonus phase). Difficulty ÷ 5 plies, quantized
 * to whole plies so the anchors land exactly: 1 → 0 plies (0 mosse), 5 → 1 ply (0.5 mosse),
 * 10 → 2 plies (1 mossa), 20 → 4 plies (2 mosse), 50 → 10 plies (5 mosse).
 */
export function difficultyToDepth(difficulty: number): number {
  return Math.max(0, Math.round(difficulty / 5));
}

/**
 * Wall-clock safety cap (ms) for a numeric difficulty — more lookahead buys more time. Full-ability
 * action generation makes the branching factor position-dependent (a busy board with many
 * Arcieri/Necromanti in range costs far more than a sparse endgame), so a fixed depth alone can't
 * bound response time — this keeps the bot from ever freezing the UI for long, at the cost of a
 * shallower-than-requested search in the rare positions that would otherwise blow the budget.
 * 500ms at difficulty 1, ~1.1s at 10, ~2.5s at 25, 4s at 50.
 */
export function difficultyTimeBudgetMs(difficulty: number): number {
  const t = Math.min(BOT_DIFFICULTY_MAX, Math.max(BOT_DIFFICULTY_MIN, difficulty));
  return Math.round(500 + ((t - BOT_DIFFICULTY_MIN) / (BOT_DIFFICULTY_MAX - BOT_DIFFICULTY_MIN)) * 3500);
}

/** Human-readable lookahead for a difficulty: difficulty ÷ 10 mosse (10 → "1 mossa", 5 → "0.5
 *  mosse", 1 → "0 mosse"), shared by the difficulty slider and the in-game PC badge. */
export function formatMovesAhead(difficulty: number): string {
  const moves = difficulty / 10;
  if (moves === 1) return '1 mossa';
  return `${moves} mosse`;
}

export type BotAction =
  | { kind: 'move'; from: Coord; to: Coord; promotionChoice?: string; orphanMimicSource?: Coord }
  | { kind: 'scocca'; from: Coord; target: Coord }
  | { kind: 'swap'; from: Coord; target: Coord }
  | { kind: 'swapperSwap'; from: Coord; squareA: Coord; squareB: Coord }
  | { kind: 'revive'; from: Coord; target: Coord; sigla: string }
  | { kind: 'sdoppiamento'; from: Coord; cloneSquare: Coord; realSquare: Coord }
  | { kind: 'riunione'; from: Coord; mergeSquare: Coord }
  | { kind: 'skipExtraMove' }
  | { kind: 'stopRabbitChain' };

export function applyBotAction(state: GameState, action: BotAction): ApplyTurnResult {
  switch (action.kind) {
    case 'move':
      return applyTurn(state, action.from, action.to, action.promotionChoice, action.orphanMimicSource);
    case 'scocca':
      return applyScocca(state, action.from, action.target);
    case 'swap':
      return applySwap(state, action.from, action.target);
    case 'swapperSwap':
      return applySwapperSwap(state, action.from, action.squareA, action.squareB);
    case 'revive':
      return applyRevive(state, action.from, action.target, action.sigla);
    case 'sdoppiamento':
      return applySdoppiamento(state, action.from, action.cloneSquare, action.realSquare);
    case 'riunione':
      return applyRiunione(state, action.from, action.mergeSquare);
    case 'skipExtraMove':
      return skipExtraMove(state);
    case 'stopRabbitChain':
      return stopRabbitChain(state);
  }
}

/** Every legal action `owner` could take from `state`, across normal moves and every special ability. */
export function generateBotActions(state: GameState, owner: Owner): BotAction[] {
  const actions: BotAction[] = [];

  if (state.pendingExtraMove) {
    const from = state.pendingExtraMove;
    for (const move of getLegalMovesForTurn(state, from)) {
      actions.push({ kind: 'move', from, to: move.to });
    }
    actions.push({ kind: 'skipExtraMove' });
    return actions;
  }

  if (state.pendingRabbitChain) {
    const from = state.pendingRabbitChain.at;
    for (const move of getLegalMovesForTurn(state, from)) {
      actions.push({ kind: 'move', from, to: move.to });
    }
    actions.push({ kind: 'stopRabbitChain' });
    return actions;
  }

  for (const from of allCoords(state.dimensions)) {
    const piece = getPieceAt(state.board, from);
    if (!piece || piece.owner !== owner) continue;
    const pieceDef = getPieceDef(piece.sigla);

    if (canMimic(pieceDef)) {
      const threats = getOrphanThreats(state.board, from, owner, state.dimensions);
      if (threats.length > 0) {
        for (const threat of threats) {
          for (const move of getLegalMovesForTurn(state, from, threat)) {
            actions.push({ kind: 'move', from, to: move.to, orphanMimicSource: threat });
          }
        }
        continue; // a threatened Orfano has no other move source this turn
      }
    }

    for (const move of getLegalMovesForTurn(state, from)) {
      if (isPromotionMove(pieceDef, owner, move.to, state.dimensions)) {
        for (const promotionChoice of getPromotionOptions(pieceDef)) {
          actions.push({ kind: 'move', from, to: move.to, promotionChoice });
        }
      } else {
        actions.push({ kind: 'move', from, to: move.to });
      }
    }

    if (canUseScocca(pieceDef)) {
      for (const target of getScoccaTargets(state.board, from, owner, state.dimensions)) {
        actions.push({ kind: 'scocca', from, target });
      }
    }

    if (canSwap(pieceDef)) {
      for (const target of getSwapTargets(state.board, from, owner, state.dimensions)) {
        actions.push({ kind: 'swap', from, target });
      }
    }

    if (canSwapperSwap(pieceDef)) {
      for (const [squareA, squareB] of getSwapperCandidatePairs(state.board, from, owner, state.dimensions)) {
        actions.push({ kind: 'swapperSwap', from, squareA, squareB });
      }
    }

    if (canRevive(pieceDef)) {
      const siglas = getRevivableSiglas(state.captured[owner]);
      if (siglas.length > 0) {
        for (const target of getRevivalSquares(state.board, from, owner, state.dimensions)) {
          for (const sigla of siglas) {
            actions.push({ kind: 'revive', from, target, sigla });
          }
        }
      }
    }

    if (canSdoppiare(pieceDef)) {
      for (const cloneSquare of getSdoppiamentoSquares(state.board, from, owner, getPieceDef, state.dimensions)) {
        for (const realSquare of [from, cloneSquare]) {
          actions.push({ kind: 'sdoppiamento', from, cloneSquare, realSquare });
        }
      }
    }

    if (canRiunire(pieceDef)) {
      for (const mergeSquare of getRiunioneSquares(state.board, from, owner, getPieceDef, state.dimensions)) {
        actions.push({ kind: 'riunione', from, mergeSquare });
      }
    }
  }

  return actions;
}

const CENTER_SQUARES: ReadonlySet<Coord> = new Set(['d4', 'd5', 'e4', 'e5']);
const CENTER_CONTROL_BONUS = 3;
/** A Miraggio (real half, clone, or unsplit) sitting next to its own King is a shield: an enemy
 *  capture on the clone is a wasted capture (the illusion awards no punti), and either half patrols
 *  the King's immediate perimeter — worth more than a random quiet move, less than a real piece. */
const MIRAGE_GUARD_BONUS = 12;
const CHECKMATE_SCORE = 100000;

/** True when the two squares are 8-neighbors (different squares, |Δfile| ≤ 1 and |Δrank| ≤ 1). */
function isAdjacentCoord(a: Coord, b: Coord): boolean {
  if (a === b) return false;
  const pa = coordToFileRank(a);
  const pb = coordToFileRank(b);
  return Math.abs(pa.file - pb.file) <= 1 && Math.abs(pa.rank - pb.rank) <= 1;
}

function positionalScore(state: GameState, owner: Owner): number {
  let score = computeMaterialScore(state.board, owner, state.dimensions);
  const kingCoord = findKingCoord(state.board, owner, state.dimensions);

  for (const coord of allCoords(state.dimensions)) {
    const piece = getPieceAt(state.board, coord);
    if (!piece || piece.owner !== owner) continue;
    if (CENTER_SQUARES.has(coord)) {
      score += CENTER_CONTROL_BONUS;
    }
    if (kingCoord && canSdoppiare(getPieceDef(piece.sigla)) && isAdjacentCoord(coord, kingCoord)) {
      score += MIRAGE_GUARD_BONUS;
    }
  }

  return score;
}

/** Cheap capture-value estimate used only to order actions before search, so alpha-beta prunes more. */
function estimateActionGain(state: GameState, owner: Owner, action: BotAction): number {
  const targetCoord = action.kind === 'move' ? action.to : action.kind === 'scocca' ? action.target : null;
  if (!targetCoord) return 0;
  const target = getPieceAt(state.board, targetCoord);
  if (!target || target.owner === owner) return 0;
  return getPieceDef(target.sigla).punti;
}

function orderActions(state: GameState, owner: Owner, actions: BotAction[]): BotAction[] {
  return [...actions].sort((a, b) => estimateActionGain(state, owner, b) - estimateActionGain(state, owner, a));
}

function evaluate(state: GameState, botOwner: Owner): number {
  const opponent: Owner = botOwner === 'A' ? 'B' : 'A';

  if (state.status === 'checkmate') {
    return state.winner === botOwner ? CHECKMATE_SCORE : -CHECKMATE_SCORE;
  }
  if (state.status === 'anti_stalemate') {
    if (state.winner === botOwner) return CHECKMATE_SCORE / 2;
    if (state.winner === opponent) return -CHECKMATE_SCORE / 2;
    return 0;
  }
  if (state.status === 'stalemate') return 0;

  return positionalScore(state, botOwner) - positionalScore(state, opponent);
}

function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  botOwner: Owner,
  deadline: number,
): number {
  if (
    depth <= 0 ||
    Date.now() >= deadline ||
    state.status === 'checkmate' ||
    state.status === 'stalemate' ||
    state.status === 'anti_stalemate'
  ) {
    return evaluate(state, botOwner);
  }

  const toMove = state.turn;
  const actions = orderActions(state, toMove, generateBotActions(state, toMove));
  if (actions.length === 0) return evaluate(state, botOwner);

  const maximizing = toMove === botOwner;
  let best = maximizing ? -Infinity : Infinity;

  for (const action of actions) {
    const result = applyBotAction(state, action);
    if (!result.ok) continue;
    const value = minimax(result.state, depth - 1, alpha, beta, botOwner, deadline);

    if (maximizing) {
      best = Math.max(best, value);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, value);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
    if (Date.now() >= deadline) break;
  }

  return best;
}

/**
 * Picks the best action for `owner` to play from `state` via alpha-beta minimax over every legal
 * action (movement and all special abilities), searched iteratively: depth 1, 2, … up to the
 * difficulty's target depth. Each iteration reorders the actions by how they scored in the
 * previous one (best first) so alpha-beta prunes more, and the answer of the deepest *completed*
 * iteration is returned — if the wall-clock budget runs out mid-iteration, the previous
 * iteration's (already sound) answer is kept instead of a half-searched deeper one. Returns null
 * if there is nothing legal to do (the caller shouldn't normally reach this — the game would
 * already have ended).
 */
export function chooseBotAction(state: GameState, owner: Owner, difficulty: BotDifficulty): BotAction | null {
  const actions = orderActions(state, owner, generateBotActions(state, owner));
  if (actions.length === 0) return null;

  const maxDepth = difficultyToDepth(difficulty);
  const deadline = Date.now() + difficultyTimeBudgetMs(difficulty);

  // Difficulty 1 = 0 plies: no lookahead at all — pick the action whose resulting position scores
  // best under the static evaluation (the equivalent of a depth-0 minimax over the root actions).
  if (maxDepth === 0) {
    let bestAction = actions[0];
    let bestValue = -Infinity;
    for (const action of actions) {
      if (Date.now() >= deadline) break;
      const result = applyBotAction(state, action);
      if (!result.ok) continue;
      const value = evaluate(result.state, owner);
      if (value > bestValue) {
        bestValue = value;
        bestAction = action;
      }
    }
    return bestAction;
  }

  let ordering = actions;
  const previousScores = new Map<BotAction, number>();
  let bestAction = actions[0];

  for (let depth = 1; depth <= maxDepth; depth++) {
    // Best-first ordering from the previous iteration's scores makes alpha-beta cut the most.
    const iterationOrdering = [...ordering].sort((a, b) => (previousScores.get(b) ?? 0) - (previousScores.get(a) ?? 0));

    let iterationBest: BotAction | null = null;
    let iterationBestValue = -Infinity;
    let alpha = -Infinity;
    const beta = Infinity;
    let interrupted = false;

    for (const action of iterationOrdering) {
      if (Date.now() >= deadline) {
        interrupted = true;
        break;
      }
      const result = applyBotAction(state, action);
      if (!result.ok) continue;
      const value = minimax(result.state, depth - 1, alpha, beta, owner, deadline);
      previousScores.set(action, value);
      if (value > iterationBestValue) {
        iterationBestValue = value;
        iterationBest = action;
      }
      alpha = Math.max(alpha, iterationBestValue);
    }

    if (interrupted) break; // time ran out mid-iteration — keep the previous completed iteration's answer
    if (iterationBest) bestAction = iterationBest;
    ordering = iterationOrdering;
  }

  return bestAction;
}
