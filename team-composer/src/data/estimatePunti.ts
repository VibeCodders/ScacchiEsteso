import type { ActionModalita, Move, Piece } from '../types';
import { computePieceRangeSquares } from '../game/pieceInfo';
import { pieces as ROSTER } from './pieces';
import { allCoords, coordToFileRank, isOffAxis, type Coord } from '../game/board';

/**
 * Every square of the standard board, used to compute a piece's *exact* average mobility rather
 * than approximating it from a handful of sampled squares. Exhaustive rather than sampled because
 * the roster is small (34 pieces) and `computePieceRangeSquares` is cheap, so there's no real cost
 * to dropping the sampling approximation — this also means color-restricted entries (e.g.
 * Camaleonte) are evaluated against the board's true light/dark square distribution instead of
 * whichever colors happened to land in an 8-square sample. Board-size-agnostic in principle
 * (`allCoords` takes `dimensions`), but deliberately fixed to the default 8x8 here — scaling this
 * estimate to non-standard board sizes is out of scope for now.
 */
const ALL_SQUARES: Coord[] = allCoords();

function entryIgnoresBlocking(entry: Move): boolean {
  return Boolean(entry.jump) || entry.leapPattern !== undefined;
}

interface EntryMobility {
  moveCount: number;
  captureCount: number;
  /** Average number of reachable squares sharing no rank, file or diagonal with the origin — the
   *  off-axis signature of the Cavallo's L-leap and the bent slides (Grifone/Manticora), which
   *  `moveCount` alone cannot see (the Manticora's bent slide reaches the same average square
   *  count as a Torre on 8×8). Mirrors the similar-pieces detector's "Mobilità fuori asse" so
   *  "similar" and "estimated price" stay aligned. */
  offAxisMoveCount: number;
  offAxisCaptureCount: number;
}

/** Move vs. capture mobility contributed by a single Move entry, averaged across the sample
 *  squares, isolated by computing range squares for a synthetic one-entry piece so entries don't
 *  interfere with each other's `visit` calls. Kept as two separate counts (rather than the union
 *  size) because "can move there" and "can capture there" are worth different amounts in play —
 *  a piece that can only ever capture in melee is not as flexible as one with the same square
 *  count reachable purely as non-capturing moves. Off-axis move/capture counts are measured the
 *  same way (see `EntryMobility`). */
function entryMobility(piece: Piece, entry: Move): EntryMobility {
  const isolated: Piece = { ...piece, moves: [entry] };
  const samples = ALL_SQUARES.map((sq) => ({ from: sq, range: computePieceRangeSquares(isolated, 'A', sq) }));
  const moveCount = samples.reduce((sum, s) => sum + s.range.moveSquares.length, 0) / samples.length;
  const captureCount = samples.reduce((sum, s) => sum + s.range.captureSquares.length, 0) / samples.length;
  let offAxisMoveCount = 0;
  let offAxisCaptureCount = 0;
  for (const { from, range } of samples) {
    const { file: fromFile, rank: fromRank } = coordToFileRank(from);
    for (const coord of range.moveSquares) {
      if (isOffAxis(coord, fromFile, fromRank)) offAxisMoveCount++;
    }
    for (const coord of range.captureSquares) {
      if (isOffAxis(coord, fromFile, fromRank)) offAxisCaptureCount++;
    }
  }
  return {
    moveCount,
    captureCount,
    offAxisMoveCount: offAxisMoveCount / samples.length,
    offAxisCaptureCount: offAxisCaptureCount / samples.length,
  };
}

interface Stage1Features {
  stepSlideMoveMobility: number;
  stepSlideCaptureMobility: number;
  leapMoveMobility: number;
  leapCaptureMobility: number;
  offAxisMoveMobility: number;
  offAxisCaptureMobility: number;
  isPawnCategory: number;
  extraEntries: number;
  resistance: number;
  immunityCount: number;
  rangedCapture: number;
  meleeOnlyCapture: number;
  extraActionFlags: number;
  specialMovementFlags: number;
  promotable: number;
}

/** Count of minor "advantageous" boolean flags not already represented by `alternativeActions` —
 *  aggregated into one feature instead of four separate columns so the parameter count stays sane
 *  against the small stage-1 training set (see `stage1TrainingSet`). */
function extraActionFlagsOf(piece: Piece): number {
  return [piece.secondoMovimentoPostCattura, piece.silenzioAttacchiADistanza, piece.saltaInterposizioni, piece.egida]
    .filter(Boolean).length;
}

