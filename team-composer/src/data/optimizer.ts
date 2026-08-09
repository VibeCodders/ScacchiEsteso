import type { Piece } from '../types';
import { pieces, rules, KING_SIGLA } from './pieces';
import { getMaxIdenticalBySigla, countByCategory, computeBudgetSpent, computeTotalPieces } from './validators';

function getMaxIdenticalFor(sigla: string): number {
  return getMaxIdenticalBySigla(sigla, pieces, rules);
}

function calcCost(team: Map<string, number>): number {
  return computeBudgetSpent(team, pieces);
}

function calcTotalPieces(team: Map<string, number>): number {
  return computeTotalPieces(team);
}

function calcTotalPawns(team: Map<string, number>): number {
  return countByCategory(team, pieces, 'pedone');
}

function cloneTeam(team: Map<string, number>): Map<string, number> {
  return new Map(team);
}

export interface OptimizerResult {
  team: Map<string, number>;
  changed: boolean;
  message: string;
}

export function autoFillTeam(currentTeam: Map<string, number>): OptimizerResult {
  const team = cloneTeam(currentTeam);
  const currentCost = calcCost(team);
  const currentTotal = calcTotalPieces(team);
  const remainingBudget = rules.budget - currentCost;
  const slotsNeeded = Math.max(0, rules.minPiecesTotal - currentTotal);

  if (remainingBudget <= 0) {
    return { team, changed: false, message: 'Budget esaurito, non è possibile aggiungere pezzi.' };
  }

  if (slotsNeeded <= 0 && currentTotal >= rules.maxPiecesTotal) {
    return { team, changed: false, message: 'Team già completo (numero massimo di pezzi raggiunto).' };
  }

  let added = 0;
  let budgetLeft = remainingBudget;
  const maxPawns = rules.maxCountByCategory.pedone ?? rules.maxIdenticalDefault;

  for (let i = 0; i < slotsNeeded; i++) {
    let bestPiece: Piece | null = null;
    let bestScore = -Infinity;

    for (const piece of pieces) {
      if (piece.sigla === KING_SIGLA) continue;
      const currentCount = team.get(piece.sigla) ?? 0;
      if (currentCount >= getMaxIdenticalFor(piece.sigla)) continue;
      if (piece.categoria === 'pedone' && calcTotalPawns(team) + 1 > maxPawns) continue;
      if (piece.punti > budgetLeft) continue;

      const slotsAfter = slotsNeeded - i - 1;
      const budgetAfter = budgetLeft - piece.punti;

      let score: number;
      if (slotsAfter === 0) {
        score = budgetLeft > 0 ? (piece.punti / budgetLeft) * 100 : 0;
      } else {
        const minPieceCost = Math.min(...pieces
          .filter((p: Piece) => p.sigla !== KING_SIGLA && p.punti <= budgetAfter && (team.get(p.sigla) ?? 0) < getMaxIdenticalFor(p.sigla) && !(p.categoria === 'pedone' && calcTotalPawns(team) + 1 > maxPawns))
          .map((p: Piece) => p.punti));
        if (minPieceCost > budgetAfter) {
          score = piece.punti / budgetLeft;
        } else {
          score = (piece.punti / budgetLeft) * 0.7 + (minPieceCost / budgetAfter) * 0.3;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestPiece = piece;
      }
    }

    if (!bestPiece) break;

    team.set(bestPiece.sigla, (team.get(bestPiece.sigla) ?? 0) + 1);
    budgetLeft -= bestPiece.punti;
    added++;
  }

  if (added === 0) {
    return { team, changed: false, message: 'Nessun pezzo trovato che rientri nel budget rimanente.' };
  }

  const newTotal = calcTotalPieces(team);
  const budgetUsed = rules.budget - budgetLeft;

  return {
    team,
    changed: true,
    message: `Aggiunti ${added} pezzo/i. Costo: ${budgetUsed}/${rules.budget} (${budgetLeft} rimanenti). Totale: ${newTotal} pezzi.`,
  };
}

export function improveTeam(currentTeam: Map<string, number>): OptimizerResult {
  const team = cloneTeam(currentTeam);
  let improved = true;
  let iterations = 0;
  const maxIterations = 50;
  const maxPawns = rules.maxCountByCategory.pedone ?? rules.maxIdenticalDefault;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    const currentCost = calcCost(team);
    const currentDiff = Math.abs(rules.budget - currentCost);

    if (currentCost === rules.budget) {
      return { team, changed: false, message: 'Il team è già perfettamente in budget!' };
    }

    let bestDiff = currentDiff;
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
      const diffWithout = Math.abs(rules.budget - costWithout);

      if (diffWithout < bestDiff && costWithout <= rules.budget) {
        bestDiff = diffWithout;
        bestTeam = teamWithout;
        improved = true;
      }

      for (const piece of pieces) {
        if (piece.sigla === KING_SIGLA) continue;
        if (piece.sigla === sigla) continue;

        const newCount = teamWithout.get(piece.sigla) ?? 0;
        if (newCount >= getMaxIdenticalFor(piece.sigla)) continue;
        if (piece.categoria === 'pedone' && calcTotalPawns(teamWithout) + 1 > maxPawns) continue;

        const costWithSwap = costWithout + piece.punti;
        if (costWithSwap > rules.budget) continue;

        const diffSwap = Math.abs(rules.budget - costWithSwap);
        if (diffSwap < bestDiff) {
          bestDiff = diffSwap;
          const swappedTeam = cloneTeam(teamWithout);
          swappedTeam.set(piece.sigla, newCount + 1);
          bestTeam = swappedTeam;
          improved = true;
        }
      }
    }

    for (const piece of pieces) {
      if (piece.sigla === KING_SIGLA) continue;
      const currentCount = team.get(piece.sigla) ?? 0;
      if (currentCount >= getMaxIdenticalFor(piece.sigla)) continue;
      if (piece.categoria === 'pedone' && calcTotalPawns(team) + 1 > maxPawns) continue;

      const costAdd = currentCost + piece.punti;
      if (costAdd > rules.budget) continue;
      const totalAdd = calcTotalPieces(team) + 1;
      if (totalAdd > rules.maxPiecesTotal) continue;

      const diffAdd = Math.abs(rules.budget - costAdd);
      if (diffAdd < bestDiff) {
        bestDiff = diffAdd;
        const addedTeam = cloneTeam(team);
        addedTeam.set(piece.sigla, currentCount + 1);
        bestTeam = addedTeam;
          improved = true;
      }
    }

    if (improved) {
      team.clear();
      bestTeam.forEach((count, sigla) => team.set(sigla, count));
    }
  }

  const finalCost = calcCost(team);
  const finalDiff = Math.abs(rules.budget - finalCost);

  if (finalCost === rules.budget) {
    return { team, changed: true, message: `Team ottimizzato! Budget esatto: ${rules.budget}/${rules.budget}.` };
  }

  return {
    team,
    changed: true,
    message: `Team migliorato. Budget: ${finalCost}/${rules.budget} (differenza: ${finalDiff}).`,
  };
}
