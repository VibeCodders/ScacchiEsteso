import { expect, test } from '@playwright/test';
import { playMove } from './helpers';

/**
 * End-to-end happy path: Home → impostazioni → composizione Team 1 → composizione Team 2 →
 * schieramento → partita (PvP locale, entrambi i giocatori umani sulla stessa macchina).
 * Every step drives the real UI: no seeded state, no shortcuts.
 */
test('PvP: flusso completo da Home fino a una partita giocata', async ({ page }) => {
  // 1. Home — scegli la modalità
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Scacchi Esteso/ })).toBeVisible();
  await page.getByRole('button', { name: /PvP locale/ }).click();

  // 2. Impostazioni — dimensioni predefinite (8×8, nessun limite), continua
  await expect(page).toHaveURL(/\/game-settings/);
  await expect(page.getByRole('heading', { name: /Impostazioni partita/ })).toBeVisible();
  await page.getByRole('button', { name: /Continua/ }).click();

  // 3. Composizione Team — Giocatore 1: riempimento automatico + conferma
  await expect(page).toHaveURL(/\/team\/a/);
  await expect(page.getByRole('heading', { name: /Composizione Team/ })).toBeVisible();
  await page.getByRole('button', { name: 'Completa', exact: true }).click();
  const confirmTeam1 = page.getByRole('button', { name: /Conferma Team Giocatore 1/ });
  await expect(confirmTeam1).toBeEnabled();
  await confirmTeam1.click();

  // 4. Composizione Team — Giocatore 2
  await expect(page).toHaveURL(/\/team\/b/);
  await page.getByRole('button', { name: 'Completa', exact: true }).click();
  const confirmTeam2 = page.getByRole('button', { name: /Conferma Team/ });
  await expect(confirmTeam2).toBeEnabled();
  await confirmTeam2.click();

  // 5. Schieramento — tiro a sorte, piazzamento automatico di entrambi gli eserciti, via
  await expect(page).toHaveURL(/\/deployment/);
  await expect(page.getByRole('heading', { name: /Schieramento/ })).toBeVisible();
  await page.getByRole('button', { name: /Tira la moneta/ }).click();
  await expect(page.getByTestId('board')).toBeVisible();
  await page.getByRole('button', { name: /Piazza automaticamente entrambi gli eserciti/ }).click();
  await expect(page.getByText(/Schieramento completo/)).toBeVisible();
  await page.getByRole('button', { name: /Vai alla partita/ }).click();

  // 6. Partita — la scacchiera 8×8 è pronta e muove il Giocatore 1
  await expect(page).toHaveURL(/\/game/);
  await expect(page.getByTestId('board')).toBeVisible();
  await expect(page.locator('.board-square')).toHaveCount(64);
  await expect(page.getByText(/Turno: Giocatore 1/)).toBeVisible();
  await expect(page.getByText(/Nessuna mossa ancora/)).toBeVisible();

  // Il Giocatore 1 muove: la mossa finisce nello storico e il turno passa al Giocatore 2
  const move1 = await playMove(page);
  expect(move1).toMatch(/^[a-h][1-8]->[a-h][1-8]$/);
  await expect(page.getByText(/Turno: Giocatore 2/)).toBeVisible();
  await expect(page.locator('ol li')).toHaveCount(1);

  // Il Giocatore 2 risponde: storico a 2 mosse, turno di nuovo al Giocatore 1
  await playMove(page);
  await expect(page.getByText(/Turno: Giocatore 1/)).toBeVisible();
  await expect(page.locator('ol li')).toHaveCount(2);
});
