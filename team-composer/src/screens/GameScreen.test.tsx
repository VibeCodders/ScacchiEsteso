import { describe, expect, it } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import GameScreen from './GameScreen';
import GameOverScreen from './GameOverScreen';
import { GameSetupProvider } from '../context/GameSetupContext';
import { ThemeProvider } from '../context/ThemeContext';
import { useGameSetup } from '../context/gameSetup';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState } from '../game/board';
import { KING_SIGLA } from '../data/pieces';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A') {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

function Bootstrap({ board, dimensions }: { board: BoardState; dimensions?: { width: number; height: number } }) {
  const { setDeployedBoard, setMode, setBoardDimensions, deployedBoard } = useGameSetup();
  useEffect(() => {
    setMode('pvp');
    if (dimensions) setBoardDimensions(dimensions);
    setDeployedBoard(board);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!deployedBoard) return null;
  return <GameScreen />;
}

function renderGame(board: BoardState, dimensions?: { width: number; height: number }) {
  return render(
    <MemoryRouter>
      <GameSetupProvider>
        <ThemeProvider>
          <Bootstrap board={board} dimensions={dimensions} />
        </ThemeProvider>
      </GameSetupProvider>
    </MemoryRouter>,
  );
}

describe('GameScreen — fallback when there is no deployed board', () => {
  it('shows a message and a way back to Home instead of crashing', () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <GameSetupProvider>
            <GameScreen />
          </GameSetupProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText(/Nessuno schieramento trovato/i)).toBeInTheDocument();
  });
});

describe('GameScreen — return to Home', () => {
  function renderGameWithHomeRoute(board: BoardState) {
    return render(
      <MemoryRouter initialEntries={['/game']}>
        <GameSetupProvider>
          <ThemeProvider>
            <Routes>
              <Route path="/game" element={<Bootstrap board={board} />} />
              <Route path="/" element={<div>HOME-PROBE</div>} />
            </Routes>
          </ThemeProvider>
        </GameSetupProvider>
      </MemoryRouter>,
    );
  }

  it('shows a "Torna alla Home" button during the match (header and under the board)', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    renderGameWithHomeRoute(board);
    expect(screen.getAllByRole('button', { name: '🏠 Torna alla Home' })).toHaveLength(2);
  });

  it('asks for confirmation before leaving: Annulla keeps the match, Sì navigates Home', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    renderGameWithHomeRoute(board);

    fireEvent.click(screen.getAllByRole('button', { name: '🏠 Torna alla Home' })[0]);
    expect(screen.getByText(/La partita in corso andrà persa/i)).toBeInTheDocument();

    // Annulla closes the dialog and the match stays playable.
    fireEvent.click(screen.getByRole('button', { name: /annulla/i }));
    expect(screen.queryByText(/La partita in corso andrà persa/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Turno: Giocatore 1/i)).toBeInTheDocument();

    // Sì, torna alla Home — the match is abandoned and the home route is shown.
    fireEvent.click(screen.getAllByRole('button', { name: '🏠 Torna alla Home' })[1]);
    fireEvent.click(screen.getByRole('button', { name: /sì, torna alla home/i }));
    expect(screen.getByText('HOME-PROBE')).toBeInTheDocument();
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

  it('lists captured pieces sorted by point cost, ascending, regardless of the order they were captured in', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'TO', 'A'); // 15pt — captured first
    board = place(board, 'a4', 'PE', 'A'); // 4pt — captured second
    board = place(board, 'd8', 'TO', 'B');
    board = place(board, 'b6', 'CA', 'B');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="e1"]')!); // A: harmless King shuffle
    fireEvent.click(document.querySelector('[data-coord="f1"]')!);
    fireEvent.click(document.querySelector('[data-coord="d8"]')!); // B: captures the Torre (15pt)
    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    fireEvent.click(document.querySelector('[data-coord="f1"]')!); // A: King back
    fireEvent.click(document.querySelector('[data-coord="e1"]')!);
    fireEvent.click(document.querySelector('[data-coord="b6"]')!); // B: captures the Pedone (4pt)
    fireEvent.click(document.querySelector('[data-coord="a4"]')!);

    expect(screen.getByText((_, el) => el?.textContent === 'Giocatore 1: PE, TO')).toBeInTheDocument();
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

  it('uses the responsive board-layout class instead of an inline grid override (Step 13d — an inline style would out-rank the layout\'s media query)', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    renderGame(board);

    const main = document.querySelector('.main')!;
    expect(main).toHaveClass('main-board-layout');
    expect(main.getAttribute('style') ?? '').not.toContain('grid-template-columns');
  });

  it('shows the manual rotation toggle and lets the player flip perspective at will', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    renderGame(board);

    fireEvent.click(screen.getByText(/Gira scacchiera/i));
    expect(screen.getByTestId('board')).toHaveClass('board-rotated');
  });
});

describe('GameScreen — show-names mode (hold H / toggle button)', () => {
  it('shows the name of every piece while H is held, and hides them on release', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'TO', 'A');
    renderGame(board);

    expect(document.querySelectorAll('.board-piece-name')).toHaveLength(0);

    fireEvent.keyDown(window, { key: 'h' });
    expect(document.querySelectorAll('.board-piece-name')).toHaveLength(3);
    const torreLabel = document.querySelector('[data-coord="d4"] .board-piece-name')!;
    expect(torreLabel.textContent).toContain('Torre');
    expect(torreLabel.textContent).toContain('27 pt');

    fireEvent.keyUp(window, { key: 'h' });
    expect(document.querySelectorAll('.board-piece-name')).toHaveLength(0);
  });

  it('toggles the names permanently with the button, on and off', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'TO', 'A');
    renderGame(board);

    expect(screen.queryByText(/Mostra i nomi/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Mostra i nomi/i));
    expect(document.querySelectorAll('.board-piece-name')).toHaveLength(3);
    expect(screen.getByText(/Nascondi i nomi/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Nascondi i nomi/i));
    expect(document.querySelectorAll('.board-piece-name')).toHaveLength(0);
  });

  it('ignores H while typing in an input', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    renderGame(board);

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    fireEvent.keyDown(input, { key: 'h' });
    expect(document.querySelectorAll('.board-piece-name')).toHaveLength(0);
    input.remove();
  });
});

