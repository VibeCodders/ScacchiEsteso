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
