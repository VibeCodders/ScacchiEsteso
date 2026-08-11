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
    // squares as the Torre's straight slide — the plain move/capture counts are still identical...
    const diffNames = pair.featureDiffs.map((d) => d.name);
    expect(diffNames).not.toContain('Mobilità mossa (scorrimento)');
    expect(diffNames).not.toContain('Mobilità cattura (scorrimento)');
    // ...but the bent second legs DO reach off-axis squares the Torre never does, on top of the
    // real mechanic difference (the bent slide itself).
    expect(diffNames).toContain('Mobilità fuori asse');
    expect(pair.differingMechanicTypes).toContain('manticora');
    expect(pair.distance).toBeGreaterThan(DEFAULT_SIMILARITY_THRESHOLD);
  });

  it('keeps flagging genuine near-duplicates that share the same mechanics and shape', () => {
    // Paggio and Fante differ only by the forward capture (README §11): same mechanics, tiny distance.
    const paggioFante = pairBetween('PG', 'FG');
    expect(paggioFante.differingMechanicTypes).toEqual([]);
    expect(paggioFante.distance).toBeLessThanOrEqual(DEFAULT_SIMILARITY_THRESHOLD);
    // Corriere and Ricognitore are both 2-step straight movers (orthogonal vs diagonal): same
    // on-axis shape and no mechanics — they genuinely play alike, so they stay flagged.
    const corriereRicognitore = pairBetween('CR', 'RI');
    expect(corriereRicognitore.differingMechanicTypes).toEqual([]);
    expect(corriereRicognitore.distance).toBeLessThanOrEqual(DEFAULT_SIMILARITY_THRESHOLD);
  });

  it('does not flag Cavallo and Spettro: the off-axis L-leap separates them despite identical counts and mechanics', () => {
    const pair = pairBetween('CA', 'SP');
    // Both are jumping pieces (shared saltaInterposizioni) reaching ~8 squares on average — no
    // mechanic and no mobility-count difference separates them...
    expect(pair.differingMechanicTypes).toEqual([]);
    // ...but the Cavallo's targets share no rank/file/diagonal with the origin, while the
    // Spettro's stay on diagonals: the off-axis feature is what tells them apart.
    expect(pair.featureDiffs.map((d) => d.name)).toContain('Mobilità fuori asse');
    expect(pair.distance).toBeGreaterThan(DEFAULT_SIMILARITY_THRESHOLD);
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