/** Count of special-movement mechanics that live as bare booleans on `Piece` (no
 *  `alternativeActions` entry, so stage 2 never sees them) and are not already counted by
 *  `extraActionFlagsOf` — pieces whose movement needs dedicated engine handling: the bent slides
 *  of the Grifone/Manticora (`gryphon`/`manticora`), the Rimbalzatore's bounce (`rimbalzoUnico`)
 *  and the Coniglio's deferred-capture jump chain (`catenaSaltiConCatturaFinale`). Their
 *  *mobility* is already counted exactly by the range-square sampler (`computePieceRangeSquares`
 *  dispatches to the special generators), but without this flag the model would treat them as
 *  plain sliders/leapers and never learn the special shape itself is worth anything. Aggregated
 *  into one feature for the same parameter-count reason as `extraActionFlagsOf`. */
function specialMovementFlagsOf(piece: Piece): number {
  return [piece.catenaSaltiConCatturaFinale, piece.rimbalzoUnico, piece.gryphon, piece.manticora]
    .filter(Boolean).length;
}

/** Purely structural features used for the mobility-first ("stage 1") regression. Special
 *  mechanics that live in `alternativeActions` (or `armatura`) are handled separately in stage 2
 *  (see `specialMechanicBonus`); the handful of mechanic booleans with no `alternativeActions`
 *  entry are folded in here as flags (`extraActionFlags`, `specialMovementFlags`, `promotable`) so
 *  *every* special effect on a piece influences the estimate. Mobility counts are passed through
 *  `sqrt` before being used as model inputs (see `stage1FeatureVector`) to approximate diminishing
 *  returns — going from 8 to 16 reachable squares is not worth the same as going from 16 to 24,
 *  the same intuition behind why a rook and a queen aren't simply "2x the squares = 2x the value"
 *  in real chess valuation. */
function stage1FeaturesOf(piece: Piece): Stage1Features {
  let stepSlideMoveMobility = 0;
  let stepSlideCaptureMobility = 0;
  let leapMoveMobility = 0;
  let leapCaptureMobility = 0;
  let offAxisMoveMobility = 0;
  let offAxisCaptureMobility = 0;
  for (const entry of piece.moves) {
    const { moveCount, captureCount, offAxisMoveCount, offAxisCaptureCount } = entryMobility(piece, entry);
    if (entryIgnoresBlocking(entry)) {
      leapMoveMobility += moveCount;
      leapCaptureMobility += captureCount;
    } else {
      stepSlideMoveMobility += moveCount;
      stepSlideCaptureMobility += captureCount;
    }
    offAxisMoveMobility += offAxisMoveCount;
    offAxisCaptureMobility += offAxisCaptureCount;
  }
  return {
    stepSlideMoveMobility,
    stepSlideCaptureMobility,
    leapMoveMobility,
    leapCaptureMobility,
    offAxisMoveMobility,
    offAxisCaptureMobility,
    isPawnCategory: piece.categoria === 'pedone' ? 1 : 0,
    extraEntries: Math.max(0, piece.moves.length - 1),
    resistance: piece.resistance,
    immunityCount: piece.immunityTypes.length,
    rangedCapture: piece.catturaADistanza ? 1 : 0,
    meleeOnlyCapture: piece.catturaSoloInMischia ? 1 : 0,
    extraActionFlags: extraActionFlagsOf(piece),
    specialMovementFlags: specialMovementFlagsOf(piece),
    promotable: piece.promotable ? 1 : 0,
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
    Math.sqrt(f.offAxisMoveMobility),
    Math.sqrt(f.offAxisCaptureMobility),
    f.isPawnCategory,
    f.extraEntries,
    f.resistance,
    f.immunityCount,
    f.rangedCapture,
    f.meleeOnlyCapture,
    f.extraActionFlags,
    f.specialMovementFlags,
    f.promotable,
  ];
}

const STAGE1_FEATURE_NAMES = [
  'Intercetta',
  'Mobilità di movimento (scorrimento)',
  'Mobilità di cattura (scorrimento)',
  'Mobilità di movimento (salto)',
  'Mobilità di cattura (salto)',
  'Mobilità di movimento fuori asse',
  'Mobilità di cattura fuori asse',
  'Categoria pedone',
  'Voci di mossa extra (pezzi composti)',
  'Resistenza',
  'Numero di immunità',
  'Cattura a distanza',
  'Cattura solo in mischia',
  'Flag azione minori',
  'Flag movimento speciale (ginocchio/rimbalzo/catena)',
  'Promozione',
] as const;

