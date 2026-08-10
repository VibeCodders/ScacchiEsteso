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

interface EntryMobility {
  moveCount: number;
  captureCount: number;
}

/** Move vs. capture mobility contributed by a single Move entry, averaged across the sample
 *  squares, isolated by computing range squares for a synthetic one-entry piece so entries don't
 *  interfere with each other's `visit` calls. Kept as two separate counts (rather than the union
 *  size) because "can move there" and "can capture there" are worth different amounts in play —
 *  a piece that can only ever capture in melee is not as flexible as one with the same square
 *  count reachable purely as non-capturing moves. */
function entryMobility(piece: Piece, entry: Move): EntryMobility {
  const isolated: Piece = { ...piece, moves: [entry] };
  const samples = SAMPLE_SQUARES.map((sq) => computePieceRangeSquares(isolated, 'A', sq));
  const moveCount = samples.reduce((sum, s) => sum + s.moveSquares.length, 0) / samples.length;
  const captureCount = samples.reduce((sum, s) => sum + s.captureSquares.length, 0) / samples.length;
  return { moveCount, captureCount };
}

interface Stage1Features {
  stepSlideMoveMobility: number;
  stepSlideCaptureMobility: number;
  leapMoveMobility: number;
  leapCaptureMobility: number;
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
 *  against the small stage-1 training set (see `stage1TrainingSet`). */
function extraActionFlagsOf(piece: Piece): number {
  return [piece.secondoMovimentoPostCattura, piece.silenzioAttacchiADistanza, piece.saltaInterposizioni, piece.egida]
    .filter(Boolean).length;
}

/** Purely structural features used for the mobility-only ("stage 1") regression — no notion of
 *  special mechanics here, those are handled separately in stage 2 (see `specialMechanicBonus`).
 *  Mobility counts are passed through `sqrt` before being used as model inputs (see
 *  `stage1FeatureVector`) to approximate diminishing returns — going from 8 to 16 reachable
 *  squares is not worth the same as going from 16 to 24, the same intuition behind why a rook and
 *  a queen aren't simply "2x the squares = 2x the value" in real chess valuation. */
function stage1FeaturesOf(piece: Piece): Stage1Features {
  let stepSlideMoveMobility = 0;
  let stepSlideCaptureMobility = 0;
  let leapMoveMobility = 0;
  let leapCaptureMobility = 0;
  for (const entry of piece.moves) {
    const { moveCount, captureCount } = entryMobility(piece, entry);
    if (entryIgnoresBlocking(entry)) {
      leapMoveMobility += moveCount;
      leapCaptureMobility += captureCount;
    } else {
      stepSlideMoveMobility += moveCount;
      stepSlideCaptureMobility += captureCount;
    }
  }
  return {
    stepSlideMoveMobility,
    stepSlideCaptureMobility,
    leapMoveMobility,
    leapCaptureMobility,
    isPawnCategory: piece.categoria === 'pedone' ? 1 : 0,
    extraEntries: Math.max(0, piece.moves.length - 1),
    resistance: piece.resistance,
    immunityCount: piece.immunityTypes.length,
    rangedCapture: piece.catturaADistanza ? 1 : 0,
    meleeOnlyCapture: piece.catturaSoloInMischia ? 1 : 0,
    extraActionFlags: extraActionFlagsOf(piece),
  };
}

/** `sqrt` applied only to the raw mobility counts (diminishing returns) — the remaining features
 *  are already small integers/booleans where a linear relationship is the right assumption. */
function stage1FeatureVector(f: Stage1Features): number[] {
  return [
    1,
    Math.sqrt(f.stepSlideMoveMobility),
    Math.sqrt(f.stepSlideCaptureMobility),
    Math.sqrt(f.leapMoveMobility),
    Math.sqrt(f.leapCaptureMobility),
    f.isPawnCategory,
    f.extraEntries,
    f.resistance,
    f.immunityCount,
    f.rangedCapture,
    f.meleeOnlyCapture,
    f.extraActionFlags,
  ];
}

const STAGE1_FEATURE_NAMES = [
  'Intercetta',
  'Mobilità di movimento (scorrimento)',
  'Mobilità di cattura (scorrimento)',
  'Mobilità di movimento (salto)',
  'Mobilità di cattura (salto)',
  'Categoria pedone',
  'Voci di mossa extra (pezzi composti)',
  'Resistenza',
  'Numero di immunità',
  'Cattura a distanza',
  'Cattura solo in mischia',
  'Flag azione minori',
] as const;

/**
 * Solves `X·β ≈ y` in the ridge-regularized least-squares sense via the normal equations
 * `(XᵀX + λI)β = Xᵀy`, solved by Gaussian elimination with partial pivoting. `X` is n×k (first
 * column is normally the intercept, a column of 1s); `y` is length n. `lambda` defaults to 0
 * (ordinary least squares) — the intercept column (index 0) is never regularized, since shrinking
 * the intercept toward 0 would bias every prediction, not just stabilize the slopes. No external
 * dependency — the matrices here are tiny (k ≤ 12).
 */
function solveLeastSquares(X: number[][], y: number[], lambda = 0): number[] {
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
  for (let i = 1; i < k; i++) XtX[i][i] += lambda;

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

/** Candidate ridge penalties tried during leave-one-out selection — 0 keeps the old OLS behavior
 *  as a baseline; the rest trade a little in-sample fit for coefficients that don't swing wildly
 *  from one training set to the next (relevant here since stage 1 fits 12 parameters against
 *  ~24 examples — a thin ratio where unregularized OLS coefficients are known to be unstable). */
const RIDGE_LAMBDA_CANDIDATES = [0, 0.5, 1, 2, 4, 8];

/** Mean absolute leave-one-out error for a given ridge penalty: refit on every (n-1)-piece subset
 *  and score the held-out piece, which is what actually predicts how the model behaves on a piece
 *  it wasn't tuned against — unlike in-sample error, which the ridge penalty could otherwise be
 *  picked to minimize trivially by overfitting. */
function looMeanAbsoluteError(X: number[][], y: number[], lambda: number): number {
  let totalAbsError = 0;
  for (let holdout = 0; holdout < X.length; holdout++) {
    const trainX = X.filter((_, i) => i !== holdout);
    const trainY = y.filter((_, i) => i !== holdout);
    const beta = solveLeastSquares(trainX, trainY, lambda);
    const predicted = dotProduct(beta, X[holdout]);
    totalAbsError += Math.abs(predicted - y[holdout]);
  }
  return totalAbsError / X.length;
}

interface Stage1Fit {
  coefficients: number[];
  lambda: number;
  looMeanAbsoluteError: number;
}

/**
 * Stage-1 regression: fits `stage1FeatureVector` coefficients against every "pure movement"
 * roster piece via `solveLeastSquares`, choosing the ridge penalty `lambda` that minimizes
 * leave-one-out error rather than fixing it at 0 (plain OLS) or picking it by hand. Computed once
 * at module load from the live roster (cheap: a ~24×12 matrix, and only 6 lambda candidates ×
 * 24 LOO refits) rather than hardcoded from a one-off script run, so it can never silently go
 * stale the way a hand-copied constant could — this is the same lesson the roster-reading CLI
 * script already applies.
 */
function fitStage1(): Stage1Fit {
  const trainingSet = stage1TrainingSet();
  const X = trainingSet.map((p) => stage1FeatureVector(stage1FeaturesOf(p)));
  const y = trainingSet.map((p) => p.punti);

  let bestLambda = RIDGE_LAMBDA_CANDIDATES[0];
  let bestLoo = Infinity;
  for (const lambda of RIDGE_LAMBDA_CANDIDATES) {
    const loo = looMeanAbsoluteError(X, y, lambda);
    if (loo < bestLoo) {
      bestLoo = loo;
      bestLambda = lambda;
    }
  }

  return { coefficients: solveLeastSquares(X, y, bestLambda), lambda: bestLambda, looMeanAbsoluteError: bestLoo };
}

let stage1FitCache: Stage1Fit | null = null;
function stage1Fit(): Stage1Fit {
  if (!stage1FitCache) stage1FitCache = fitStage1();
  return stage1FitCache;
}

function dotProduct(a: number[], b: number[]): number {
  return a.reduce((sum, value, i) => sum + value * b[i], 0);
}

function stage1Estimate(piece: Piece): number {
  return dotProduct(stage1Fit().coefficients, stage1FeatureVector(stage1FeaturesOf(piece)));
}

export interface Stage1ModelSummary {
  features: { name: string; coefficient: number }[];
  lambda: number;
  looMeanAbsoluteError: number;
}

/** Exposes the fitted stage-1 model itself (coefficients, chosen ridge penalty, its cross-validated
 *  error) so the UI can show *why* the estimator says what it says instead of just the final
 *  number — reuses the same cached fit `estimatePunti` uses, no duplicate computation. */
export function stage1ModelSummary(): Stage1ModelSummary {
  const fit = stage1Fit();
  return {
    features: fit.coefficients.map((coefficient, i) => ({ name: STAGE1_FEATURE_NAMES[i], coefficient })),
    lambda: fit.lambda,
    looMeanAbsoluteError: fit.looMeanAbsoluteError,
  };
}

/**
 * Additive adjustment per `alternativeActions[i].type`, computed as the average
 * (actualPunti - stage1Estimate) across roster pieces carrying that action type, using the
 * improved stage-1 formula above as the baseline being corrected, then pulled toward the average
 * bonus across *all* special-mechanic pieces via empirical-Bayes shrinkage (see
 * `shrinkMechanicBonus`). IMPORTANT LIMITATION, stated plainly rather than glossed over: every
 * mechanic in the current roster has exactly ONE example piece (e.g. only Colosso has
 * `danno_ad_area`, only Necromante has `rianimazione_pedone`) — with a single data point per
 * mechanic, the raw per-type average is just "the one observed correction"; shrinkage doesn't
 * manufacture more data, it only tempers how literally that single observation is trusted by
 * blending it with the global tendency of special mechanics to add value at all.
 */
export interface MechanicBonusEntry {
  /** Bonus actually applied by the estimator — the raw per-type average shrunk toward the global
   *  mean special-mechanic bonus, more strongly so the fewer examples back it up. */
  value: number;
  /** The un-shrunk per-type average, kept for transparency (shown in the model panel) — this is
   *  what the estimator used to apply outright before shrinkage was introduced. */
  rawValue: number;
  sampleCount: number;
}

/** Empirical-Bayes shrinkage weight for a mechanic type backed by `sampleCount` roster examples:
 *  approaches 1 (trust the observed average) as `sampleCount` grows, and is 1/(1+k) for a single
 *  example. `k = 2` means a 1-example type keeps 1/3 of its raw value and borrows 2/3 from the
 *  global average — a deliberately generous pull toward the center given that literally every
 *  mechanic type today has exactly one example (see the limitation above); revisit `k` once the
 *  roster grows enough for some types to have multiple examples. */
const MECHANIC_SHRINKAGE_K = 2;

function shrinkMechanicBonus(rawValue: number, sampleCount: number, globalMean: number): number {
  const weight = sampleCount / (sampleCount + MECHANIC_SHRINKAGE_K);
  return weight * rawValue + (1 - weight) * globalMean;
}

function computeMechanicBonusTable(): Record<string, MechanicBonusEntry> {
  const bonuses: Record<string, number[]> = {};
  const allMechanicBonuses: number[] = [];
  for (const piece of ROSTER) {
    if (piece.sigla === 'RE') continue;
    const baseline = stage1Estimate(piece);
    const perPieceBonus = piece.punti - baseline;
    for (const action of piece.alternativeActions) {
      (bonuses[action.type] ??= []).push(perPieceBonus);
      allMechanicBonuses.push(perPieceBonus);
    }
    if (piece.armatura) {
      (bonuses.armatura ??= []).push(perPieceBonus);
      allMechanicBonuses.push(perPieceBonus);
    }
  }

  const globalMean = allMechanicBonuses.length > 0
    ? allMechanicBonuses.reduce((a, b) => a + b, 0) / allMechanicBonuses.length
    : 0;

  const table: Record<string, MechanicBonusEntry> = {};
  for (const [type, samples] of Object.entries(bonuses)) {
    const rawValue = samples.reduce((a, b) => a + b, 0) / samples.length;
    table[type] = { value: shrinkMechanicBonus(rawValue, samples.length, globalMean), rawValue, sampleCount: samples.length };
  }
  return table;
}

let mechanicBonusTableCache: Record<string, MechanicBonusEntry> | null = null;
function mechanicBonusTable(): Record<string, MechanicBonusEntry> {
  if (!mechanicBonusTableCache) mechanicBonusTableCache = computeMechanicBonusTable();
  return mechanicBonusTableCache;
}

/** Exposes the mechanic bonus table for the UI's model transparency panel. */
export function mechanicBonusSummary(): Record<string, MechanicBonusEntry> {
  return mechanicBonusTable();
}

/** Confidence tier for a mechanic bonus based on how many roster pieces it was averaged over — a
 *  bonus derived from a single example is not a statistical fit, just the one observed correction
 *  (see the limitation documented on `computeMechanicBonusTable`), so it's surfaced distinctly from
 *  one backed by several pieces. */
export function confidenceForSampleCount(sampleCount: number): 'low' | 'medium' | 'high' {
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
    stepSlideMoveMobility: number;
    stepSlideCaptureMobility: number;
    leapMoveMobility: number;
    leapCaptureMobility: number;
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
 * writes to pieces.json. Fit via ridge-regularized least squares (penalty chosen by leave-one-out
 * cross-validation, see `fitStage1`) against the current roster's hand-balanced values, with
 * special-mechanic bonuses shrunk toward their global average (see `shrinkMechanicBonus`); treat
 * the result as a statistically-grounded anchor, not a precise predictor — see
 * `estimatorFitQuality()` for the model's actual measured error (both in-sample and
 * cross-validated) against the roster, and `estimatePunti.test.ts` for the expected tolerance band.
 */
export function estimatePunti(piece: Piece): PuntiEstimate {
  const f = stage1FeaturesOf(piece);
  const [, coeffStepSlideMove, coeffStepSlideCapture, coeffLeapMove, coeffLeapCapture, , coeffExtraEntries] = stage1Fit().coefficients;
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

  const mobilityContribution =
    coeffStepSlideMove * Math.sqrt(f.stepSlideMoveMobility) +
    coeffStepSlideCapture * Math.sqrt(f.stepSlideCaptureMobility) +
    coeffLeapMove * Math.sqrt(f.leapMoveMobility) +
    coeffLeapCapture * Math.sqrt(f.leapCaptureMobility);

  return {
    // A piece costing 0 punti would be free to field — every real piece costs at least 1 (in
    // practice the cheapest, Paggio, costs 2), so the floor is 1, not 0.
    suggestedPunti: Math.max(1, Math.round(stage1Estimate(piece) + mechanicBonus)),
    breakdown: {
      stepSlideMoveMobility: f.stepSlideMoveMobility,
      stepSlideCaptureMobility: f.stepSlideCaptureMobility,
      leapMoveMobility: f.leapMoveMobility,
      leapCaptureMobility: f.leapCaptureMobility,
      mobilityContribution,
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
  /** Leave-one-out cross-validated error of the stage-1 mobility fit — the honest measure of how
   *  well the model generalizes to a piece it wasn't tuned against, as opposed to
   *  `meanAbsoluteError` below, which also includes stage-2 mechanic bonuses fit on the very same
   *  pieces they're evaluated against and is therefore optimistic. */
  looMeanAbsoluteError: number;
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

  return { meanAbsoluteError, meanAbsolutePercentError, looMeanAbsoluteError: stage1Fit().looMeanAbsoluteError, worstFits };
}
