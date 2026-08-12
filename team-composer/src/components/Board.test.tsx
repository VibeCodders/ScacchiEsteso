import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Board from './Board';
import { allCoords, createEmptyBoard, createPieceInstance, setPieceAt } from '../game/board';
import { pieces } from '../data/pieces';

describe('Board rendering', () => {
  it('renders exactly 64 squares', () => {
    render(<Board pieces={createEmptyBoard()} orientation="A" />);
    expect(document.querySelectorAll('.board-square')).toHaveLength(64);
  });

  it('renders a piece icon on the square it occupies, and none elsewhere', () => {
    const board = setPieceAt(createEmptyBoard(), 'e1', createPieceInstance('RE', 'A'));
    render(<Board pieces={board} orientation="A" />);

    const e1 = document.querySelector('[data-coord="e1"]')!;
    expect(e1.querySelector('svg')).not.toBeNull();

    const e2 = document.querySelector('[data-coord="e2"]')!;
    expect(e2.querySelector('svg')).toBeNull();
  });

  it('applies the rotation class only when orientation is "B"', () => {
    const { rerender } = render(<Board pieces={createEmptyBoard()} orientation="A" />);
    expect(screen.getByTestId('board')).not.toHaveClass('board-rotated');

    rerender(<Board pieces={createEmptyBoard()} orientation="B" />);
    expect(screen.getByTestId('board')).toHaveClass('board-rotated');
  });

  it('calls onSquareClick with the coordinate of the clicked square', () => {
    const onSquareClick = vi.fn();
    render(<Board pieces={createEmptyBoard()} orientation="A" onSquareClick={onSquareClick} />);

    fireEvent.click(document.querySelector('[data-coord="d4"]')!);
    expect(onSquareClick).toHaveBeenCalledWith('d4');
  });

  it('marks the selected square and highlighted squares distinctly', () => {
    render(
      <Board
        pieces={createEmptyBoard()}
        orientation="A"
        selectedSquare="d4"
        highlightedSquares={['d5', 'd6']}
      />,
    );

    expect(document.querySelector('[data-coord="d4"]')).toHaveClass('board-square-selected');
    expect(document.querySelector('[data-coord="d5"]')).toHaveClass('board-square-highlighted');
    expect(document.querySelector('[data-coord="d6"]')).toHaveClass('board-square-highlighted');
    expect(document.querySelector('[data-coord="e5"]')).not.toHaveClass('board-square-highlighted');
  });

  it('has a distinct SVG icon available for every piece sigla in pieces.json', () => {
    let board = createEmptyBoard();
    expect(pieces.length).toBeLessThanOrEqual(64);
    const coords = allCoords().slice(0, pieces.length);
    pieces.forEach((piece, idx) => {
      board = setPieceAt(board, coords[idx], createPieceInstance(piece.sigla, 'A'));
    });

    render(<Board pieces={board} orientation="A" />);

    pieces.forEach((piece, idx) => {
      const square = document.querySelector(`[data-coord="${coords[idx]}"]`)!;
      const svg = square.querySelector('svg');
      expect(svg, `missing icon for ${piece.sigla}`).not.toBeNull();
      expect(svg?.getAttribute('aria-label')).toBe(piece.sigla);
    });
  });
});

describe('Board — Step 14e: custom board dimensions', () => {
  it('renders width × height squares for a custom (non-default) board size', () => {
    render(<Board pieces={createEmptyBoard()} orientation="A" dimensions={{ width: 10, height: 6 }} />);
    expect(document.querySelectorAll('.board-square')).toHaveLength(60);
  });

  it('renders exactly 16 squares for the minimum 4×4 board', () => {
    render(<Board pieces={createEmptyBoard()} orientation="A" dimensions={{ width: 4, height: 4 }} />);
    expect(document.querySelectorAll('.board-square')).toHaveLength(16);
  });

  it('labels files with double letters past the 26th file, and ranks from the real height', () => {
    render(<Board pieces={createEmptyBoard()} orientation="A" dimensions={{ width: 30, height: 4 }} />);
    expect(document.querySelector('[data-coord="aa1"]')).not.toBeNull();
    expect(document.querySelector('[data-coord="ad4"]')).not.toBeNull();
  });

  it('places a piece correctly on a coordinate beyond the default 8×8 bounds', () => {
    const board = setPieceAt(createEmptyBoard(), 'j5', createPieceInstance('RE', 'A'));
    render(<Board pieces={board} orientation="A" dimensions={{ width: 10, height: 8 }} />);

    const j5 = document.querySelector('[data-coord="j5"]')!;
    expect(j5.querySelector('svg')).not.toBeNull();
  });

  it('defaults to the classic 8×8 board when dimensions is omitted (used by the piece encyclopedia)', () => {
    render(<Board pieces={createEmptyBoard()} orientation="A" />);
    expect(document.querySelectorAll('.board-square')).toHaveLength(64);
  });
});

