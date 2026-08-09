import { pieces, pickablePieces, rules, KING_SIGLA } from './pieces';
import { canAddPieceType, computeBudgetSpent, computeTotalPieces, computeValidation } from './validators';
import type { Piece, Rules } from '../types';

export type PresetTeamId = 'bilanciato' | 'aggressivo' | 'difensivo';

interface PresetTeamDef {
  id: PresetTeamId;
  label: string;
  description: string;
  composition: Array<[string, number]>;
}

// Compositions are hand-picked within the *default* 8×8 budget/rules and no special-types limit;
// whether a given preset is still valid for the current match's (possibly scaled/limited) rules
// must be checked at use-time with isPresetValid, not assumed.
const PRESET_DEFS: PresetTeamDef[] = [
  {
    id: 'bilanciato',
    label: 'Bilanciato',
    description: 'Un esercito classico: pedoni, alfieri, cavalli, torri e la regina.',
    composition: [[KING_SIGLA, 1], ['PE', 8], ['AL', 2], ['CA', 2], ['TO', 2], ['RA', 1]],
  },
  {
    id: 'aggressivo',
    label: 'Aggressivo',
    description: 'Pochi pedoni, molti pezzi ad alto impatto per colpire in fretta.',
    composition: [[KING_SIGLA, 1], ['PE', 5], ['BE', 2], ['CO', 1], ['AR', 1]],
  },
  {
    id: 'difensivo',
    label: 'Difensivo',
    description: 'Muro di pedoni con Golem, Paladino e Inquisitore a protezione.',
    composition: [[KING_SIGLA, 1], ['PE', 8], ['GL', 1], ['PA', 1], ['IQ', 1], ['TO', 1], ['CR', 1]],
  },
];

export function getPresetTeams(): PresetTeamDef[] {
  return PRESET_DEFS;
}

export function buildPresetTeam(id: PresetTeamId): Map<string, number> {
  const def = PRESET_DEFS.find((p) => p.id === id);
  if (!def) throw new Error(`Unknown preset team: ${id}`);
  return new Map(def.composition);
}

/**
 * Whether a fixed preset is still legal under the *current* match's rules — which may have a
 * scaled budget/piece-cap (custom board size) and/or a distinct-special-types limit the preset's
 * static composition was never designed against.
 */
export function isPresetValid(
  id: PresetTeamId,
  effectiveRules: Rules = rules,
  maxDistinctSpecialTypes: number | null = null,
): boolean {
  const team = buildPresetTeam(id);
  return computeValidation(team, pieces, effectiveRules, maxDistinctSpecialTypes).overall;
}

/**
 * Fills a team with random valid picks (respecting budget, max-identical, pawn cap, total piece
 * cap, and — when set — the distinct-special-types limit) until nothing more fits — a random
 * counterpart to autoFillTeam's greedy optimizer.
 */
export function randomFillTeam(
  effectiveRules: Rules = rules,
  maxDistinctSpecialTypes: number | null = null,
): Map<string, number> {
  const team = new Map<string, number>([[KING_SIGLA, 1]]);

  let guard = 0;
  while (guard++ < 500) {
    const spent = computeBudgetSpent(team, pieces);
    const total = computeTotalPieces(team);
    if (total >= effectiveRules.maxPiecesTotal) break;
    const budgetLeft = effectiveRules.budget - spent;
    if (budgetLeft <= 0) break;

    const candidates = pickablePieces.filter(
      (p: Piece) => p.punti <= budgetLeft && canAddPieceType(team, p, pieces, effectiveRules, maxDistinctSpecialTypes),
    );

    if (candidates.length === 0) break;

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    team.set(pick.sigla, (team.get(pick.sigla) ?? 0) + 1);
  }

  return team;
}
