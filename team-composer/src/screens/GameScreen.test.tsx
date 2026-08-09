import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GameScreen from './GameScreen';
import { GameSetupProvider } from '../context/GameSetupContext';

function renderGameScreen() {
  return render(
    <MemoryRouter>
      <GameSetupProvider>
        <GameScreen />
      </GameSetupProvider>
    </MemoryRouter>,
  );
}

describe('GameScreen — demo board preview', () => {
  it('renders the Board with the 32-piece classic starting layout', () => {
    renderGameScreen();
    expect(screen.getByTestId('board')).toBeInTheDocument();
    expect(document.querySelectorAll('.board-square svg')).toHaveLength(32);
  });

  it('starts oriented for Player 1 (A)', () => {
    renderGameScreen();
    expect(screen.getByTestId('board')).toHaveAttribute('data-orientation', 'A');
    expect(screen.getByTestId('board')).not.toHaveClass('board-rotated');
  });

  it('flips orientation to B when the rotate button is clicked, and back to A on a second click', () => {
    renderGameScreen();
    const toggle = screen.getByText(/Gira scacchiera/i);

    fireEvent.click(toggle);
    expect(screen.getByTestId('board')).toHaveAttribute('data-orientation', 'B');
    expect(screen.getByTestId('board')).toHaveClass('board-rotated');

    fireEvent.click(toggle);
    expect(screen.getByTestId('board')).toHaveAttribute('data-orientation', 'A');
    expect(screen.getByTestId('board')).not.toHaveClass('board-rotated');
  });
});
