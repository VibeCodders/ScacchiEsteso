import { describe, expect, it } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import GameScreen from './GameScreen';
import GameOverScreen from './GameOverScreen';
import { GameSetupProvider } from '../context/GameSetupContext';
import { useGameSetup } from '../context/gameSetup';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState } from '../game/board';
import { KING_SIGLA } from '../data/pieces';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A') {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

function Bootstrap({ board }: { board: BoardState }) {
  const { setDeployedBoard, setMode, deployedBoard } = useGameSetup();
  useEffect(() => {
    setMode('pvp');
    setDeployedBoard(board);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!deployedBoard) return null;
  return <GameScreen />;
}

function renderGame(board: BoardState) {
  return render(
    <MemoryRouter>
      <GameSetupProvider>
        <Bootstrap board={board} />
      </GameSetupProvider>
    </MemoryRouter>,
  );
}

describe('GameScreen — fallback when there is no deployed board', () => {
  it('shows a message and a way back to Home instead of crashing', () => {
    render(
      <MemoryRouter>
        <GameSetupProvider>
          <GameScreen />
        </GameSetupProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText(/Nessuno schieramento trovato/i)).toBeInTheDocument();
  });
});

describe('GameScreen — playable match', () => {
  it('renders the deployed board and starts with Player A to move', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'TO', 'A');
    renderGame(board);

    expect(screen.getByTestId('board')).toBeInTheDocument();
    expect(screen.getByText(/Turno: Giocatore 1/i)).toBeInTheDocument();
  });

  it('selecting a piece highlights its legal destinations, and clicking one moves it', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'TO', 'A');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    expect(document.querySelector('[data-coord="d8"]')).toHaveClass('board-square-highlighted');

    fireEvent.click(document.querySelector('[data-coord="d8"]')!);
    expect(document.querySelector('[data-coord="d4"]')?.querySelector('svg')).toBeNull();
    expect(document.querySelector('[data-coord="d8"]')?.querySelector('svg')).not.toBeNull();
  });

  it('moves a piece via drag and drop, just like click-to-move', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'TO', 'A');
    renderGame(board);

    const draggedPiece = document.querySelector('[data-coord="d4"] span[draggable]')!;
    fireEvent.dragStart(draggedPiece, { dataTransfer: { setData: () => {} } });
    expect(document.querySelector('[data-coord="d8"]')).toHaveClass('board-square-highlighted');

    fireEvent.drop(document.querySelector('[data-coord="d8"]')!, { dataTransfer: { getData: () => '' } });
    expect(document.querySelector('[data-coord="d4"]')?.querySelector('svg')).toBeNull();
    expect(document.querySelector('[data-coord="d8"]')?.querySelector('svg')).not.toBeNull();
    expect(screen.getByText(/Turno: Giocatore 2/i)).toBeInTheDocument();
  });

  it('does not let dragging start from an opponent\'s piece', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd7', 'PE', 'B');
    renderGame(board);

    const draggedPiece = document.querySelector('[data-coord="d7"] span[draggable]')!;
    fireEvent.dragStart(draggedPiece, { dataTransfer: { setData: () => {} } });
    expect(document.querySelector('[data-coord="d7"]')).not.toHaveClass('board-square-selected');
  });

  it('switches turn and auto-rotates the board after a move', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'TO', 'A');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    fireEvent.click(document.querySelector('[data-coord="d6"]')!);

    expect(screen.getByText(/Turno: Giocatore 2/i)).toBeInTheDocument();
    expect(screen.getByTestId('board')).toHaveAttribute('data-orientation', 'B');
    expect(screen.getByTestId('board')).toHaveClass('board-rotated');
  });

  it('records the move in the history panel', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'TO', 'A');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    fireEvent.click(document.querySelector('[data-coord="d6"]')!);

    expect(screen.getByText(/TO d4 → d6/i)).toBeInTheDocument();
  });

  it('lists a captured piece in the captured panel', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'TO', 'A');
    board = place(board, 'd7', 'PE', 'B');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    fireEvent.click(document.querySelector('[data-coord="d7"]')!);

    expect(screen.getByText((_, el) => el?.textContent === 'Giocatore 2: PE')).toBeInTheDocument();
  });

  it('deselects when clicking the already-selected square again', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'TO', 'A');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    expect(document.querySelector('[data-coord="d8"]')).toHaveClass('board-square-highlighted');
    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    expect(document.querySelector('[data-coord="d8"]')).not.toHaveClass('board-square-highlighted');
  });

  it('shows the manual rotation toggle and lets the player flip perspective at will', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    renderGame(board);

    fireEvent.click(screen.getByText(/Gira scacchiera/i));
    expect(screen.getByTestId('board')).toHaveClass('board-rotated');
  });
});

