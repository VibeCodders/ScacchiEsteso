import { expect, test } from '@playwright/test';

/**
 * E2E per la modalità nomi sulla scacchiera: tenendo premuto H compaiono nome + punti sotto ogni
 * pezzo, rilasciandolo spariscono; il bottone "Mostra i nomi" fa lo stesso effetto come toggle
 * permanente. Verificato sia sullo schermo di schieramento sia in partita, guidando il flusso
 * reale completo (Home → impostazioni → team → schieramento → partita), senza stato pre-seedato.
 */
test('Modalità nomi: tasto H e toggle permanente su schieramento e partita', async ({ page }) => {
  // Flusso completo fino allo schieramento
  await page.goto('/');
  await page.getByRole('button', { name: /PvP locale/ }).click();
  await expect(page).toHaveURL(/\/game-settings/);
  await page.getByRole('button', { name: /Continua/ }).click();

  await expect(page).toHaveURL(/\/team\/a/);
  await page.getByRole('button', { name: 'Completa', exact: true }).click();
  const confirmTeam1 = page.getByRole('button', { name: /Conferma Team Giocatore 1/ });
  await expect(confirmTeam1).toBeEnabled();
  await confirmTeam1.click();

  await expect(page).toHaveURL(/\/team\/b/);
  await page.getByRole('button', { name: 'Completa', exact: true }).click();
  const confirmTeam2 = page.getByRole('button', { name: /Conferma Team/ });
  await expect(confirmTeam2).toBeEnabled();
  await confirmTeam2.click();

  await expect(page).toHaveURL(/\/deployment/);
  await page.getByRole('button', { name: /Tira la moneta/ }).click();
  await expect(page.getByTestId('board')).toBeVisible();

  const nameLabels = page.locator('.board-piece-name');
  const namesButton = page.getByRole('button', { name: /Mostra i nomi/ });

  // --- Schieramento: dopo il tiro a sorte sono piazzati solo i 2 Re ---
  await expect(nameLabels).toHaveCount(0); // nessun nome di default

  await page.keyboard.down('h');
  await expect(nameLabels).toHaveCount(2); // i nomi compaiono tenendo premuto H
  await expect(nameLabels.first()).toHaveText(/Re\s*15 pt/);
  await page.keyboard.up('h');
  await expect(nameLabels).toHaveCount(0); // e spariscono rilasciandolo

  // Il bottone è un toggle permanente: on → visibili, off → nascosti
  await namesButton.click();
  await expect(nameLabels).toHaveCount(2);
  await expect(page.getByRole('button', { name: /Nascondi i nomi/ })).toBeVisible();
  await page.getByRole('button', { name: /Nascondi i nomi/ }).click();
  await expect(nameLabels).toHaveCount(0);

  // --- Partita: piazza tutto e vai a giocare ---
  await page.getByRole('button', { name: /Piazza automaticamente entrambi gli eserciti/ }).click();
  await expect(page.getByText(/Schieramento completo/)).toBeVisible();
  await page.getByRole('button', { name: /Vai alla partita/ }).click();

  await expect(page).toHaveURL(/\/game/);
  await expect(page.getByTestId('board')).toBeVisible();

  // Nessun nome visibile all'inizio della partita
  await expect(nameLabels).toHaveCount(0);

  // Tieni premuto H → i nomi (con punti) appaiono su tutti i pezzi piazzati
  await page.keyboard.down('h');
  await expect(nameLabels).not.toHaveCount(0);
  const sample = (await nameLabels.first().textContent()) ?? '';
  expect(sample).toMatch(/pt$/); // ogni etichetta termina con il costo in punti
  await page.keyboard.up('h');
  await expect(nameLabels).toHaveCount(0);

  // Toggle permanente → i nomi restano visibili anche senza premere H
  await page.getByRole('button', { name: /Mostra i nomi/ }).click();
  await expect(nameLabels).not.toHaveCount(0);
  await page.keyboard.down('h'); // premere/rilasciare H non spegne il toggle
  await page.keyboard.up('h');
  await expect(nameLabels).not.toHaveCount(0);

  // Toggle → off: i nomi spariscono
  await page.getByRole('button', { name: /Nascondi i nomi/ }).click();
  await expect(nameLabels).toHaveCount(0);
});