describe('GameScreen — game over', () => {
  it('a checkmated position opens the dedicated results page automatically (no modal, no click)', () => {
    let board = place(createEmptyBoard(), 'h1', KING_SIGLA, 'B');
    board = place(board, 'a1', KING_SIGLA, 'A');
    board = place(board, 'a8', 'TO', 'B');
    board = place(board, 'b8', 'TO', 'B');

    render(
      <MemoryRouter initialEntries={['/game']}>
        <GameSetupProvider>
          <ThemeProvider>
            <Routes>
              <Route path="/game" element={<Bootstrap board={board} />} />
              <Route path="/game-over" element={<GameOverScreen />} />
            </Routes>
          </ThemeProvider>
        </GameSetupProvider>
      </MemoryRouter>,
    );

    // A is already checkmated on mount — the game-over modal is gone, the results page replaces it.
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

  it('lists the promotion options sorted by point cost, ascending', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd7', 'PE', 'A');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d7"]')!);
    fireEvent.click(document.querySelector('[data-coord="d8"]')!);

    const optionSiglas = [...document.querySelectorAll('.btn-save')].map((el) => el.textContent?.split(' — ')[0]);
    expect(optionSiglas).toEqual(['PE', 'CA', 'SP', 'AL']); // 7pt, 15pt, 17pt, 19pt
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
    board = place(board, 'd7', 'PE', 'B'); // a valid scocca target, so the button has something to show
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

describe('GameScreen — Pezzi in gioco sidebar', () => {
  function boardWithMixedArmies() {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'a1', 'TO', 'A');
    board = place(board, 'd4', 'PE', 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'f5', 'MA', 'B');
    board = place(board, 'e5', 'PE', 'B');
    return board;
  }

  it('lists the pieces on the board per owner, deduplicated by sigla', () => {
    renderGame(boardWithMixedArmies());

    expect(screen.getByText(/♟️ Pezzi in gioco/i)).toBeInTheDocument();
    // A's group: Re, Torre, Pedone; B's group: Re, Manticora, Pedone.
    expect(screen.getByText('TO')).toBeInTheDocument();
    expect(screen.getByText('MA')).toBeInTheDocument();
    expect(screen.getAllByText(KING_SIGLA)).toHaveLength(2); // a King on each side
    expect(screen.getAllByText('PE')).toHaveLength(2); // one Pedone per side
    // one row per distinct sigla on the board: A's RE/TO/PE + B's RE/MA/PE = 6
    expect(screen.getAllByRole('button', { name: /🔍 Info/i })).toHaveLength(6);
  });

  it('opens the same piece-detail modal as the encyclopedia and closes it again', () => {
    renderGame(boardWithMixedArmies());

    fireEvent.click(document.querySelector('[data-piece-row="MA"] button')!);

    const dialog = screen.getByRole('dialog', { name: /Dettagli — Manticora/i });
    expect(dialog).toBeInTheDocument();
    // the full rules prose is shown, like in the encyclopedia
    expect(within(dialog).getByText(/si muove di una casella in orizzontale o verticale/i)).toBeInTheDocument();
    expect(within(dialog).queryByText('Respingere')).not.toBeInTheDocument(); // MA has no special action — sanity on the shared descriptions

    fireEvent.click(within(dialog).getByText(/✕ Chiudi/i));
    expect(screen.queryByRole('dialog', { name: /Dettagli — Manticora/i })).not.toBeInTheDocument();
  });

  it('shows the special-action descriptions for pieces that have them (Repulsore → Respingere)', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'd4', 'RP', 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-piece-row="RP"] button')!);

    const dialog = screen.getByRole('dialog', { name: /Dettagli — Repulsore/i });
    expect(within(dialog).getByText('Respingere')).toBeInTheDocument(); // the special-action label
    expect(within(dialog).getByText(/su una casella vuota/i)).toBeInTheDocument(); // its description (unique to the abilities list)
  });

  it('marks captured pieces as no longer on the board, and their info button still opens the rules', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'a1', 'TO', 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'a5', 'PE', 'B'); // will be captured
    board = place(board, 'b5', 'PE', 'B'); // stays on the board
    renderGame(board);

    // Before the capture there is no captured row.
    expect(document.querySelector('[data-captured-row="PE"]')).toBeNull();

    // A's Torre captures B's Pedone on a5.
    fireEvent.click(document.querySelector('[data-coord="a1"]')!);
    fireEvent.click(document.querySelector('[data-coord="a5"]')!);

    // The captured Pedone now appears in B's group, marked as captured, while the other Pedone
    // (b5) keeps its normal on-board row.
    const capturedRow = document.querySelector('[data-captured-row="PE"]');
    expect(capturedRow).not.toBeNull();
    expect(within(capturedRow as HTMLElement).getByText(/💀 catturato/)).toBeInTheDocument();
    expect(document.querySelector('[data-piece-row="PE"]')).not.toBeNull();

    // The info button on a captured row opens the same piece-detail modal as the encyclopedia.
    fireEvent.click((capturedRow as HTMLElement).querySelector('button')!);
    expect(screen.getByRole('dialog', { name: /Dettagli — Pedone/i })).toBeInTheDocument();
  });

  it('shows the captured count and drops the on-board row once all copies are gone', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'a1', 'TO', 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'a5', 'PE', 'B');
    board = place(board, 'b5', 'PE', 'B');
    renderGame(board);

    // Capture a5.
    fireEvent.click(document.querySelector('[data-coord="a1"]')!);
    fireEvent.click(document.querySelector('[data-coord="a5"]')!);
    // B's King shuffles.
    fireEvent.click(document.querySelector('[data-coord="e8"]')!);
    fireEvent.click(document.querySelector('[data-coord="d8"]')!);
    // Capture b5 too: the Torre is already on a5 and b5 is adjacent.
    fireEvent.click(document.querySelector('[data-coord="a5"]')!);
    fireEvent.click(document.querySelector('[data-coord="b5"]')!);

    // Both Pedoni are gone: the captured row shows ×2 and the on-board row disappeared.
    const capturedRow = document.querySelector('[data-captured-row="PE"]');
    expect(capturedRow).not.toBeNull();
    expect(within(capturedRow as HTMLElement).getByText(/Pedone ×2/)).toBeInTheDocument();
    expect(document.querySelector('[data-piece-row="PE"]')).toBeNull();
  });
});

