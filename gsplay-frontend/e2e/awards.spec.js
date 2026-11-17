import { expect, test } from '@playwright/test'

const game = (igdbId) => ({
  igdbId,
  title: `Gioco ${igdbId}`,
  igdbUrl: `https://www.igdb.com/games/game-${igdbId}`,
  artwork: '/gslogo.png',
  platforms: ['Nintendo Switch']
})
async function mockMember(page) {
  await page.route('**/api/v2/me', (route) =>
    route.fulfill({ json: { user: { id: 'member', username: 'Awards Member', role: 'member' } } })
  )
}
async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  )
}
for (const phase of ['nominations', 'voting']) {
  test(`Awards ${phase} has a final confirmation, skips categories and preserves submitted state`, async ({
    page
  }, testInfo) => {
    await mockMember(page)
    const edition = {
      id: 'edition',
      year: 2026,
      status: phase,
      nominated: false,
      voted: false,
      nominationsCloseAt: '2099-01-01T12:00:00Z',
      votingClosesAt: '2099-01-01T12:00:00Z',
      categories: [
        {
          id: 'category',
          name: 'Er gioco migliore',
          description: 'Daje co’ le scelte.',
          finalists: [game(1), game(2)]
        },
        { id: 'skip', name: 'Server privati', description: 'Qui puoi passà.', finalists: [game(3)] }
      ]
    }
    let sent = 0
    await page.route('**/api/v2/awards', (route) => route.fulfill({ json: { edition } }))
    await page.route('**/api/v2/awards/games?q=*', (route) =>
      route.fulfill({ json: { games: [1, 2, 3, 4, 5].map(game) } })
    )
    await page.route(
      `**/api/v2/awards/${phase === 'nominations' ? 'nominations' : 'ballots'}`,
      async (route) => {
        const payload = route.request().postDataJSON()
        expect(payload.editionId).toBe('edition')
        expect(payload.selections).toEqual([
          { categoryId: 'category', igdbIds: phase === 'nominations' ? [1, 2, 3, 4] : [1] }
        ])
        sent += 1
        edition[phase === 'nominations' ? 'nominated' : 'voted'] = true
        await route.fulfill({ json: { edition } })
      }
    )
    await page.goto('/awards')
    await expect(page.getByRole('heading', { name: 'GAME AWARDS 2026' })).toBeVisible()
    const submit = page.getByRole('button', {
      name: phase === 'nominations' ? 'Invia nomination' : 'Invia voti',
      exact: true
    })
    await expect(submit).toBeDisabled()
    if (phase === 'nominations') {
      const input = page.getByRole('combobox', { name: 'Cerca giochi per Er gioco migliore' })
      for (const number of [1, 2, 3, 4]) {
        await input.fill('Gioco')
        await page.getByRole('option', { name: `Gioco ${number} · Nintendo Switch` }).click()
      }
      await input.fill('Gioco')
      await expect(page.getByRole('option', { name: 'Gioco 5 · Nintendo Switch' })).toHaveAttribute(
        'aria-disabled',
        'true'
      )
      await page.keyboard.press('Escape')
    } else await page.getByRole('radio', { name: 'Gioco 1', exact: true }).check()
    await noOverflow(page)
    if (testInfo.project.name === '1280x900')
      await page.screenshot({ path: `../docs/screenshots/awards-${phase}.png`, fullPage: true })
    await submit.click()
    await expect(page.getByRole('dialog')).toContainText('1 categorie saltate.')
    await page.getByRole('button', { name: 'Torna alle scelte' }).click()
    expect(sent).toBe(0)
    await submit.click()
    await page.getByRole('button', { name: 'Conferma invio definitivo' }).click()
    await expect(
      page.getByText(
        phase === 'nominations'
          ? 'Hai già nominato, aò! Le tue scelte stanno in cassaforte.'
          : 'Hai già votato, aò! Er dado è tratto, mo’ aspetta la gloria.'
      )
    ).toBeVisible()
    await expect(submit).toHaveCount(0)
    await page.reload()
    await expect(page.getByText(/Hai già (nominato|votato), aò!/)).toBeVisible()
    expect(sent).toBe(1)
    await noOverflow(page)
  })
}

