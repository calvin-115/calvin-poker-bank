import { test, expect, loadAllTestAccounts } from 'deepspace/testing'

test('a player joins a hosted game by code and both see the roster live', async ({ users }) => {
  const usableTestAccounts = loadAllTestAccounts().length
  test.skip(usableTestAccounts < 2, `Needs 2 usable test accounts, found ${usableTestAccounts}.`)
  const [host, player] = await users(2)

  await host.page.goto('/games')
  await host.page.getByLabel('Game name').fill(`Test game ${Date.now()}`)
  await host.page.getByRole('button', { name: 'Create game' }).click()

  const code = (await host.page.getByTestId('game-code').textContent({ timeout: 15_000 }))?.trim()
  expect(code).toMatch(/^[A-Z0-9]{6}$/)
  await expect(host.page.getByTestId('player-list').getByRole('listitem')).toHaveCount(1)

  await player.page.goto('/games')
  await player.page.getByLabel('Game code').fill(code!)
  await player.page.getByRole('button', { name: 'Join game' }).click()
  await expect(player.page.getByTestId('game-code')).toHaveText(code!, { timeout: 15_000 })

  for (const user of [host, player]) {
    await expect(user.page.getByTestId('player-list').getByRole('listitem')).toHaveCount(2, { timeout: 15_000 })
  }
})

test('host runs the ledger, flags a mismatch, closes and settles', async ({ users }) => {
  const usableTestAccounts = loadAllTestAccounts().length
  test.skip(usableTestAccounts < 2, `Needs 2 usable test accounts, found ${usableTestAccounts}.`)
  const [host, player] = await users(2)

  await host.page.goto('/games')
  await host.page.getByLabel('Game name').fill(`Ledger test ${Date.now()}`)
  await host.page.getByRole('button', { name: 'Create game' }).click()
  const code = (await host.page.getByTestId('game-code').textContent({ timeout: 15_000 }))!.trim()

  await player.page.goto('/games')
  await player.page.getByLabel('Game code').fill(code)
  await player.page.getByRole('button', { name: 'Join game' }).click()
  await expect(host.page.getByTestId('ledger-row')).toHaveCount(2, { timeout: 15_000 })

  // Players see the ledger but get no host controls.
  await expect(player.page.getByRole('button', { name: 'Buy in' })).toHaveCount(0)

  const rows = host.page.getByTestId('ledger-row')
  for (const i of [0, 1]) {
    await rows.nth(i).getByLabel(/Buy-in amount/).fill('20')
    await rows.nth(i).getByRole('button', { name: 'Buy in' }).click()
  }
  await rows.nth(0).getByLabel(/Cash-out chips/).fill('30')
  await rows.nth(0).getByRole('button', { name: 'Cash out' }).click()
  await rows.nth(1).getByLabel(/Cash-out chips/).fill('5')
  await rows.nth(1).getByRole('button', { name: 'Cash out' }).click()

  await expect(player.page.getByTestId('mismatch')).toBeVisible({ timeout: 15_000 })
  await expect(host.page.getByRole('button', { name: 'Close game' })).toBeDisabled()

  await rows.nth(1).getByLabel(/Cash-out chips/).fill('10')
  await rows.nth(1).getByRole('button', { name: 'Cash out' }).click()
  await expect(host.page.getByTestId('mismatch')).toHaveCount(0)
  await host.page.getByRole('button', { name: 'Close game' }).click()

  await expect(player.page.getByTestId('game-status')).toHaveText('closed', { timeout: 15_000 })
  await expect(player.page.getByTestId('settlement').getByRole('listitem')).toHaveCount(1)
  await expect(player.page.getByTestId('settlement')).toContainText('$10')
})

