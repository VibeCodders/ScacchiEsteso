import type { Piece, Rules, ValidationResult } from '../types';

export function getMaxIdentical(piece: Piece, rules: Rules): number {
  return rules.maxIdenticalByCategory[piece.categoria] ?? rules.maxIdenticalDefault;
}

export function getMaxIdenticalBySigla(sigla: string, pieces: Piece[], rules: Rules): number {
  const piece = pieces.find((p) => p.sigla === sigla);
  return piece ? getMaxIdentical(piece, rules) : rules.maxIdenticalDefault;
}

export function countByCategory(team: Map<string, number>, pieces: Piece[], categoria: string): number {
  let total = 0;
  team.forEach((count, sigla) => {
    const piece = pieces.find((p) => p.sigla === sigla);
    if (piece?.categoria === categoria) total += count;
  });
  return total;
}

export function computeBudgetSpent(team: Map<string, number>, pieces: Piece[]): number {
  let spent = 0;
  team.forEach((count, sigla) => {
    const piece = pieces.find((p) => p.sigla === sigla);
    if (piece) spent += piece.punti * count;
  });
  return spent;
}

export function computeTotalPieces(team: Map<string, number>): number {
  let total = 0;
  team.forEach((count) => { total += count; });
  return total;
}

export function computeValidation(team: Map<string, number>, pieces: Piece[], rules: Rules): ValidationResult {
  const budgetSpent = computeBudgetSpent(team, pieces);
  const budgetRemaining = rules.budget - budgetSpent;
  const budgetExact = budgetSpent === rules.budget;

  const budgetMsg = budgetExact
    ? `Budget esatto: ${budgetSpent}/${rules.budget}`
    : budgetSpent > rules.budget
      ? `Budget superato: ${budgetSpent}/${rules.budget} (+${budgetSpent - rules.budget})`
      : `Budget: ${budgetSpent}/${rules.budget} (${budgetRemaining} rimanenti)`;

  const totalPieces = computeTotalPieces(team);
  const totalPiecesOk = totalPieces >= rules.minPiecesTotal && totalPieces <= rules.maxPiecesTotal;
  const totalPiecesMsg = totalPiecesOk
    ? `Pezzi totali: ${totalPieces} (${rules.minPiecesTotal}–${rules.maxPiecesTotal})`
    : totalPieces < rules.minPiecesTotal
      ? `Pezzi insufficienti: ${totalPieces}/${rules.minPiecesTotal} min`
      : `Pezzi in eccesso: ${totalPieces}/${rules.maxPiecesTotal} max`;

  let maxIdenticalViolated = false;
  team.forEach((count, sigla) => {
    if (count > getMaxIdenticalBySigla(sigla, pieces, rules)) maxIdenticalViolated = true;
  });
  const maxFiveOk = !maxIdenticalViolated;
  const maxFiveMsg = maxFiveOk
    ? 'Nessun pezzo supera il proprio limite'
    : 'Alcuni pezzi superano il proprio limite';

  const totalPawns = countByCategory(team, pieces, 'pedone');
  const maxPawns = rules.maxCountByCategory.pedone ?? rules.maxIdenticalDefault;
  const maxPawnsOk = totalPawns <= maxPawns;
  const pawnsMsg = maxPawnsOk
    ? `Pedoni: ${totalPawns}/${maxPawns} max`
    : `Pedoni in eccesso: ${totalPawns}/${maxPawns}`;

  const kingCount = team.get(rules.kingSigla) ?? 0;
  const hasKingOk = kingCount === 1;
  const kingMsg = hasKingOk ? 'Re presente (1 richiesto)' : 'Re mancante (obbligatorio 1)';

  const kingCountOk = kingCount === 1;
  const kingCountMsg = kingCountOk
    ? 'Esattamente 1 Re'
    : kingCount === 0
      ? 'Nessun Re presente'
      : `Troppi Re: ${kingCount} (1 obbligatorio)`;

  const overall = budgetExact && totalPiecesOk && maxFiveOk && maxPawnsOk && hasKingOk && kingCountOk;

  return {
    budget: { valid: budgetSpent <= rules.budget && budgetExact, message: budgetMsg, level: budgetSpent > rules.budget ? 'error' : budgetExact ? 'success' : 'warning' },
    totalPieces: { valid: totalPiecesOk, message: totalPiecesMsg, level: totalPiecesOk ? 'success' : 'error' },
    maxFive: { valid: maxFiveOk, message: maxFiveMsg, level: maxFiveOk ? 'success' : 'error' },
    maxPawns: { valid: maxPawnsOk, message: pawnsMsg, level: maxPawnsOk ? 'success' : 'error' },
    hasKing: { valid: hasKingOk, message: kingMsg, level: hasKingOk ? 'success' : 'error' },
    kingCount: { valid: kingCountOk, message: kingCountMsg, level: kingCountOk ? 'success' : 'error' },
    overall,
  };
}
