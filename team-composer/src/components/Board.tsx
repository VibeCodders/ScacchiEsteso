import PieceIcon from '../assets/pieces/pieceIcons';
import { FILES, allCoords, coordToDisplayPosition, type BoardState, type Owner } from '../game/board';
import './Board.css';

export interface BoardProps {
  pieces: BoardState;
  /** Whose perspective the board is drawn from — rotates 180° so that player's own side is at the bottom. */
  orientation: Owner;
  onSquareClick?: (coord: string) => void;
  highlightedSquares?: string[];
  selectedSquare?: string | null;
  /** Fired when the user starts dragging a piece that occupies a square on this board. */
  onPieceDragStart?: (coord: string) => void;
  /**
   * Fired when something is dropped on a square — either a piece dragged from elsewhere on this
   * board, or an external draggable (e.g. a roster card in DeploymentScreen). The board doesn't
   * care which; the caller already tracks what's "held" (mirroring its click-selection state).
   */
  onSquareDrop?: (coord: string) => void;
}

function Board({
  pieces,
  orientation,
  onSquareClick,
  highlightedSquares = [],
  selectedSquare = null,
  onPieceDragStart,
  onSquareDrop,
}: BoardProps) {
  const highlighted = new Set(highlightedSquares);

  return (
    <div className={`board-wrapper ${orientation === 'B' ? 'board-rotated' : ''}`} data-testid="board" data-orientation={orientation}>
      <div className="board-grid">
        {allCoords().map((coord) => {
          const { row, col } = coordToDisplayPosition(coord);
          const isLight = (row + col) % 2 === 0;
          const piece = pieces.get(coord);
          const isSelected = coord === selectedSquare;
          const isHighlighted = highlighted.has(coord);

          return (
            <button
              key={coord}
              type="button"
              className={[
                'board-square',
                isLight ? 'board-square-light' : 'board-square-dark',
                isSelected ? 'board-square-selected' : '',
                isHighlighted ? 'board-square-highlighted' : '',
              ].filter(Boolean).join(' ')}
              data-coord={coord}
              onClick={() => onSquareClick?.(coord)}
              onDragOver={onSquareDrop ? (e) => e.preventDefault() : undefined}
              onDrop={onSquareDrop ? (e) => { e.preventDefault(); onSquareDrop(coord); } : undefined}
              aria-label={`Casella ${coord}${piece ? `, ${piece.sigla} (${piece.owner === 'A' ? 'Giocatore 1' : 'Giocatore 2'})` : ''}`}
            >
              <span className="board-square-content">
                {piece && (
                  <span
                    draggable={Boolean(onPieceDragStart)}
                    onDragStart={onPieceDragStart ? (e) => { e.dataTransfer.setData('text/plain', coord); onPieceDragStart(coord); } : undefined}
                    style={onPieceDragStart ? { cursor: 'grab' } : undefined}
                  >
                    <PieceIcon
                      sigla={piece.sigla}
                      className={`board-piece board-piece-${piece.owner === 'A' ? 'light' : 'dark'}`}
                    />
                  </span>
                )}
                {col === 0 && <span className="board-rank-label">{8 - row}</span>}
                {row === 7 && <span className="board-file-label">{FILES[col]}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default Board;
