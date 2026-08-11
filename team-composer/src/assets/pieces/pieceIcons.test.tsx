import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import PieceIcon from './pieceIcons';
import { pieces } from '../../data/pieces';

describe('piece icons — every piece in pieces.json ships a real icon', () => {
  it('renders a dedicated silhouette for every piece in the roster (no <text> label, which only the fallback circle uses)', () => {
    const fallbackUsed: string[] = [];
    for (const piece of pieces) {
      const { container } = render(<PieceIcon sigla={piece.sigla} />);
      const svg = container.querySelector('svg');
      expect(svg, `nessun svg per ${piece.sigla}`).not.toBeNull();
      expect(svg?.getAttribute('aria-label')).toBe(piece.sigla);
      // The fallback circle draws the sigla as <text>; every real silhouette is pure shapes —
      // so a <text> child means this piece is still falling back to the placeholder circle.
      if (container.querySelector('text')) {
        fallbackUsed.push(piece.sigla);
      }
    }
    expect(fallbackUsed, `pezzi che usano ancora il fallback (cerchio con etichetta): ${fallbackUsed.join(', ')}`).toEqual([]);
  });

  it('guards itself: an unknown sigla falls back to the labeled circle (detection above would catch it)', () => {
    const { container } = render(<PieceIcon sigla="XX" />);
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe('XX');
    expect(container.querySelector('text')?.textContent).toBe('XX');
  });
});
