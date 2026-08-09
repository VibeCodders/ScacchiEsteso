import PieceIcon from '../assets/pieces/pieceIcons';
import {
  allCoords,
  coordToDisplayPosition,
  indexToFile,
  DEFAULT_BOARD_DIMENSIONS,
  type BoardDimensions,
  type BoardState,
  type Owner,
} from '../game/board';
import './Board.css';

export interface BoardProps {
  pieces: BoardState;
  /** Whose perspective the board is drawn from — rotates 180° so that player's own side is at the bottom. */
  orientation: Owner;
  /** Board size to render. Defaults to the classic 8×8 (used as-is by the piece encyclopedia, which is deliberately size-independent). */
  dimensions?: BoardDimensions;
  onSquareClick?: (coord: string) => void;
  /** Blue overlay — typically legal move destinations. Combined with captureSquares on a shared square, the overlays blend to violet. */
  highlightedSquares?: string[];
  /** Red overlay — typically capturable squares (see the piece encyclopedia). */
  captureSquares?: string[];
  selectedSquare?: string | null;
  /** Fired when the user starts dragging a piece that occupies a square on this board. */
  onPieceDragStart?: (coord: string) => void;
  /**
   * Fired when something is dropped on a square — either a piece dragged from elsewhere on this
   * board, or an external draggable (e.g. a roster card in DeploymentScreen). The board doesn't
   * care which; the caller already tracks what's "held" (mirroring its click-selection state).
   */
  onSquareDrop?: (coord: string) => void;
  /**
   * Squares touched by the last move/action — briefly flashed to draw the eye. Covers plain moves,
   * captures, a scocca's (stationary) attacker plus its target, and area-damage victims.
   */
  flashSquares?: string[];
  /** Bumped by the caller on every move/action so the flash replays even if it lands on the same squares again. */
  flashVersion?: number;
}

function Board({
  pieces,
  orientation,
  dimensions = DEFAULT_BOARD_DIMENSIONS,
  onSquareClick,
  highlightedSquares = [],
  captureSquares = [],
  selectedSquare = null,
  onPieceDragStart,
  onSquareDrop,
  flashSquares = [],
  flashVersion = 0,
}: BoardProps) {
  const flashing = new Set(flashSquares);
  const highlighted = new Set(highlightedSquares);
  const captureHighlighted = new Set(captureSquares);

  return (
    <div className={`board-wrapper ${orientation === 'B' ? 'board-rotated' : ''}`} data-testid="board" data-orientation={orientation}>
      <div
        className="board-grid"
        style={{
          gridTemplateColumns: `repeat(${dimensions.width}, minmax(2.5rem, 4rem))`,
          gridTemplateRows: `repeat(${dimensions.height}, minmax(2.5rem, 4rem))`,
        }}
      >
        {allCoords(dimensions).map((coord) => {
          const { row, col } = coordToDisplayPosition(coord, dimensions);
          const isLight = (row + col) % 2 === 0;
          const piece = pieces.get(coord);
          const isSelected = coord === selectedSquare;
          const isHighlighted = highlighted.has(coord);
          const isCaptureHighlighted = captureHighlighted.has(coord);

          return (
            <button
              key={coord}
              type="button"
              className={[
                'board-square',
                isLight ? 'board-square-light' : 'board-square-dark',
                isSelected ? 'board-square-selected' : '',
                isHighlighted ? 'board-square-highlighted' : '',
                isCaptureHighlighted ? 'board-square-capture-highlighted' : '',
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
                {flashing.has(coord) && <span key={flashVersion} className="board-square-flash" />}
                {col === 0 && <span className="board-rank-label">{dimensions.height - row}</span>}
                {row === dimensions.height - 1 && <span className="board-file-label">{indexToFile(col)}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default Board;
