import type { Piece, Rules, ValidationResult } from '../types';

/**
 * How many copies of `piece` a single team may field. A piece-level `maxIdentical` (e.g. the
 * Miraggio's 1 — its clone brings the on-board count to 2, so two of them would be too many)
 * overrides the rules' default and per-category caps.
 */
export function getMaxIdentical(piece: Piece, rules: Rules): number {
  return piece.maxIdentical ?? rules.maxIdenticalByCategory[piece.categoria] ?? rules.maxIdenticalDefault;
}

/**
 * New placement rule (in addition to the existing limits — it never relaxes them). The max number
 * of copies of a piece type is `x = round((d / punti)²)`, where `d` is the punti of the most
 * expensive piece in the roster (dynamic: recomputed from the piece list passed in, so it follows
 * any punti rebalance or a new stronger piece — today `d` is the Paladino at 51).
 *
 * Derived from the user's legend: c = punti / d, b = 1/c, a = b², x = round(a). For pieces costing
 * `d/2` or less the formula yields 4 or more, so the classic "max 5 identical" rule still binds
 * for everything cheap enough; it only tightens the cap on the most expensive pieces (the most
 * expensive one is limited to 1 copy).
 */
export function getFormulaMaxIdentical(piece: Piece, pieces: Piece[]): number {
  const mostExpensive = Math.max(...pieces.map((p) => p.punti));
  if (piece.punti <= 0) return Number.POSITIVE_INFINITY;
  const c = piece.punti / mostExpensive; // c = punteggio pezzo / d
  const b = 1 / c;                        // b = 1/c
  const a = b * b;                        // a = b²
  return Math.round(a);                   // x = round(a)
}

/** Effective per-type cap: the formula-based cap and the existing rules both apply, so the binding
 *  one is whichever is stricter. Never relaxes an existing limit (e.g. Miraggio's `maxIdentical: 1`
 *  stays 1 even though the formula alone would allow more). */
export function getEffectiveMaxIdentical(piece: Piece, pieces: Piece[], rules: Rules): number {
  return Math.min(getMaxIdentical(piece, rules), getFormulaMaxIdentical(piece, pieces));
}

export function getMaxIdenticalBySigla(sigla: string, pieces: Piece[], rules: Rules): number {
  const piece = pieces.find((p) => p.sigla === sigla);
  return piece ? getEffectiveMaxIdentical(piece, pieces, rules) : rules.maxIdenticalDefault;
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

/**
 * True if adding one more `piece` to `team` would introduce a *new* distinct special type beyond
 * the configured limit — i.e. `piece` is non-classic, not already present in `team`, and every
 * "slot" up to `maxDistinctSpecialTypes` is already taken. Always false when `piece` is classic,
 * already present (adding a copy doesn't consume a new slot), or no limit is set.
 */
export function wouldExceedSpecialTypesLimit(
  team: Map<string, number>,
  piece: Piece,
  pieces: Piece[],
  maxDistinctSpecialTypes: number | null,
): boolean {
  if (maxDistinctSpecialTypes == null) return false;
  if (piece.classico) return false;
  if ((team.get(piece.sigla) ?? 0) > 0) return false; // already present — a copy doesn't need a new slot
  return computeDistinctSpecialTypes(team, pieces) >= maxDistinctSpecialTypes;
}

/**
 * Single source of truth for "is adding one more copy of `piece` to `team` structurally legal" —
 * every automatic team-building tool (Completa/Migliora, the PC's random fill) should filter
 * candidates through this instead of re-implementing the same checks. Does *not* check budget,
 * since remaining budget is caller-specific context this function doesn't have.
 */
export function canAddPieceType(
  team: Map<string, number>,
  piece: Piece,
  pieces: Piece[],
  rules: Rules,
  maxDistinctSpecialTypes: number | null = null,
): boolean {
  if (piece.sigla === rules.kingSigla) return false;
  const currentCount = team.get(piece.sigla) ?? 0;
  if (currentCount >= getEffectiveMaxIdentical(piece, pieces, rules)) return false;
  if (piece.categoria === 'pedone') {
    const maxPawns = rules.maxCountByCategory.pedone ?? rules.maxIdenticalDefault;
    if (countByCategory(team, pieces, 'pedone') + 1 > maxPawns) return false;
  }
  if (wouldExceedSpecialTypesLimit(team, piece, pieces, maxDistinctSpecialTypes)) return false;
  return true;
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
    ? 'Nessun pezzo supera il proprio limite (max per tipo, incl. la regola dinamica)'
    : 'Alcuni pezzi superano il proprio limite (max per tipo, incl. la regola dinamica)';

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
