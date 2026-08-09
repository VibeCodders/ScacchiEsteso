import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PieceEncyclopediaScreen from './PieceEncyclopediaScreen';
import { pieces } from '../data/pieces';

function renderScreen() {
  return render(
    <MemoryRouter>
      <PieceEncyclopediaScreen />
    </MemoryRouter>,
  );
}

describe('PieceEncyclopediaScreen', () => {
  it('lists every piece, including the Damone (only obtainable via promotion)', () => {
    renderScreen();
    expect(document.querySelectorAll('.piece-card')).toHaveLength(pieces.length);
    expect(screen.getByText('DM')).toBeInTheDocument();
  });

  it('lists every piece sorted by point cost, ascending', () => {
    renderScreen();
    const renderedSiglas = [...document.querySelectorAll('.piece-card .sigla')].map((el) => el.textContent);
    const expectedSiglas = [...pieces].sort((a, b) => a.punti - b.punti).map((p) => p.sigla);
    expect(renderedSiglas).toEqual(expectedSiglas);
  });

  it('shows no detail board before any "più info" button is clicked', () => {
    renderScreen();
    expect(screen.queryByTestId('board')).not.toBeInTheDocument();
  });

  it('opens a detail board with the piece placed on it when "più info" is clicked', () => {
    renderScreen();
    const reCard = screen.getByText('RE').closest('.piece-card')!;
    fireEvent.click(reCard.querySelector('button')!);

    expect(screen.getByTestId('board')).toBeInTheDocument();
    // the Re shows up somewhere on the demo board
    expect(document.querySelectorAll('.board-square svg[aria-label="RE"]')).toHaveLength(1);
  });

  it('highlights all 8 adjacent squares as both move and capture for the Re', () => {
    renderScreen();
    const reCard = screen.getByText('RE').closest('.piece-card')!;
    fireEvent.click(reCard.querySelector('button')!);

    const moveHighlighted = document.querySelectorAll('.board-square-highlighted');
    const captureHighlighted = document.querySelectorAll('.board-square-capture-highlighted');
    expect(moveHighlighted).toHaveLength(8);
    expect(captureHighlighted).toHaveLength(8);
  });

  it('separates move-only and capture-only squares for the Pedone, and places a demo enemy on a capture square', () => {
    renderScreen();
    const peCard = screen.getByText('PE').closest('.piece-card')!;
    fireEvent.click(peCard.querySelector('button')!);

    // forward squares: move only, not capture
    const d5 = document.querySelector('[data-coord="d5"]')!;
    expect(d5).toHaveClass('board-square-highlighted');
    expect(d5).not.toHaveClass('board-square-capture-highlighted');

    // diagonal squares: capture only, not move — and one of them holds the demo enemy piece
    const c5 = document.querySelector('[data-coord="c5"]')!;
    const e5 = document.querySelector('[data-coord="e5"]')!;
    expect(c5).toHaveClass('board-square-capture-highlighted');
    expect(c5).not.toHaveClass('board-square-highlighted');
    expect(e5).toHaveClass('board-square-capture-highlighted');
    expect(e5).not.toHaveClass('board-square-highlighted');
    expect(document.querySelectorAll('.board-square svg[aria-label="PE"]')).toHaveLength(2); // the Pedone itself + the demo enemy
  });

  it('closes the detail board when "Chiudi" is clicked', () => {
    renderScreen();
    const reCard = screen.getByText('RE').closest('.piece-card')!;
    fireEvent.click(reCard.querySelector('button')!);
    expect(screen.getByTestId('board')).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Chiudi/i));
    expect(screen.queryByTestId('board')).not.toBeInTheDocument();
  });

  it('"Torna alla Home" navigates back', () => {
    renderScreen();
    expect(() => fireEvent.click(screen.getByText(/Torna alla Home/i))).not.toThrow();
  });
});
