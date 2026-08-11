import {
  DEFAULT_BOARD_DIMENSIONS,
  type BoardDimensions,
  type BoardState,
  type Coord,
  type Owner,
} from './board';
import { isSilenced } from './auras';
import { isFrozenByEnemyAura } from './stun';

/**
 * True when the piece at `from` cannot perform its special action: frozen by an enemy freezing
 * aura (an adjacent Stunner or a Basilisco's gaze — always) and/or silenced by an enemy
 * Inquisitore's aura (unless opts.silenced is false — the Swapper's swap is only blocked by stun,
 * not by silence, so it passes { silenced: false }). `getDef` is injected following stun.ts's
 * convention rather than importing moveEngine.ts directly: moveEngine.ts imports stun.ts, so this
 * module must not pull it back in.
 */
export function isActionBlocked(
  board: BoardState,
  from: Coord,
  owner: Owner,
  getDef: (sigla: string) => { stunAura?: boolean },
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
  opts: { silenced?: boolean } = {},
): boolean {
  if (opts.silenced !== false && isSilenced(board, from, owner, dimensions)) return true;
  if (isFrozenByEnemyAura(board, from, owner, getDef, dimensions)) return true;
  return false;
}
