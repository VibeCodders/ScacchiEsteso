import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { render, screen } from '@testing-library/react';
import { GameSetupProvider } from '../context/GameSetupContext';
import { useGameSetup, type MatchResult, type GameMode } from '../context/gameSetup';
import { ThemeProvider } from '../context/ThemeContext';
import { createInitialGameState, type GameState } from '../game/turnManager';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState } from '../game/board';
import GameOverScreen from './GameOverScreen';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A') {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

/** Mounts a matchResult into the context and renders the results page (with a home route to catch navigation). */
function renderResult(result: MatchResult, mode: GameMode = 'pvp') {
  function BootstrapResult() {
    const { setMatchResult, setMode } = useGameSetup();
    useEffect(() => {
      setMode(mode);
      setMatchResult(result);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
  }
  function HomeProbe() {
    const location = useLocation();
    return <div>HOME — {location.pathname}</div>;
  }
  return render(
    <MemoryRouter initialEntries={['/game-over']}>
      <GameSetupProvider>
        <ThemeProvider>
          <BootstrapResult />
          <Routes>
            <Route path="/" element={<HomeProbe />} />
            <Route path="/game-over" element={<GameOverScreen />} />
          </Routes>
        </ThemeProvider>
      </GameSetupProvider>
    </MemoryRouter>,
  );
}

/** Final position: A (RE 15 + CA 15 + TO 27 = 57 pt) vs B (RE 15 + CA 15 = 30 pt), plus one captured PE each. */
function stalemateSnapshot(status: GameState['status'], winner?: 'A' | 'B'): GameState {
  let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
  board = place(board, 'b1', 'CA', 'A');
  board = place(board, 'd4', 'TO', 'A');
  board = place(board, 'h8', 'RE', 'B');
  board = place(board, 'g8', 'CA', 'B');
  const state = createInitialGameState(board);
  return {
    ...state,
    turnNumber: 21,
    status,
    winner,
    history: [
      { turnNumber: 1, owner: 'A', from: 'a1', to: 'a2', sigla: 'RE', isCapture: false },
      { turnNumber: 2, owner: 'B', from: 'h8', to: 'h7', sigla: 'RE', isCapture: false },
    ],
    captured: {
      A: [createPieceInstance('PE', 'B')], // A captured B's pawn
      B: [createPieceInstance('PE', 'A')], // B captured A's pawn
    },
  };
}

describe('GameOverScreen — dedicated results page', () => {
  it('shows the outcome, per-player stats and no moral banner on a checkmate', () => {
    renderResult({
      status: 'checkmate',
      winner: 'B',
      finalState: stalemateSnapshot('checkmate', 'B'),
    });

    expect(screen.getByText(/Scacco matto — vince Giocatore 2/i)).toBeInTheDocument();
    // Stats panel: moves played and total captures.
    expect(screen.getByText(/Mosse giocate:/i)).toBeInTheDocument();
    expect(screen.getAllByText('2')).toHaveLength(2); // history length + total captured pieces (1+1)
    // Remaining material per player (numbers are bolded in nested <strong>, so assert separately).
    expect(screen.getAllByText(/Punti rimasti sulla scacchiera:/i)).toHaveLength(2);
    expect(screen.getByText('57')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    // One captured pawn each.
    expect(screen.getAllByText(/Catturati all'avversario:/i)).toHaveLength(2);
    expect(screen.getAllByText('7 pt')).toHaveLength(2); // each side captured one 7pt pawn
    expect(screen.getAllByText(/Pezzi persi:/i)).toHaveLength(2);
    // No moral winner on checkmate.
    expect(screen.queryByText(/vincitore morale/i)).not.toBeInTheDocument();
  });

  it('declares a moral winner from the remaining points on an anti-stalemate', () => {
    renderResult({
      status: 'anti_stalemate',
      winner: 'A',
      finalState: stalemateSnapshot('anti_stalemate', 'A'),
    });

    expect(screen.getByText(/Limite di 20 turni senza progressi — vince Giocatore 1 per punteggio/i)).toBeInTheDocument();
    // The moral-winner banner confirms the official winner by points.
    expect(screen.getByText(/Vincitore morale: Giocatore 1 — 57 pt rimasti contro 30/i)).toBeInTheDocument();
    // The winner's card carries the medal badge (exact string: the banner paragraph also mentions it).
    expect(screen.getByText('🏅 vincitore morale')).toBeInTheDocument();
  });

  it('shows "nessun vincitore morale" when a stalemate leaves equal points', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    // Equal material: RE+CA (30 pt) vs RE+CA (30 pt).
    board = place(board, 'b1', 'CA', 'A');
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'g8', 'CA', 'B');
    const state = { ...stalemateSnapshot('stalemate'), board };

    renderResult({ status: 'stalemate', finalState: state });

    expect(screen.getByText(/Stallo — partita patta/i)).toBeInTheDocument();
    expect(screen.getByText(/🤝 Punti rimasti pari — nessun vincitore morale/i)).toBeInTheDocument();
    expect(screen.queryByText(/🏅 vincitore morale/i)).not.toBeInTheDocument();
  });

  it('falls back gracefully and can return home when no result is available', () => {
    function BootstrapEmpty() {
      const { setMode } = useGameSetup();
      useEffect(() => {
        setMode('pvp');
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return null;
    }
    render(
      <MemoryRouter initialEntries={['/game-over']}>
        <GameSetupProvider>
          <ThemeProvider>
            <BootstrapEmpty />
            <Routes>
              <Route path="/" element={<div>HOME</div>} />
              <Route path="/game-over" element={<GameOverScreen />} />
            </Routes>
          </ThemeProvider>
        </GameSetupProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Nessun risultato disponibile/i)).toBeInTheDocument();
    expect(screen.getByText(/Torna alla Home/i)).toBeInTheDocument();
  });
});
