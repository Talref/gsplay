import { expect, test } from '@playwright/test'

async function expectNoHorizontalOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  )
}

test('public and protected routes render without horizontal overflow', async ({ page }) => {
  await page.goto('/library')
  await expect(page.getByRole('heading', { name: 'Rieccote' })).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('a member can sign up, reach the library, and log out', async ({ page }, testInfo) => {
  const username = `e2e-${testInfo.project.name}-${Date.now()}`
  await page.goto('/signup')
  await page.getByLabel('Nome utente').fill(username)
  await page.getByLabel('Password').fill('correct-horse-battery-staple')
  await page.getByRole('button', { name: 'Crea account' }).click()
  await expect(page.getByRole('button', { name: 'Esci' })).toBeVisible()
  await page.goto('/library')
  await expect(page.getByRole('heading', { name: 'La tua libbreria' })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page.getByRole('button', { name: 'Esci' }).click()
  await expect(page.getByRole('button', { name: 'Esci' })).not.toBeVisible()
})

test('catalogue search and member Steam validation expose safe UI feedback', async ({
  page
}, testInfo) => {
  let proposed = false
  const mostWantedPages = []
  await page.route('**/api/v2/casual-friday/proposals/*', async (route) => {
    if (route.request().method() === 'POST') proposed = true
    await route.fulfill({
      json: {
        proposal: {
          status: proposed ? 'pending' : null,
          proposerCount: proposed ? 1 : 0,
          proposedByMe: proposed,
          inRotation: false
        }
      }
    })
  })
  await page.route('**/api/v2/most-wanted?*', async (route) => {
    const requestedPage = Number(new URL(route.request().url()).searchParams.get('page'))
    mostWantedPages.push(requestedPage)
    const firstPage = requestedPage === 1
    await route.fulfill({
      json: {
        available: true,
        stale: true,
        generatedAt: '2026-08-15T12:00:00.000Z',
        games: [
          {
            id: firstPage ? '64e0cec540ae43699af217c7' : '64e0cec540ae43699af217c8',
            rank: firstPage ? 1 : 2,
            title: firstPage ? 'Aqua Quest' : 'Budget Brawlers',
            wishlistCount: firstPage ? 2 : 1,
            ownerCount: firstPage ? 1 : 0,
            wishlistedBy: [{ id: '64e0cec540ae43699af217c1', username: 'E2E Admin' }],
            ownedBy: firstPage
              ? [{ id: '64e0cec540ae43699af217c2', username: 'E2E Friend' }]
              : []
          }
        ],
        page: {
          number: requestedPage,
          size: 1,
          total: 2,
          hasMore: firstPage
        }
      }
    })
  })
  const username = `workflow-${testInfo.project.name}-${Date.now()}`
  await page.goto('/signup')
  await page.getByLabel('Nome utente').fill(username)
  await page.getByLabel('Password').fill('correct-horse-battery-staple')
  await page.getByRole('button', { name: 'Crea account' }).click()
  await expect(page.getByRole('button', { name: 'Esci' })).toBeVisible()
  await page.goto('/most-wanted')
  await expect(page.getByRole('heading', { name: 'MOST WANTED' })).toBeVisible()
  await expect(page.getByText(/wishlist pubbliche de 1 compari su 2/)).toHaveCount(0)
  await expect(page.getByText(/ultima classificona buona/)).toBeVisible()
  const wantedLink = page.getByRole('link', { name: 'Aqua Quest' })
  await expect(wantedLink).toBeVisible()
  const wantedCard = page.getByRole('article').filter({ has: wantedLink })
  await wantedCard.getByRole('button', { name: 'Vedi i compari' }).click()
  await expect(wantedCard.getByText('E2E Admin')).toBeVisible()
  await expect(wantedCard.getByText('E2E Friend')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Budget Brawlers' })).toBeVisible()
  expect(mostWantedPages).toEqual([1, 2])
  await expectNoHorizontalOverflow(page)
  await page.goto('/catalogue')
  await page.getByLabel('Cerca un gioco').fill('Aqua')
  await expect(page.getByText('5 DRITTE, POI DECIDI TU')).toBeVisible()
  const aquaSuggestion = page.getByRole('link', { name: /Aqua Quest 87\/100/ })
  await expect(aquaSuggestion).toBeVisible()
  await aquaSuggestion.click()
  await expect(page.getByRole('heading', { name: 'Aqua Quest' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'TRAILER E MATERIALE SOSPETTO' })).toBeVisible()
  await expect(page.locator('iframe[title="Aqua Quest video 1"]')).toHaveAttribute(
    'src',
    /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/
  )
  await expect(page.getByText('2 disgraziati ce l’hanno già')).toHaveCount(2)
  await expect(page.getByText('E2E Admin')).toBeVisible()
  await page.getByRole('button', { name: 'Buttalo ner Casual Friday' }).click()
  await expect(page.getByRole('button', { name: 'Già proposto pe’ Casual Friday' })).toBeDisabled()
  await expect(page.getByText('1 compare interessato')).toBeVisible()
  await page.getByRole('button', { name: 'Ce l’ho — aggiungi alla libbreria' }).click()
  await expect(page.getByRole('button', { name: 'Rimuovi dalla mia libbreria' })).toBeVisible()
  await page.goto('/library')
  const gameLink = page.getByRole('link', { name: 'Aqua Quest' })
  const gameCard = page.locator('.game-card', { has: gameLink })
  await expect(gameCard).toHaveClass(/game-card--interactive/)
  await gameCard.hover()
  await expect
    .poll(() => gameCard.evaluate((element) => getComputedStyle(element).transform))
    .not.toBe('none')
  await page.mouse.move(0, 0)
  await expect
    .poll(() => gameCard.evaluate((element) => getComputedStyle(element).transform))
    .toBe('none')
  await gameLink.focus()
  await expect
    .poll(() => gameCard.evaluate((element) => getComputedStyle(element).transform))
    .not.toBe('none')
  await gameLink.click()
  await page.getByRole('button', { name: 'Rimuovi dalla mia libbreria' }).click()
  await expect(page.getByRole('dialog', { name: 'Leva dalla libbreria?' })).toBeVisible()
  await page.getByRole('button', { name: 'Sì, rimuovi' }).click()
  await expect(
    page.getByRole('button', { name: 'Ce l’ho — aggiungi alla libbreria' })
  ).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page.goto('/library')
  await page.getByLabel('Aggiungi SteamID').fill('not-a-steamid')
  await page.getByRole('button', { name: 'Salva' }).click()
  await expect(page.getByText(/qualcosa s’è incartato/i)).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('guests compare ownership coverage and filter multiplayer results', async ({
  page
}) => {
  await page.goto('/compare')
  await expect(page.getByRole('heading', { name: 'Confronta le libbrerie' })).toBeVisible()
  const picker = page.getByLabel('Cerca compari')
  await picker.click()
  await page.getByRole('option', { name: 'E2E Friend' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByText(/Serve almeno un altro compare/)).toBeVisible()
  await expect(page.getByText('Aqua Quest')).not.toBeVisible()
  await picker.click()
  await page.getByRole('option', { name: 'E2E Admin' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByText(/1 giochi possibili/)).toBeVisible()
  await expect(page.getByText('Aqua Quest')).toBeVisible()
  await expect(page.getByText('E2E Friend, E2E Admin')).toBeVisible()
  await expect(page.getByText(/Ce l’hanno 2 su 2/)).toHaveCount(0)
  await page.getByRole('checkbox', { name: 'Solo multigiocatore' }).check()
  await expect(page.getByText('Aqua Quest')).toBeVisible()
  await page.getByRole('combobox', { name: 'MODALITÀ MULTIGIOCATORE' }).click()
  await page.getByRole('option', { name: /Co-op/ }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByText('Aqua Quest')).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('comparison loads the next ownership page while scrolling', async ({ page }) => {
  const requestedPages = []
  await page.route('**/api/v2/library-comparisons', async (route) => {
    const requestBody = route.request().postDataJSON()
    requestedPages.push(requestBody.page)
    const start = requestBody.page === 1 ? 0 : 24
    const count = requestBody.page === 1 ? 24 : 1
    const owners = requestBody.userIds.map((id, index) => ({
      id,
      username: index === 0 ? 'E2E Friend' : 'E2E Admin'
    }))
    await route.fulfill({
      json: {
        users: owners,
        games: [...Array(count)].map((_, index) => ({
          id: `scroll-${start + index}`,
          title: `Scroll Game ${String(start + index).padStart(2, '0')}`,
          artwork: null,
          igdbUrl: null,
          genres: [],
          multiplayerModes: [],
          ownerIds: owners.map((owner) => owner.id),
          owners,
          ownerCount: 2,
          selectedUserCount: 2
        })),
        page: {
          number: requestBody.page,
          size: 24,
          total: 25,
          hasMore: requestBody.page === 1
        },
        filters: {
          genres: [],
          multiplayerOnly: false,
          multiplayerModes: []
        },
        facets: { genres: [], multiplayerModes: [] }
      }
    })
  })
  await page.goto('/compare')
  const picker = page.getByLabel('Cerca compari')
  await picker.click()
  await page.getByRole('option', { name: 'E2E Friend' }).click()
  await picker.click()
  await page.getByRole('option', { name: 'E2E Admin' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByText('Scroll Game 00')).toBeVisible()
  await page.getByLabel('Carica altri confronti').scrollIntoViewIfNeeded()
  await expect(page.getByText('Scroll Game 24')).toBeVisible()
  expect(requestedPages).toEqual([1, 2])
})

test('an admin can queue explicit IGDB catalogue maintenance actions', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Nome utente').fill('E2E Admin')
  await page.getByLabel('Password').fill('correct-horse-battery-staple')
  await page.getByRole('button', { name: 'Entra' }).click()
  await expect(page.getByRole('button', { name: 'Esci' })).toBeVisible()
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Users and Steam coverage', level: 6 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Manage users', level: 6 })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Queue missing or pending IGDB metadata' })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Refresh all catalogue metadata from IGDB' })
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retry all failed IGDB matches' })).toBeVisible()
  await page.getByRole('button', { name: 'Queue missing or pending IGDB metadata' }).click()
  await expect(page.getByText('IGDB recovery scan queued.')).toBeVisible()
})

test('an admin can safely edit and publish the member guide', async ({ page }, testInfo) => {
  await page.goto('/login')
  await page.getByLabel('Nome utente').fill('E2E Admin')
  await page.getByLabel('Password').fill('correct-horse-battery-staple')
  await page.getByRole('button', { name: 'Entra' }).click()
  await expect(page.getByRole('button', { name: 'Esci' })).toBeVisible()
  await page.goto('/admin/guide')
  await expect(page.getByRole('heading', { name: 'Guide editor' })).toBeVisible()

  const markdown = `# Benvenuti nella guida\n\nTesto **importante** per ${testInfo.project.name}.\n\n<script>alert(1)</script>`
  const editor = page.getByLabel('Guide Markdown')
  await editor.fill(markdown)
  await editor.evaluate((element, projectName) => {
    const png = Uint8Array.from(
      atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
      ),
      (character) => character.charCodeAt(0)
    )
    const transfer = new DataTransfer()
    transfer.items.add(new File([png], `pixel-${projectName}.png`, { type: 'image/png' }))
    element.dispatchEvent(
      new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer })
    )
  }, testInfo.project.name)
  await expect(page.getByText('Image uploaded and inserted.')).toBeVisible()
  await expect(editor).toHaveValue(/\/uploads\/guide\/[0-9a-f-]+\.png/)
  await page.getByRole('tab', { name: 'Preview' }).click()
  await expect(page.getByRole('heading', { name: 'Benvenuti nella guida' })).toBeVisible()
  await expect(page.getByText('importante')).toBeVisible()
  await expect(page.locator('.guide-markdown script')).toHaveCount(0)
  await expect(page.getByRole('img', { name: `pixel-${testInfo.project.name}` })).toBeVisible()

  const openNavigation = page.getByRole('button', { name: 'Apri navigazione' })
  if (await openNavigation.isVisible()) await openNavigation.click()
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('link', { name: 'Home' }).click()
  await expect(page).toHaveURL(/\/admin\/guide$/)
  await page.getByRole('button', { name: 'Save guide' }).click()
  await expect(page.getByText('Guide saved.')).toBeVisible()

  await page.goto('/guide')
  await expect(page.getByRole('heading', { name: 'GUIDA GSPLAY' })).toHaveClass(/pixel-label/)
  await expect(page.getByRole('heading', { name: 'Benvenuti nella guida' })).toBeVisible()
  await expect(page.locator('.guide-markdown script')).toHaveCount(0)
  await expect(page.getByRole('img', { name: `pixel-${testInfo.project.name}` })).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('members see fresh server groups and safe stale and empty states', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Nome utente').fill('E2E Admin')
  await page.getByLabel('Password').fill('correct-horse-battery-staple')
  await page.getByRole('button', { name: 'Entra' }).click()
  await expect(page.getByRole('button', { name: 'Esci' })).toBeVisible()
  await page.goto('/servers')

  await expect(page.getByRole('heading', { name: 'SERVER LIVE' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Landover GS server' })).toContainText(
    'GSplay Palworld'
  )
  await expect(page.getByLabel('GSplay Palworld: Online')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Jam GS server' })).toContainText(
    'Project Zomboid GS'
  )
  await expect(page.getByText('Giocatori: 0/24')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Jam GS server' })).not.toContainText('Uptime:')
  await expect(page.getByText('Notizie fresche')).toBeVisible()
  await expect(page.getByText(/amp|pterodactyl/i)).toHaveCount(0)

  let mockedSnapshot = {
    sourceUpdatedAt: '2026-08-11T10:00:00.000Z',
    receivedAt: '2026-08-11T10:00:01.000Z',
    stale: true,
    servers: [
      {
        groupId: 'old-machine',
        groupName: 'Server non aggiornato',
        name: 'Vecchio server',
        status: 'unknown',
        uptimeMilliseconds: null
      }
    ]
  }
  await page.route('**/api/v2/server-status', (route) =>
    route.fulfill({ json: { snapshot: mockedSnapshot } })
  )
  await page.getByRole('button', { name: 'Ricontrolla' }).click()
  await expect(page.getByText('Questi dati c’hanno preso sonno.')).toBeVisible()
  await expect(page.getByLabel('Vecchio server: Sconosciuto')).toBeVisible()

  mockedSnapshot = null
  await page.getByRole('button', { name: 'Ricontrolla' }).click()
  await expect(page.getByText('Nun c’è ancora niente da spià.')).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('Casual Friday tools show responsive reorderable cards and cached ITAD offers', async ({
  page
}) => {
  await page.route('**/api/v2/casual-friday/tools/proposals', (route) =>
    route.fulfill({
      json: {
        proposals: [
          {
            id: 'proposal-one',
            status: 'pending',
            proposerCount: 2,
            proposers: [
              { id: 'one', username: 'E2E Friend' },
              { id: 'two', username: 'Proposal Fan' }
            ],
            game: {
              id: 'game-proposal',
              title: 'Community Choice',
              artwork: null,
              summary: 'A community-proposed party game.',
              genres: ['Party'],
              igdbUrl: null
            }
          }
        ]
      }
    })
  )
  await page.goto('/login')
  await page.getByLabel('Nome utente').fill('E2E Admin')
  await page.getByLabel('Password').fill('correct-horse-battery-staple')
  await page.getByRole('button', { name: 'Entra' }).click()
  await expect(page.getByRole('button', { name: 'Esci' })).toBeVisible()
  await page.goto('/casual-friday/tools')
  await expect(page.getByRole('heading', { name: 'Weekly playlist' })).toBeVisible()
  await expect(page.getByText('Community Choice')).toBeHidden()
  await page.getByRole('button', { name: 'Expand proposals' }).click()
  await expect(page.getByText('Community Choice')).toBeVisible()
  await expect(page.getByText('E2E Friend')).toBeVisible()
  await page.getByRole('button', { name: 'Review and accept' }).click()
  await expect(page.getByText('Selected: Community Choice')).toBeVisible()
  await expect(page.getByLabel('Info for players')).toHaveValue('A community-proposed party game.')
  await expect(page.getByText('2 selected')).toBeVisible()
  await expect(page.getByRole('link', { name: /Buy at E2E Games for €11\.99/i })).toHaveCount(2)
  const aqua = page.getByRole('article').filter({ hasText: 'Aqua Quest' })
  const budget = page.getByRole('article').filter({ hasText: 'Budget Brawlers' })
  await expect(aqua.getByText(/Owned · steam/i)).toHaveCount(0)
  await expect(aqua.getByRole('link', { name: /Buy at E2E Games for/i })).toHaveAttribute(
    'href',
    'https://isthereanydeal.com/game/aqua-quest/deal'
  )
  await aqua.getByRole('button', { name: 'Player info' }).click()
  await expect(page.getByRole('dialog', { name: 'Aqua Quest' })).toContainText(
    'Join the host lobby from your friends list.'
  )
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(budget.getByText('Not in your library')).toHaveCount(0)
  await expect(budget.getByRole('link', { name: /Buy at E2E Games for/i })).toHaveAttribute(
    'href',
    'https://isthereanydeal.com/game/budget-brawlers/deal'
  )
  await page.getByRole('button', { name: 'Edit' }).first().click()
  const editDialog = page.getByRole('dialog', { name: 'Edit rotation game' })
  await editDialog
    .getByLabel('Info for players')
    .fill('Updated helper-facing rotation information.')
  await editDialog.getByRole('button', { name: 'Save' }).click()
  await expect(editDialog).not.toBeVisible()
  await expect(page.getByText(/was updated\.$/)).toBeVisible()
  const cards = page.getByRole('region', { name: 'Weekly playlist' }).getByRole('article')
  const secondTitle = (await cards.nth(1).textContent()).includes('Budget Brawlers')
    ? 'Budget Brawlers'
    : 'Aqua Quest'
  await cards
    .nth(1)
    .getByRole('button', { name: `Move ${secondTitle} up` })
    .click()
  await expect(page.getByText('Playlist order saved.')).toBeVisible()
  await expect(cards.first()).toContainText(secondTitle)
  const publishButton = page.getByRole('button', { name: 'Publish playlist' })
  if (await publishButton.isVisible()) {
    page.once('dialog', (dialog) => dialog.accept())
    await publishButton.click()
  }
  await expect(page.getByRole('button', { name: 'Cancel event' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel event' }).click()
  const cancelDialog = page.getByRole('dialog', { name: 'Cancel this week’s event?' })
  await expect(cancelDialog).toContainText('restore it as a draft')
  await cancelDialog.getByLabel('Cancellation reason').fill('E2E cancellation')
  await cancelDialog.getByRole('button', { name: 'Keep event' }).click()
  await expect(cancelDialog).not.toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('Casual Friday member page shows the running lineup and its inactive placeholder', async ({
  page
}) => {
  await page.goto('/login')
  await page.getByLabel('Nome utente').fill('E2E Admin')
  await page.getByLabel('Password').fill('correct-horse-battery-staple')
  await page.getByRole('button', { name: 'Entra' }).click()
  await expect(page.getByRole('button', { name: 'Esci' })).toBeVisible()
  let running = true
  const rotation = (displayTitle, acquisitionKind = 'owned_store', acquisitionUrl = '') => ({
    displayTitle,
    artwork: null,
    info: `Info per ${displayTitle}.`,
    playerCountMin: 2,
    playerCountMax: 6,
    playerCountLabel: '',
    joinInstructions: 'Entra dalla lobby.',
    hostMode: 'host_runs',
    acquisitionKind,
    acquisitionUrl,
    availabilityNote: 'Porta pazienza.'
  })
  await page.route('**/api/v2/casual-friday', (route) =>
    route.fulfill({
      json: {
        playlist: running
          ? {
              id: 'playlist',
              entries: [
                {
                  id: 'owned',
                  position: 1,
                  owned: true,
                  free: false,
                  game: { title: 'Già Comprato' },
                  rotation: rotation('Già Comprato'),
                  itad: {
                    status: 'verified',
                    offer: {
                      shop: 'Steam',
                      url: 'https://example.test/owned',
                      price: 5,
                      currency: 'EUR'
                    }
                  }
                },
                {
                  id: 'free',
                  position: 2,
                  owned: false,
                  free: true,
                  game: { title: 'A Gratisse' },
                  rotation: rotation('A Gratisse', 'web', 'https://example.test/free'),
                  itad: { status: 'not_required', offer: null }
                },
                {
                  id: 'priced',
                  position: 3,
                  owned: false,
                  free: false,
                  game: { title: 'Da Accattà' },
                  rotation: rotation('Da Accattà'),
                  itad: {
                    status: 'verified',
                    offer: {
                      shop: 'Steam',
                      url: 'https://example.test/deal',
                      price: 7.49,
                      currency: 'EUR',
                      voucher: 'DAJE10'
                    }
                  }
                }
              ]
            }
          : null
      }
    })
  )
  await page.goto('/casual-friday')
  await expect(page.getByRole('heading', { name: 'CASUAL FRIDAY' })).toHaveClass(/pixel-label/)
  await expect(page.getByText('Ce l’hai')).toBeVisible()
  await expect(page.getByText('Gratis', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('link', { name: /Compra Da Accattà su Steam a 7,49.*col codice DAJE10/i })
  ).toHaveAttribute('href', 'https://example.test/deal')
  await expect(
    page.getByRole('article').filter({ hasText: 'Già Comprato' }).getByRole('link')
  ).toHaveCount(0)
  await expect(page.getByText('Come s’entra:', { exact: true }).first()).toBeVisible()
  await expectNoHorizontalOverflow(page)
  running = false
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Per mo’ nun se gioca.' })).toBeVisible()
})

test('Casual Friday members can RSVP and select at most five locked candidates', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Nome utente').fill('E2E Admin')
  await page.getByLabel('Password').fill('correct-horse-battery-staple')
  await page.getByRole('button', { name: 'Entra' }).click()
  await expect(page.getByRole('button', { name: 'Esci' })).toBeVisible()

  const event = {
    id: 'event-one',
    weekKey: '2026-08-14',
    status: 'open',
    startsAt: '2026-08-14T17:00:00.000Z',
    endsAt: '2026-08-15T04:00:00.000Z',
    votingClosesAt: '2026-08-14T13:00:00.000Z',
    open: true,
    maxVotes: 5,
    response: { rsvp: null, voteRotationGameIds: [] },
    candidates: [...Array(6)].map((_, index) => ({
      rotationGameId: `rotation-${index}`,
      canonicalGameId: `game-${index}`,
      displayTitle: `Candidato ${index + 1}`,
      artwork: null,
      playerCountMin: 2,
      playerCountMax: 8,
      playerCountLabel: ''
    }))
  }
  await page.route('**/api/v2/casual-friday/events/**', async (route) => {
    const body = route.request().postDataJSON()
    if (route.request().url().endsWith('/rsvp'))
      event.response = { ...event.response, rsvp: body.rsvp }
    if (route.request().url().endsWith('/votes'))
      event.response = { ...event.response, voteRotationGameIds: body.rotationGameIds }
    await route.fulfill({ json: { event: { ...event, response: { ...event.response } } } })
  })
  await page.route('**/api/v2/casual-friday', (route) =>
    route.fulfill({ json: { event, playlist: null } })
  )
  await page.goto('/casual-friday')
  await page.getByRole('button', { name: 'Ce sto', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Ce sto', exact: true })).toHaveAttribute(
    'class',
    /MuiButton-contained/
  )
  for (let index = 1; index <= 5; index += 1)
    await page.getByText(`Candidato ${index}`, { exact: true }).click()
  await expect(page.getByText('5/5 scelti')).toBeVisible()
  await page.getByText('Candidato 6', { exact: true }).click()
  await expect(page.getByText(/Massimo 5 giochi/)).toBeVisible()
  await expectNoHorizontalOverflow(page)
})