describe('GameScreen — Repulsore respingi', () => {
  it('shows the "Respingi" toggle only when a Repulsore with a pushable enemy is selected', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'RP', 'A');
    board = place(board, 'e5', 'TO', 'B'); // adjacent enemy, landing f6 empty
    board = place(board, 'a1', 'TO', 'A');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="a1"]')!);
    expect(screen.queryByText(/Respingi/i)).not.toBeInTheDocument();

    fireEvent.click(document.querySelector('[data-coord="a1"]')!); // deselect
    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    expect(screen.getByText(/💨 Respingi/i)).toBeInTheDocument();
  });

  it('entering repulse mode highlights the pushable enemy instead of normal move destinations', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'RP', 'A');
    board = place(board, 'e5', 'TO', 'B'); // pushable enemy
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    expect(document.querySelector('[data-coord="e5"]')).toHaveClass('board-square-highlighted'); // normal move too

    fireEvent.click(screen.getByText(/💨 Respingi/i));
    expect(document.querySelector('[data-coord="e5"]')).toHaveClass('board-square-highlighted'); // still highlighted as the push target
    expect(document.querySelector('[data-coord="d5"]')).not.toHaveClass('board-square-highlighted'); // plain move square, not a push target
  });

  it('pushes the enemy one square away without moving the Repulsore, and passes the turn', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'RP', 'A');
    board = place(board, 'e5', 'TO', 'B');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    fireEvent.click(screen.getByText(/💨 Respingi/i));
    fireEvent.click(document.querySelector('[data-coord="e5"]')!);

    expect(document.querySelector('[data-coord="d4"]')?.querySelector('svg')?.getAttribute('aria-label')).toBe('RP');
    expect(document.querySelector('[data-coord="e5"]')?.querySelector('svg')).toBeNull(); // the enemy left its square
    expect(document.querySelector('[data-coord="f6"]')?.querySelector('svg')?.getAttribute('aria-label')).toBe('TO');
    expect(screen.getByText(/Turno: Giocatore 2/i)).toBeInTheDocument();
  });
});

