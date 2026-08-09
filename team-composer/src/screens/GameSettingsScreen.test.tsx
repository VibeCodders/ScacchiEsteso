import { describe, expect, it } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import GameSettingsScreen from './GameSettingsScreen';
import { GameSetupProvider } from '../context/GameSetupContext';
import { useGameSetup, type GameMode } from '../context/gameSetup';
import type { Owner } from '../game/board';

function Bootstrap({ mode, humanOwner, children }: { mode: GameMode; humanOwner?: Owner; children: React.ReactNode }) {
  const { setMode, setHumanOwner } = useGameSetup();
  useEffect(() => {
    setMode(mode);
    if (humanOwner) setHumanOwner(humanOwner);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
}

function renderSettings(mode: GameMode = 'pvp', humanOwner?: Owner, destinationLabel = 'destination') {
  return render(
    <MemoryRouter initialEntries={['/game-settings']}>
      <GameSetupProvider>
        <Bootstrap mode={mode} humanOwner={humanOwner}>
          <Routes>
            <Route path="/game-settings" element={<GameSettingsScreen />} />
            <Route path="/team/a" element={<div>{destinationLabel}: team/a</div>} />
            <Route path="/team/pc-choice" element={<div>{destinationLabel}: team/pc-choice</div>} />
          </Routes>
        </Bootstrap>
      </GameSetupProvider>
    </MemoryRouter>,
  );
}

describe('GameSettingsScreen', () => {
  it('defaults to 8×8 and no special-types limit', () => {
    renderSettings();
    expect(screen.getAllByDisplayValue('8')).toHaveLength(2);
    expect(screen.getByText(/Nessun limite/i)).toBeInTheDocument();
  });

  it('the "8×8 (classica)" shortcut resets width/height back to 8', () => {
    renderSettings();
    fireEvent.change(screen.getByLabelText(/Larghezza/i), { target: { value: '12' } });
    fireEvent.click(screen.getByText(/8×8 \(classica\)/i));
    expect(screen.getAllByDisplayValue('8')).toHaveLength(2);
  });

  it('rejects a width below the minimum playable size and disables continuing', () => {
    renderSettings();
    fireEvent.change(screen.getByLabelText(/Larghezza/i), { target: { value: '3' } });
    expect(screen.getByText(/Larghezza non valida/i)).toBeInTheDocument();
    expect(screen.getByText(/✗ Impostazioni non valide/i)).toBeDisabled();
  });

  it('rejects a height below the minimum playable size', () => {
    renderSettings();
    fireEvent.change(screen.getByLabelText(/Altezza/i), { target: { value: '1' } });
    expect(screen.getByText(/Altezza non valida/i)).toBeInTheDocument();
  });

  it('enables the special-types limit input only once "Limita a:" is selected', () => {
    renderSettings();
    const limitInput = screen.getByDisplayValue('3');
    expect(limitInput).toBeDisabled();

    fireEvent.click(screen.getByText(/^Limita a:$/i));
    expect(limitInput).not.toBeDisabled();
  });

  it('in PvP mode, "Continua" navigates to the Team A select route', () => {
    renderSettings('pvp');
    fireEvent.click(screen.getByText(/Continua →/i));
    expect(screen.getByText(/destination: team\/a/i)).toBeInTheDocument();
  });

  it('in PvC mode playing as A, "Continua" navigates to the Team A select route', () => {
    renderSettings('pvc', 'A');
    fireEvent.click(screen.getByText(/Continua →/i));
    expect(screen.getByText(/destination: team\/a/i)).toBeInTheDocument();
  });

  it('in PvC mode playing as B, "Continua" navigates to the PC team choice route (PC composes first)', () => {
    renderSettings('pvc', 'B');
    fireEvent.click(screen.getByText(/Continua →/i));
    expect(screen.getByText(/destination: team\/pc-choice/i)).toBeInTheDocument();
  });

  it('a custom board size and an enabled special-types limit are both saved before navigating', () => {
    renderSettings('pvp');
    fireEvent.change(screen.getByLabelText(/Larghezza/i), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(/Altezza/i), { target: { value: '6' } });
    fireEvent.click(screen.getByText(/^Limita a:$/i));
    fireEvent.change(screen.getByDisplayValue('3'), { target: { value: '2' } });
    fireEvent.click(screen.getByText(/Continua →/i));

    expect(screen.getByText(/destination: team\/a/i)).toBeInTheDocument();
  });
});