test('player requests buy-ins; host approves one and declines one', async ({ users }) => {
  const usableTestAccounts = loadAllTestAccounts().length
  test.skip(usableTestAccounts < 2, `Needs 2 usable test accounts, found ${usableTestAccounts}.`)
  const [host, player] = await users(2)

  await host.page.goto('/games')
  await host.page.getByLabel('Game name').fill(`Request test ${Date.now()}`)
  await host.page.getByRole('button', { name: 'Create game' }).click()
  const code = (await host.page.getByTestId('game-code').textContent({ timeout: 15_000 }))!.trim()

  await player.page.goto('/games')
  await player.page.getByLabel('Game code').fill(code)
  await player.page.getByRole('button', { name: 'Join game' }).click()

  for (const amount of ['25', '15']) {
    await player.page.getByLabel('Buy-in request amount').fill(amount)
    await player.page.getByRole('button', { name: 'Request buy-in' }).click()
  }
  await expect(player.page.getByTestId('my-requests').getByRole('listitem')).toHaveCount(2, { timeout: 15_000 })

  const requests = host.page.getByTestId('buyin-requests').getByRole('listitem')
  await expect(requests).toHaveCount(2, { timeout: 15_000 })
  await requests.filter({ hasText: '$25' }).getByRole('button', { name: 'Approve' }).click()
  await requests.filter({ hasText: '$15' }).getByRole('button', { name: 'Decline' }).click()
  await expect(host.page.getByTestId('buyin-requests')).toHaveCount(0)

  // Only the approved request reaches the ledger.
  await expect(player.page.getByTestId('ledger-row').nth(1)).toContainText('In $25', { timeout: 15_000 })
  await expect(player.page.getByTestId('my-requests')).toContainText('Declined')
  await expect(player.page.getByTestId('my-requests').getByRole('listitem')).toHaveCount(1)
})

test('host settles a miscount by covering it; the player is paid their full chips', async ({ users }) => {
  const usableTestAccounts = loadAllTestAccounts().length
  test.skip(usableTestAccounts < 2, `Needs 2 usable test accounts, found ${usableTestAccounts}.`)
  const [host, player] = await users(2)

  await host.page.goto('/games')
  await host.page.getByLabel('Game name').fill(`Miscount test ${Date.now()}`)
  await host.page.getByRole('button', { name: 'Create game' }).click()
  const code = (await host.page.getByTestId('game-code').textContent({ timeout: 15_000 }))!.trim()

  await player.page.goto('/games')
  await player.page.getByLabel('Game code').fill(code)
  await player.page.getByRole('button', { name: 'Join game' }).click()

  const rows = host.page.getByTestId('ledger-row')
  await expect(rows).toHaveCount(2, { timeout: 15_000 })
  for (const i of [0, 1]) {
    await rows.nth(i).getByLabel(/Buy-in amount/).fill('20')
    await rows.nth(i).getByRole('button', { name: 'Buy in' }).click()
  }
  // $40 in, $45 of chips out: the bank is $5 short.
  await rows.nth(0).getByLabel(/Cash-out chips/).fill('30')
  await rows.nth(0).getByRole('button', { name: 'Cash out' }).click()
  await rows.nth(1).getByLabel(/Cash-out chips/).fill('15')
  await rows.nth(1).getByRole('button', { name: 'Cash out' }).click()

  await expect(host.page.getByTestId('miscount')).toContainText('The bank is $5 short', { timeout: 15_000 })
  await expect(host.page.getByRole('button', { name: 'Close game' })).toBeDisabled()
  await host.page.getByRole('radio', { name: /Host covers it/ }).check()
  await host.page.getByRole('button', { name: 'Close game' }).click()

  await expect(player.page.getByTestId('game-status')).toHaveText('closed', { timeout: 15_000 })
  await expect(player.page.getByTestId('settlement')).toContainText('$15')
  await expect(player.page.getByTestId('ledger-row').nth(0)).toContainText('count adjustment -$5')
})

test('signed-out visitors cannot see games', async ({ page }) => {
  await page.goto('/games')
  await expect(page.getByText('Sign in to continue')).toBeVisible({ timeout: 15_000 })
})