describe('GameScreen — Mistico swap', () => {
  it('shows the "Scambia posizione" toggle only when a Mistico is selected', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'MI', 'A');
    board = place(board, 'd5', 'PE', 'A'); // adjacent ally, so the button has a valid target to show
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

    // sorted by point cost, ascending: Paggio (2pt) before Pedone (4pt), not insertion/capture order
    const optionSiglas = [...document.querySelectorAll('.btn-save')].map((el) => el.textContent?.split(' — ')[0]);
    expect(optionSiglas).toEqual(['PG', 'PE']);

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

    // sorted by point cost, ascending: Cavallo (12pt) before Torre (15pt)
    const optionSiglas = [...document.querySelectorAll('.btn-save')].map((el) => el.textContent?.split(' — ')[0]);
    expect(optionSiglas).toEqual(['CA', 'TO']);

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

describe('GameScreen — Miraggio sdoppiamento', () => {
  it('shows the "Sdoppia" toggle only when a Miraggio with an adjacent empty square is selected', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'MG', 'A');
    board = place(board, 'a1', 'TO', 'A');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="a1"]')!);
    expect(screen.queryByText(/Sdoppia/i)).not.toBeInTheDocument();

    fireEvent.click(document.querySelector('[data-coord="a1"]')!); // deselect
    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    expect(screen.getByText(/🌫️ Sdoppia/i)).toBeInTheDocument();
  });

  it('entering sdoppiamento mode highlights adjacent EMPTY squares only', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'MG', 'A');
    board = place(board, 'd5', 'TO', 'B'); // occupied — not a valid clone square
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    fireEvent.click(screen.getByText(/🌫️ Sdoppia/i));

    expect(document.querySelector('[data-coord="d5"]')).not.toHaveClass('board-square-highlighted'); // occupied
    expect(document.querySelector('[data-coord="e4"]')).toHaveClass('board-square-highlighted');
    expect(document.querySelector('[data-coord="e5"]')).toHaveClass('board-square-highlighted');
  });

  it('shows the real-or-clone dialog and commits the split, passing the turn', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'MG', 'A');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    fireEvent.click(screen.getByText(/🌫️ Sdoppia/i));
    fireEvent.click(document.querySelector('[data-coord="e4"]')!);

    expect(screen.getByText(/Dove sta il Miraggio vero/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Il vero resta in d4/));

    expect(document.querySelector('[data-coord="e4"]')?.querySelector('svg')?.getAttribute('aria-label')).toBe('MG'); // the clone
    expect(document.querySelector('[data-coord="d4"]')?.querySelector('svg')?.getAttribute('aria-label')).toBe('MG'); // the real
    expect(screen.getByText(/Turno: Giocatore 2/i)).toBeInTheDocument();
    expect(screen.getByText(/sdoppiamento: vero in d4, clone in e4/i)).toBeInTheDocument();
  });

  it('shows "Riunisci" only once the Miraggio has split, and merges the pair back into one piece', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'MG', 'A');
    renderGame(board);

    // Before splitting, there is nothing to merge.
    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    expect(screen.queryByText(/Riunisci/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/🌫️ Sdoppia/i));
    fireEvent.click(document.querySelector('[data-coord="e4"]')!);
    fireEvent.click(screen.getByText(/Il vero resta in d4/));

    // B plays a quiet king shuffle; back on A's turn, select one half (they look identical) and merge.
    fireEvent.click(document.querySelector('[data-coord="e8"]')!);
    fireEvent.click(document.querySelector('[data-coord="e7"]')!);
    fireEvent.click(document.querySelector('[data-coord="e4"]')!); // the clone half
    expect(screen.getByText(/🔗 Riunisci/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/🔗 Riunisci/i));
    expect(document.querySelector('[data-coord="d4"]')).toHaveClass('board-square-highlighted'); // the other half
    expect(document.querySelector('[data-coord="e4"]')).toHaveClass('board-square-highlighted');

    fireEvent.click(document.querySelector('[data-coord="d4"]')!); // reconstitute on the real's square
    expect(document.querySelector('[data-coord="d4"]')?.querySelector('svg')?.getAttribute('aria-label')).toBe('MG');
    expect(document.querySelector('[data-coord="e4"]')?.querySelector('svg')).toBeNull(); // clone gone
    expect(screen.getByText(/Turno: Giocatore 2/i)).toBeInTheDocument();
    expect(screen.getByText(/\(riunione\)/i)).toBeInTheDocument();
  });

  it('hides the "Vedi i Miraggi veri" toggle when no player has a Miraggio on the board', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'TO', 'A');
    renderGame(board);

    expect(screen.queryByText(/Vedi i Miraggi veri/i)).not.toBeInTheDocument();
  });

  it('shows the "Vedi i Miraggi veri" toggle only while the player to move has a split Miraggio', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'MG', 'A'); // unsplit — no real/clone ambiguity yet
    renderGame(board);

    // Unsplit Miraggio: nothing to reveal, toggle hidden.
    expect(screen.queryByText(/Vedi i Miraggi veri/i)).not.toBeInTheDocument();

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    fireEvent.click(screen.getByText(/🌫️ Sdoppia/i));
    fireEvent.click(document.querySelector('[data-coord="e4"]')!);
    fireEvent.click(screen.getByText(/Il vero è in e4/)); // real at e4, clone left at d4

    // It's B's turn now — B has no Miraggio, so the toggle stays hidden.
    expect(screen.queryByText(/Vedi i Miraggi veri/i)).not.toBeInTheDocument();

    // B plays a quiet king shuffle; back on A's turn, A's split Miraggio brings the toggle back.
    fireEvent.click(document.querySelector('[data-coord="e8"]')!);
    fireEvent.click(document.querySelector('[data-coord="e7"]')!);
    expect(screen.getByText(/Vedi i Miraggi veri/i)).toBeInTheDocument();
  });

  it('turns the reveal off automatically when the real Miraggio is captured', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd8', 'TO', 'B'); // rook that can reach d4
    board = place(board, 'd4', 'MG', 'A');
    renderGame(board);

    // A splits (real stays at d4, clone at e4); the turn passes to B.
    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    fireEvent.click(screen.getByText(/🌫️ Sdoppia/i));
    fireEvent.click(document.querySelector('[data-coord="e4"]')!);
    fireEvent.click(screen.getByText(/Il vero resta in d4/));

    // B shuffles; back on A's turn, A reveals the real half.
    fireEvent.click(document.querySelector('[data-coord="e8"]')!);
    fireEvent.click(document.querySelector('[data-coord="e7"]')!);
    fireEvent.click(screen.getByText(/Vedi i Miraggi veri/i));
    expect(screen.getByText(/I Miraggi veri del giocatore di turno/i)).toBeInTheDocument();

    // A shuffles away; B captures the real at d4 — the reveal resets on its own.
    fireEvent.click(document.querySelector('[data-coord="e1"]')!);
    fireEvent.click(document.querySelector('[data-coord="f1"]')!);
    fireEvent.click(document.querySelector('[data-coord="d8"]')!);
    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    expect(screen.queryByText(/I Miraggi veri del giocatore di turno/i)).not.toBeInTheDocument();
  });

  it('turns the reveal off automatically when the Miraggio clone is captured (real half left alone)', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'e6', 'TO', 'B'); // rook that can reach the clone at e4
    board = place(board, 'd4', 'MG', 'A');
    renderGame(board);

    // A splits (real stays at d4, clone at e4); the turn passes to B.
    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    fireEvent.click(screen.getByText(/🌫️ Sdoppia/i));
    fireEvent.click(document.querySelector('[data-coord="e4"]')!);
    fireEvent.click(screen.getByText(/Il vero resta in d4/));

    // B shuffles; back on A's turn, A reveals the real half.
    fireEvent.click(document.querySelector('[data-coord="e8"]')!);
    fireEvent.click(document.querySelector('[data-coord="f8"]')!);
    fireEvent.click(screen.getByText(/Vedi i Miraggi veri/i));
    expect(screen.getByText(/I Miraggi veri del giocatore di turno/i)).toBeInTheDocument();
    expect(document.querySelector('[data-coord="d4"] .board-mirage-real-marker')).not.toBeNull();

    // A shuffles away; B captures the clone at e4 — the real is left alone, nothing to reveal.
    fireEvent.click(document.querySelector('[data-coord="e1"]')!);
    fireEvent.click(document.querySelector('[data-coord="f1"]')!);
    fireEvent.click(document.querySelector('[data-coord="e6"]')!);
    fireEvent.click(document.querySelector('[data-coord="e4"]')!);
    expect(screen.queryByText(/I Miraggi veri del giocatore di turno/i)).not.toBeInTheDocument();

    // Back on A's turn, the lone real half no longer counts as a split pair: no button either.
    expect(screen.queryByText(/Vedi i Miraggi veri/i)).not.toBeInTheDocument();
  });

  it('turns the reveal off automatically when the real Miraggio is destroyed by a Bomba explosion', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd5', 'BO', 'A'); // Bomba: explodes when captured
    board = place(board, 'd4', 'MG', 'B');
    renderGame(board);

    // A shuffles; B splits (real stays at d4, clone at e4); A shuffles again.
    fireEvent.click(document.querySelector('[data-coord="e1"]')!);
    fireEvent.click(document.querySelector('[data-coord="f1"]')!);
    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    fireEvent.click(screen.getByText(/🌫️ Sdoppia/i));
    fireEvent.click(document.querySelector('[data-coord="e4"]')!);
    fireEvent.click(screen.getByText(/Il vero resta in d4/));
    fireEvent.click(document.querySelector('[data-coord="f1"]')!);
    fireEvent.click(document.querySelector('[data-coord="g1"]')!);

    // On B's turn, B reveals the real half, then the real captures the Bomba at d5.
    fireEvent.click(screen.getByText(/Vedi i Miraggi veri/i));
    expect(screen.getByText(/I Miraggi veri del giocatore di turno/i)).toBeInTheDocument();
    expect(document.querySelector('[data-coord="d4"] .board-mirage-real-marker')).not.toBeNull();

    fireEvent.click(document.querySelector('[data-coord="d4"]')!); // select the real half
    fireEvent.click(document.querySelector('[data-coord="d5"]')!); // capture the Bomba

    // The blast destroys the real half: the reveal resets and the clone dissolves too.
    expect(screen.queryByText(/I Miraggi veri del giocatore di turno/i)).not.toBeInTheDocument();
    expect(document.querySelector('[data-coord="d4"]')?.querySelector('svg')).toBeNull(); // real destroyed by the blast
    expect(document.querySelector('[data-coord="e4"]')?.querySelector('svg')).toBeNull(); // clone dissolved as fallout
  });

  it('keeps the reveal on when the opponent\'s real half is captured by our clone — reset only when OUR pair breaks', () => {
    // Both players field a split Miraggio, marked directly (createInitialGameState keeps the board).
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'MG', 'A'); // A's real
    board = place(board, 'e4', 'MG', 'A'); // A's clone
    board = place(board, 'e6', 'MG', 'B'); // B's real
    board = place(board, 'e5', 'MG', 'B'); // B's clone
    board = place(board, 'c4', 'BO', 'A'); // Bomba: the clone explodes on it later
    board.get('d4')!.mirage = { id: 'mA', isClone: false };
    board.get('e4')!.mirage = { id: 'mA', isClone: true };
    board.get('e6')!.mirage = { id: 'mB', isClone: false };
    board.get('e5')!.mirage = { id: 'mB', isClone: true };
    renderGame(board);

    // A passes; B reveals the real half of B's own pair.
    fireEvent.click(document.querySelector('[data-coord="e1"]')!);
    fireEvent.click(document.querySelector('[data-coord="f1"]')!);
    fireEvent.click(screen.getByText(/Vedi i Miraggi veri/i));
    expect(screen.getByText(/I Miraggi veri del giocatore di turno/i)).toBeInTheDocument();
    expect(document.querySelector('[data-coord="e6"] .board-mirage-real-marker')).not.toBeNull(); // B's real
    expect(document.querySelector('[data-coord="e5"] .board-mirage-real-marker')).toBeNull(); // B's clone

    // B's clone captures A's real at d4: A's pair breaks (A's clone dissolves), but B's pair is
    // intact — the reveal must stay on.
    fireEvent.click(document.querySelector('[data-coord="e5"]')!);
    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    expect(screen.getByText(/I Miraggi veri del giocatore di turno/i)).toBeInTheDocument();
    expect(document.querySelector('[data-coord="d4"]')?.querySelector('svg')?.getAttribute('aria-label')).toBe('MG'); // B's clone now on d4
    expect(document.querySelector('[data-coord="e4"]')?.querySelector('svg')).toBeNull(); // A's clone dissolved
    expect(document.querySelector('[data-coord="e6"]')?.querySelector('svg')?.getAttribute('aria-label')).toBe('MG'); // B's real untouched

    // A passes; B's clone (now on d4) captures the Bomba at c4 and explodes — only now that B's
    // OWN pair is gone does the reveal reset.
    fireEvent.click(document.querySelector('[data-coord="f1"]')!);
    fireEvent.click(document.querySelector('[data-coord="g1"]')!);
    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    fireEvent.click(document.querySelector('[data-coord="c4"]')!);
    expect(screen.queryByText(/I Miraggi veri del giocatore di turno/i)).not.toBeInTheDocument();
  });

  it('turns the reveal off automatically when the real Miraggio is destroyed by a Scoccare', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'AR', 'A'); // Arciere: can scoccare the real at d7 (3 away, clear path)
    board = place(board, 'd7', 'MG', 'B');
    renderGame(board);

    // A shuffles; B splits (real stays at d7, clone at e7).
    fireEvent.click(document.querySelector('[data-coord="e1"]')!);
    fireEvent.click(document.querySelector('[data-coord="f1"]')!);
    fireEvent.click(document.querySelector('[data-coord="d7"]')!);
    fireEvent.click(screen.getByText(/🌫️ Sdoppia/i));
    fireEvent.click(document.querySelector('[data-coord="e7"]')!);
    fireEvent.click(screen.getByText(/Il vero resta in d7/));

    // A shuffles; back on B's turn, B reveals the real half.
    fireEvent.click(document.querySelector('[data-coord="f1"]')!);
    fireEvent.click(document.querySelector('[data-coord="g1"]')!);
    fireEvent.click(screen.getByText(/Vedi i Miraggi veri/i));
    expect(screen.getByText(/I Miraggi veri del giocatore di turno/i)).toBeInTheDocument();
    expect(document.querySelector('[data-coord="d7"] .board-mirage-real-marker')).not.toBeNull();

    // B shuffles; A scocca the real at d7 — the clone dissolves and the reveal resets.
    fireEvent.click(document.querySelector('[data-coord="e8"]')!);
    fireEvent.click(document.querySelector('[data-coord="f8"]')!);
    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    fireEvent.click(screen.getByText(/🏹 Scoccare/i));
    fireEvent.click(document.querySelector('[data-coord="d7"]')!);

    expect(screen.queryByText(/I Miraggi veri del giocatore di turno/i)).not.toBeInTheDocument();
    expect(document.querySelector('[data-coord="e7"]')?.querySelector('svg')).toBeNull(); // clone dissolved as fallout
  });

  it('turns the reveal off automatically when the real Miraggio is destroyed by the Colosso\'s area damage', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd5', 'CO', 'A'); // Colosso: captures the PE at d6, its blast hits d7
    board = place(board, 'd6', 'PE', 'B'); // capture bait
    board = place(board, 'd7', 'MG', 'B');
    renderGame(board);

    // A shuffles; B splits (real stays at d7, clone at e7).
    fireEvent.click(document.querySelector('[data-coord="e1"]')!);
    fireEvent.click(document.querySelector('[data-coord="f1"]')!);
    fireEvent.click(document.querySelector('[data-coord="d7"]')!);
    fireEvent.click(screen.getByText(/🌫️ Sdoppia/i));
    fireEvent.click(document.querySelector('[data-coord="e7"]')!);
    fireEvent.click(screen.getByText(/Il vero resta in d7/));

    // A shuffles; back on B's turn, B reveals the real half.
    fireEvent.click(document.querySelector('[data-coord="f1"]')!);
    fireEvent.click(document.querySelector('[data-coord="g1"]')!);
    fireEvent.click(screen.getByText(/Vedi i Miraggi veri/i));
    expect(screen.getByText(/I Miraggi veri del giocatore di turno/i)).toBeInTheDocument();
    expect(document.querySelector('[data-coord="d7"] .board-mirage-real-marker')).not.toBeNull();

    // B shuffles; the Colosso captures the PE at d6 and its blast destroys the real at d7.
    fireEvent.click(document.querySelector('[data-coord="e8"]')!);
    fireEvent.click(document.querySelector('[data-coord="f8"]')!);
    fireEvent.click(document.querySelector('[data-coord="d5"]')!);
    fireEvent.click(document.querySelector('[data-coord="d6"]')!);

    expect(screen.queryByText(/I Miraggi veri del giocatore di turno/i)).not.toBeInTheDocument();
    expect(document.querySelector('[data-coord="d7"]')?.querySelector('svg')).toBeNull(); // real destroyed by the blast
    expect(document.querySelector('[data-coord="e7"]')?.querySelector('svg')).toBeNull(); // clone dissolved as fallout
  });

  it('turns the reveal off automatically once the Miraggio merges back (riunione)', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'MG', 'A');
    renderGame(board);

    // A splits (real stays at d4, clone at e4); the turn passes to B.
    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    fireEvent.click(screen.getByText(/🌫️ Sdoppia/i));
    fireEvent.click(document.querySelector('[data-coord="e4"]')!);
    fireEvent.click(screen.getByText(/Il vero resta in d4/));

    // B shuffles; back on A's turn, A reveals the real half.
    fireEvent.click(document.querySelector('[data-coord="e8"]')!);
    fireEvent.click(document.querySelector('[data-coord="e7"]')!);
    fireEvent.click(screen.getByText(/Vedi i Miraggi veri/i));
    expect(screen.getByText(/I Miraggi veri del giocatore di turno/i)).toBeInTheDocument();

    // A merges the pair back on d4 — the reveal resets on its own.
    fireEvent.click(document.querySelector('[data-coord="e4"]')!); // select the clone half
    fireEvent.click(screen.getByText(/🔗 Riunisci/i));
    fireEvent.click(document.querySelector('[data-coord="d4"]')!); // reconstitute on the real's square
    expect(screen.queryByText(/I Miraggi veri del giocatore di turno/i)).not.toBeInTheDocument();
  });

  it('the reveal toggle marks only the current player\'s real Miraggio', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'MG', 'A');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    fireEvent.click(screen.getByText(/🌫️ Sdoppia/i));
    fireEvent.click(document.querySelector('[data-coord="e4"]')!);
    fireEvent.click(screen.getByText(/Il vero è in e4/)); // real at e4, clone left at d4

    // It's B's turn: B has no Miraggio, so the toggle is hidden and nothing is marked.
    expect(screen.queryByText(/Vedi i Miraggi veri/i)).not.toBeInTheDocument();
    expect(document.querySelector('[data-coord="e4"] .board-mirage-real-marker')).toBeNull();

    // B plays a quiet king shuffle; back on A's turn the reveal marks A's real at e4, never the clone at d4.
    fireEvent.click(document.querySelector('[data-coord="e8"]')!);
    fireEvent.click(document.querySelector('[data-coord="e7"]')!);
    fireEvent.click(screen.getByText(/Vedi i Miraggi veri/i));
    expect(document.querySelector('[data-coord="e4"] .board-mirage-real-marker')).not.toBeNull();
    expect(document.querySelector('[data-coord="d4"] .board-mirage-real-marker')).toBeNull();
  });
});

