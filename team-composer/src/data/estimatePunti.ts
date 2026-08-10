import type { Move, Piece } from '../types';
import { computePieceRangeSquares } from '../game/pieceInfo';
import { pieces as ROSTER } from './pieces';
import type { Coord } from '../game/board';

/**
 * Representative squares sampled to approximate a piece's average mobility: 8 squares balanced
 * across board region (center/edge/near-corner) AND square color (4 light + 4 dark), so
 * color-restricted entries (e.g. Camaleonte) aren't biased by which squares happen to be sampled.
 * Pure function of the piece's `moves` data — no board or occupancy involved, same spirit as
 * pieceInfo.ts's encyclopedia computation.
 */
const SAMPLE_SQUARES: Coord[] = ['d4', 'e5', 'b2', 'g7', 'a4', 'h5', 'b7', 'g2'];

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

interface Stage1Features {
  stepSlideMobility: number;
  leapMobility: number;
  isPawnCategory: number;
  extraEntries: number;
  resistance: number;
  immunityCount: number;
  rangedCapture: number;
  meleeOnlyCapture: number;
  extraActionFlags: number;
}

/** Count of minor "advantageous" boolean flags not already represented by `alternativeActions` —
 *  aggregated into one feature instead of four separate columns so the parameter count stays sane
 *  against the ~20-piece stage-1 training set (see `stage1TrainingSet`). */
function extraActionFlagsOf(piece: Piece): number {
  return [piece.secondoMovimentoPostCattura, piece.silenzioAttacchiADistanza, piece.saltaInterposizioni, piece.egida]
    .filter(Boolean).length;
}

/** Purely structural features used for the mobility-only ("stage 1") regression — no notion of
 *  special mechanics here, those are handled separately in stage 2 (see `specialMechanicBonus`).
 *  Includes durability/utility properties (`resistance`, `immunityTypes`, ranged/melee-only capture,
 *  minor action flags) that were previously ignored entirely by the estimator despite being real
 *  drivers of a piece's in-game power. */
function stage1FeaturesOf(piece: Piece): Stage1Features {
  let stepSlideMobility = 0;
  let leapMobility = 0;
  for (const entry of piece.moves) {
    const mobility = entryMobility(piece, entry);
    if (entryIgnoresBlocking(entry)) leapMobility += mobility;
    else stepSlideMobility += mobility;
  }
  return {
    stepSlideMobility,
    leapMobility,
    isPawnCategory: piece.categoria === 'pedone' ? 1 : 0,
    extraEntries: Math.max(0, piece.moves.length - 1),
    resistance: piece.resistance,
    immunityCount: piece.immunityTypes.length,
    rangedCapture: piece.catturaADistanza ? 1 : 0,
    meleeOnlyCapture: piece.catturaSoloInMischia ? 1 : 0,
    extraActionFlags: extraActionFlagsOf(piece),
  };
}

function stage1FeatureVector(f: Stage1Features): number[] {
  return [
    1,
    f.stepSlideMobility,
    f.leapMobility,
    f.isPawnCategory,
    f.extraEntries,
    f.resistance,
    f.immunityCount,
    f.rangedCapture,
    f.meleeOnlyCapture,
    f.extraActionFlags,
  ];
}

/**
 * Solves `X·β ≈ y` in the least-squares sense via the normal equations `(XᵀX)β = Xᵀy`, solved by
 * Gaussian elimination with partial pivoting. `X` is n×k (first column is normally the intercept,
 * a column of 1s); `y` is length n. No external dependency — the matrices here are tiny (k ≤ 10).
 */
function solveLeastSquares(X: number[][], y: number[]): number[] {
  const k = X[0].length;
  const XtX: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
  const Xty: number[] = new Array(k).fill(0);

  for (let row = 0; row < X.length; row++) {
    for (let i = 0; i < k; i++) {
      Xty[i] += X[row][i] * y[row];
      for (let j = 0; j < k; j++) {
        XtX[i][j] += X[row][i] * X[row][j];
      }
    }
  }

  // Gaussian elimination with partial pivoting on the augmented [XtX | Xty] system.
  const augmented = XtX.map((r, i) => [...r, Xty[i]]);
  for (let col = 0; col < k; col++) {
    let pivotRow = col;
    for (let row = col + 1; row < k; row++) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[pivotRow][col])) pivotRow = row;
    }
    [augmented[col], augmented[pivotRow]] = [augmented[pivotRow], augmented[col]];

    const pivot = augmented[col][col];
    if (Math.abs(pivot) < 1e-10) continue; // degenerate feature (e.g. all-zero column) — leave its coefficient at 0

    for (let row = 0; row < k; row++) {
      if (row === col) continue;
      const factor = augmented[row][col] / pivot;
      for (let c = col; c <= k; c++) augmented[row][c] -= factor * augmented[col][c];
    }
  }

  return augmented.map((row, i) => (Math.abs(row[i]) < 1e-10 ? 0 : row[k] / row[i]));
}

