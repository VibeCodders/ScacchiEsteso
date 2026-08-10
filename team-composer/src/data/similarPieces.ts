import { pieces as ROSTER } from './pieces';
import { allCoords } from '../game/board';
import { computePieceRangeSquares } from '../game/pieceInfo';
import type { Move, Piece } from '../types';

/** Same exhaustive board sampling `estimatePunti.ts` uses for its own mobility features — reusing
 *  the technique (not the function, which isn't exported) keeps "similar" meaning the same thing
 *  here as it does to the estimator: two pieces this module calls similar are also likely to land
 *  close together in `estimatePunti`'s stage-1 fit. */
const ALL_SQUARES = allCoords();

function entryIgnoresBlocking(entry: Move): boolean {
  return Boolean(entry.jump) || entry.leapPattern !== undefined;
}

interface MobilityTotals {
  stepSlideMove: number;
  stepSlideCapture: number;
  leapMove: number;
  leapCapture: number;
}

function mobilityOf(piece: Piece): MobilityTotals {
  const totals: MobilityTotals = { stepSlideMove: 0, stepSlideCapture: 0, leapMove: 0, leapCapture: 0 };
  for (const entry of piece.moves) {
    const isolated: Piece = { ...piece, moves: [entry] };
    const samples = ALL_SQUARES.map((sq) => computePieceRangeSquares(isolated, 'A', sq));
    const moveCount = samples.reduce((sum, s) => sum + s.moveSquares.length, 0) / samples.length;
    const captureCount = samples.reduce((sum, s) => sum + s.captureSquares.length, 0) / samples.length;
    if (entryIgnoresBlocking(entry)) {
      totals.leapMove += moveCount;
      totals.leapCapture += captureCount;
    } else {
      totals.stepSlideMove += moveCount;
      totals.stepSlideCapture += captureCount;
    }
  }
  return totals;
}

export const SIMILARITY_FEATURE_NAMES = [
  'Mobilità mossa (scorrimento)',
  'Mobilità cattura (scorrimento)',
  'Mobilità mossa (salto)',
  'Mobilità cattura (salto)',
  'Categoria pedone',
  'Voci di mossa extra',
  'Resistenza',
  'Numero immunità',
  'Cattura a distanza',
  'Cattura solo in mischia',
] as const;

function featureVectorOf(piece: Piece): number[] {
  const m = mobilityOf(piece);
  return [
    m.stepSlideMove,
    m.stepSlideCapture,
    m.leapMove,
    m.leapCapture,
    piece.categoria === 'pedone' ? 1 : 0,
    Math.max(0, piece.moves.length - 1),
    piece.resistance,
    piece.immunityTypes.length,
    piece.catturaADistanza ? 1 : 0,
    piece.catturaSoloInMischia ? 1 : 0,
  ];
}

function mechanicTypesOf(piece: Piece): Set<string> {
  const types = new Set(piece.alternativeActions.map((a) => a.type));
  if (piece.armatura) types.add('armatura');
  return types;
}

/** Z-scores every column across the roster so no single feature (e.g. resistance, which is 0 for
 *  almost every piece today) dominates the distance purely because its raw scale happens to be
 *  bigger — a difference of "2" in mobility and a difference of "2" in resistance should count
 *  comparably once both are expressed in "how unusual is this for the roster" units. */
function standardize(vectors: number[][]): number[][] {
  const dims = vectors[0].length;
  const means = new Array(dims).fill(0);
  const stds = new Array(dims).fill(0);
  for (const v of vectors) for (let i = 0; i < dims; i++) means[i] += v[i];
  for (let i = 0; i < dims; i++) means[i] /= vectors.length;
  for (const v of vectors) for (let i = 0; i < dims; i++) stds[i] += (v[i] - means[i]) ** 2;
  for (let i = 0; i < dims; i++) stds[i] = Math.sqrt(stds[i] / vectors.length) || 1; // constant column -> no contribution, not div-by-zero

  return vectors.map((v) => v.map((x, i) => (x - means[i]) / stds[i]));
}

function euclideanDistance(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((sum, v, i) => sum + (v - b[i]) ** 2, 0));
}

function jaccardDistance(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  const union = new Set([...a, ...b]);
  let intersectionSize = 0;
  for (const x of a) if (b.has(x)) intersectionSize++;
  return 1 - intersectionSize / union.size;
}

/** Weight given to a differing special-mechanic set in the overall distance — deliberately large
 *  relative to the (already standardized) numeric features: two pieces with near-identical mobility
 *  but different special mechanics (one has an aura, the other doesn't) shouldn't be flagged as
 *  "similar", since the mechanic is exactly what differentiates them in play despite the matching
 *  movement profile. */
const MECHANIC_DISTANCE_WEIGHT = 3;

/** Distance at or below which a pair is flagged as "very similar" — chosen so that two pieces
 *  differing by roughly half a standard deviation on one or two features (and sharing the same
 *  mechanics, or lack thereof) get flagged, while pieces that only vaguely resemble each other
 *  don't drown out the real near-duplicates. */
export const DEFAULT_SIMILARITY_THRESHOLD = 1.2;

export interface FeatureDiff {
  name: string;
  diff: number;
}

export interface SimilarPiecePair {
  a: Piece;
  b: Piece;
  distance: number;
  featureDiffs: FeatureDiff[];
  differingMechanicTypes: string[];
}

interface PairsResult {
  pairs: SimilarPiecePair[];
  comparedPieceCount: number;
}

let pairsCache: PairsResult | null = null;

/**
 * All pairs of roster pieces (King excluded — a unique role with a fixed nominal cost, not a
 * mobility-priced piece in the same sense as the rest of the roster), sorted by ascending
 * similarity distance. Distance combines a standardized Euclidean distance over mobility/structural
 * features (see `SIMILARITY_FEATURE_NAMES`) with a heavily-weighted Jaccard distance over special
 * mechanic types, so two pieces sharing a movement profile but differing in special mechanics don't
 * get flagged as near-duplicates. Computed once and cached — the roster only changes across module
 * reloads, same pattern as `estimatePunti.ts`'s fit caches.
 */
export function findSimilarPiecePairs(): PairsResult {
  if (pairsCache) return pairsCache;

  const comparable = ROSTER.filter((p) => p.sigla !== 'RE');
  const rawVectors = comparable.map(featureVectorOf);
  const standardized = standardize(rawVectors);
  const mechanicSets = comparable.map(mechanicTypesOf);

  const pairs: SimilarPiecePair[] = [];
  for (let i = 0; i < comparable.length; i++) {
    for (let j = i + 1; j < comparable.length; j++) {
      const numericDistance = euclideanDistance(standardized[i], standardized[j]);
      const mechanicDistance = jaccardDistance(mechanicSets[i], mechanicSets[j]) * MECHANIC_DISTANCE_WEIGHT;
      const featureDiffs = rawVectors[i]
        .map((v, k) => ({ name: SIMILARITY_FEATURE_NAMES[k], diff: v - rawVectors[j][k] }))
        .filter((d) => Math.abs(d.diff) > 1e-9);
      const differingMechanicTypes = [...mechanicSets[i]]
        .filter((m) => !mechanicSets[j].has(m))
        .concat([...mechanicSets[j]].filter((m) => !mechanicSets[i].has(m)));
      pairs.push({
        a: comparable[i],
        b: comparable[j],
        distance: numericDistance + mechanicDistance,
        featureDiffs,
        differingMechanicTypes,
      });
    }
  }

  pairs.sort((x, y) => x.distance - y.distance);
  pairsCache = { pairs, comparedPieceCount: comparable.length };
  return pairsCache;
}
