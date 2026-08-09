import type { Piece, Rules } from '../types';
import { pieces, pickablePieces, rules, KING_SIGLA } from './pieces';
import { canAddPieceType, computeBudgetSpent, computeDistinctSpecialTypes, computeTotalPieces } from './validators';

/** Score bonus for a candidate that reinforces an already-present special type (or is classic)
 * instead of introducing a new one — steers the greedy fill toward reusing scarce "slots" without
 * making it an absolute veto, since it's expressed on the same 0–~1 scale as the base score.
 */
const SLOT_REUSE_BONUS = 0.5;

/** improveTeam's diff-minimization search works in raw budget points, not a 0–1 score — the reuse
 * bonus there is expressed as a fraction of the budget instead, so it stays meaningful regardless
 * of board size. */
const SLOT_REUSE_BONUS_RATIO = 0.05;

function calcCost(team: Map<string, number>): number {
  return computeBudgetSpent(team, pieces);
}

function calcTotalPieces(team: Map<string, number>): number {
  return computeTotalPieces(team);
}

function cloneTeam(team: Map<string, number>): Map<string, number> {
  return new Map(team);
}

function usesNewSpecialSlot(team: Map<string, number>, piece: Piece): boolean {
  return !piece.classico && (team.get(piece.sigla) ?? 0) === 0;
}

export interface OptimizerResult {
  team: Map<string, number>;
  changed: boolean;
  message: string;
}

/**
 * Scores a candidate piece for the greedy fill: prefers picks that use up more of the remaining
 * budget while leaving a remainder that some other candidate can still make good use of. One
 * consistent 0–~1 scale across all candidates (no branch-dependent scale jumps), plus an optional
 * bonus for reusing an already-present special type when a distinct-types limit is active.
 */
function scoreCandidate(
  team: Map<string, number>,
  piece: Piece,
  budgetLeft: number,
  candidates: Piece[],
  maxDistinctSpecialTypes: number | null,
): number {
  const budgetAfter = budgetLeft - piece.punti;
  const otherCosts = candidates.filter((p) => p.sigla !== piece.sigla && p.punti <= budgetAfter).map((p) => p.punti);
  const bestRemainderFit = otherCosts.length > 0
    ? Math.max(...otherCosts) / Math.max(budgetAfter, 1)
    : (budgetAfter === 0 ? 1 : 0);

  let score = (piece.punti / Math.max(budgetLeft, 1)) * 0.7 + bestRemainderFit * 0.3;

  if (maxDistinctSpecialTypes != null && !usesNewSpecialSlot(team, piece)) {
    score += SLOT_REUSE_BONUS;
  }

  return score;
}