/** Index of the 'Promozione' feature in `STAGE1_FEATURE_NAMES` / `stage1FeatureVector`. Its
 *  coefficient is constrained to be non-negative (see `solveLeastSquares`): promotion potential
 *  is a strictly positive trait, so the model must never price a promotable piece below the
 *  identical non-promotable one (guard tested in estimatePunti.test.ts). */
const PROMOTABLE_FEATURE_INDEX = STAGE1_FEATURE_NAMES.indexOf('Promozione');
const STAGE1_NON_NEGATIVE_FEATURES: ReadonlySet<number> = new Set([PROMOTABLE_FEATURE_INDEX]);

/**
 * Solves `X·β ≈ y` in the ridge-regularized least-squares sense via the normal equations
 * `(XᵀX + λI)β = Xᵀy`, solved by Gaussian elimination with partial pivoting. `X` is n×k (first
 * column is normally the intercept, a column of 1s); `y` is length n. `lambda` defaults to 0
 * (ordinary least squares) — the intercept column (index 0) is never regularized, since shrinking
 * the intercept toward 0 would bias every prediction, not just stabilize the slopes. `weights`
 * (default: all 1s) lets a caller down-weight specific rows — used by `solveRobustLeastSquares` to
 * implement IRLS without duplicating the normal-equations assembly. No external dependency — the
 * matrices here are tiny (k ≤ 12).
 */
function solveLeastSquares(X: number[][], y: number[], lambda = 0, weights?: number[], nonNegativeIndices: ReadonlySet<number> = new Set()): number[] {
  const k = X[0].length;
  const XtX: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
  const Xty: number[] = new Array(k).fill(0);

  for (let row = 0; row < X.length; row++) {
    const w = weights ? weights[row] : 1;
    for (let i = 0; i < k; i++) {
      Xty[i] += w * X[row][i] * y[row];
      for (let j = 0; j < k; j++) {
        XtX[i][j] += w * X[row][i] * X[row][j];
      }
    }
  }
  for (let i = 1; i < k; i++) XtX[i][i] += lambda;

  let beta = solveNormalEquations(XtX, Xty);
  // Non-negativity (active set): if a constrained coefficient comes out negative, re-solve with
  // those features pinned at exactly 0 (identity rows/cols) and the rest re-fit on the reduced
  // model. This guarantees structural invariants like "promotion never lowers a piece's price".
  const violated = [...nonNegativeIndices].filter((i) => beta[i] < 0);
  if (violated.length > 0) {
    for (const i of violated) {
      for (let j = 0; j < k; j++) {
        XtX[i][j] = i === j ? 1 : 0;
        XtX[j][i] = i === j ? 1 : 0;
      }
      Xty[i] = 0;
    }
    beta = solveNormalEquations(XtX, Xty);
  }
  return beta;
}

