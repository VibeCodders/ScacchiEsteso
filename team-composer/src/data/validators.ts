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

/** Number of *distinct* non-classic ("speciale") siglas in the team — copies of the same sigla count once. */
export function computeDistinctSpecialTypes(team: Map<string, number>, pieces: Piece[]): number {
  let distinct = 0;
  team.forEach((count, sigla) => {
    if (count <= 0) return;
    const piece = pieces.find((p) => p.sigla === sigla);
    if (piece && !piece.classico) distinct += 1;
  });
  return distinct;
}

export function computeValidation(
  team: Map<string, number>,
  pieces: Piece[],
  rules: Rules,
  maxDistinctSpecialTypes: number | null = null,
): ValidationResult {
  const budgetSpent = computeBudgetSpent(team, pieces);
  const budgetRemaining = rules.budget - budgetSpent;
  const budgetOk = budgetSpent <= rules.budget;

  const budgetMsg = budgetSpent > rules.budget
    ? `Budget superato: ${budgetSpent}/${rules.budget} (+${budgetSpent - rules.budget})`
    : `Budget: ${budgetSpent}/${rules.budget} (${budgetRemaining} rimanenti)`;

  const totalPieces = computeTotalPieces(team);
  const totalPiecesOk = totalPieces <= rules.maxPiecesTotal;
  const totalPiecesMsg = totalPiecesOk
    ? `Pezzi totali: ${totalPieces} (max ${rules.maxPiecesTotal})`
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

  const distinctSpecialTypes = computeDistinctSpecialTypes(team, pieces);
  const specialTypesLimitOk = maxDistinctSpecialTypes == null || distinctSpecialTypes <= maxDistinctSpecialTypes;
  const specialTypesLimitMsg = maxDistinctSpecialTypes == null
    ? 'Nessun limite di tipi speciali'
    : specialTypesLimitOk
      ? `Tipi speciali distinti: ${distinctSpecialTypes}/${maxDistinctSpecialTypes} max`
      : `Troppi tipi speciali distinti: ${distinctSpecialTypes}/${maxDistinctSpecialTypes} max`;

  const overall = budgetOk && totalPiecesOk && maxFiveOk && maxPawnsOk && hasKingOk && kingCountOk && specialTypesLimitOk;

  return {
    budget: { valid: budgetOk, message: budgetMsg, level: budgetOk ? 'success' : 'error' },
    totalPieces: { valid: totalPiecesOk, message: totalPiecesMsg, level: totalPiecesOk ? 'success' : 'error' },
    maxFive: { valid: maxFiveOk, message: maxFiveMsg, level: maxFiveOk ? 'success' : 'error' },
    maxPawns: { valid: maxPawnsOk, message: pawnsMsg, level: maxPawnsOk ? 'success' : 'error' },
    hasKing: { valid: hasKingOk, message: kingMsg, level: hasKingOk ? 'success' : 'error' },
    kingCount: { valid: kingCountOk, message: kingCountMsg, level: kingCountOk ? 'success' : 'error' },
    specialTypesLimit: { valid: specialTypesLimitOk, message: specialTypesLimitMsg, level: specialTypesLimitOk ? 'success' : 'error' },
    overall,
  };
}
