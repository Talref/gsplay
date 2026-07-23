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

test('comparison validates a selection and renders server-side shared games', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Nome utente').fill('E2E Admin');
  await page.getByLabel('Password').fill('correct-horse-battery-staple');
  await page.getByRole('button', { name: 'Entra' }).click();
  await expect(page.getByRole('button', { name: 'Esci' })).toBeVisible();
  await page.goto('/compare');
  await expect(page.getByRole('heading', { name: 'Confronta le libbrerie' })).toBeVisible();
  const picker = page.getByLabel('Cerca compari');
  await picker.click();
  await page.getByRole('option', { name: 'E2E Friend' }).click();
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