/** Gaussian elimination with partial pivoting on the augmented [XtX | Xty] system. */
function solveNormalEquations(XtX: number[][], Xty: number[]): number[] {
  const k = XtX.length;
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

/** Beyond this absolute residual (in punti), a training example's influence on the fit switches
 *  from quadratic (ordinary least squares) to linear (Huber) — chosen to line up with
 *  `CLOSE_ENOUGH_ABS_DIFF` in the UI (a piece the fit misses by more than "close enough" shouldn't
 *  get to keep dragging every coefficient toward itself at full quadratic strength). */
const HUBER_DELTA = 3;
const IRLS_MAX_ITERATIONS = 15;
const IRLS_CONVERGENCE_TOL = 1e-3;

/** Huber weight for a residual: 1 inside `delta` (full quadratic influence, same as OLS), shrinking
 *  toward 0 as `|residual|` grows beyond it (the example still pulls the fit, just proportionally
 *  less the further it sits from everyone else). */
function huberWeight(residual: number, delta: number): number {
  const abs = Math.abs(residual);
  return abs <= delta ? 1 : delta / abs;
}

/**
 * Iteratively reweighted least squares with a Huber weight: refits `solveLeastSquares` a handful of
 * times, each time down-weighting rows whose current residual exceeds `HUBER_DELTA`, so a couple of
 * stubborn worst-fit pieces (see `estimatorFitQuality().worstFits`) can't single-handedly deform the
 * coefficients that every other piece's estimate depends on. Warm-started from the plain ridge fit;
 * stops once the coefficients stop moving (`IRLS_CONVERGENCE_TOL`) or after `IRLS_MAX_ITERATIONS`.
 * No external dependency, same spirit as `solveLeastSquares` itself.
 */
function solveRobustLeastSquares(X: number[][], y: number[], lambda: number, nonNegativeIndices: ReadonlySet<number> = new Set()): number[] {
  let beta = solveLeastSquares(X, y, lambda, undefined, nonNegativeIndices);
  for (let iter = 0; iter < IRLS_MAX_ITERATIONS; iter++) {
    const residuals = X.map((row, i) => dotProduct(beta, row) - y[i]);
    const weights = residuals.map((r) => huberWeight(r, HUBER_DELTA));
    const newBeta = solveLeastSquares(X, y, lambda, weights, nonNegativeIndices);
    const shift = Math.sqrt(newBeta.reduce((sum, v, i) => sum + (v - beta[i]) ** 2, 0));
    beta = newBeta;
    if (shift < IRLS_CONVERGENCE_TOL) break;
  }
  return beta;
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

/** Mean absolute leave-one-out error for a given ridge penalty: refit (via the same robust IRLS fit
 *  used for the final model — otherwise lambda would be tuned for a different model than the one
 *  actually deployed) on every (n-1)-piece subset and score the held-out piece, which is what
 *  actually predicts how the model behaves on a piece it wasn't tuned against — unlike in-sample
 *  error, which the ridge penalty could otherwise be picked to minimize trivially by overfitting. */
function looMeanAbsoluteError(X: number[][], y: number[], lambda: number, nonNegativeIndices: ReadonlySet<number> = new Set()): number {
  let totalAbsError = 0;
  for (let holdout = 0; holdout < X.length; holdout++) {
    const trainX = X.filter((_, i) => i !== holdout);
    const trainY = y.filter((_, i) => i !== holdout);
    const beta = solveRobustLeastSquares(trainX, trainY, lambda, nonNegativeIndices);
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
 * roster piece via `solveRobustLeastSquares` (ridge + Huber IRLS, see above), choosing the ridge
 * penalty `lambda` that minimizes leave-one-out error rather than fixing it at 0 (plain OLS) or
 * picking it by hand. Computed once at module load from the live roster (cheap: a ~24×12 matrix,
 * and only 6 lambda candidates × 24 LOO refits, each a handful of IRLS iterations) rather than
 * hardcoded from a one-off script run, so it can never silently go stale the way a hand-copied
 * constant could — this is the same lesson the roster-reading CLI script already applies.
 */
function fitStage1(): Stage1Fit {
  const trainingSet = stage1TrainingSet();
  const X = trainingSet.map((p) => stage1FeatureVector(stage1FeaturesOf(p)));
  const y = trainingSet.map((p) => p.punti);

  let bestLambda = RIDGE_LAMBDA_CANDIDATES[0];
  let bestLoo = Infinity;
  for (const lambda of RIDGE_LAMBDA_CANDIDATES) {
    const loo = looMeanAbsoluteError(X, y, lambda, STAGE1_NON_NEGATIVE_FEATURES);
    if (loo < bestLoo) {
      bestLoo = loo;
      bestLambda = lambda;
    }
  }

  return {
    coefficients: solveRobustLeastSquares(X, y, bestLambda, STAGE1_NON_NEGATIVE_FEATURES),
    lambda: bestLambda,
    looMeanAbsoluteError: bestLoo,
  };
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

/** A special-mechanic action in the normalized shape stage 2 works with — `AlternativeAction`
 *  entries already fit this shape; `armatura` (a boolean + separate `armaturaMaxCosto` field on
 *  `Piece`, not an `AlternativeAction`) is converted into one via `mechanicActionsOf` so every
 *  mechanic can be treated uniformly. Exported so callers (e.g. the piece designer UI) can build a
 *  hypothetical mechanic — including a `type` never seen in the roster — and price it via
 *  `predictMechanicBonus`. */
export interface MechanicActionInput {
  type: string;
  modalita?: ActionModalita;
  params: Record<string, unknown>;
}

/** Every special-mechanic action a piece carries, `armatura` normalized alongside
 *  `alternativeActions` (see `MechanicActionInput`). */
function mechanicActionsOf(piece: Piece): MechanicActionInput[] {
  const actions: MechanicActionInput[] = piece.alternativeActions.map((a) => ({ type: a.type, modalita: a.modalita, params: a.params }));
  if (piece.armatura) {
    actions.push({ type: 'armatura', modalita: 'passiva', params: { armaturaMaxCosto: piece.armaturaMaxCosto ?? 0 } });
  }
  return actions;
}

function piecesMechanicTypes(piece: Piece): string[] {
  return mechanicActionsOf(piece).map((a) => a.type);
}

interface MechanicFeatures {
  radius: number;
  directionCount: number;
  intensityValue: number;
  targetsAllies: number;
  isPassive: number;
  isDefensive: number;
  isOnCapture: number;
}

/** Mechanic types that protect the owner rather than threatening the opponent — `armatura`
 *  (Golem: immune to cheap capturers) and `esplosione` (Bomba: destroys its own capturer). Stage 2
 *  models these with a dedicated `isDefensive` feature (coefficient constrained ≥ 0, see
 *  `STAGE2_NON_NEGATIVE_FEATURES`) so a defensive mechanic is never priced as a penalty and the
 *  model transparency panel can show why a Bomba costs more than a bare King-step piece. */
const DEFENSIVE_MECHANIC_TYPES: ReadonlySet<string> = new Set(['armatura', 'esplosione']);

const MECHANIC_FEATURE_NAMES = [
  'Intercetta',
  'Raggio',
  'Ampiezza direzionale/distanze',
  'Intensità numerica',
  'Coinvolge alleati',
  'Passiva',
  'Difensiva',
  'Su cattura',
] as const;

/** Index of the 'Difensiva' feature in `MECHANIC_FEATURE_NAMES` / `mechanicFeatureVector`. Its
 *  coefficient is constrained to be non-negative (see `solveLeastSquares`): a defensive mechanic
 *  protects its owner or punishes its captor, so it must never lower a piece's price. */
const DEFENSIVE_FEATURE_INDEX = MECHANIC_FEATURE_NAMES.indexOf('Difensiva');
const STAGE2_NON_NEGATIVE_FEATURES: ReadonlySet<number> = new Set([DEFENSIVE_FEATURE_INDEX]);

/** Scales a matched "intensity" parameter (e.g. `armaturaMaxCosto`) down to roughly the same order
 *  of magnitude as the other stage-2 features — a raw threshold like "costo ≤ 14" would otherwise
 *  dwarf every other feature's coefficient. */
const MECHANIC_INTENSITY_SCALE = 10;

/** Sum of the lengths of every array in `params` whose key name looks like a set of directions or
 *  distances (matches both `direzioni` on aura-style mechanics and `distanze` on `scocca`) — a
 *  generic proxy for "how wide is this mechanic's angular/range coverage" that doesn't need to know
 *  the mechanic's `type` up front. */
function countRangeArrays(params: Record<string, unknown>): number {
  return Object.entries(params)
    .filter(([key, v]) => Array.isArray(v) && /direzion|distanz/i.test(key))
    .reduce((sum, [, v]) => sum + (v as unknown[]).length, 0);
}

/** First numeric value in `params` whose key name suggests a magnitude/threshold ("Costo", "Max",
 *  "Valore") — e.g. `armaturaMaxCosto`. Generic by design (see `mechanicFeaturesOf`). */
function firstNumericParamMatching(params: Record<string, unknown>, pattern: RegExp): number | undefined {
  for (const [key, value] of Object.entries(params)) {
    if (pattern.test(key) && typeof value === 'number') return value;
  }
  return undefined;
}

/**
 * Maps a mechanic's free-form `params` (a `Record<string, unknown>` that varies per `type`, see
 * `pieces.json`) to a small, generic numeric feature vector — by pattern-matching PARAMETER NAMES
 * (`raggio`→radius, `*direzioni*`/`*distanze*`→directionCount, `*Costo*`/`*Max*`/`*Valore*`→
 * intensity, `includeAlleati`/`target` containing "alleat"→targetsAllies) rather than switching on
 * `type`. A per-type switch would silently fall back to "no special mechanic" for any type never
 * seen before; name-pattern matching lets a brand new mechanic that follows the roster's existing
 * naming convention still produce a meaningful feature vector, which is what makes
 * `predictMechanicBonus` able to extrapolate at all. KNOWN LIMITATION, stated plainly: a future
 * mechanic using non-conventional parameter names degrades to "a bare special mechanic" (every
 * feature but the `modalita`-derived ones at 0) rather than crashing or producing NaN — a
 * reasonable floor, not a silently wrong answer.
 */
function mechanicFeaturesOf(action: MechanicActionInput): MechanicFeatures {
  const { params, modalita } = action;
  const target = params.target;
  return {
    radius: typeof params.raggio === 'number' ? params.raggio : 0,
    directionCount: countRangeArrays(params),
    intensityValue: (firstNumericParamMatching(params, /costo|max|valore/i) ?? 0) / MECHANIC_INTENSITY_SCALE,
    targetsAllies: params.includeAlleati === true || (typeof target === 'string' && target.includes('alleat')) ? 1 : 0,
    isPassive: modalita === 'passiva' ? 1 : 0,
    isDefensive: DEFENSIVE_MECHANIC_TYPES.has(action.type) ? 1 : 0,
    isOnCapture: modalita === 'sul_cattura' ? 1 : 0,
  };
}

function mechanicFeatureVector(f: MechanicFeatures): number[] {
  return [1, f.radius, f.directionCount, f.intensityValue, f.targetsAllies, f.isPassive, f.isDefensive, f.isOnCapture];
}

interface MechanicTrainingRow {
  action: MechanicActionInput;
  /** `punti - stage1Estimate`, i.e. the correction stage 2 needs to explain, split evenly across
   *  the piece's mechanics if it carries more than one (none does today, but the roster will grow —
   *  a linear split is a reasonable approximation at this scale rather than something requiring
   *  iterative disentangling). */
  observedBonus: number;
}

/** One training row per (piece, mechanic-on-that-piece) pair, rather than one constant per mechanic
 *  `type` as before — lets stage 2 fit *shared* coefficients (see `mechanicFeatureVector`) across
 *  every mechanic instead of an independent constant per type, which is what lets it generalize to
 *  a type it has never seen (see `mechanicFeaturesOf`). */
function mechanicRowsFromRoster(): MechanicTrainingRow[] {
  const rows: MechanicTrainingRow[] = [];
  for (const piece of ROSTER) {
    if (piece.sigla === 'RE') continue;
    const mechanics = mechanicActionsOf(piece);
    if (mechanics.length === 0) continue;
    const baseline = stage1Estimate(piece);
    const perMechanicBonus = (piece.punti - baseline) / mechanics.length;
    for (const action of mechanics) {
      rows.push({ action, observedBonus: perMechanicBonus });
    }
  }
  return rows;
}

interface Stage2Fit {
  coefficients: number[];
  lambda: number;
  looMeanAbsoluteError: number;
  /** Empirical-Bayes shrinkage constant chosen by `chooseShrinkageK` — replaces the old fixed
   *  `MECHANIC_SHRINKAGE_K`. */
  shrinkageK: number;
  shrinkageKLooMeanAbsoluteError: number;
}

const SHRINKAGE_K_CANDIDATES = [0.5, 1, 2, 4, 8];

/**
 * Chooses the empirical-Bayes shrinkage constant `K` the same way stage 1 chooses its ridge
 * penalty: leave one mechanic instance out and see which `K` reproduces its actual bonus best.
 * IMPORTANT CAVEAT, stated plainly rather than glossed over: the held-out row's "sample count" here
 * counts *other* roster examples of the same `type`, excluding the held-out row itself — today
 * every mechanic type has exactly one example, so that count is always 0 for every candidate `K`,
 * forcing `weight = 0` (i.e. `predictedValue` alone) regardless of `K`. LOO therefore cannot yet
 * discriminate between candidates — every `K` ties at the same error, and the smallest candidate is
 * kept as a neutral default. This is the deliberately honest alternative to comparing the shrunk
 * value against the held-out row's own *known* bonus while still counting that row toward its own
 * sample size: that would be circular (the raw value is *defined* as exactly the target being
 * validated against) and would always trivially prefer `K → 0`, i.e. no shrinkage at all. This
 * selection only starts doing real discriminating work once the roster has 2+ pieces sharing a
 * mechanic type, at which point a held-out row's same-type sibling supplies genuine, non-circular
 * signal about how much to trust a raw per-type average.
 */
function chooseShrinkageK(rows: MechanicTrainingRow[], lambda: number): { k: number; looMeanAbsoluteError: number } {
  const X = rows.map((r) => mechanicFeatureVector(mechanicFeaturesOf(r.action)));
  const y = rows.map((r) => r.observedBonus);

  let bestK = SHRINKAGE_K_CANDIDATES[0];
  let bestLoo = Infinity;
  for (const k of SHRINKAGE_K_CANDIDATES) {
    let totalAbsError = 0;
    for (let holdout = 0; holdout < rows.length; holdout++) {
      const trainX = X.filter((_, i) => i !== holdout);
      const trainY = y.filter((_, i) => i !== holdout);
      const beta = solveRobustLeastSquares(trainX, trainY, lambda, STAGE2_NON_NEGATIVE_FEATURES);
      const predictedValue = dotProduct(beta, X[holdout]);
      const othersOfSameType = rows.filter((r, i) => i !== holdout && r.action.type === rows[holdout].action.type);
      const sampleCount = othersOfSameType.length;
      const rawValue = sampleCount > 0
        ? othersOfSameType.reduce((sum, r) => sum + r.observedBonus, 0) / sampleCount
        : predictedValue; // no signal from other examples — weight below is 0 either way
      const weight = sampleCount / (sampleCount + k);
      const shrunk = weight * rawValue + (1 - weight) * predictedValue;
      totalAbsError += Math.abs(shrunk - rows[holdout].observedBonus);
    }
    const loo = totalAbsError / rows.length;
    if (loo < bestLoo) {
      bestLoo = loo;
      bestK = k;
    }
  }
  return { k: bestK, looMeanAbsoluteError: bestLoo };
}

/**
 * Stage-2 regression: fits `mechanicFeatureVector` coefficients against every (piece, mechanic)
 * row in the roster (see `mechanicRowsFromRoster`), choosing the ridge penalty the same way stage 1
 * does, then the shrinkage constant `K` via `chooseShrinkageK`. Replaces the old "one constant per
 * mechanic type" table with a small model shared across all mechanics — see `mechanicFeaturesOf`
 * for why that's what allows extrapolation to a mechanic type never seen in the roster.
 */
function fitStage2(): Stage2Fit {
  const rows = mechanicRowsFromRoster();
  const X = rows.map((r) => mechanicFeatureVector(mechanicFeaturesOf(r.action)));
  const y = rows.map((r) => r.observedBonus);

  let bestLambda = RIDGE_LAMBDA_CANDIDATES[0];
  let bestLoo = Infinity;
  for (const lambda of RIDGE_LAMBDA_CANDIDATES) {
    const loo = looMeanAbsoluteError(X, y, lambda, STAGE2_NON_NEGATIVE_FEATURES);
    if (loo < bestLoo) {
      bestLoo = loo;
      bestLambda = lambda;
    }
  }

  const coefficients = solveRobustLeastSquares(X, y, bestLambda, STAGE2_NON_NEGATIVE_FEATURES);
  const { k, looMeanAbsoluteError: shrinkageKLoo } = chooseShrinkageK(rows, bestLambda);

  return {
    coefficients,
    lambda: bestLambda,
    looMeanAbsoluteError: bestLoo,
    shrinkageK: k,
    shrinkageKLooMeanAbsoluteError: shrinkageKLoo,
  };
}

let stage2FitCache: Stage2Fit | null = null;
function stage2Fit(): Stage2Fit {
  if (!stage2FitCache) stage2FitCache = fitStage2();
  return stage2FitCache;
}

/**
 * Evaluates the stage-2 parametric model for an arbitrary mechanic action — including one whose
 * `type` has never appeared in the roster, or an existing `type` with different `params` than any
 * roster example — by mapping its `params` to the shared feature vector (`mechanicFeaturesOf`) and
 * applying the fitted coefficients. This is what lets the estimator (and the piece designer UI)
 * price a brand new special mechanic instead of silently returning 0 for anything outside the
 * roster's exact catalog of known types.
 */
export function predictMechanicBonus(action: MechanicActionInput): number {
  return dotProduct(stage2Fit().coefficients, mechanicFeatureVector(mechanicFeaturesOf(action)));
}

export interface Stage2ModelSummary {
  features: { name: string; coefficient: number }[];
  lambda: number;
  shrinkageK: number;
  looMeanAbsoluteError: number;
}

/** Exposes the fitted stage-2 model (coefficients, chosen ridge penalty and shrinkage K, their
 *  cross-validated errors) so the UI can show why the estimator's mechanic bonus is what it is —
 *  symmetric to `stage1ModelSummary`. */
export function stage2ModelSummary(): Stage2ModelSummary {
  const fit = stage2Fit();
  return {
    features: fit.coefficients.map((coefficient, i) => ({ name: MECHANIC_FEATURE_NAMES[i], coefficient })),
    lambda: fit.lambda,
    shrinkageK: fit.shrinkageK,
    looMeanAbsoluteError: fit.looMeanAbsoluteError,
  };
}

export interface MechanicBonusEntry {
  /** Bonus actually applied by the estimator — the raw per-type average shrunk toward
   *  `predictedValue` (the stage-2 model's own prediction), more strongly so the fewer roster
   *  examples back the raw average up. */
  value: number;
  /** The un-shrunk per-type average of `punti - stage1Estimate` across roster pieces carrying this
   *  mechanic type, kept for transparency (shown in the model panel). */
  rawValue: number;
  /** What the stage-2 parametric model predicts for this mechanic type's roster example(s) —
   *  the "background" `rawValue` is shrunk toward, replacing the old flat global-mean background. */
  predictedValue: number;
  sampleCount: number;
}

function shrinkMechanicBonus(rawValue: number, sampleCount: number, predictedValue: number): number {
  const weight = sampleCount / (sampleCount + stage2Fit().shrinkageK);
  return weight * rawValue + (1 - weight) * predictedValue;
}

function computeMechanicBonusTable(): Record<string, MechanicBonusEntry> {
  const rows = mechanicRowsFromRoster();
  const byType = new Map<string, MechanicTrainingRow[]>();
  for (const row of rows) {
    const list = byType.get(row.action.type) ?? [];
    list.push(row);
    byType.set(row.action.type, list);
  }

  const table: Record<string, MechanicBonusEntry> = {};
  for (const [type, typeRows] of byType) {
    const rawValue = typeRows.reduce((sum, r) => sum + r.observedBonus, 0) / typeRows.length;
    const predictedValue = typeRows.reduce((sum, r) => sum + predictMechanicBonus(r.action), 0) / typeRows.length;
    table[type] = {
      value: shrinkMechanicBonus(rawValue, typeRows.length, predictedValue),
      rawValue,
      predictedValue,
      sampleCount: typeRows.length,
    };
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

/** Applies each of a piece's own mechanic actions through `predictMechanicBonus` (using that
 *  piece's own `params`, not a roster "representative") shrunk toward the per-type roster average —
 *  for the current roster (one example per type) this is numerically identical to looking up
 *  `mechanicBonusTable()[type].value` directly, but computing it per-action keeps behavior correct
 *  once a type has multiple roster examples with different `params`, and for a hypothetical piece
 *  (piece designer) whose mechanic `params` differ from any roster example of the same type. */
function specialMechanicBonus(piece: Piece): number {
  const table = mechanicBonusTable();
  return mechanicActionsOf(piece).reduce((sum, action) => {
    const entry = table[action.type];
    const rawValue = entry?.rawValue ?? 0;
    const sampleCount = entry?.sampleCount ?? 0;
    const predictedValue = predictMechanicBonus(action);
    return sum + shrinkMechanicBonus(rawValue, sampleCount, predictedValue);
  }, 0);
}

export interface PuntiEstimate {
  suggestedPunti: number;
  /** Plausible range around `suggestedPunti`, built from `marginOfError` (see below) — a heuristic
   *  band anchored to real cross-validation error, not a formal statistical confidence interval
   *  (the training sets are far too small — ~24 pieces for stage 1, 11 mechanic instances for stage
   *  2 — to support one). Floored at 1 on the low side, same reasoning as `suggestedPunti`. */
  confidenceInterval: { low: number; high: number };
  /** Half-width of `confidenceInterval`: the stage-1 leave-one-out error, plus the stage-2
   *  leave-one-out error if the piece carries any special mechanic. Exposed raw (not just as the
   *  interval) so callers like the scatter chart can draw it without reconstructing it. */
  marginOfError: number;
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
  const [
    , coeffStepSlideMove, coeffStepSlideCapture, coeffLeapMove, coeffLeapCapture,
    coeffOffAxisMove, coeffOffAxisCapture, , coeffExtraEntries,
  ] = stage1Fit().coefficients;
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
    coeffLeapCapture * Math.sqrt(f.leapCaptureMobility) +
    coeffOffAxisMove * Math.sqrt(f.offAxisMoveMobility) +
    coeffOffAxisCapture * Math.sqrt(f.offAxisCaptureMobility);

  // A piece costing 0 punti would be free to field — every real piece costs at least 1 (in
  // practice the cheapest, Paggio, costs 2), so the floor is 1, not 0.
  const suggestedPunti = Math.max(1, Math.round(stage1Estimate(piece) + mechanicBonus));
  const marginOfError = stage1Fit().looMeanAbsoluteError + (mechanicTypes.length > 0 ? stage2Fit().looMeanAbsoluteError : 0);

  return {
    suggestedPunti,
    confidenceInterval: {
      low: Math.max(1, Math.round(suggestedPunti - marginOfError)),
      high: Math.round(suggestedPunti + marginOfError),
    },
    marginOfError,
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
