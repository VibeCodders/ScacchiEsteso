import { expect, test } from '@playwright/test';
import { playMove } from './helpers';

/**
 * End-to-end PvC flow: Home → impostazioni → composizione team umano → scelta del team del PC →
 * schieramento → partita contro il bot. La difficoltà del PC viene portata al minimo dalla
 * schermata di scelta del team così la risposta automatica del bot è immediata.
 */
test('PvC: flusso completo con team del PC e risposta automatica del bot', async ({ page }) => {
  // 1. Home — modalità PvC, l'umano gioca come Giocatore 1 (owner A, muove per primo)
  await page.goto('/');
  await page.getByRole('button', { name: /PvC — gioco come Giocatore A/ }).click();

  // 2. Impostazioni — default, continua
  await expect(page).toHaveURL(/\/game-settings/);
  await page.getByRole('button', { name: /Continua/ }).click();

  // 3. Composizione del team umano (owner A)
  await expect(page).toHaveURL(/\/team\/a/);
  await page.getByRole('button', { name: 'Completa', exact: true }).click();
  const confirmHuman = page.getByRole('button', { name: /Conferma Team Giocatore 1/ });
  await expect(confirmHuman).toBeEnabled();
  await confirmHuman.click();

  // 4. Scelta del team del PC — passo 1: difficoltà minima, poi passo 2: composizione manuale
  await expect(page).toHaveURL(/\/team\/pc-difficulty/);
  await expect(page.getByText(/Difficoltà del PC/)).toBeVisible();
  await page.locator('#bot-difficulty').fill('1');
  await expect(page.getByText(/Livello di difficoltà: 1 \(da -10 a 50\)/)).toBeVisible();
  await page.getByRole('button', { name: /Continua/ }).click();

  await expect(page).toHaveURL(/\/team\/pc-choice/);
  await expect(page.getByText(/Team del PC/)).toBeVisible();
  await page.getByRole('button', { name: /Manuale — lo compongo io/ }).click();

  await expect(page).toHaveURL(/\/team\/b/);
  await page.getByRole('button', { name: 'Completa', exact: true }).click();
  const confirmPc = page.getByRole('button', { name: /Conferma Team del PC/ });
  await expect(confirmPc).toBeEnabled();
  await confirmPc.click();

  // 5. Schieramento — tiro a sorte e piazzamento automatico
  await expect(page).toHaveURL(/\/deployment/);
  await page.getByRole('button', { name: /Tira la moneta/ }).click();
  await page.getByRole('button', { name: /Piazza automaticamente entrambi gli eserciti/ }).click();
  await expect(page.getByText(/Schieramento completo/)).toBeVisible();
  await page.getByRole('button', { name: /Vai alla partita/ }).click();

  // 6. Partita — badge del PC visibile, muove l'umano
  await expect(page).toHaveURL(/\/game/);
  await expect(page.getByText(/PC: difficoltà 1\/50/)).toBeVisible();
  await expect(page.getByText(/Turno: Giocatore 1/)).toBeVisible();

  // L'umano muove; il bot risponde da solo: due mosse nello storico e di nuovo il turno umano
  await playMove(page);
  await expect(page.locator('ol li')).toHaveCount(2);
  await expect(page.getByText(/Turno: Giocatore 1/)).toBeVisible();
});
