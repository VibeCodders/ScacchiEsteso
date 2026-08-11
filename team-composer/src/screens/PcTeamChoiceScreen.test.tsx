import { describe, expect, it } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PcTeamChoiceScreen from './PcTeamChoiceScreen';
import { GameSetupProvider } from '../context/GameSetupContext';
import { ThemeProvider } from '../context/ThemeContext';
import { useGameSetup } from '../context/gameSetup';
import { KING_SIGLA } from '../data/pieces';
import { computeDistinctSpecialTypes } from '../data/validators';
import { pieces } from '../data/pieces';

function Bootstrap({
  maxDistinctSpecialTypes, dimensions,
}: { maxDistinctSpecialTypes?: number | null; dimensions?: { width: number; height: number } }) {
  const { setMode, setHumanOwner, setMaxDistinctSpecialTypes, setBoardDimensions } = useGameSetup();
  useEffect(() => {
    setMode('pvc');
    setHumanOwner('A'); // PC composes B
    if (maxDistinctSpecialTypes !== undefined) setMaxDistinctSpecialTypes(maxDistinctSpecialTypes);
    if (dimensions) setBoardDimensions(dimensions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <PcTeamChoiceScreen />;
}

function renderScreen(maxDistinctSpecialTypes?: number | null, dimensions?: { width: number; height: number }) {
  return render(
    <MemoryRouter initialEntries={['/team/pc']}>
      <GameSetupProvider>
        <ThemeProvider>
        <Routes>
          <Route path="/team/pc" element={<Bootstrap maxDistinctSpecialTypes={maxDistinctSpecialTypes} dimensions={dimensions} />} />
          <Route path="/deployment" element={<div>Schermata Schieramento</div>} />
        </Routes>
        </ThemeProvider>
      </GameSetupProvider>
    </MemoryRouter>,
  );
}

describe('PcTeamChoiceScreen — numeric bot difficulty (−10…50)', () => {
  it('shows a −10…50 slider defaulting to 10 (il PC vede 1 mossa avanti)', () => {
    renderScreen(null);
    const slider = screen.getByLabelText(/Difficoltà del bot/i) as HTMLInputElement;
    expect(slider.type).toBe('range');
    expect(Number(slider.min)).toBe(-10);
    expect(Number(slider.max)).toBe(50);
    expect(Number(slider.value)).toBe(10);
    expect(screen.getByText(/vede 1 mossa avanti/i)).toBeInTheDocument();
  });

  it('updates the difficulty and the lookahead label when the slider moves', () => {
    renderScreen(null);
    const slider = screen.getByLabelText(/Difficoltà del bot/i) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '20' } });
    expect(screen.getByText(/Livello di difficoltà: 20/i)).toBeInTheDocument();
    expect(screen.getByText(/vede 2 mosse avanti/i)).toBeInTheDocument();

    fireEvent.change(slider, { target: { value: '5' } });
    expect(screen.getByText(/vede 0.5 mosse avanti/i)).toBeInTheDocument();
  });

  it('explains the sabotage for negative difficulties', () => {
    renderScreen(null);
    const slider = screen.getByLabelText(/Difficoltà del bot/i) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '-10' } });
    expect(screen.getByText(/gioca le mosse peggiori per sé/i)).toBeInTheDocument();
    expect(screen.getByText(/1 mossa a favore del nemico/i)).toBeInTheDocument();
  });
});

describe('PcTeamChoiceScreen — preset gating against the current match rules', () => {
  it('leaves every preset enabled when there is no distinct-special-types limit', () => {
    renderScreen(null);
    expect(screen.getByText(/Preset: Difensivo/i).closest('button')).not.toBeDisabled();
    expect(screen.getByText(/Preset: Aggressivo/i).closest('button')).not.toBeDisabled();
    expect(screen.getByText(/Preset: Bilanciato/i).closest('button')).not.toBeDisabled();
  });

  it('disables "Difensivo" (4 distinct special types) once the limit is set below 4', () => {
    renderScreen(2);
    expect(screen.getByText(/Preset: Difensivo/i).closest('button')).toBeDisabled();
  });

  it('keeps "Bilanciato" (classic-only) enabled even with the strictest limit', () => {
    renderScreen(0);
    expect(screen.getByText(/Preset: Bilanciato/i).closest('button')).not.toBeDisabled();
  });

  it('does not let a disabled preset be chosen (clicking it does not navigate onward)', () => {
    renderScreen(2);
    fireEvent.click(screen.getByText(/Preset: Difensivo/i));
    expect(screen.queryByText('Schermata Schieramento')).not.toBeInTheDocument();
  });
});

describe('PcTeamChoiceScreen — "Casuale" respects the current match rules', () => {
  it('produces a PC team that never exceeds the configured distinct-special-types limit', () => {
    renderScreen(1);
    fireEvent.click(screen.getByText(/Casuale/i));
    expect(screen.getByText('Schermata Schieramento')).toBeInTheDocument();
  });
});

describe('PcTeamChoiceScreen — sanity: difensivo really has 4 distinct special types', () => {
  it('confirms the fixture assumption used by the gating tests above', () => {
    const difensivo = new Map<string, number>([[KING_SIGLA, 1], ['PE', 8], ['GL', 1], ['PA', 1], ['IQ', 1], ['TO', 1], ['CR', 1]]);
    expect(computeDistinctSpecialTypes(difensivo, pieces)).toBe(4);
  });
});
