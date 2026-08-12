import { describe, expect, it } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PcDifficultyScreen from './PcDifficultyScreen';
import { GameSetupProvider } from '../context/GameSetupContext';
import { ThemeProvider } from '../context/ThemeContext';
import { useGameSetup } from '../context/gameSetup';

function Bootstrap() {
  const { setMode, setHumanOwner } = useGameSetup();
  useEffect(() => {
    setMode('pvc');
    setHumanOwner('A'); // the PC composes B
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <PcDifficultyScreen />;
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/team/pc-difficulty']}>
      <GameSetupProvider>
        <ThemeProvider>
          <Routes>
            <Route path="/team/pc-difficulty" element={<Bootstrap />} />
            <Route path="/team/pc-choice" element={<div>Schermata Composizione PC</div>} />
          </Routes>
        </ThemeProvider>
      </GameSetupProvider>
    </MemoryRouter>,
  );
}

describe('PcDifficultyScreen — numeric bot difficulty (−10…50), passo 1', () => {
  it('shows a −10…50 slider defaulting to 10 (il PC vede 1 mossa avanti)', () => {
    renderScreen();
    const slider = screen.getByLabelText(/Difficoltà del bot/i) as HTMLInputElement;
    expect(slider.type).toBe('range');
    expect(Number(slider.min)).toBe(-10);
    expect(Number(slider.max)).toBe(50);
    expect(Number(slider.value)).toBe(10);
    expect(screen.getByText(/vede 1 mossa avanti/i)).toBeInTheDocument();
  });

  it('updates the difficulty and the lookahead label when the slider moves', () => {
    renderScreen();
    const slider = screen.getByLabelText(/Difficoltà del bot/i) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '20' } });
    expect(screen.getByText(/Livello di difficoltà: 20/i)).toBeInTheDocument();
    expect(screen.getByText(/vede 2 mosse avanti/i)).toBeInTheDocument();

    fireEvent.change(slider, { target: { value: '5' } });
    expect(screen.getByText(/vede 0.5 mosse avanti/i)).toBeInTheDocument();
  });

  it('explains the sabotage for negative difficulties', () => {
    renderScreen();
    const slider = screen.getByLabelText(/Difficoltà del bot/i) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '-10' } });
    expect(screen.getByText(/gioca le mosse peggiori per sé/i)).toBeInTheDocument();
    expect(screen.getByText(/1 mossa a favore del nemico/i)).toBeInTheDocument();
  });

  it('\"Continua\" moves to the sequential team-composition screen', () => {
    renderScreen();
    expect(screen.queryByText('Schermata Composizione PC')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/Continua/i));
    expect(screen.getByText('Schermata Composizione PC')).toBeInTheDocument();
  });
});