describe('GameScreen — Vampiro Lunare (Sete di Sangue)', () => {
  it('asks the player where to materialize the Ghoul when several squares are free', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'VL', 'B');
    board = place(board, 'c5', 'PE', 'A'); // capture bait — c5 has 8 free neighbors
    renderGame(board);

    // A passes; B selects the Vampiro Lunare and captures the Pedone.
    fireEvent.click(document.querySelector('[data-coord="e1"]')!);
    fireEvent.click(document.querySelector('[data-coord="f1"]')!);
    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    fireEvent.click(document.querySelector('[data-coord="c5"]')!);

    // The placement dialog appears instead of committing the move.
    expect(screen.getByText(/Dove materializzare il Ghoul/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/🧟 d4/)); // place the Ghoul on the VL's old square

    expect(document.querySelector('[data-coord="c5"]')?.querySelector('svg')?.getAttribute('aria-label')).toBe('VL');
    expect(document.querySelector('[data-coord="d4"]')?.querySelector('svg')?.getAttribute('aria-label')).toBe('GH');
    expect(document.querySelector('[data-coord="c5"] .board-square-highlighted')).toBeNull();
    expect(screen.queryByText(/Dove materializzare il Ghoul/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Turno: Giocatore 1/i)).toBeInTheDocument(); // turn passed to A
  });

  it('auto-places the Ghoul without a dialog when only one square is free', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'VL', 'B');
    board = place(board, 'c5', 'PE', 'A');
    // Occupy every neighbor of c5 except the VL's origin d4 (free again after the capture).
    for (const coord of ['b4', 'b5', 'b6', 'c4', 'c6', 'd5', 'd6']) {
      board = place(board, coord, 'FG', 'A');
    }
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="e1"]')!);
    fireEvent.click(document.querySelector('[data-coord="f1"]')!);
    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    fireEvent.click(document.querySelector('[data-coord="c5"]')!);

    expect(screen.queryByText(/Dove materializzare il Ghoul/i)).not.toBeInTheDocument();
    expect(document.querySelector('[data-coord="c5"]')?.querySelector('svg')?.getAttribute('aria-label')).toBe('VL');
    expect(document.querySelector('[data-coord="d4"]')?.querySelector('svg')?.getAttribute('aria-label')).toBe('GH');
  });

  it('lists the converted Ghoul in the "Pezzi in gioco" sidebar with a distinct badge', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'VL', 'B');
    board = place(board, 'c5', 'PE', 'A');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="e1"]')!);
    fireEvent.click(document.querySelector('[data-coord="f1"]')!);
    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    fireEvent.click(document.querySelector('[data-coord="c5"]')!);
    fireEvent.click(screen.getByText(/🧟 d4/));

    // B's new Ghoul stands out from the deployed pieces: flagged as converted, with the badge.
    const ghoulRow = document.querySelector('[data-piece-row="GH"]');
    expect(ghoulRow).not.toBeNull();
    expect(ghoulRow).toHaveAttribute('data-converted');
    expect(within(ghoulRow as HTMLElement).getByText(/🩸 convertito/i)).toBeInTheDocument();
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
          <ThemeProvider>
            <Routes>
              <Route path="/game" element={<Bootstrap board={board} />} />
              <Route path="/game-over" element={<GameOverScreen />} />
            </Routes>
          </ThemeProvider>
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

    // No modal, no click: the 20th quiet ply lands on the dedicated results page automatically.
    expect(screen.getByText(/Fine Partita/i)).toBeInTheDocument();
    expect(screen.getByText(/Limite di 20 turni senza progressi — vince Giocatore 1 per punteggio/i)).toBeInTheDocument();
    // The results page reports the remaining material per player and the moral winner (A: 57 pt vs B: 30).
    // (Numbers are bolded in nested <strong> tags and the chart's axis labels reuse them, so scope
    // the value assertions to the stats panel.)
    expect(screen.getAllByText(/Punti rimasti sulla scacchiera:/i)).toHaveLength(2);
    const statsPanel = screen.getAllByText(/Punti rimasti sulla scacchiera:/i)[0].closest('section')!;
    expect(within(statsPanel).getByText('57')).toBeInTheDocument();
    expect(within(statsPanel).getByText('30')).toBeInTheDocument();
    expect(screen.getByText(/Vincitore morale: Giocatore 1 — 57 pt rimasti contro 30/i)).toBeInTheDocument();
  });
});

