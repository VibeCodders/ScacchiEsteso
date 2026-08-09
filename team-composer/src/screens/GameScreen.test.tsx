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
