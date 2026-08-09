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
    expect(screen.getByText(/gioco come Giocatore A/i)).toBeInTheDocument();
    expect(screen.getByText(/gioco come Giocatore B/i)).toBeInTheDocument();
  });

  it('choosing PvP navigates to the Team Select screen for Giocatore 1', () => {
    renderApp('/');
    fireEvent.click(screen.getByText(/PvP locale/i));
    expect(screen.getByText(/Composizione Team — Giocatore 1/i)).toBeInTheDocument();
  });

  it('"Enciclopedia dei pezzi" from Home navigates to the piece encyclopedia', () => {
    renderApp('/');
    fireEvent.click(screen.getByText(/Enciclopedia dei pezzi/i));
    expect(screen.getByText(/Enciclopedia dei pezzi/i, { selector: 'h1' })).toBeInTheDocument();
  });

  it('mounts the piece encyclopedia directly when navigated to "/pieces"', () => {
    renderApp('/pieces');
    expect(screen.getByRole('heading', { name: /Enciclopedia dei pezzi/i })).toBeInTheDocument();
  });

  it('completing Giocatore 1 in PvP mode navigates straight to Giocatore 2 (not the PC choice screen)', () => {
    renderApp('/');
    fireEvent.click(screen.getByText(/PvP locale/i));
    fireEvent.click(screen.getByText(/Conferma Team Giocatore 1/i));
    expect(screen.getByText(/Composizione Team — Giocatore 2/i)).toBeInTheDocument();
  });

  it('completing the human team in PvC (playing A) routes through the PC team choice screen', () => {
    renderApp('/');
    fireEvent.click(screen.getByText(/gioco come Giocatore A/i));
    fireEvent.click(screen.getByText(/Conferma Team Giocatore 1/i));
    expect(screen.getByText(/Come vuoi comporre l'esercito avversario/i)).toBeInTheDocument();
  });

  it('choosing to play as B in PvC routes straight to the PC team choice screen (PC composes first)', () => {
    renderApp('/');
    fireEvent.click(screen.getByText(/gioco come Giocatore B/i));
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
  it('offers a difficulty selector plus manual, three presets, mirror and random options', () => {
    renderApp('/');
    fireEvent.click(screen.getByText(/gioco come Giocatore A/i));
    fireEvent.click(screen.getByText(/Conferma Team Giocatore 1/i));

    expect(screen.getByText(/Facile/i)).toBeInTheDocument();
    expect(screen.getByText(/Medio/i)).toBeInTheDocument();
    expect(screen.getByText(/Difficile/i)).toBeInTheDocument();
    expect(screen.getByText(/Manuale — lo compongo io/i)).toBeInTheDocument();
    expect(screen.getByText(/Bilanciato/i)).toBeInTheDocument();
    expect(screen.getByText(/Aggressivo/i)).toBeInTheDocument();
    expect(screen.getByText(/Difensivo/i)).toBeInTheDocument();
    expect(screen.getByText(/Specchio — copia il mio team/i)).toBeInTheDocument();
    expect(screen.getByText(/Casuale — genera entro il budget/i)).toBeInTheDocument();
  });

  it('choosing a preset skips straight to Deployment when the human already composed first (playing A)', () => {
    renderApp('/');
    fireEvent.click(screen.getByText(/gioco come Giocatore A/i));
    fireEvent.click(screen.getByText(/Conferma Team Giocatore 1/i));
    fireEvent.click(screen.getByText(/Preset: Bilanciato/i));

    expect(screen.getByRole('heading', { name: /Schieramento/i })).toBeInTheDocument();
  });

  it('choosing manual routes to the Team A select screen labeled for the PC when the human plays B', () => {
    renderApp('/');
    fireEvent.click(screen.getByText(/gioco come Giocatore B/i));
    fireEvent.click(screen.getByText(/Manuale — lo compongo io/i));

    expect(screen.getByText(/Composizione Team — PC \(manuale\)/i)).toBeInTheDocument();
  });

  it('choosing a preset when the PC composes first (human plays B) routes to the human\'s own team select screen next', () => {
    renderApp('/');
    fireEvent.click(screen.getByText(/gioco come Giocatore B/i));
    fireEvent.click(screen.getByText(/Preset: Bilanciato/i));

    expect(screen.getByText(/Composizione Team — Giocatore 1/i)).toBeInTheDocument();
  });

  it('choosing manual routes to the Team B select screen labeled for the PC when the human plays A', () => {
    renderApp('/');
    fireEvent.click(screen.getByText(/gioco come Giocatore A/i));
    fireEvent.click(screen.getByText(/Conferma Team Giocatore 1/i));
    fireEvent.click(screen.getByText(/Manuale — lo compongo io/i));

    expect(screen.getByText(/Composizione Team — PC \(manuale\)/i)).toBeInTheDocument();
  });
});
