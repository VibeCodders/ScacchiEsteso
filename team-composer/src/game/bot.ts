import { allCoords, getPieceAt, type Coord, type Owner } from './board';
import { getPieceDef } from './moveEngine';
import { getPromotionOptions, isPromotionMove } from './promotion';
import { canUseScocca, getScoccaTargets } from './scocca';
import { canSwap, getSwapTargets } from './swap';
import { canSwapperSwap, getSwapperCandidatePairs } from './swapper';
import { canRevive, getRevivalSquares, getRevivableSiglas } from './necromancy';
import { canMimic, getOrphanThreats } from './orphan';
import { computeMaterialScore } from './antiStalemate';
import {
  applyTurn,
  applyScocca,
  applySwap,
  applySwapperSwap,
  applyRevive,
  skipExtraMove,
  stopRabbitChain,
  getLegalMovesForTurn,
  type ApplyTurnResult,
  type GameState,
} from './turnManager';

export type BotDifficulty = 'easy' | 'medium' | 'hard';

/** Search depth per difficulty. A "depth unit" is one resolved action, not strictly one full turn — see bot.ts's notes on the Berserker bonus phase. */
export const DIFFICULTY_DEPTH: Record<BotDifficulty, number> = { easy: 1, medium: 2, hard: 3 };

/**
 * Wall-clock safety cap per difficulty (ms). Full-ability action generation makes the branching
 * factor position-dependent (a busy board with many Arcieri/Necromanti in range costs far more
 * than a sparse endgame), so a fixed depth alone can't bound response time — this keeps the bot
 * from ever freezing the UI for long, at the cost of a shallower-than-requested search in the
 * rare positions that would otherwise blow the budget.
 */
export const DIFFICULTY_TIME_BUDGET_MS: Record<BotDifficulty, number> = { easy: 1000, medium: 2500, hard: 4000 };

export type BotAction =
  | { kind: 'move'; from: Coord; to: Coord; promotionChoice?: string; orphanMimicSource?: Coord }
  | { kind: 'scocca'; from: Coord; target: Coord }
  | { kind: 'swap'; from: Coord; target: Coord }
  | { kind: 'swapperSwap'; from: Coord; squareA: Coord; squareB: Coord }
  | { kind: 'revive'; from: Coord; target: Coord; sigla: string }
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
  }

  return actions;
}

const CENTER_SQUARES: ReadonlySet<Coord> = new Set(['d4', 'd5', 'e4', 'e5']);
const CENTER_CONTROL_BONUS = 3;
const CHECKMATE_SCORE = 100000;

function positionalScore(state: GameState, owner: Owner): number {
  let score = computeMaterialScore(state.board, owner, state.dimensions);

  for (const coord of allCoords(state.dimensions)) {
    const piece = getPieceAt(state.board, coord);
    if (piece && piece.owner === owner && CENTER_SQUARES.has(coord)) {
      score += CENTER_CONTROL_BONUS;
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
    depth === 0 ||
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
 * action (movement and all special abilities). Returns null if there is nothing legal to do (the
 * caller shouldn't normally reach this — the game would already have ended).
 */
export function chooseBotAction(state: GameState, owner: Owner, difficulty: BotDifficulty): BotAction | null {
  const actions = orderActions(state, owner, generateBotActions(state, owner));
  if (actions.length === 0) return null;

  const depth = DIFFICULTY_DEPTH[difficulty];
  const deadline = Date.now() + DIFFICULTY_TIME_BUDGET_MS[difficulty];
  let bestAction = actions[0];
  let bestValue = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;

  for (const action of actions) {
    const result = applyBotAction(state, action);
    if (!result.ok) continue;
    const value = minimax(result.state, depth - 1, alpha, beta, owner, deadline);
    if (value > bestValue) {
      bestValue = value;
      bestAction = action;
    }
    alpha = Math.max(alpha, bestValue);
    if (Date.now() >= deadline) break;
  }

  return bestAction;
}