describe('GameScreen — game over banner', () => {
  it('shows a checkmate banner instead of allowing further moves, with a button to see the result', () => {
    let board = place(createEmptyBoard(), 'h1', KING_SIGLA, 'B');
    board = place(board, 'a1', KING_SIGLA, 'A');
    board = place(board, 'a8', 'TO', 'B');
    board = place(board, 'b8', 'TO', 'B');
    renderGame(board);

    // It is Player A's turn and A is already checkmated by the two rooks — the banner should show immediately.
    expect(screen.getByText(/Scacco matto/i)).toBeInTheDocument();
    expect(screen.getByText(/Vedi risultato/i)).toBeInTheDocument();
  });

  it('navigates onward when "Vedi risultato" is clicked', () => {
    let board = place(createEmptyBoard(), 'h1', KING_SIGLA, 'B');
    board = place(board, 'a1', KING_SIGLA, 'A');
    board = place(board, 'a8', 'TO', 'B');
    board = place(board, 'b8', 'TO', 'B');

    render(
      <MemoryRouter initialEntries={['/game']}>
        <GameSetupProvider>
          <Routes>
            <Route path="/game" element={<Bootstrap board={board} />} />
            <Route path="/game-over" element={<GameOverScreen />} />
          </Routes>
        </GameSetupProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText(/Vedi risultato/i));
    expect(screen.getByText(/Fine Partita/i)).toBeInTheDocument();
    expect(screen.getByText(/Scacco matto — vince Giocatore 2/i)).toBeInTheDocument();
  });
});

describe('GameScreen — pawn promotion', () => {
  it('shows a promotion dialog with the Pawn\'s options when it reaches the back rank', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd7', 'PE', 'A');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d7"]')!);
    fireEvent.click(document.querySelector('[data-coord="d8"]')!);

    expect(screen.getByText(/Scegli la promozione/i)).toBeInTheDocument();
    expect(screen.getByText(/PE — Pedone/)).toBeInTheDocument();
    expect(screen.getByText(/AL — Alfiere/)).toBeInTheDocument();
    expect(screen.getByText(/CA — Cavallo/)).toBeInTheDocument();
    expect(screen.getByText(/SP — Spettro/)).toBeInTheDocument();

    // the move is not committed yet — the pawn is still on d7 until a choice is made
    expect(document.querySelector('[data-coord="d7"]')?.querySelector('svg')).not.toBeNull();
  });

  it('replaces the pawn with the chosen piece once an option is picked', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd7', 'PE', 'A');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d7"]')!);
    fireEvent.click(document.querySelector('[data-coord="d8"]')!);
    fireEvent.click(screen.getByText(/AL — Alfiere/));

    expect(screen.queryByText(/Scegli la promozione/i)).not.toBeInTheDocument();
    expect(document.querySelector('[data-coord="d7"]')?.querySelector('svg')).toBeNull();
    expect(document.querySelector('[data-coord="d8"]')?.querySelector('svg')?.getAttribute('aria-label')).toBe('AL');
    expect(screen.getByText(/promosso a AL/i)).toBeInTheDocument();
  });

  it('auto-promotes the Pedone di Dama to Damone without showing a dialog (only one option)', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd7', 'DA', 'A');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d7"]')!);
    fireEvent.click(document.querySelector('[data-coord="d8"]')!);

    expect(screen.queryByText(/Scegli la promozione/i)).not.toBeInTheDocument();
    expect(document.querySelector('[data-coord="d8"]')?.querySelector('svg')?.getAttribute('aria-label')).toBe('DM');
  });
});