describe('Board — Step 13c: move/capture flash', () => {
  it('renders a flash overlay only on the squares listed in flashSquares', () => {
    render(<Board pieces={createEmptyBoard()} orientation="A" flashSquares={['d4', 'e5']} flashVersion={1} />);

    expect(document.querySelector('[data-coord="d4"] .board-square-flash')).not.toBeNull();
    expect(document.querySelector('[data-coord="e5"] .board-square-flash')).not.toBeNull();
    expect(document.querySelector('[data-coord="d5"] .board-square-flash')).toBeNull();
  });

  it('renders no flash overlay when flashSquares is omitted', () => {
    render(<Board pieces={createEmptyBoard()} orientation="A" />);
    expect(document.querySelectorAll('.board-square-flash')).toHaveLength(0);
  });
});

describe('Board — capture-square highlight (piece encyclopedia)', () => {
  it('applies the capture-highlight class only to squares listed in captureSquares', () => {
    render(<Board pieces={createEmptyBoard()} orientation="A" captureSquares={['c5', 'e5']} />);

    expect(document.querySelector('[data-coord="c5"]')).toHaveClass('board-square-capture-highlighted');
    expect(document.querySelector('[data-coord="e5"]')).toHaveClass('board-square-capture-highlighted');
    expect(document.querySelector('[data-coord="d5"]')).not.toHaveClass('board-square-capture-highlighted');
  });

  it('applies both the move and capture classes to a square present in both lists', () => {
    render(<Board pieces={createEmptyBoard()} orientation="A" highlightedSquares={['d6']} captureSquares={['d6']} />);

    const square = document.querySelector('[data-coord="d6"]')!;
    expect(square).toHaveClass('board-square-highlighted');
    expect(square).toHaveClass('board-square-capture-highlighted');
  });
});

describe('Board — show-names mode', () => {
  it('renders no name labels by default', () => {
    const board = setPieceAt(createEmptyBoard(), 'e4', createPieceInstance('RE', 'A'));
    render(<Board pieces={board} orientation="A" />);
    expect(document.querySelectorAll('.board-piece-name')).toHaveLength(0);
  });

  it('renders a name label on every occupied square when showNames is true, and none on empty squares', () => {
    let board = setPieceAt(createEmptyBoard(), 'e4', createPieceInstance('RE', 'A'));
    board = setPieceAt(board, 'd5', createPieceInstance('MG', 'B'));
    render(<Board pieces={board} orientation="A" showNames />);

    const labels = document.querySelectorAll('.board-piece-name');
    expect(labels).toHaveLength(2);
    const reLabel = document.querySelector('[data-coord="e4"] .board-piece-name')!;
    expect(reLabel.textContent).toContain('Re');
    expect(reLabel.textContent).toContain('15 pt');
    const mgLabel = document.querySelector('[data-coord="d5"] .board-piece-name')!;
    expect(mgLabel.textContent).toContain('Miraggio');
    expect(mgLabel.textContent).toContain('28 pt');
    expect(document.querySelector('[data-coord="e5"] .board-piece-name')).toBeNull();
  });
});

describe('Board drag & drop', () => {
  it('fires onPieceDragStart with the coordinate of the dragged piece', () => {
    const onPieceDragStart = vi.fn();
    const board = setPieceAt(createEmptyBoard(), 'e4', createPieceInstance('RE', 'A'));
    render(<Board pieces={board} orientation="A" onPieceDragStart={onPieceDragStart} />);

    const wrapper = document.querySelector('[data-coord="e4"] span[draggable]')!;
    fireEvent.dragStart(wrapper, { dataTransfer: { setData: vi.fn() } });
    expect(onPieceDragStart).toHaveBeenCalledWith('e4');
  });

  it('fires onSquareDrop with the coordinate of the target square', () => {
    const onSquareDrop = vi.fn();
    render(<Board pieces={createEmptyBoard()} orientation="A" onSquareDrop={onSquareDrop} />);

    fireEvent.drop(document.querySelector('[data-coord="d5"]')!, { dataTransfer: { getData: () => '' } });
    expect(onSquareDrop).toHaveBeenCalledWith('d5');
  });

  it('a piece is not draggable when onPieceDragStart is not provided', () => {
    const board = setPieceAt(createEmptyBoard(), 'e4', createPieceInstance('RE', 'A'));
    render(<Board pieces={board} orientation="A" />);

    const wrapper = document.querySelector('[data-coord="e4"] span[draggable]')!;
    expect(wrapper.getAttribute('draggable')).toBe('false');
  });

  it('does not throw when a square is dropped on without an onSquareDrop handler', () => {
    render(<Board pieces={createEmptyBoard()} orientation="A" />);
    expect(() => fireEvent.drop(document.querySelector('[data-coord="d5"]')!)).not.toThrow();
  });
});