/** Pieces with no special mechanic (no `alternativeActions`, no `armatura`) and not the King —
 *  even though the King now carries a nominal punti value (used only to size the team budget; it
 *  can't actually be traded for other pieces or left out of a team, so it isn't a mobility-priced
 *  quantity in the same sense as everything else) — the "pure movement" training set for the
 *  stage-1 fit. */
function stage1TrainingSet(): Piece[] {
  return ROSTER.filter((p) => p.sigla !== 'RE' && p.alternativeActions.length === 0 && !p.armatura);
}

/**
 * Stage-1 regression coefficients — one per `stage1FeatureVector` column (intercept,
 * stepSlideMobility, leapMobility, isPawnCategory, extraEntries, resistance, immunityCount,
 * rangedCapture, meleeOnlyCapture, extraActionFlags) — fit via `solveLeastSquares` against every
 * "pure movement" roster piece (~20 pieces for 10 parameters — still a healthier ratio than a
 * single global slope, though tighter than before now that durability/utility features were added).
 * Computed once at module load from the live roster (cheap: a ~20×10 matrix) rather than hardcoded
 * from a one-off script run, so it can never silently go stale the way a hand-copied constant could
 * — this is the same lesson the roster-reading `--roster` CLI mode already applies.
 */
function fitStage1Coefficients(): number[] {
  const trainingSet = stage1TrainingSet();
  const X = trainingSet.map((p) => stage1FeatureVector(stage1FeaturesOf(p)));
  const y = trainingSet.map((p) => p.punti);
  return solveLeastSquares(X, y);
}

let stage1CoefficientsCache: number[] | null = null;
function stage1Coefficients(): number[] {
  if (!stage1CoefficientsCache) stage1CoefficientsCache = fitStage1Coefficients();
  return stage1CoefficientsCache;
}

function dotProduct(a: number[], b: number[]): number {
  return a.reduce((sum, value, i) => sum + value * b[i], 0);
}

function stage1Estimate(piece: Piece): number {
  return dotProduct(stage1Coefficients(), stage1FeatureVector(stage1FeaturesOf(piece)));
}

/**
 * Additive adjustment per `alternativeActions[i].type`, computed as the average
 * (actualPunti - stage1Estimate) across roster pieces carrying that action type, using the
 * improved stage-1 formula above as the baseline being corrected. IMPORTANT LIMITATION, stated
 * plainly rather than glossed over: every mechanic in the current roster has exactly ONE example
 * piece (e.g. only Colosso has `danno_ad_area`, only Necromante has `rianimazione_pedone`) — with a
 * single data point per mechanic, no amount of algorithmic sophistication can statistically
 * improve this beyond "the one observed correction"; it is not, and cannot yet be, a fitted
 * regression term the way the stage-1 mobility coefficients are. It will only become a genuine fit
 * once the roster has multiple pieces sharing the same mechanic.
 */
interface MechanicBonusEntry {
  value: number;
  sampleCount: number;
}

function computeMechanicBonusTable(): Record<string, MechanicBonusEntry> {
  const bonuses: Record<string, number[]> = {};
  for (const piece of ROSTER) {
    if (piece.sigla === 'RE') continue;
    const baseline = stage1Estimate(piece);
    for (const action of piece.alternativeActions) {
      (bonuses[action.type] ??= []).push(piece.punti - baseline);
    }
    if (piece.armatura) {
      (bonuses.armatura ??= []).push(piece.punti - baseline);
    }
  }
  const table: Record<string, MechanicBonusEntry> = {};
  for (const [type, samples] of Object.entries(bonuses)) {
    table[type] = { value: samples.reduce((a, b) => a + b, 0) / samples.length, sampleCount: samples.length };
  }
  return table;
}

let mechanicBonusTableCache: Record<string, MechanicBonusEntry> | null = null;
function mechanicBonusTable(): Record<string, MechanicBonusEntry> {
  if (!mechanicBonusTableCache) mechanicBonusTableCache = computeMechanicBonusTable();
  return mechanicBonusTableCache;
}

/** Confidence tier for a mechanic bonus based on how many roster pieces it was averaged over — a
 *  bonus derived from a single example is not a statistical fit, just the one observed correction
 *  (see the limitation documented on `computeMechanicBonusTable`), so it's surfaced distinctly from
 *  one backed by several pieces. */
function confidenceForSampleCount(sampleCount: number): 'low' | 'medium' | 'high' {
  if (sampleCount <= 1) return 'low';
  if (sampleCount === 2) return 'medium';
  return 'high';
}

