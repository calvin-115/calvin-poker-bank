import { describe, expect, it } from 'vitest'
import { parseVenmoUsername, venmoPayUrl } from './venmo'

describe('parseVenmoUsername', () => {
  it('accepts a username with or without the @', () => {
    expect(parseVenmoUsername('@calvin-poker')).toBe('calvin-poker')
    expect(parseVenmoUsername('  Calvin_Poker ')).toBe('Calvin_Poker')
  })

  it('rejects things that cannot be a Venmo username', () => {
    expect(parseVenmoUsername('abc')).toBeNull()
    expect(parseVenmoUsername('has space')).toBeNull()
    expect(parseVenmoUsername('https://venmo.com/u/calvin')).toBeNull()
    expect(parseVenmoUsername('')).toBeNull()
  })
})

describe('venmoPayUrl', () => {
  it('fills in recipient, amount and an encoded note, kept private', () => {
    const url = new URL(venmoPayUrl('calvin-poker', 4000, 'Friday Night buy-in'))
    expect(url.origin).toBe('https://venmo.com')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      txn: 'pay',
      recipients: 'calvin-poker',
      amount: '40.00',
      note: 'Friday Night buy-in',
      audience: 'private',
    })
  })

  it('keeps cents', () => {
    expect(new URL(venmoPayUrl('calvin-poker', 1250, 'x')).searchParams.get('amount')).toBe('12.50')
  })
})
