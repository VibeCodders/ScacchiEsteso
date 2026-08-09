import { describe, expect, it } from 'vitest';
import { pieces, pickablePieces, sortByPunti, sortSiglasByPunti } from './pieces';

describe('sortByPunti', () => {
  it('sorts a shuffled list of pieces ascending by point cost', () => {
    const shuffled = [...pickablePieces].sort(() => Math.random() - 0.5);
    const sorted = sortByPunti(shuffled);

    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].punti).toBeGreaterThanOrEqual(sorted[i - 1].punti);
    }
  });

  it('does not mutate the input array', () => {
    const input = [pieces[2], pieces[0], pieces[1]];
    const originalOrder = [...input];
    sortByPunti(input);
    expect(input).toEqual(originalOrder);
  });

  it('the full piece roster and the pickable-only roster both come out ascending', () => {
    for (const list of [pieces, pickablePieces]) {
      const sorted = sortByPunti(list);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].punti).toBeGreaterThanOrEqual(sorted[i - 1].punti);
      }
    }
  });
});

describe('sortSiglasByPunti', () => {
  it('sorts siglas ascending by the point cost of the piece they name', () => {
    // SP=15, PE=4, CA=12, AL=10 — deliberately shuffled, not already in cost order
    expect(sortSiglasByPunti(['SP', 'PE', 'CA', 'AL'])).toEqual(['PE', 'AL', 'CA', 'SP']);
  });

  it('does not mutate the input array', () => {
    const input = ['TO', 'RE', 'PE'];
    const originalOrder = [...input];
    sortSiglasByPunti(input);
    expect(input).toEqual(originalOrder);
  });

  it('is a no-op on an empty list', () => {
    expect(sortSiglasByPunti([])).toEqual([]);
  });
});
