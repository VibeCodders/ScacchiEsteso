import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { GameSetupProvider } from './context/GameSetupContext';

function renderApp(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <GameSetupProvider>
        <App />
      </GameSetupProvider>
    </MemoryRouter>,
  );
}

describe('routing skeleton', () => {
  it('mounts Home at "/" with both mode choices', () => {
    renderApp('/');
    expect(screen.getByText(/Scegli come giocare/i)).toBeInTheDocument();
    expect(screen.getByText(/PvP locale/i)).toBeInTheDocument();
    expect(screen.getByText(/PvC \(contro il PC\)/i)).toBeInTheDocument();
  });

  it('choosing PvP navigates to the Team Select screen for Giocatore 1', () => {
    renderApp('/');
    fireEvent.click(screen.getByText(/PvP locale/i));
    expect(screen.getByText(/Composizione Team — Giocatore 1/i)).toBeInTheDocument();
  });

  it('completing Giocatore 1 in PvP mode navigates straight to Giocatore 2 (not the PC choice screen)', () => {
    renderApp('/');
    fireEvent.click(screen.getByText(/PvP locale/i));
    fireEvent.click(screen.getByText(/Conferma Team Giocatore 1/i));
    expect(screen.getByText(/Composizione Team — Giocatore 2/i)).toBeInTheDocument();
  });

  it('completing the human team in PvC mode routes through the PC team choice screen', () => {
    renderApp('/');
    fireEvent.click(screen.getByText(/PvC \(contro il PC\)/i));
    fireEvent.click(screen.getByText(/Conferma Team Giocatore 1/i));
    expect(screen.getByText(/Come vuoi comporre l'esercito avversario/i)).toBeInTheDocument();
  });

  it('mounts the Deployment screen directly when navigated to "/deployment"', () => {
    renderApp('/deployment');
    expect(screen.getByRole('heading', { name: /Schieramento/i })).toBeInTheDocument();
  });

  it('mounts the Game screen directly when navigated to "/game"', () => {
    renderApp('/game');
    expect(screen.getByRole('heading', { name: /Partita/i })).toBeInTheDocument();
  });

  it('mounts the GameOver screen directly when navigated to "/game-over"', () => {
    renderApp('/game-over');
    expect(screen.getByText(/Fine Partita/i)).toBeInTheDocument();
  });
});

describe('PC team choice screen options', () => {
  it('offers manual, three presets, mirror and random options', () => {
    renderApp('/');
    fireEvent.click(screen.getByText(/PvC \(contro il PC\)/i));
    fireEvent.click(screen.getByText(/Conferma Team Giocatore 1/i));

    expect(screen.getByText(/Manuale — lo compongo io/i)).toBeInTheDocument();
    expect(screen.getByText(/Bilanciato/i)).toBeInTheDocument();
    expect(screen.getByText(/Aggressivo/i)).toBeInTheDocument();
    expect(screen.getByText(/Difensivo/i)).toBeInTheDocument();
    expect(screen.getByText(/Specchio — copia il mio team/i)).toBeInTheDocument();
    expect(screen.getByText(/Casuale — genera entro il budget/i)).toBeInTheDocument();
  });

  it('choosing a preset skips straight to Deployment', () => {
    renderApp('/');
    fireEvent.click(screen.getByText(/PvC \(contro il PC\)/i));
    fireEvent.click(screen.getByText(/Conferma Team Giocatore 1/i));
    fireEvent.click(screen.getByText(/Preset: Bilanciato/i));

    expect(screen.getByRole('heading', { name: /Schieramento/i })).toBeInTheDocument();
  });

  it('choosing manual routes to the Team B select screen labeled for the PC', () => {
    renderApp('/');
    fireEvent.click(screen.getByText(/PvC \(contro il PC\)/i));
    fireEvent.click(screen.getByText(/Conferma Team Giocatore 1/i));
    fireEvent.click(screen.getByText(/Manuale — lo compongo io/i));

    expect(screen.getByText(/Composizione Team — PC \(manuale\)/i)).toBeInTheDocument();
  });
});
