import type { Move, Piece } from '../types';
import { computePieceRangeSquares } from '../game/pieceInfo';
import type { Coord } from '../game/board';

/**
 * Representative squares sampled to approximate a piece's average mobility: one central, one
 * near-edge, one edge-mid, one corner-adjacent (avoiding the degenerate corner itself, which
 * under-counts diagonal movers disproportionately). Pure function of the piece's `moves` data —
 * no board or occupancy involved, same spirit as pieceInfo.ts's encyclopedia computation.
 */
const SAMPLE_SQUARES: Coord[] = ['d4', 'b2', 'a4', 'b1'];

/** Entries that ignore intervening pieces (leaps/jumps) are worth more than a slide/step entry
 *  reaching the same squares, since nothing can ever block them. */
const BLOCKING_IGNORED_MULTIPLIER = 1.5;

function entryIgnoresBlocking(entry: Move): boolean {
  return Boolean(entry.jump) || entry.leapPattern !== undefined;
}

/** Mobility contributed by a single Move entry, averaged across the sample squares, isolated by
 *  computing range squares for a synthetic one-entry piece so entries don't interfere with each
 *  other's `visit` calls (e.g. two entries landing on the same square only count once per-entry). */
function entryMobility(piece: Piece, entry: Move): number {
  const isolated: Piece = { ...piece, moves: [entry] };
  const totals = SAMPLE_SQUARES.map((sq) => {
    const { moveSquares, captureSquares } = computePieceRangeSquares(isolated, 'A', sq);
    return new Set([...moveSquares, ...captureSquares]).size;
  });
  return totals.reduce((a, b) => a + b, 0) / totals.length;
}

function weightedMobilityOf(piece: Piece): number {
  return piece.moves.reduce((sum, entry) => {
    const mobility = entryMobility(piece, entry);
    return sum + mobility * (entryIgnoresBlocking(entry) ? BLOCKING_IGNORED_MULTIPLIER : 1);
  }, 0);
}

/**
 * Calibrated once (see team-composer/README or the plan this shipped with) by least-squares
 * fitting `punti = BASE_OFFSET + MOBILITY_COEFFICIENT * weightedMobility` against the roster's
 * "pure mobility, no special mechanics" pieces (Corriere, Ricognitore, Alfiere, Cavallo, Torre,
 * Spettro, Pedone di Dama, Cavalletta, Regina) — the King is deliberately excluded even though
 * it's highly mobile, since its punti is fixed at 0 by design (it can't be removed from a team
 * and losing it ends the game, not a mobility-priced quantity).
 */
const MOBILITY_COEFFICIENT = 1.4;
const BASE_OFFSET = 2;

/**
 * Flat bonus for compound multi-entry pieces (King+X style: Paladino, Damone, and now Generale/
 * Tigre/Rinoceronte) — calibrated by minimizing squared error against Paladino (real punti 36)
 * and Damone (real punti 25), the two multi-entry pieces already in the roster with no other
 * special mechanics.
 */
const COMPOUND_BONUS = 15;

/**
 * Additive adjustment per `alternativeActions[i].type`, calibrated as the average
 * (actualPunti - mobilityOnlyEstimate) across roster pieces carrying that action type. None of
 * the 6 new pieces (Duca/Elefante/Generale/Tigre/Rinoceronte/Coniglio) use alternativeActions, so
 * this table contributes 0 for all of them today — kept generic for future custom pieces.
 */
const SPECIAL_MECHANIC_BONUS: Record<string, number> = {
  furia_bellica: 15,
  rianimazione_pedone: 22,
  silenzio_aura: 20,
  armatura: 20,
  scambio_posizione: 20,
  scocca: 22,
  egida: 0, // already absorbed into COMPOUND_BONUS via Paladino's calibration
  danno_ad_area: 32,
  copia_poteri: 18,
};

/** Armatura (Golem) is a boolean flag with no corresponding `alternativeActions` entry — every
 *  other special mechanic in the roster mirrors itself into `alternativeActions`, this one doesn't. */
const ARMATURA_BONUS = 20;

function specialMechanicBonus(piece: Piece): number {
  const fromActions = piece.alternativeActions.reduce((sum, action) => sum + (SPECIAL_MECHANIC_BONUS[action.type] ?? 0), 0);
  const fromArmatura = piece.armatura ? ARMATURA_BONUS : 0;
  return fromActions + fromArmatura;
}

export interface PuntiEstimate {
  suggestedPunti: number;
  breakdown: {
    weightedMobility: number;
    mobilityContribution: number;
    compoundBonus: number;
    specialMechanicBonus: number;
  };
}

/**
 * Suggests a `punti` (point-cost) value for a piece, as a starting point for manual review — never
 * writes to pieces.json. Calibrated against the current roster's hand-balanced values; treat the
 * result as a rough anchor; see the estimatePunti.test.ts calibration-sanity suite for the
 * expected error band.
 */
export function estimatePunti(piece: Piece): PuntiEstimate {
  const weightedMobility = weightedMobilityOf(piece);
  const mobilityContribution = BASE_OFFSET + MOBILITY_COEFFICIENT * weightedMobility;
  const compoundBonus = piece.moves.length > 1 ? COMPOUND_BONUS : 0;
  const mechanicBonus = specialMechanicBonus(piece);

  return {
    suggestedPunti: Math.max(0, Math.round(mobilityContribution + compoundBonus + mechanicBonus)),
    breakdown: {
      weightedMobility,
      mobilityContribution,
      compoundBonus,
      specialMechanicBonus: mechanicBonus,
    },
  };
}
