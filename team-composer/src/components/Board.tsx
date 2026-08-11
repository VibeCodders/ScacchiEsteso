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
import { cn } from '../lib/cn';

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
  /**
   * Squares holding the REAL half of a split Miraggio, rendered with a small marker (see
   * GameScreen's reveal toggle — off by default, since the whole point of the illusion is that
   * the two pieces are indistinguishable on the board).
   */
  mirageRealSquares?: string[];
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
  mirageRealSquares = [],
}: BoardProps) {
  const flashing = new Set(flashSquares);
  const highlighted = new Set(highlightedSquares);
  const captureHighlighted = new Set(captureSquares);
  const mirageReals = new Set(mirageRealSquares);
  const isRotated = orientation === 'B';

  return (
    <div className={cn('board-wrapper inline-block transition-transform duration-500', isRotated && 'board-rotated rotate-180')} data-testid="board" data-orientation={orientation}>
      <div
        className="board-grid grid border-4 border-[#1a1a1a]"
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
              className={cn(
                'board-square relative aspect-square cursor-pointer border-none p-0',
                isLight ? 'board-square-light bg-[#e8dcc8]' : 'board-square-dark bg-[#6b5544]',
                isSelected && 'board-square-selected outline-[3px] outline-blue-500 outline-offset-[-3px]',
                isHighlighted && 'board-square-highlighted after:pointer-events-none after:absolute after:inset-0 after:bg-blue-500/35',
                isCaptureHighlighted && 'board-square-capture-highlighted before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:bg-red-500/40',
              )}
              data-coord={coord}
              onClick={() => onSquareClick?.(coord)}
              onDragOver={onSquareDrop ? (e) => e.preventDefault() : undefined}
              onDrop={onSquareDrop ? (e) => { e.preventDefault(); onSquareDrop(coord); } : undefined}
              aria-label={`Casella ${coord}${piece ? `, ${piece.sigla} (${piece.owner === 'A' ? 'Giocatore 1' : 'Giocatore 2'})` : ''}`}
            >
              <span className="board-square-content relative block size-full">
                {piece && (
                  <span
                    draggable={Boolean(onPieceDragStart)}
                    onDragStart={onPieceDragStart ? (e) => { e.dataTransfer.setData('text/plain', coord); onPieceDragStart(coord); } : undefined}
                    style={onPieceDragStart ? { cursor: 'grab' } : undefined}
                  >
                    <PieceIcon
                      sigla={piece.sigla}
                      className={cn(
                        'board-piece absolute left-1/2 top-1/2 h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2',
                        isRotated && 'rotate-180',
                        piece.owner === 'A'
                          ? 'board-piece-light text-[#f5f0e6] [stroke:#2b2b2b] [stroke-width:1.5]'
                          : 'board-piece-dark text-[#2b2b2b] [stroke:#f5f0e6] [stroke-width:1.5]',
                      )}
                    />
                  </span>
                )}
                {mirageReals.has(coord) && (
                  <span className="board-mirage-real-marker pointer-events-none absolute right-1 top-1 z-[2] size-2.5 rounded-full bg-yellow-400 shadow-[0_0_4px_rgba(250,204,21,0.9)]" aria-label="Miraggio vero" />
                )}
                {flashing.has(coord) && (
                  <span key={flashVersion} className="board-square-flash pointer-events-none absolute inset-0 animate-board-square-flash bg-yellow-400/55" />
                )}
                {col === 0 && (
                  <span className={cn('board-rank-label pointer-events-none absolute left-1 top-0.5 text-[0.65rem] font-semibold text-[#8b7355]', isRotated && 'rotate-180')}>
                    {dimensions.height - row}
                  </span>
                )}
                {row === dimensions.height - 1 && (
                  <span className={cn('board-file-label pointer-events-none absolute bottom-0.5 right-1 text-[0.65rem] font-semibold text-[#8b7355]', isRotated && 'rotate-180')}>
                    {indexToFile(col)}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default Board;