describe('GameScreen — Berserker bonus move', () => {
  it('shows the bonus-move banner and highlights the Berserker\'s square after a melee capture', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'BE', 'A');
    board = place(board, 'd5', 'PE', 'B');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    fireEvent.click(document.querySelector('[data-coord="d5"]')!);

    expect(screen.getByText(/Movimento extra Berserker disponibile/i)).toBeInTheDocument();
    expect(document.querySelector('[data-coord="d5"]')).toHaveClass('board-square-selected');
    expect(screen.getByText(/Turno: Giocatore 1/i)).toBeInTheDocument(); // turn hasn't passed yet
  });

  it('completing the bonus move passes the turn and hides the banner', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'BE', 'A');
    board = place(board, 'd5', 'PE', 'B');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    fireEvent.click(document.querySelector('[data-coord="d5"]')!);
    fireEvent.click(document.querySelector('[data-coord="d6"]')!);

    expect(screen.queryByText(/Movimento extra Berserker disponibile/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Turno: Giocatore 2/i)).toBeInTheDocument();
    expect(document.querySelector('[data-coord="d6"]')?.querySelector('svg')).not.toBeNull();
  });

  it('"Salta movimento extra" declines the bonus and passes the turn', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'BE', 'A');
    board = place(board, 'd5', 'PE', 'B');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    fireEvent.click(document.querySelector('[data-coord="d5"]')!);
    fireEvent.click(screen.getByText(/Salta movimento extra/i));

    expect(screen.getByText(/Turno: Giocatore 2/i)).toBeInTheDocument();
    expect(document.querySelector('[data-coord="d5"]')?.querySelector('svg')?.getAttribute('aria-label')).toBe('BE');
  });

  it('ignores clicks on other pieces while a bonus move is pending', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'BE', 'A');
    board = place(board, 'd5', 'PE', 'B');
    board = place(board, 'a1', 'TO', 'A');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    fireEvent.click(document.querySelector('[data-coord="d5"]')!);
    fireEvent.click(document.querySelector('[data-coord="a1"]')!); // try to select the rook instead

    expect(screen.getByText(/Movimento extra Berserker disponibile/i)).toBeInTheDocument();
    expect(document.querySelector('[data-coord="d5"]')).toHaveClass('board-square-selected');
  });
});

describe('GameScreen — Arciere scocca', () => {
  it('shows the "Scoccare" toggle only when an Arciere is selected', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'AR', 'A');
    board = place(board, 'a1', 'TO', 'A');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="a1"]')!);
    expect(screen.queryByText(/Scoccare/i)).not.toBeInTheDocument();

    fireEvent.click(document.querySelector('[data-coord="a1"]')!); // deselect
    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    expect(screen.getByText(/🏹 Scoccare/i)).toBeInTheDocument();
  });

  it('entering scocca mode highlights ranged targets instead of normal move destinations', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'AR', 'A');
    board = place(board, 'd7', 'PE', 'B');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    expect(document.querySelector('[data-coord="d7"]')).not.toHaveClass('board-square-highlighted');

    fireEvent.click(screen.getByText(/🏹 Scoccare/i));
    expect(document.querySelector('[data-coord="d7"]')).toHaveClass('board-square-highlighted');
    expect(document.querySelector('[data-coord="d5"]')).not.toHaveClass('board-square-highlighted'); // normal move square, not a scocca target
  });

  it('eliminates the target without moving the Arciere, and passes the turn', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'AR', 'A');
    board = place(board, 'd7', 'PE', 'B');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    fireEvent.click(screen.getByText(/🏹 Scoccare/i));
    fireEvent.click(document.querySelector('[data-coord="d7"]')!);

    expect(document.querySelector('[data-coord="d4"]')?.querySelector('svg')?.getAttribute('aria-label')).toBe('AR');
    expect(document.querySelector('[data-coord="d7"]')?.querySelector('svg')).toBeNull();
    expect(screen.getByText(/Turno: Giocatore 2/i)).toBeInTheDocument();
    expect(screen.getByText(/\(scocca\)/i)).toBeInTheDocument();
  });

  it('"Annulla Scoccare" returns to normal move highlighting', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'AR', 'A');
    board = place(board, 'd7', 'PE', 'B');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    fireEvent.click(screen.getByText(/🏹 Scoccare/i));
    fireEvent.click(screen.getByText(/Annulla Scoccare/i));

    expect(document.querySelector('[data-coord="d5"]')).toHaveClass('board-square-highlighted'); // back to normal moves
    expect(document.querySelector('[data-coord="d7"]')).not.toHaveClass('board-square-highlighted');
  });
});