function BootstrapPvc({ board, humanOwner }: { board: BoardState; humanOwner: 'A' | 'B' }) {
  const { setDeployedBoard, setMode, setHumanOwner, setBotDifficulty, deployedBoard } = useGameSetup();
  useEffect(() => {
    setMode('pvc');
    setHumanOwner(humanOwner);
    setBotDifficulty(5); // difficulty 5 = 1 ply — fast and deterministic-enough for a test
    setDeployedBoard(board);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!deployedBoard) return null;
  return <GameScreen />;
}

function renderPvcGame(board: BoardState, humanOwner: 'A' | 'B') {
  return render(
    <MemoryRouter initialEntries={['/game']}>
      <GameSetupProvider>
        <ThemeProvider>
          <Routes>
            <Route path="/game" element={<BootstrapPvc board={board} humanOwner={humanOwner} />} />
            <Route path="/game-over" element={<GameOverScreen />} />
          </Routes>
        </ThemeProvider>
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

  it('shows the PC difficulty badge (level and moves seen ahead) in PvC mode', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'a1', 'TO', 'A');
    board = place(board, 'h8', 'TO', 'B');
    renderPvcGame(board, 'A'); // BootstrapPvc sets difficulty 5

    expect(screen.getByText(/PC: difficoltà 5\/50 — vede 0.5 mosse avanti/i)).toBeInTheDocument();
  });

  it('lets the human change the PC difficulty mid-game with the in-game slider', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'a1', 'TO', 'A');
    board = place(board, 'h8', 'TO', 'B');
    renderPvcGame(board, 'A'); // BootstrapPvc sets difficulty 5

    const slider = screen.getByLabelText('Difficoltà del bot in partita') as HTMLInputElement;
    expect(slider).toBeInTheDocument();
    expect(slider.value).toBe('5');

    fireEvent.change(slider, { target: { value: '20' } });

    expect(screen.getByText(/PC: difficoltà 20\/50 — vede 2 mosse avanti/i)).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getAllByText(/vede 2 mosse avanti/i)).toHaveLength(2); // header badge + slider label
  });

  it('does not show the difficulty slider outside PvC mode', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'a1', 'TO', 'A');
    board = place(board, 'h8', 'TO', 'B');
    renderGame(board);

    expect(screen.queryByLabelText('Difficoltà del bot in partita')).not.toBeInTheDocument();
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