function piecesMechanicTypes(piece: Piece): string[] {
  const types = piece.alternativeActions.map((a) => a.type);
  return piece.armatura ? [...types, 'armatura'] : types;
}

function specialMechanicBonus(piece: Piece): number {
  const table = mechanicBonusTable();
  return piecesMechanicTypes(piece).reduce((sum, type) => sum + (table[type]?.value ?? 0), 0);
}

export interface PuntiEstimate {
  suggestedPunti: number;
  breakdown: {
    stepSlideMobility: number;
    leapMobility: number;
    mobilityContribution: number;
    compoundContribution: number;
    specialMechanicBonus: number;
    /** 'low' if any mechanic on this piece has a bonus averaged over a single roster example;
     *  'high' if the piece has no special mechanics at all or all are backed by 3+ examples. */
    mechanicConfidence: 'low' | 'medium' | 'high';
    /** Mechanic type names (e.g. 'armatura', 'danno_ad_area') whose bonus rests on a single example. */
    lowConfidenceMechanics: string[];
  };
}

/**
 * Suggests a `punti` (point-cost) value for a piece, as a starting point for manual review — never
 * writes to pieces.json. Fit via ordinary least squares against the current roster's hand-balanced
 * values (see `fitStage1Coefficients`/`computeMechanicBonusTable`); treat the result as a
 * statistically-grounded anchor, not a precise predictor — see `estimatorFitQuality()` for the
 * model's actual measured error against the roster, and `estimatePunti.test.ts` for the expected
 * tolerance band.
 */
export function estimatePunti(piece: Piece): PuntiEstimate {
  const [, coeffStepSlide, coeffLeap, , coeffExtraEntries] = stage1Coefficients();
  const f = stage1FeaturesOf(piece);
  const mechanicBonus = specialMechanicBonus(piece);
  const table = mechanicBonusTable();
  const mechanicTypes = piecesMechanicTypes(piece);
  const lowConfidenceMechanics = mechanicTypes.filter(
    (type) => confidenceForSampleCount(table[type]?.sampleCount ?? 0) === 'low',
  );
  const confidenceRank = { low: 0, medium: 1, high: 2 } as const;
  const mechanicConfidence = mechanicTypes.reduce<'low' | 'medium' | 'high'>(
    (worst, type) => {
      const tier = confidenceForSampleCount(table[type]?.sampleCount ?? 0);
      return confidenceRank[tier] < confidenceRank[worst] ? tier : worst;
    },
    'high',
  );

  return {
    suggestedPunti: Math.max(0, Math.round(stage1Estimate(piece) + mechanicBonus)),
    breakdown: {
      stepSlideMobility: f.stepSlideMobility,
      leapMobility: f.leapMobility,
      mobilityContribution: coeffStepSlide * f.stepSlideMobility + coeffLeap * f.leapMobility,
      compoundContribution: coeffExtraEntries * f.extraEntries,
      specialMechanicBonus: mechanicBonus,
      mechanicConfidence,
      lowConfidenceMechanics,
    },
  };
}

export interface FitQuality {
  meanAbsoluteError: number;
  meanAbsolutePercentError: number;
  worstFits: { sigla: string; actual: number; suggested: number }[];
}

/**
 * Measures how well `estimatePunti` currently reproduces the real roster's hand-balanced `punti`
 * values (excluding the King, which isn't part of the stage-1 training set — see
 * `stage1TrainingSet` — so comparing its estimate to its assigned value wouldn't say anything
 * about the model's real accuracy). This is what makes the model's real-world accuracy visible
 * and checkable, instead of a comment asserting "loose heuristic" without a number to back it up.
 */
export function estimatorFitQuality(): FitQuality {
  const evaluated = ROSTER.filter((p) => p.sigla !== 'RE').map((p) => {
    const suggested = estimatePunti(p).suggestedPunti;
    return { sigla: p.sigla, actual: p.punti, suggested, absError: Math.abs(suggested - p.punti) };
  });

  const meanAbsoluteError = evaluated.reduce((sum, e) => sum + e.absError, 0) / evaluated.length;
  const percentErrors = evaluated
    .filter((e) => e.actual > 0)
    .map((e) => e.absError / e.actual);
  const meanAbsolutePercentError = percentErrors.reduce((a, b) => a + b, 0) / percentErrors.length;

  const worstFits = [...evaluated]
    .sort((a, b) => b.absError - a.absError)
    .slice(0, 5)
    .map(({ sigla, actual, suggested }) => ({ sigla, actual, suggested }));

  return { meanAbsoluteError, meanAbsolutePercentError, worstFits };
}
