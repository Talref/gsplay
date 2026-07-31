import { expect, test } from '@playwright/test';

async function expectNoHorizontalOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test('public and protected routes render without horizontal overflow', async ({ page }) => {
  await page.goto('/library');
  await expect(page.getByRole('heading', { name: 'Rieccote' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('a member can sign up, reach the library, and log out', async ({ page }, testInfo) => {
  const username = `e2e-${testInfo.project.name}-${Date.now()}`;
  await page.goto('/signup');
  await page.getByLabel('Nome utente').fill(username);
  await page.getByLabel('Password').fill('correct-horse-battery-staple');
  await page.getByRole('button', { name: 'Crea account' }).click();
  await expect(page.getByRole('button', { name: 'Esci' })).toBeVisible();
  await page.goto('/library');
  await expect(page.getByRole('heading', { name: 'La tua libbreria' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: 'Esci' }).click();
  await expect(page.getByRole('button', { name: 'Esci' })).not.toBeVisible();
});

test('catalogue search and member Steam validation expose safe UI feedback', async ({ page }, testInfo) => {
  const username = `workflow-${testInfo.project.name}-${Date.now()}`;
  await page.goto('/signup');
  await page.getByLabel('Nome utente').fill(username);
  await page.getByLabel('Password').fill('correct-horse-battery-staple');
  await page.getByRole('button', { name: 'Crea account' }).click();
  await expect(page.getByRole('button', { name: 'Esci' })).toBeVisible();
  await page.goto('/catalogue');
  await page.getByLabel('Cerca un gioco').fill('Aqua');
  await expect(page.getByText('5 DRITTE, POI DECIDI TU')).toBeVisible();
  const aquaSuggestion = page.getByRole('link', { name: /Aqua Quest 87\/100/ });
  await expect(aquaSuggestion).toBeVisible();
  await aquaSuggestion.click();
  await expect(page.getByRole('heading', { name: 'Aqua Quest' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'TRAILER E MATERIALE SOSPETTO' })).toBeVisible();
  await expect(page.locator('iframe[title="Aqua Quest video 1"]')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
  await expect(page.getByText('2 disgraziati ce l’hanno già')).toHaveCount(2);
  await expect(page.getByText('E2E Admin')).toBeVisible();
  await page.getByRole('button', { name: 'Ce l’ho — aggiungi alla libbreria' }).click();
  await expect(page.getByRole('button', { name: 'Rimuovi dalla mia libbreria' })).toBeVisible();
  await page.getByRole('button', { name: 'Rimuovi dalla mia libbreria' }).click();
  await expect(page.getByRole('dialog', { name: 'Leva dalla libbreria?' })).toBeVisible();
  await page.getByRole('button', { name: 'Sì, rimuovi' }).click();
  await expect(page.getByRole('button', { name: 'Ce l’ho — aggiungi alla libbreria' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.goto('/library');
  await page.getByLabel('Aggiungi SteamID').fill('not-a-steamid');
  await page.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByText(/qualcosa s’è incartato/i)).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('guests can view one public library and compare an explicit multi-user selection', async ({ page }) => {
  await page.goto('/compare');
  await expect(page.getByRole('heading', { name: 'Confronta le libbrerie' })).toBeVisible();
  const picker = page.getByLabel('Cerca compari');
  await picker.click();
  await page.getByRole('option', { name: 'E2E Friend' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByText('1 giochi nella libbreria di E2E Friend.')).toBeVisible();
  await expect(page.getByText('Aqua Quest')).toBeVisible();
  await picker.click();
  await page.getByRole('option', { name: 'E2E Admin' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByText('1 giochi in comune. Annamo a vede’.')).toBeVisible();
  await expect(page.getByText('Aqua Quest')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('an admin can queue explicit IGDB catalogue maintenance actions', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Nome utente').fill('E2E Admin');
  await page.getByLabel('Password').fill('correct-horse-battery-staple');
  await page.getByRole('button', { name: 'Entra' }).click();
  await expect(page.getByRole('button', { name: 'Esci' })).toBeVisible();
  await page.goto('/admin');
  await expect(page.getByRole('button', { name: 'Queue missing or pending IGDB metadata' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh all catalogue metadata from IGDB' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry all failed IGDB matches' })).toBeVisible();
  await page.getByRole('button', { name: 'Queue missing or pending IGDB metadata' }).click();
  await expect(page.getByText('IGDB recovery scan queued.')).toBeVisible();
});

test('Casual Friday tools show responsive reorderable cards and cached ITAD offers', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Nome utente').fill('E2E Admin');
  await page.getByLabel('Password').fill('correct-horse-battery-staple');
  await page.getByRole('button', { name: 'Entra' }).click();
  await expect(page.getByRole('button', { name: 'Esci' })).toBeVisible();
  await page.goto('/casual-friday/tools');
  await expect(page.getByRole('heading', { name: 'Weekly playlist' })).toBeVisible();
  await expect(page.getByText('2 selected')).toBeVisible();
  await expect(page.getByRole('link', { name: /Buy at E2E Games for €11\.99/i })).toHaveCount(2);
  const aqua = page.getByRole('article').filter({ hasText: 'Aqua Quest' });
  const budget = page.getByRole('article').filter({ hasText: 'Budget Brawlers' });
  await expect(aqua.getByText(/Owned · steam/i)).toHaveCount(0);
  await expect(aqua.getByRole('link', { name: /Buy at E2E Games for/i })).toHaveAttribute('href', 'https://isthereanydeal.com/game/aqua-quest/deal');
  await aqua.getByRole('button', { name: 'Player info' }).click();
  await expect(page.getByRole('dialog', { name: 'Aqua Quest' })).toContainText('Join the host lobby from your friends list.');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(budget.getByText('Not in your library')).toHaveCount(0);
  await expect(budget.getByRole('link', { name: /Buy at E2E Games for/i })).toHaveAttribute('href', 'https://isthereanydeal.com/game/budget-brawlers/deal');
  await page.getByRole('button', { name: 'Edit' }).first().click();
  const editDialog = page.getByRole('dialog', { name: 'Edit rotation game' });
  await editDialog.getByLabel('Info for players').fill('Updated helper-facing rotation information.');
  await editDialog.getByRole('button', { name: 'Save' }).click();
  await expect(editDialog).not.toBeVisible();
  await expect(page.getByText(/was updated\.$/)).toBeVisible();
  const cards = page.getByRole('article');
  const secondTitle = (await cards.nth(1).textContent()).includes('Budget Brawlers') ? 'Budget Brawlers' : 'Aqua Quest';
  await cards.nth(1).getByRole('button', { name: `Move ${secondTitle} up` }).click();
  await expect(page.getByText('Playlist order saved.')).toBeVisible();
  await expect(cards.first()).toContainText(secondTitle);
  const publishButton = page.getByRole('button', { name: 'Publish playlist' });
  if (await publishButton.isVisible()) {
    page.once('dialog', (dialog) => dialog.accept());
    await publishButton.click();
  }
  await expect(page.getByRole('button', { name: 'Cancel event' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel event' }).click();
  const cancelDialog = page.getByRole('dialog', { name: 'Cancel this week’s event?' });
  await expect(cancelDialog).toContainText('restore it as a draft');
  await cancelDialog.getByLabel('Cancellation reason').fill('E2E cancellation');
  await cancelDialog.getByRole('button', { name: 'Keep event' }).click();
  await expect(cancelDialog).not.toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('Casual Friday member page shows the running lineup and its inactive placeholder', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Nome utente').fill('E2E Admin');
  await page.getByLabel('Password').fill('correct-horse-battery-staple');
  await page.getByRole('button', { name: 'Entra' }).click();
  await expect(page.getByRole('button', { name: 'Esci' })).toBeVisible();
  let running = true;
  const rotation = (displayTitle, acquisitionKind = 'owned_store', acquisitionUrl = '') => ({
    displayTitle, artwork: null, info: `Info per ${displayTitle}.`, playerCountMin: 2, playerCountMax: 6,
    playerCountLabel: '', joinInstructions: 'Entra dalla lobby.', hostMode: 'host_runs',
    acquisitionKind, acquisitionUrl, availabilityNote: 'Porta pazienza.'
  });
  await page.route('**/api/v2/casual-friday', (route) => route.fulfill({
    json: { playlist: running ? { id: 'playlist', entries: [
      { id: 'owned', position: 1, owned: true, free: false, game: { title: 'Già Comprato' }, rotation: rotation('Già Comprato'), itad: { status: 'verified', offer: { shop: 'Steam', url: 'https://example.test/owned', price: 5, currency: 'EUR' } } },
      { id: 'free', position: 2, owned: false, free: true, game: { title: 'A Gratisse' }, rotation: rotation('A Gratisse', 'web', 'https://example.test/free'), itad: { status: 'not_required', offer: null } },
      { id: 'priced', position: 3, owned: false, free: false, game: { title: 'Da Accattà' }, rotation: rotation('Da Accattà'), itad: { status: 'verified', offer: { shop: 'Steam', url: 'https://example.test/deal', price: 7.49, currency: 'EUR' } } }
    ] } : null }
  }));
  await page.goto('/casual-friday');
  await expect(page.getByRole('heading', { name: 'CASUAL FRIDAY' })).toHaveClass(/pixel-label/);
  await expect(page.getByText('Ce l’hai')).toBeVisible();
  await expect(page.getByText('Gratis', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Compra Da Accattà su Steam a 7,49/i })).toHaveAttribute('href', 'https://example.test/deal');
  await expect(page.getByRole('article').filter({ hasText: 'Già Comprato' }).getByRole('link')).toHaveCount(0);
  await expect(page.getByText('Come s’entra:', { exact: true }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  running = false;
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Per mo’ nun se gioca.' })).toBeVisible();
});