export function autoFillTeam(
  currentTeam: Map<string, number>,
  effectiveRules: Rules = rules,
  maxDistinctSpecialTypes: number | null = null,
): OptimizerResult {
  const team = cloneTeam(currentTeam);
  const currentCost = calcCost(team);
  const currentTotal = calcTotalPieces(team);
  const remainingBudget = effectiveRules.budget - currentCost;

  if (remainingBudget <= 0) {
    return { team, changed: false, message: 'Budget esaurito, non è possibile aggiungere pezzi.' };
  }

  if (currentTotal >= effectiveRules.maxPiecesTotal) {
    return { team, changed: false, message: 'Team già completo (numero massimo di pezzi raggiunto).' };
  }

  let added = 0;
  let budgetLeft = remainingBudget;
  let blockedBySpecialLimit = false;

  while (calcTotalPieces(team) < effectiveRules.maxPiecesTotal) {
    const candidates = pickablePieces.filter(
      (p) => p.punti <= budgetLeft && canAddPieceType(team, p, pieces, effectiveRules, maxDistinctSpecialTypes),
    );

    if (candidates.length === 0) {
      const wouldFitWithoutLimit = pickablePieces.some(
        (p) => p.punti <= budgetLeft && canAddPieceType(team, p, pieces, effectiveRules, null),
      );
      if (wouldFitWithoutLimit) blockedBySpecialLimit = true;
      break;
    }

    let bestPiece = candidates[0];
    let bestScore = -Infinity;
    for (const piece of candidates) {
      const score = scoreCandidate(team, piece, budgetLeft, candidates, maxDistinctSpecialTypes);
      if (score > bestScore) {
        bestScore = score;
        bestPiece = piece;
      }
    }

    team.set(bestPiece.sigla, (team.get(bestPiece.sigla) ?? 0) + 1);
    budgetLeft -= bestPiece.punti;
    added++;
  }

  if (added === 0) {
    const message = blockedBySpecialLimit
      ? `Nessun pezzo aggiunto: il limite di tipi speciali distinti (max ${maxDistinctSpecialTypes}) è già saturo e non ci sono più copie di tipi già presenti o pezzi classici che rientrino nel budget rimanente.`
      : 'Nessun pezzo trovato che rientri nel budget rimanente.';
    return { team, changed: false, message };
  }

  const newTotal = calcTotalPieces(team);
  const budgetUsed = effectiveRules.budget - budgetLeft;
  const limitNote = blockedBySpecialLimit ? ' (limite di tipi speciali raggiunto, non è stato possibile aggiungere altro)' : '';

  return {
    team,
    changed: true,
    message: `Aggiunti ${added} pezzo/i. Costo: ${budgetUsed}/${effectiveRules.budget} (${budgetLeft} rimanenti). Totale: ${newTotal} pezzi.${limitNote}`,
  };
}

/**
 * If `team` already exceeds `maxDistinctSpecialTypes` (e.g. built manually before the limit was
 * set, or from a preset that doesn't respect it), remove whole special types — cheapest first,
 * all copies at once, since removing only some copies wouldn't free the slot — until compliant.
 */
function correctSpecialTypesOverflow(
  team: Map<string, number>,
  maxDistinctSpecialTypes: number | null,
): { team: Map<string, number>; removedCount: number } {
  if (maxDistinctSpecialTypes == null) return { team, removedCount: 0 };

  const working = cloneTeam(team);
  let removedCount = 0;

  while (computeDistinctSpecialTypes(working, pieces) > maxDistinctSpecialTypes) {
    let cheapestSigla: string | null = null;
    let cheapestCost = Infinity;

    working.forEach((count, sigla) => {
      if (count <= 0) return;
      const piece = pieces.find((p) => p.sigla === sigla);
      if (piece && !piece.classico && piece.punti < cheapestCost) {
        cheapestCost = piece.punti;
        cheapestSigla = sigla;
      }
    });

    if (!cheapestSigla) break; // safety net; shouldn't happen since the loop condition implies at least one special type

    removedCount += working.get(cheapestSigla) ?? 0;
    working.delete(cheapestSigla);
  }

  return { team: working, removedCount };
}

