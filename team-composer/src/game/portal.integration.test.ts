import { describe, expect, it } from 'vitest';
import { applyCreatePortal, createInitialGameState, applyTurn } from './turnManager';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState } from './board';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A'): BoardState {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

describe('applyCreatePortal', () => {
  it('creates a portal on an adjacent empty square', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'd4', 'PT', 'A');
    board = place(board, 'h8', 'RE', 'B');
    const state = createInitialGameState(board, 'A');
    
    const result = applyCreatePortal(state, 'd4', 'e4');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    
    expect(result.state.portals).toHaveLength(1);
    expect(result.state.portals[0].coord).toBe('e4');
    expect(result.state.portals[0].owner).toBe('A');
    expect(result.state.portals[0].creatorCoord).toBe('d4');
    expect(result.state.turn).toBe('B');
    expect(result.state.history.at(-1)?.isPortalCreation).toBe(true);
  });

  it('rejects portal creation on occupied squares', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'd4', 'PT', 'A');
    board = place(board, 'e4', 'PE', 'B');
    board = place(board, 'h8', 'RE', 'B');
    const state = createInitialGameState(board, 'A');
    
    const result = applyCreatePortal(state, 'd4', 'e4');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/Destinazione non valida/);
  });

  it('rejects portal creation on non-adjacent squares', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'd4', 'PT', 'A');
    board = place(board, 'h8', 'RE', 'B');
    const state = createInitialGameState(board, 'A');
    
    const result = applyCreatePortal(state, 'd4', 'f6');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/Destinazione non valida/);
  });

  it('removes existing portals created by the same Portale piece', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'd4', 'PT', 'A');
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'h7', 'PE', 'B');
    const state = createInitialGameState(board, 'A');
    
    // Create first portal
    const result1 = applyCreatePortal(state, 'd4', 'e4');
    expect(result1.ok).toBe(true);
    if (!result1.ok) return;
    
    // B makes a move to pass turn back to A
    const resultB = applyTurn(result1.state, 'h7', 'h6');
    expect(resultB.ok).toBe(true);
    if (!resultB.ok) return;
    
    // Create second portal (should remove the first)
    const result2 = applyCreatePortal(resultB.state, 'd4', 'd5');
    expect(result2.ok).toBe(true);
    if (!result2.ok) return;
    
    expect(result2.state.portals).toHaveLength(1);
    expect(result2.state.portals[0].coord).toBe('d5');
  });

  it('allows up to 2 portals per player', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'd4', 'PT', 'A');
    board = place(board, 'f4', 'PT', 'A'); // Second Portale (not adjacent to first)
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'h7', 'PE', 'B');
    const state = createInitialGameState(board, 'A');
    
    // First portal from first Portale
    const result1 = applyCreatePortal(state, 'd4', 'e4');
    expect(result1.ok).toBe(true);
    if (!result1.ok) return;
    
    // B makes a move to pass turn back to A
    const resultB = applyTurn(result1.state, 'h7', 'h6');
    expect(resultB.ok).toBe(true);
    if (!resultB.ok) return;
    
    // Second portal from second Portale
    const result2 = applyCreatePortal(resultB.state, 'f4', 'g4');
    expect(result2.ok).toBe(true);
    if (!result2.ok) return;
    
    expect(result2.state.portals).toHaveLength(2);
  });

  it('rejects creating a 3rd portal for the same player', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'd4', 'PT', 'A');
    board = place(board, 'f4', 'PT', 'A');
    board = place(board, 'h4', 'PT', 'A'); // Third Portale
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'h7', 'PE', 'B');
    const state = createInitialGameState(board, 'A');
    
    // Create 2 portals
    const result1 = applyCreatePortal(state, 'd4', 'e4');
    expect(result1.ok).toBe(true);
    if (!result1.ok) return;
    
    const resultB1 = applyTurn(result1.state, 'h7', 'h6');
    expect(resultB1.ok).toBe(true);
    if (!resultB1.ok) return;
    
    const result2 = applyCreatePortal(resultB1.state, 'f4', 'g4');
    expect(result2.ok).toBe(true);
    if (!result2.ok) return;
    
    const resultB2 = applyTurn(result2.state, 'h6', 'h5');
    expect(resultB2.ok).toBe(true);
    if (!resultB2.ok) return;
    
    // Try to create 3rd (h5 is now occupied, so use g5)
    const result3 = applyCreatePortal(resultB2.state, 'h4', 'g5');
    expect(result3.ok).toBe(false);
    if (result3.ok) return;
    expect(result3.reason).toMatch(/Massimo 2 portali/);
  });

  it('rejects portal creation from non-Portale pieces', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'd4', 'TO', 'A'); // Torre instead of Portale
    board = place(board, 'h8', 'RE', 'B');
    const state = createInitialGameState(board, 'A');
    
    const result = applyCreatePortal(state, 'd4', 'e4');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/non può creare portali/);
  });

  it('counts as progress for the anti-stalemate counter', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'd4', 'PT', 'A');
    board = place(board, 'h8', 'RE', 'B');
    const state = createInitialGameState(board, 'A');
    const stateWithProgress = { ...state, turnsSinceProgress: 15 };
    
    const result = applyCreatePortal(stateWithProgress, 'd4', 'e4');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.turnsSinceProgress).toBe(0);
  });

  it('portals persist across turns', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'd4', 'PT', 'A');
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'h7', 'PE', 'B');
    const state = createInitialGameState(board, 'A');
    
    const result1 = applyCreatePortal(state, 'd4', 'e4');
    expect(result1.ok).toBe(true);
    if (!result1.ok) return;
    
    // B makes a regular move
    const result2 = applyTurn(result1.state, 'h7', 'h6');
    expect(result2.ok).toBe(true);
    if (!result2.ok) return;
    
    // The portal should still be there
    expect(result2.state.portals).toHaveLength(1);
  });
});