test('Awards waiting and published views expose only phase-appropriate information', async ({
  page
}) => {
  await mockMember(page)
  const edition = { id: 'edition', year: 2026, status: 'closed', categories: [] }
  await page.route('**/api/v2/awards', (route) => route.fulfill({ json: { edition } }))
  await page.goto('/awards')
  await expect(page.getByText(/Urne chiuse, fiato sospeso/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Invia voti' })).toHaveCount(0)
  edition.status = 'published'
  edition.categories = [
    { id: 'one', name: 'La corona', description: 'Scelta dalla comitiva.', winner: game(1) }
  ]
  await page.reload()
  await expect(page.getByRole('heading', { name: 'E la corona va a…' })).toBeVisible()
  await expect(page.getByText('Gioco 1', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'IGDB: Gioco 1' })).toHaveAttribute(
    'href',
    game(1).igdbUrl
  )
  await noOverflow(page)
})

test('Awards administrators can run the full real API lifecycle and publish separately', async ({
  page
}, testInfo) => {
  test.skip(
    testInfo.project.name !== '1280x900',
    'One shared edition in the isolated API harness; responsive member flows run in every viewport.'
  )
  await page.goto('/login')
  await page.getByLabel('Nome utente').fill('E2E Admin')
  await page.getByLabel('Password').fill('correct-horse-battery-staple')
  await page.getByRole('button', { name: 'Entra', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Esci' })).toBeVisible()
  page.on('dialog', (dialog) => dialog.accept())
  await page.goto('/admin/awards')
  await page.getByRole('button', { name: 'Create current-year edition' }).click()
  await page.getByLabel('Category 1 name', { exact: true }).fill('Il gioco dell’anno')
  await page.getByLabel('Category 1 description').fill('Le proposte della comitiva.')
  await page.getByRole('button', { name: 'Save categories', exact: true }).click()
  await expect(page.getByText('Categories saved.', { exact: true })).toBeVisible()
  await page.getByLabel('Closing date and time (Europe/Rome)').fill('2099-01-01T12:00')
  await page.getByRole('button', { name: 'Start nominations', exact: true }).click()
  await expect(page.getByText('Nominations opened.', { exact: true })).toBeVisible()
  await page.goto('/awards')
  await page.getByRole('combobox', { name: 'Cerca giochi per Il gioco dell’anno' }).fill('Aqua')
  await page.getByRole('option', { name: 'Aqua Quest · Nintendo Switch' }).click()
  await page.getByRole('button', { name: 'Invia nomination', exact: true }).click()
  await page.getByRole('button', { name: 'Conferma invio definitivo' }).click()
  await expect(page.getByText(/Hai già nominato, aò!/)).toBeVisible()
  await page.goto('/admin/awards')
  await page.getByRole('button', { name: 'Close nominations now' }).click()
  await page.getByLabel('Category 1 name', { exact: true }).fill('La scelta finale')
  await page
    .getByLabel('Category 1 finalist IGDB URLs')
    .fill('https://www.igdb.com/games/aqua-quest\nhttps://www.igdb.com/games/budget-brawlers')
  await page.getByRole('button', { name: 'Save categories', exact: true }).click()
  await expect(page.getByText('Categories saved.', { exact: true })).toBeVisible()
  await page.getByLabel('Closing date and time (Europe/Rome)').fill('2099-01-02T12:00')
  await page.getByRole('button', { name: 'Confirm shortlist and start voting' }).click()
  await expect(page.getByText('Voting opened.', { exact: true })).toBeVisible()
  await page.goto('/awards')
  await page.getByRole('radio', { name: 'Aqua Quest', exact: true }).check()
  await page.getByRole('button', { name: 'Invia voti', exact: true }).click()
  await page.getByRole('button', { name: 'Conferma invio definitivo' }).click()
  await expect(page.getByText(/Hai già votato, aò!/)).toBeVisible()
  await page.goto('/admin/awards')
  await page.getByRole('button', { name: 'Close voting now' }).click()
  await page.getByRole('combobox', { name: 'Winner: La scelta finale' }).click()
  await page.getByRole('option', { name: 'Aqua Quest', exact: true }).click()
  await page.getByRole('button', { name: 'Save confirmed winners' }).click()
  await expect(page.getByText('Winners confirmed privately.', { exact: true })).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: '../docs/screenshots/awards-admin-results.png', fullPage: true })
  await page.goto('/awards')
  await expect(page.getByText(/Urne chiuse, fiato sospeso/)).toBeVisible()
  await page.goto('/admin/awards')
  await page.getByRole('button', { name: 'Publish confirmed results' }).click()
  await expect(page.getByText('Results published.', { exact: true })).toBeVisible()
  await page.goto('/awards')
  await expect(page.getByRole('heading', { name: 'E la corona va a…' })).toBeVisible()
  await expect(page.getByText('Aqua Quest', { exact: true })).toBeVisible()
  await page.screenshot({ path: '../docs/screenshots/awards-published.png', fullPage: true })
  await noOverflow(page)
})
