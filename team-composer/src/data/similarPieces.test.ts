import { describe, expect, it } from 'vitest';
import { findSimilarPiecePairs, DEFAULT_SIMILARITY_THRESHOLD, type SimilarPiecePair } from './similarPieces';

const { pairs } = findSimilarPiecePairs();

function pairBetween(a: string, b: string): SimilarPiecePair {
  const pair = pairs.find(
    (p) => (p.a.sigla === a && p.b.sigla === b) || (p.a.sigla === b && p.b.sigla === a),
  );
  if (!pair) throw new Error(`no pair ${a}-${b} in the detector output`);
  return pair;
}

describe('similar-pieces detector — special mechanics separate mobility twins', () => {
  it('does not flag Torre and Manticora as similar, despite their identical mobility counts', () => {
    const pair = pairBetween('TO', 'MA');
    // On an 8×8 board the Manticora's bent slide reaches exactly the same average number of
    // squares as the Torre's straight slide — the numeric features are literally identical...
    expect(pair.featureDiffs).toEqual([]);
    // ...so only the mechanic dimension can tell them apart: the bent slide is a real mechanic.
    expect(pair.differingMechanicTypes).toContain('manticora');
    expect(pair.distance).toBeGreaterThan(DEFAULT_SIMILARITY_THRESHOLD);
  });

  it('keeps flagging genuine near-duplicates that share the same mechanics', () => {
    // Paggio and Fante differ only by the forward capture (README §11): same mechanics, tiny distance.
    const paggioFante = pairBetween('PG', 'FG');
    expect(paggioFante.differingMechanicTypes).toEqual([]);
    expect(paggioFante.distance).toBeLessThanOrEqual(DEFAULT_SIMILARITY_THRESHOLD);
    // Cavallo and Spettro are both jumping pieces (shared saltaInterposizioni) — still near-identical.
    const cavalloSpettro = pairBetween('CA', 'SP');
    expect(cavalloSpettro.differingMechanicTypes).toEqual([]);
    expect(cavalloSpettro.distance).toBeLessThanOrEqual(DEFAULT_SIMILARITY_THRESHOLD);
  });

  it('surfaces the special-mechanic flags of every flagged piece via differingMechanicTypes', () => {
    // A bent-slide vs a bounce piece: each keeps its own mechanic, so the pair is not similar.
    const manticoraRimbalzatore = pairBetween('MA', 'RB');
    expect(manticoraRimbalzatore.differingMechanicTypes).toEqual(
      expect.arrayContaining(['manticora', 'rimbalzoUnico']),
    );
    expect(manticoraRimbalzatore.distance).toBeGreaterThan(DEFAULT_SIMILARITY_THRESHOLD);
    // Coniglio (chain jumps) vs Miraggio (clones): completely different mechanics.
    const coniglioMiraggio = pairBetween('CN', 'MG');
    expect(coniglioMiraggio.differingMechanicTypes).toEqual(
      expect.arrayContaining(['catenaSaltiConCatturaFinale', 'sdoppiamento', 'riunione']),
    );
  });

  it('keeps the alternativeActions in the mechanic set (Repulsore vs a pure slide)', () => {
    const repulsoreTorre = pairBetween('RP', 'TO');
    expect(repulsoreTorre.differingMechanicTypes).toEqual(
      expect.arrayContaining(['respingi']),
    );
    expect(repulsoreTorre.distance).toBeGreaterThan(DEFAULT_SIMILARITY_THRESHOLD);
  });
});