describe('GameScreen — PvC complete game: the bot repulses with the Repulsore', () => {
  it('plays a full PvC game in which the PC uses the Repulsore to repulse, and the human wins by checkmate', () => {
    // PC (owner A): King e1 + Repulsore e4. Human (owner B): King h8 + Regine e8 (pins the RP along
    // the e-file) and d4 (an adjacent enemy on a center square). The RP's melee capture of d4 would
    // expose its own King, so the PC's best 1-ply move is the repulse d4 → c4.
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e4', 'RP', 'A');
    board = place(board, 'h8', KING_SIGLA, 'B');
    board = place(board, 'e8', 'RA', 'B');
    board = place(board, 'd4', 'RA', 'B');
    renderPvcGame(board, 'B');

    // 1) The PC (owner A) plays first, automatically on mount: the Repulsore pushes the adjacent
    // enemy Regina off d4 onto c4. The RP itself never leaves e4. No click required.
    expect(document.querySelector('[data-coord="c4"]')?.querySelector('svg')?.getAttribute('aria-label')).toBe('RA');
    expect(document.querySelector('[data-coord="d4"]')?.querySelector('svg')).toBeNull();
    expect(document.querySelector('[data-coord="e4"]')?.querySelector('svg')?.getAttribute('aria-label')).toBe('RP');
    expect(screen.getByText(/PC: RP e4 → d4/)).toBeInTheDocument();
    expect(screen.getByText(/Turno: Giocatore 1/i)).toBeInTheDocument(); // resolved back to the human

    // 2) Human captures the Repulsore with the e8 Regina, giving check. The PC replies automatically
    // (King e1 → d1) before the assertion — the check is already resolved.
    fireEvent.click(document.querySelector('[data-coord="e8"]')!);
    fireEvent.click(document.querySelector('[data-coord="e4"]')!);
    expect(document.querySelector('[data-coord="e4"]')?.querySelector('svg')?.getAttribute('aria-label')).toBe('RA');
    expect(screen.getByText(/PC: RE e1 → d1/)).toBeInTheDocument();
    expect(screen.getByText(/Turno: Giocatore 1/i)).toBeInTheDocument();

    // 3) Human mates: c4 → c2# — the c2 Queen boxes the King on the back rank (protected by the e4
    // Queen, and every escape square covered). The match ends and the results page opens on its own.
    fireEvent.click(document.querySelector('[data-coord="c4"]')!);
    fireEvent.click(document.querySelector('[data-coord="c2"]')!);

    expect(screen.getByText(/Fine Partita/i)).toBeInTheDocument();
    expect(screen.getByText(/Scacco matto — vince Giocatore 1/i)).toBeInTheDocument();
  });
});

describe('GameScreen — PvC complete game: the bot captures a Bomba and its piece is destroyed by the blast', () => {
  it('the PC (A) captures the Bomba with its Pedone, the explosion destroys the Pedone, and the game continues', () => {
    // PC (owner A): King e1 + Pedone d4. Human (owner B): King h8 + Bomba e5 (diagonally NE of the
    // Pedone). The 1-ply bot prefers the capture: netting the BO's 21 punti (36 → 15 on B's side)
    // outweighs losing its own 7-pt Pedone to the blast (22 → 15 on A's side).
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'd4', 'PE', 'A');
    board = place(board, 'h8', KING_SIGLA, 'B');
    board = place(board, 'e5', 'BO', 'B');
    renderPvcGame(board, 'B');

    // 1) The PC plays first automatically on mount: the Pedone captures the Bomba in e5... and the
    // explosion destroys the Pedone too (it is no King, and removing it exposes no King — README §3.2).
    expect(document.querySelector('[data-coord="e5"]')?.querySelector('svg')).toBeNull(); // BO gone (captured)
    expect(document.querySelector('[data-coord="d4"]')?.querySelector('svg')).toBeNull(); // PE gone (blast)
    expect(document.querySelector('[data-coord="e1"]')?.querySelector('svg')?.getAttribute('aria-label')).toBe(KING_SIGLA);
    expect(screen.getByText(/PC: PE d4 → e5/)).toBeInTheDocument();
    expect(screen.getByText(/Turno: Giocatore 1/i)).toBeInTheDocument(); // resolved back to the human

    // The sidebar "Pezzi in gioco" records both losses: A's Pedone destroyed by the blast (captured
    // row under the PC), B's Bomba captured (captured row under the human).
    expect(document.querySelector('[data-captured-row="PE"]')).not.toBeNull();
    expect(document.querySelector('[data-captured-row="BO"]')).not.toBeNull();

    // 2) The game continues normally: the human (B) shuffles its King, and the PC replies on its own.
    fireEvent.click(document.querySelector('[data-coord="h8"]')!);
    fireEvent.click(document.querySelector('[data-coord="h7"]')!);
    expect(screen.getByText(/Turno: Giocatore 1/i)).toBeInTheDocument(); // the PC already replied
    expect(screen.getAllByRole('listitem')).toHaveLength(3); // capture + human reply + PC reply
  });
});