describe('GameScreen — Mistico swap', () => {
  it('shows the "Scambia posizione" toggle only when a Mistico is selected', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'MI', 'A');
    board = place(board, 'a1', 'TO', 'A');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="a1"]')!);
    expect(screen.queryByText(/Scambia posizione/i)).not.toBeInTheDocument();

    fireEvent.click(document.querySelector('[data-coord="a1"]')!); // deselect
    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    expect(screen.getByText(/🔀 Scambia posizione/i)).toBeInTheDocument();
  });

  it('entering swap mode highlights adjacent allies instead of normal move destinations', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'MI', 'A');
    board = place(board, 'd5', 'CA', 'A');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    expect(document.querySelector('[data-coord="b4"]')).toHaveClass('board-square-highlighted'); // normal move square (west, unblocked)

    fireEvent.click(screen.getByText(/🔀 Scambia posizione/i));
    expect(document.querySelector('[data-coord="d5"]')).toHaveClass('board-square-highlighted'); // adjacent ally
    expect(document.querySelector('[data-coord="b4"]')).not.toHaveClass('board-square-highlighted');
  });

  it('swaps the two pieces and passes the turn', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'MI', 'A');
    board = place(board, 'd5', 'CA', 'A');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    fireEvent.click(screen.getByText(/🔀 Scambia posizione/i));
    fireEvent.click(document.querySelector('[data-coord="d5"]')!);

    expect(document.querySelector('[data-coord="d5"]')?.querySelector('svg')?.getAttribute('aria-label')).toBe('MI');
    expect(document.querySelector('[data-coord="d4"]')?.querySelector('svg')?.getAttribute('aria-label')).toBe('CA');
    expect(screen.getByText(/Turno: Giocatore 2/i)).toBeInTheDocument();
    expect(screen.getByText(/\(scambio\)/i)).toBeInTheDocument();
  });

  it('"Annulla Scambio" returns to normal move highlighting', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'MI', 'A');
    board = place(board, 'd5', 'CA', 'A');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    fireEvent.click(screen.getByText(/🔀 Scambia posizione/i));
    fireEvent.click(screen.getByText(/Annulla Scambio/i));

    expect(document.querySelector('[data-coord="b4"]')).toHaveClass('board-square-highlighted'); // back to normal moves
    expect(document.querySelector('[data-coord="d5"]')).not.toHaveClass('board-square-highlighted');
  });
});

describe('GameScreen — Necromante revival', () => {
  it('shows the "Rianima alleato" toggle only once the graveyard has a "pedone"-category piece to revive', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'NE', 'A');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    expect(screen.queryByText(/Rianima alleato/i)).not.toBeInTheDocument(); // empty graveyard
  });

  it('auto-applies the revival when the graveyard has only one revivable sigla', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'h1', 'CR', 'A');
    board = place(board, 'a4', 'PE', 'A');
    board = place(board, 'd4', 'NE', 'A');
    board = place(board, 'a8', 'TO', 'B');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="h1"]')!); // A: harmless move
    fireEvent.click(document.querySelector('[data-coord="h3"]')!);
    fireEvent.click(document.querySelector('[data-coord="a8"]')!); // B: captures A's pawn
    fireEvent.click(document.querySelector('[data-coord="a4"]')!);

    expect(screen.getByText(/Turno: Giocatore 1/i)).toBeInTheDocument();

    fireEvent.click(document.querySelector('[data-coord="d4"]')!); // select the Necromante
    fireEvent.click(screen.getByText(/🧟 Rianima alleato/i));
    fireEvent.click(document.querySelector('[data-coord="d5"]')!); // adjacent empty square

    expect(screen.queryByText(/Chi rianimare/i)).not.toBeInTheDocument(); // no dialog — only one option
    expect(document.querySelector('[data-coord="d5"]')?.querySelector('svg')?.getAttribute('aria-label')).toBe('PE');
    expect(screen.getByText(/Turno: Giocatore 2/i)).toBeInTheDocument();
    expect(screen.getByText(/\(rianimato PE\)/i)).toBeInTheDocument();
  });

  it('shows a choice dialog when the graveyard has more than one revivable sigla', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'h1', 'CR', 'A');
    board = place(board, 'a4', 'PE', 'A');
    board = place(board, 'b4', 'PG', 'A');
    board = place(board, 'd4', 'NE', 'A');
    board = place(board, 'a8', 'TO', 'B');
    board = place(board, 'd5', 'CA', 'B');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="h1"]')!); // A: harmless move
    fireEvent.click(document.querySelector('[data-coord="h3"]')!);
    fireEvent.click(document.querySelector('[data-coord="a8"]')!); // B: captures the Pedone
    fireEvent.click(document.querySelector('[data-coord="a4"]')!);
    fireEvent.click(document.querySelector('[data-coord="h3"]')!); // A: another harmless move
    fireEvent.click(document.querySelector('[data-coord="h5"]')!);
    fireEvent.click(document.querySelector('[data-coord="d5"]')!); // B: captures the Paggio
    fireEvent.click(document.querySelector('[data-coord="b4"]')!);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!); // select the Necromante
    fireEvent.click(screen.getByText(/🧟 Rianima alleato/i));
    fireEvent.click(document.querySelector('[data-coord="d5"]')!); // now empty again

    expect(screen.getByText(/Chi rianimare/i)).toBeInTheDocument();
    expect(screen.getByText(/PE — Pedone/i)).toBeInTheDocument();
    expect(screen.getByText(/PG — Paggio/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/PG — Paggio/i));
    expect(document.querySelector('[data-coord="d5"]')?.querySelector('svg')?.getAttribute('aria-label')).toBe('PG');
  });

  it('"Annulla Rianimazione" returns to normal move highlighting', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'h1', 'CR', 'A');
    board = place(board, 'a4', 'PE', 'A');
    board = place(board, 'd4', 'NE', 'A');
    board = place(board, 'a8', 'TO', 'B');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="h1"]')!);
    fireEvent.click(document.querySelector('[data-coord="h3"]')!);
    fireEvent.click(document.querySelector('[data-coord="a8"]')!);
    fireEvent.click(document.querySelector('[data-coord="a4"]')!);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    fireEvent.click(screen.getByText(/🧟 Rianima alleato/i));
    fireEvent.click(screen.getByText(/Annulla Rianimazione/i));

    expect(document.querySelector('[data-coord="e5"]')).toHaveClass('board-square-highlighted'); // back to normal (diagonal) moves
    expect(document.querySelector('[data-coord="d5"]')).not.toHaveClass('board-square-highlighted');
  });
});

