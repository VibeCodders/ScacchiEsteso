import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState, type Coord, type Owner } from './board';

const BACK_RANK: readonly string[] = ['TO', 'CA', 'AL', 'RA', 'RE', 'AL', 'CA', 'TO'];
const FILES: readonly string[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

/**
 * Standard chess starting layout, used to preview the Board component visually before the
 * real deployment/game logic (Step 4-5) exists.
 */
export function buildClassicStartingBoard(): BoardState {
  let board: BoardState = createEmptyBoard();
  board = placeBackRank(board, 1, 'A');
  board = placePawnRank(board, 2, 'A');
  board = placeBackRank(board, 8, 'B');
  board = placePawnRank(board, 7, 'B');
  return board;
}

function placeBackRank(board: BoardState, rank: number, owner: Owner): BoardState {
  let next = board;
  FILES.forEach((file, idx) => {
    const coord: Coord = `${file}${rank}`;
    next = setPieceAt(next, coord, createPieceInstance(BACK_RANK[idx], owner));
  });
  return next;
}

function placePawnRank(board: BoardState, rank: number, owner: Owner): BoardState {
  let next = board;
  FILES.forEach((file) => {
    const coord: Coord = `${file}${rank}`;
    next = setPieceAt(next, coord, createPieceInstance('PE', owner));
  });
  return next;
}