export function improveTeam(
  currentTeam: Map<string, number>,
  effectiveRules: Rules = rules,
  maxDistinctSpecialTypes: number | null = null,
): OptimizerResult {
  const { team: correctedTeam, removedCount } = correctSpecialTypesOverflow(currentTeam, maxDistinctSpecialTypes);
  const team = correctedTeam;
  const correctionPrefix = removedCount > 0
    ? `Rimossi ${removedCount} pezzo/i per rispettare il limite di tipi speciali distinti (max ${maxDistinctSpecialTypes}). `
    : '';

  let improved = true;
  let iterations = 0;
  let everImproved = false;
  const maxIterations = 50;

  // A comparison-only bonus (proportional to budget, so it's meaningful across board sizes) that
  // favors moves reusing an existing special type over introducing a new one, without distorting
  // the *actual* budget-diff figures shown in the returned message. Mirrors autoFillTeam's
  // SLOT_REUSE_BONUS intent, adapted to a diff-minimization search: it can outweigh a real (not
  // just tied) budget-fit disadvantage of a few points, but a new type still wins when it is
  // clearly the better fit for the budget.
  const slotReuseDiffBonus = effectiveRules.budget * SLOT_REUSE_BONUS_RATIO;
  const comparable = (diff: number, movePiece: Piece | null): number => {
    if (maxDistinctSpecialTypes == null || !movePiece) return diff;
    return usesNewSpecialSlot(team, movePiece) ? diff : Math.max(diff - slotReuseDiffBonus, 0);
  };

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    const currentCost = calcCost(team);
    if (currentCost === effectiveRules.budget) break;

    const currentDiff = Math.abs(effectiveRules.budget - currentCost);
    let bestComparable = currentDiff;
    let bestTeam = cloneTeam(team);

    for (const [sigla, count] of team) {
      if (sigla === KING_SIGLA) continue;

      const teamWithout = cloneTeam(team);
      if (count === 1) {
        teamWithout.delete(sigla);
      } else {
        teamWithout.set(sigla, count - 1);
      }
      const costWithout = calcCost(teamWithout);
      const diffWithout = Math.abs(effectiveRules.budget - costWithout);

      if (costWithout <= effectiveRules.budget && diffWithout < bestComparable) {
        bestComparable = diffWithout;
        bestTeam = teamWithout;
        improved = true;
      }

      for (const piece of pickablePieces) {
        if (piece.sigla === sigla) continue;
        if (!canAddPieceType(teamWithout, piece, pieces, effectiveRules, maxDistinctSpecialTypes)) continue;

        const costWithSwap = costWithout + piece.punti;
        if (costWithSwap > effectiveRules.budget) continue;

        const diffSwap = Math.abs(effectiveRules.budget - costWithSwap);
        const comparableSwap = comparable(diffSwap, piece);
        if (comparableSwap < bestComparable) {
          bestComparable = comparableSwap;
          const swappedTeam = cloneTeam(teamWithout);
          swappedTeam.set(piece.sigla, (teamWithout.get(piece.sigla) ?? 0) + 1);
          bestTeam = swappedTeam;
          improved = true;
        }
      }
    }

    for (const piece of pickablePieces) {
      if (!canAddPieceType(team, piece, pieces, effectiveRules, maxDistinctSpecialTypes)) continue;

      const costAdd = currentCost + piece.punti;
      if (costAdd > effectiveRules.budget) continue;
      const totalAdd = calcTotalPieces(team) + 1;
      if (totalAdd > effectiveRules.maxPiecesTotal) continue;

      const diffAdd = Math.abs(effectiveRules.budget - costAdd);
      const comparableAdd = comparable(diffAdd, piece);
      if (comparableAdd < bestComparable) {
        bestComparable = comparableAdd;
        const addedTeam = cloneTeam(team);
        addedTeam.set(piece.sigla, (team.get(piece.sigla) ?? 0) + 1);
        bestTeam = addedTeam;
        improved = true;
      }
    }

    if (improved) {
      everImproved = true;
      team.clear();
      bestTeam.forEach((count, sigla) => team.set(sigla, count));
    }
  }

  const finalCost = calcCost(team);
  const finalDiff = Math.abs(effectiveRules.budget - finalCost);
  const changed = removedCount > 0 || everImproved;

  if (finalCost === effectiveRules.budget) {
    if (!changed) {
      return { team, changed: false, message: 'Il team è già perfettamente in budget!' };
    }
    return {
      team,
      changed: true,
      message: `${correctionPrefix}Team ottimizzato! Budget esatto: ${effectiveRules.budget}/${effectiveRules.budget}.`,
    };
  }

  if (!changed) {
    return { team, changed: false, message: 'Nessun miglioramento possibile con le regole attuali.' };
  }

  return {
    team,
    changed: true,
    message: `${correctionPrefix}Team migliorato. Budget: ${finalCost}/${effectiveRules.budget} (differenza: ${finalDiff}).`,
  };
}