describe('GameScreen — Orfano mimicry', () => {
  it('highlights its normal 1-square moves when not under threat', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'OR', 'A');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    expect(document.querySelector('[data-coord="d5"]')).toHaveClass('board-square-highlighted');
    expect(screen.queryByText(/L'Orfano è sotto scacco/i)).not.toBeInTheDocument();
  });

  it('auto-selects the single threat and highlights the mimicked piece\'s moves', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'OR', 'A');
    board = place(board, 'd8', 'TO', 'B'); // threatens d4 along the d-file — Torre-style moves
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    expect(screen.getByText(/imita TO da d8/i)).toBeInTheDocument();
    expect(document.querySelector('[data-coord="a4"]')).toHaveClass('board-square-highlighted'); // reachable only by sliding
    expect(document.querySelector('[data-coord="d5"]')).toHaveClass('board-square-highlighted'); // also reachable via the d-file
  });

  it('shows a choice dialog with multiple threats and applies the chosen mimicry', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'OR', 'A');
    board = place(board, 'd8', 'TO', 'B'); // slide threat
    board = place(board, 'c6', 'CA', 'B'); // knight threat
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    expect(screen.getByText(/Chi imitare/i)).toBeInTheDocument();
    expect(screen.getByText(/TO — Torre \(d8\)/i)).toBeInTheDocument();
    expect(screen.getByText(/CA — Cavallo \(c6\)/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/CA — Cavallo \(c6\)/i));
    expect(screen.queryByText(/Chi imitare/i)).not.toBeInTheDocument();
    expect(screen.getByText(/imita CA da c6/i)).toBeInTheDocument();
    expect(document.querySelector('[data-coord="b5"]')).toHaveClass('board-square-highlighted'); // a knight-shaped destination
    expect(document.querySelector('[data-coord="d5"]')).not.toHaveClass('board-square-highlighted'); // not reachable by a knight jump
  });

  it('completing a mimicked move moves the Orfano and passes the turn', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'OR', 'A');
    board = place(board, 'd8', 'TO', 'B');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    fireEvent.click(document.querySelector('[data-coord="a4"]')!);

    expect(document.querySelector('[data-coord="a4"]')?.querySelector('svg')?.getAttribute('aria-label')).toBe('OR');
    expect(screen.getByText(/Turno: Giocatore 2/i)).toBeInTheDocument();
  });
});