describe('GameScreen — Step 13b: turn and check indicators', () => {
  it('shows a "Scacco!" badge right after a checking move, and it disappears once the check is resolved', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'd8', KING_SIGLA, 'B');
    board = place(board, 'd1', 'TO', 'A');
    board = place(board, 'a8', 'AL', 'B'); // gives Black a harmless reply move
    renderGame(board);

    expect(screen.queryByText(/Scacco!/i)).not.toBeInTheDocument();

    fireEvent.click(document.querySelector('[data-coord="d1"]')!); // Torre d1 -> d5: clear line to d8
    fireEvent.click(document.querySelector('[data-coord="d5"]')!);
    expect(screen.getByText(/Scacco!/i)).toBeInTheDocument();

    fireEvent.click(document.querySelector('[data-coord="d8"]')!); // King steps out of check
    fireEvent.click(document.querySelector('[data-coord="c7"]')!);
    expect(screen.queryByText(/Scacco!/i)).not.toBeInTheDocument();
  });

  it('flashes the origin and destination squares of the last move', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'TO', 'A');
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    fireEvent.click(document.querySelector('[data-coord="d6"]')!);

    expect(document.querySelector('[data-coord="d4"] .board-square-flash')).not.toBeNull();
    expect(document.querySelector('[data-coord="d6"] .board-square-flash')).not.toBeNull();
  });

  it('shows a "Turno: X" badge that tracks the current player', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'TO', 'A');
    renderGame(board);

    expect(screen.getByText(/Turno: Giocatore 1/i)).toHaveClass('turn-badge-human');

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    fireEvent.click(document.querySelector('[data-coord="d6"]')!);
    expect(screen.getByText(/Turno: Giocatore 2/i)).toHaveClass('turn-badge-human');
  });

  it('shows the turn badge as "human" and no thinking indicator once the PC\'s automatic turn resolves back to the player', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'a1', 'TO', 'A');
    board = place(board, 'h8', 'TO', 'B');
    renderPvcGame(board, 'B'); // the PC (owner A) plays first, automatically

    expect(screen.getByText(/Turno: Giocatore 1/i)).toHaveClass('turn-badge-human'); // it's the human's (B's) turn now
    expect(screen.queryByText(/Il PC sta pensando/i)).not.toBeInTheDocument();
  });
});

describe('GameScreen — Step 13a: special-ability buttons hidden when there is nothing to target', () => {
  it('hides "Scoccare" when the Arciere is silenced by an adjacent enemy Inquisitore', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'AR', 'A');
    board = place(board, 'd7', 'PE', 'B'); // would otherwise be a valid scocca target
    board = place(board, 'e4', 'IQ', 'B'); // adjacent to d4 — silences the Arciere
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    expect(screen.queryByText(/Scoccare/i)).not.toBeInTheDocument();
  });

  it('hides "Scambia posizione" when the Mistico is silenced by an adjacent enemy Inquisitore', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'MI', 'A');
    board = place(board, 'd5', 'TO', 'A'); // would otherwise be a valid swap target
    board = place(board, 'e4', 'IQ', 'B'); // adjacent to d4 — silences the Mistico
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    expect(screen.queryByText(/Scambia posizione/i)).not.toBeInTheDocument();
  });

  it('hides "Rianima alleato" when the Necromante is silenced by an adjacent enemy Inquisitore, even with a non-empty graveyard', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'NE', 'A');
    board = place(board, 'e4', 'IQ', 'B'); // adjacent to d4 — silences the Necromante
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    expect(screen.queryByText(/Rianima alleato/i)).not.toBeInTheDocument();
  });

  it('hides "Rianima alleato" when the graveyard has revivable pieces but there is no empty adjacent square', () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'e8', KING_SIGLA, 'B');
    board = place(board, 'd4', 'NE', 'A');
    board = place(board, 'h1', 'CR', 'A'); // makes a harmless move so B gets a turn
    board = place(board, 'a4', 'PE', 'A'); // sacrificed to populate the graveyard
    board = place(board, 'a8', 'TO', 'B');
    // surround the Necromante entirely so no adjacent square is empty
    for (const coord of ['c3', 'c4', 'c5', 'd3', 'd5', 'e3', 'e4', 'e5']) {
      board = place(board, coord, 'AL', 'A');
    }
    renderGame(board);

    fireEvent.click(document.querySelector('[data-coord="h1"]')!); // A: harmless move
    fireEvent.click(document.querySelector('[data-coord="h3"]')!);
    fireEvent.click(document.querySelector('[data-coord="a8"]')!); // B: captures A's pawn, populating the graveyard
    fireEvent.click(document.querySelector('[data-coord="a4"]')!);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!); // select the fully-surrounded Necromante
    expect(screen.queryByText(/Rianima alleato/i)).not.toBeInTheDocument();
  });
});

describe('GameScreen — Step 14g: custom board dimensions', () => {
  it('renders the board at the configured custom size and lets a move beyond the default 8×8 bounds be played', () => {
    let board = place(createEmptyBoard(), 'f1', KING_SIGLA, 'A');
    board = place(board, 'f6', KING_SIGLA, 'B');
    board = place(board, 'a4', 'TO', 'A');
    const dimensions = { width: 10, height: 6 };
    renderGame(board, dimensions);

    expect(document.querySelectorAll('.board-square')).toHaveLength(60);
    expect(document.querySelector('[data-coord="j4"]')).not.toBeNull(); // only exists on a 10-wide board

    fireEvent.click(document.querySelector('[data-coord="a4"]')!);
    fireEvent.click(document.querySelector('[data-coord="j4"]')!); // slide the full width — impossible on 8×8

    expect(document.querySelector('[data-coord="j4"]')?.querySelector('svg')?.getAttribute('aria-label')).toBe('TO');
    expect(screen.getByText(/Turno: Giocatore 2/i)).toBeInTheDocument();
  });
});
