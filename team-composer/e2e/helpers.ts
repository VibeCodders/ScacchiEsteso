import type { Page } from '@playwright/test';

/**
 * Shared helpers for the end-to-end match-flow tests. The specs drive the real UI only
 * (no app-code imports), so the tests stay honest about what a user actually experiences.
 */

/** Pieces whose *selection* can open a modal dialog (Orfano mimic choice, Miraggio split) —
 *  skipped by playMove so the happy path never stalls on an overlay. */
const DIALOG_PIECES = new Set(['OR', 'MG']);

/** Banners that appear after a move but keep the turn alive — each is dismissed by clicking the
 *  listed button so the turn actually passes to the opponent. */
const BONUS_MOVE_DISMISSALS: Array<[RegExp, string]> = [
  [/Movimento extra Berserker disponibile/, 'Salta movimento extra'],
  [/Catena di salti del Coniglio/, 'Ferma la catena e cattura'],
];

/** Overlay used by promotion / revival / mimic / mirage / game-over choices (the shared Modal). */
const OVERLAY_SELECTOR = '[role="dialog"]';

/** Reads the "Turno: …" badge, e.g. "Turno: Giocatore 1" or "Turno: PC". */
export async function currentTurnLabel(page: Page): Promise<string> {
  const text = await page.locator('.turn-badge-human').textContent();
  return (text ?? '').replace('Turno: ', '').trim();
}

interface SquareInfo {
  coord: string;
  sigla: string | null;
}

/** Squares holding a piece whose board aria-label mentions `ownerLabel` (the board always uses
 *  the fixed labels "Giocatore 1"/"Giocatore 2", regardless of PvP/PvC). */
async function ownerSquares(page: Page, ownerLabel: string): Promise<SquareInfo[]> {
  return page.locator('.board-square').evaluateAll((squares, label) =>
    squares
      .filter((el) => (el.getAttribute('aria-label') ?? '').includes(label))
      .map((el) => ({
        coord: el.getAttribute('data-coord') ?? '',
        sigla: el.querySelector('.board-piece')?.getAttribute('aria-label') ?? null,
      })),
    ownerLabel,
  );
}

/**
 * Plays one full turn for whoever is to move: selects the first own piece that has at least one
 * legal destination (skipping Orfani/Miraggi, whose selection opens a dialog), clicks the first
 * highlighted square, and dismisses any Berserker/Coniglio bonus banner so the turn passes.
 * Returns the move as "from->to".
 *
 * `ariaOwner` maps the badge label to the board's fixed aria label; the identity mapping is
 * correct for PvP and for PvC where the human plays owner A (both covered by these specs).
 */
export async function playMove(page: Page, opts: { ariaOwner?: string } = {}): Promise<string> {
  const badgeOwner = await currentTurnLabel(page);
  const ariaOwner = opts.ariaOwner ?? badgeOwner;

  const candidates = await ownerSquares(page, ariaOwner);
  for (const { coord, sigla } of candidates) {
    if (!sigla || DIALOG_PIECES.has(sigla)) continue;

    const from = page.locator(`[data-coord="${coord}"]`);
    await from.click();
    await page.waitForTimeout(100); // let React compute and paint the legal destinations

    const overlayOpen = await page.locator(OVERLAY_SELECTOR).count();
    const highlights = page.locator('.board-square-highlighted');
    if (overlayOpen === 0 && (await highlights.count()) > 0) {
      const target = await highlights.first().getAttribute('data-coord');
      await page.locator(`[data-coord="${target}"]`).click();
      await dismissBonusTurns(page);
      return `${coord}->${target}`;
    }

    await from.click(); // no legal move (or a dialog opened) — deselect and try another piece
  }

  throw new Error(`No movable piece found for "${badgeOwner}" (aria "${ariaOwner}")`);
}

async function dismissBonusTurns(page: Page) {
  for (const [banner, buttonLabel] of BONUS_MOVE_DISMISSALS) {
    if ((await page.getByText(banner).count()) > 0) {
      await page.getByRole('button', { name: buttonLabel }).click();
    }
  }
}