describe('GameScreen — anti-stalemate (20 turns without progress)', () => {
  it('shows the anti-stalemate banner and result after 20 consecutive non-progress moves', () => {
    let board = place(createEmptyBoard(), 'a1', KING_SIGLA, 'A');
    board = place(board, 'h8', KING_SIGLA, 'B');
    board = place(board, 'b1', 'CA', 'A');
    board = place(board, 'g8', 'CA', 'B');
    board = place(board, 'd4', 'TO', 'A'); // extra material — A should win by score

    render(
      <MemoryRouter initialEntries={['/game']}>
        <GameSetupProvider>
          <Routes>
            <Route path="/game" element={<Bootstrap board={board} />} />
            <Route path="/game-over" element={<GameOverScreen />} />
          </Routes>
        </GameSetupProvider>
      </MemoryRouter>,
    );

    const squaresA: Array<[string, string]> = [['b1', 'a3'], ['a3', 'b1']];
    const squaresB: Array<[string, string]> = [['g8', 'h6'], ['h6', 'g8']];

    for (let ply = 0; ply < 20; ply++) {
      const isPlayerA = ply % 2 === 0;
      const pairIndex = Math.floor(ply / 2) % 2;
      const [from, to] = isPlayerA ? squaresA[pairIndex] : squaresB[pairIndex];
      fireEvent.click(document.querySelector(`[data-coord="${from}"]`)!);
      fireEvent.click(document.querySelector(`[data-coord="${to}"]`)!);
    }

    expect(screen.getByText(/Limite di 20 turni senza progressi — vince Giocatore 1 per punteggio/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Vedi risultato/i));
    expect(screen.getByText(/Fine Partita/i)).toBeInTheDocument();
    expect(screen.getByText(/Limite di 20 turni senza progressi — vince Giocatore 1 per punteggio/i)).toBeInTheDocument();
  });
});

function BootstrapPvc({ board, humanOwner }: { board: BoardState; humanOwner: 'A' | 'B' }) {
  const { setDeployedBoard, setMode, setHumanOwner, setBotDifficulty, deployedBoard } = useGameSetup();
  useEffect(() => {
    setMode('pvc');
    setHumanOwner(humanOwner);
    setBotDifficulty('easy'); // depth 1 — fast and deterministic-enough for a test
    setDeployedBoard(board);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!deployedBoard) return null;
  return <GameScreen />;
}

function renderPvcGame(board: BoardState, humanOwner: 'A' | 'B') {
  return render(
    <MemoryRouter>
      <GameSetupProvider>
        <BootstrapPvc board={board} humanOwner={humanOwner} />
      </GameSetupProvider>
    </MemoryRouter>,
  );
}

describe('GameScreen — PvC bot auto-play', () => {
  it("plays the bot's turn automatically, with no click required, once the human (playing A) moves", () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'a1', 'TO', 'A');
    board = place(board, 'h8', 'TO', 'B');
    renderPvcGame(board, 'A');

    expect(screen.getByText(/Turno: Giocatore 1/i)).toBeInTheDocument();
    fireEvent.click(document.querySelector('[data-coord="a1"]')!);
    fireEvent.click(document.querySelector('[data-coord="a4"]')!);

    // it's now the PC's (owner B's) turn — the effect should have already resolved it back to A
    // without any further interaction from the test. Two moves should now be in the history: the
    // human's, plus the PC's automatic reply.
    expect(screen.getByText(/Turno: Giocatore 1/i)).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it("plays the bot's turn automatically, with no click required, when the human plays B (the PC moves first)", () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'a1', 'TO', 'A');
    board = place(board, 'h8', 'TO', 'B');
    renderPvcGame(board, 'B');

    // the PC (owner A) should have already played automatically on mount, before any human input.
    expect(screen.getByText(/Turno: Giocatore 1/i)).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('does not let the human move the PC\'s pieces during the PC\'s turn', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'a1', 'TO', 'A');
    board = place(board, 'h8', 'TO', 'B');
    renderPvcGame(board, 'B');

    // it's owner A's (the PC's) turn only for the very first render, but even then clicking one
    // of its pieces must not select it for the human — selection stays a no-op until it's B's turn.
    fireEvent.click(document.querySelector('[data-coord="a1"]')!);
    expect(document.querySelector('[data-coord="a1"]')).not.toHaveClass('board-square-selected');
  });
});
