// Venmo usernames are 5–30 letters, numbers, hyphens or underscores.
const USERNAME = /^[A-Za-z0-9_-]{5,30}$/

/** Cleans what a host typed ("@calvin-poker", " calvin-poker ") into a username, or null if it can't be one. */
export function parseVenmoUsername(input: string): string | null {
  const username = input.trim().replace(/^@/, '')
  return USERNAME.test(username) ? username : null
}

/**
 * A Venmo pay link with the recipient, amount and note filled in, in the format
 * from venmo.com/paymentlinks. On a phone it opens the Venmo app. Private, so a
 * poker buy-in doesn't land in anyone's public feed.
 */
export function venmoPayUrl(username: string, amountCents: number, note: string): string {
  const params = new URLSearchParams({
    txn: 'pay',
    recipients: username,
    amount: (amountCents / 100).toFixed(2),
    note,
    audience: 'private',
  })
  return `https://venmo.com/?${params}`
}
