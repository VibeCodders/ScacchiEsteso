import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { GameSetupProvider } from './context/GameSetupContext';
import { ThemeProvider } from './context/ThemeContext';

function renderApp(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <GameSetupProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </GameSetupProvider>
    </MemoryRouter>,
  );
}

/** Home always routes through "Impostazioni partita" before team composition — accept the 8×8/no-limit defaults and move on. */
function continueFromGameSettings() {
  fireEvent.click(screen.getByText(/Continua →/i));
}

describe('routing skeleton', () => {
  it('mounts Home at "/" with both mode choices', () => {
    renderApp('/');
    expect(screen.getByText(/Scegli come giocare/i)).toBeInTheDocument();
    expect(screen.getByText(/PvP locale/i)).toBeInTheDocument();
    expect(screen.getByText(/gioco come Giocatore A/i)).toBeInTheDocument();
    expect(screen.getByText(/gioco come Giocatore B/i)).toBeInTheDocument();
  });

  it('choosing PvP navigates to Game Settings, then to the Team Select screen for Giocatore 1', () => {
    renderApp('/');
    fireEvent.click(screen.getByText(/PvP locale/i));
    expect(screen.getByRole('heading', { name: /Impostazioni partita/i })).toBeInTheDocument();

    continueFromGameSettings();
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

  it('mounts Game Settings directly when navigated to "/game-settings"', () => {
    renderApp('/game-settings');
    expect(screen.getByRole('heading', { name: /Impostazioni partita/i })).toBeInTheDocument();
  });

  it('completing Giocatore 1 in PvP mode navigates straight to Giocatore 2 (not the PC choice screen)', () => {
    renderApp('/');
    fireEvent.click(screen.getByText(/PvP locale/i));
    continueFromGameSettings();
    fireEvent.click(screen.getByText(/Conferma Team Giocatore 1/i));
    expect(screen.getByText(/Composizione Team — Giocatore 2/i)).toBeInTheDocument();
  });

  it('completing the human team in PvC (playing A) routes through the PC team choice screen', () => {
    renderApp('/');
    fireEvent.click(screen.getByText(/gioco come Giocatore A/i));
    continueFromGameSettings();
    fireEvent.click(screen.getByText(/Conferma Team Giocatore 1/i));
    expect(screen.getByText(/Come vuoi comporre l'esercito avversario/i)).toBeInTheDocument();
  });

  it('choosing to play as B in PvC routes straight to the PC team choice screen (PC composes first)', () => {
    renderApp('/');
    fireEvent.click(screen.getByText(/gioco come Giocatore B/i));
    continueFromGameSettings();
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
    continueFromGameSettings();
    fireEvent.click(screen.getByText(/Conferma Team Giocatore 1/i));

    // Difficulty is a numeric 1–50 slider (default 10 = the PC sees 1 mossa ahead).
    const slider = screen.getByLabelText(/Difficoltà del bot/i) as HTMLInputElement;
    expect(slider.type).toBe('range');
    expect(Number(slider.min)).toBe(1);
    expect(Number(slider.max)).toBe(50);
    expect(Number(slider.value)).toBe(10);
    expect(screen.getByText(/vede 1 mossa avanti/i)).toBeInTheDocument();
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
    continueFromGameSettings();
    fireEvent.click(screen.getByText(/Conferma Team Giocatore 1/i));
    fireEvent.click(screen.getByText(/Preset: Bilanciato/i));

    expect(screen.getByRole('heading', { name: /Schieramento/i })).toBeInTheDocument();
  });

  it('choosing manual routes to the Team A select screen labeled for the PC when the human plays B', () => {
    renderApp('/');
    fireEvent.click(screen.getByText(/gioco come Giocatore B/i));
    continueFromGameSettings();
    fireEvent.click(screen.getByText(/Manuale — lo compongo io/i));

    expect(screen.getByText(/Composizione Team — PC \(manuale\)/i)).toBeInTheDocument();
  });

  it('choosing a preset when the PC composes first (human plays B) routes to the human\'s own team select screen next', () => {
    renderApp('/');
    fireEvent.click(screen.getByText(/gioco come Giocatore B/i));
    continueFromGameSettings();
    fireEvent.click(screen.getByText(/Preset: Bilanciato/i));

    expect(screen.getByText(/Composizione Team — Giocatore 1/i)).toBeInTheDocument();
  });

  it('choosing manual routes to the Team B select screen labeled for the PC when the human plays A', () => {
    renderApp('/');
    fireEvent.click(screen.getByText(/gioco come Giocatore A/i));
    continueFromGameSettings();
    fireEvent.click(screen.getByText(/Conferma Team Giocatore 1/i));
    fireEvent.click(screen.getByText(/Manuale — lo compongo io/i));

    expect(screen.getByText(/Composizione Team — PC \(manuale\)/i)).toBeInTheDocument();
  });
});

describe('Game Settings screen', () => {
  it('defaults to the classic 8×8 board and no special-types limit', () => {
    renderApp('/');
    fireEvent.click(screen.getByText(/PvP locale/i));

    expect(screen.getAllByDisplayValue('8')).toHaveLength(2); // width and height inputs, both default 8
    expect(screen.getByText(/Nessun limite/i)).toBeInTheDocument();
  });

  it('blocks continuing with a board dimension below the minimum', () => {
    renderApp('/');
    fireEvent.click(screen.getByText(/PvP locale/i));

    fireEvent.change(screen.getByLabelText(/Larghezza/i), { target: { value: '2' } });
    expect(screen.getByText(/✗ Impostazioni non valide/i)).toBeInTheDocument();
  });
});
