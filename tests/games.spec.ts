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

test('signed-out visitors cannot see games', async ({ page }) => {
  await page.goto('/games')
  await expect(page.getByText('Sign in to continue')).toBeVisible({ timeout: 15_000 })
})
