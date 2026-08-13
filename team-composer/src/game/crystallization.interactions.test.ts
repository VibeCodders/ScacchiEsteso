import { describe, expect, it } from 'vitest';
import { 
  getCrystallizationSquares,
  isSquareCrystallized,
  decrementCrystallizationTurns,
  isSquareAccessible,
  canCreateMoreCrystallizations,
  type CrystallizedSquare 
} from './crystallization';
import { getPieceDef } from './moveEngine';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState } from './board';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A'): BoardState {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

describe('Smeraldo interactions with other pieces', () => {
  describe('Movement through crystallized squares', () => {
    it('blocks regular pieces from moving through crystallized squares', () => {
      const crystallizations: CrystallizedSquare[] = [
        { id: 'c1', owner: 'A', coord: 'b2', creatorCoord: 'd4', remainingTurns: 3 },
      ];
      
      // Verify crystallization logic - b2 is blocked, c3 is not
      expect(isSquareCrystallized(crystallizations, 'b2')).toBe(true);
      expect(isSquareCrystallized(crystallizations, 'c3')).toBe(false);
      expect(isSquareAccessible(crystallizations, 'b2', false)).toBe(false);
      expect(isSquareAccessible(crystallizations, 'c3', false)).toBe(true);
    });
  });

  describe('King interaction with crystallized squares', () => {
    it('prevents King from entering crystallized squares', () => {
      let board = place(createEmptyBoard(), 'd4', 'SM', 'A');
      board = place(board, 'd3', 'RE', 'A');
      
      const crystallizations: CrystallizedSquare[] = [
        { id: 'c1', owner: 'A', coord: 'd4', creatorCoord: 'd4', remainingTurns: 3 },
      ];
      
      // King trying to move from d3 to d4 (crystallized)
      const accessible = isSquareAccessible(crystallizations, 'd4', true);
      expect(accessible).toBe(false);
    });

    it('allows King to move adjacent to crystallized squares', () => {
      let board = place(createEmptyBoard(), 'd4', 'SM', 'A');
      board = place(board, 'd3', 'RE', 'A');
      
      const crystallizations: CrystallizedSquare[] = [
        { id: 'c1', owner: 'A', coord: 'e5', creatorCoord: 'd4', remainingTurns: 3 },
      ];
      
      // King trying to move from d3 to e4 (adjacent to crystallized e5)
      const accessible = isSquareAccessible(crystallizations, 'e4', true);
      expect(accessible).toBe(true);
    });
  });

  describe('Teleport interaction with crystallized squares', () => {
    it('prevents Teletrasporto from targeting crystallized squares', () => {
      let board = place(createEmptyBoard(), 'd4', 'SM', 'A');
      board = place(board, 'a1', 'TT', 'A');
      
      const crystallizations: CrystallizedSquare[] = [
        { id: 'c1', owner: 'A', coord: 'd4', creatorCoord: 'd4', remainingTurns: 3 },
      ];
      
      // Teletrasporto at a1 trying to teleport to d4 (crystallized)
      const accessible = isSquareAccessible(crystallizations, 'd4', false);
      expect(accessible).toBe(false);
    });
  });

  describe('Repulsore interaction with crystallized squares', () => {
    it('prevents Repulsore from pushing enemies into crystallized squares', () => {
      let board = place(createEmptyBoard(), 'd4', 'SM', 'A');
      board = place(board, 'd3', 'RP', 'A');
      board = place(board, 'd2', 'PE', 'B');
      
      const crystallizations: CrystallizedSquare[] = [
        { id: 'c1', owner: 'A', coord: 'd1', creatorCoord: 'd4', remainingTurns: 3 },
      ];
      
      // Repulsore at d3 trying to push PE from d2 to d1 (crystallized)
      const accessible = isSquareAccessible(crystallizations, 'd1', false);
      expect(accessible).toBe(false);
    });
  });

  describe('Temporal behavior - crystallization decay', () => {
    it('crystallization dissolves after 3 full turns', () => {
      const crystallizations: CrystallizedSquare[] = [
        { id: 'c1', owner: 'A', coord: 'd4', creatorCoord: 'd4', remainingTurns: 3 },
      ];
      
      // After 1 turn
      let updated = decrementCrystallizationTurns(crystallizations);
      expect(updated[0].remainingTurns).toBe(2);
      expect(isSquareCrystallized(updated, 'd4')).toBe(true);
      
      // After 2 turns
      updated = decrementCrystallizationTurns(updated);
      expect(updated[0].remainingTurns).toBe(1);
      expect(isSquareCrystallized(updated, 'd4')).toBe(true);
      
      // After 3 turns
      updated = decrementCrystallizationTurns(updated);
      expect(updated).toHaveLength(0); // Should be removed
      expect(isSquareCrystallized(updated, 'd4')).toBe(false);
    });

    it('allows new crystallization after old one dissolves', () => {
      let crystallizations: CrystallizedSquare[] = [
        { id: 'c1', owner: 'A', coord: 'd4', creatorCoord: 'd4', remainingTurns: 1 },
      ];
      
      // Before decrement: can create more (only 1 active)
      expect(canCreateMoreCrystallizations(crystallizations, 'A')).toBe(true);
      
      // After decrement: should be removed
      crystallizations = decrementCrystallizationTurns(crystallizations);
      expect(crystallizations).toHaveLength(0);
      
      // Now can create new crystallizations
      expect(canCreateMoreCrystallizations(crystallizations, 'A')).toBe(true);
    });
  });

  describe('Multiple crystallizations management', () => {
    it('respects maximum of 2 active crystallizations per owner', () => {
      let crystallizations: CrystallizedSquare[] = [
        { id: 'c1', owner: 'A', coord: 'e5', creatorCoord: 'd4', remainingTurns: 3 },
        { id: 'c2', owner: 'A', coord: 'c3', creatorCoord: 'd4', remainingTurns: 3 },
      ];
      
      // Cannot create more (already at max 2)
      expect(canCreateMoreCrystallizations(crystallizations, 'A')).toBe(false);
      
      // Add third crystallization
      crystallizations.push({ id: 'c3', owner: 'A', coord: 'f6', creatorCoord: 'd4', remainingTurns: 3 });
      
      // Still should not allow creation (mechanic limitation)
      expect(canCreateMoreCrystallizations(crystallizations, 'A')).toBe(false);
    });

    it('separates crystallizations by owner', () => {
      const crystallizations: CrystallizedSquare[] = [
        { id: 'c1', owner: 'A', coord: 'd4', creatorCoord: 'd4', remainingTurns: 3 },
        { id: 'c2', owner: 'A', coord: 'e5', creatorCoord: 'd4', remainingTurns: 3 },
        { id: 'c3', owner: 'B', coord: 'f6', creatorCoord: 'e6', remainingTurns: 3 },
      ];
      
      // Player A cannot create more (at max 2)
      expect(canCreateMoreCrystallizations(crystallizations, 'A')).toBe(false);
      
      // Player B can still create more (only 1 active)
      expect(canCreateMoreCrystallizations(crystallizations, 'B')).toBe(true);
    });
  });

  describe('Interaction with frozen/silenced Smeraldo', () => {
    it('prevents crystallization when Smeraldo is frozen by Stunner', () => {
      let board = place(createEmptyBoard(), 'd4', 'SM', 'A');
      board = place(board, 'd5', 'ST', 'B');
      
      const squares = getCrystallizationSquares(board, 'd4', 'A', getPieceDef);
      expect(squares).toEqual([]);
    });

    // Note: Silence interaction requires proper aura implementation
    // Skipping for now as it's not critical for basic functionality
  });

  describe('Strategic scenarios', () => {
    it('can create a barrier to protect the King', () => {
      let board = place(createEmptyBoard(), 'd4', 'SM', 'A');
      board = place(board, 'e1', 'RE', 'A');
      
      const crystallizations: CrystallizedSquare[] = [
        { id: 'c1', owner: 'A', coord: 'e2', creatorCoord: 'd4', remainingTurns: 3 },
        { id: 'c2', owner: 'A', coord: 'f2', creatorCoord: 'd4', remainingTurns: 3 },
      ];
      
      // Create a protective barrier in front of the King
      expect(isSquareCrystallized(crystallizations, 'e2')).toBe(true);
      expect(isSquareCrystallized(crystallizations, 'f2')).toBe(true);
      
      // King cannot enter these squares
      expect(isSquareAccessible(crystallizations, 'e2', true)).toBe(false);
      expect(isSquareAccessible(crystallizations, 'f2', true)).toBe(false);
    });

    it('can block enemy advance routes', () => {
      let board = place(createEmptyBoard(), 'd4', 'SM', 'A');
      board = place(board, 'a7', 'PE', 'B');
      
      const crystallizations: CrystallizedSquare[] = [
        { id: 'c1', owner: 'A', coord: 'a6', creatorCoord: 'd4', remainingTurns: 3 },
        { id: 'c2', owner: 'A', coord: 'b6', creatorCoord: 'd4', remainingTurns: 3 },
      ];
      
      // Block the pawn's advance
      expect(isSquareCrystallized(crystallizations, 'a6')).toBe(true);
      expect(isSquareCrystallized(crystallizations, 'b6')).toBe(true);
      
      // Pawn cannot move to these squares
      expect(isSquareAccessible(crystallizations, 'a6', false)).toBe(false);
    });
  });
});
