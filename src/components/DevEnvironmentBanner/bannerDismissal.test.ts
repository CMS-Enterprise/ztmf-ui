import {
  bannerVersion,
  isBannerDismissed,
  setBannerDismissed,
} from './bannerDismissal'

beforeEach(() => {
  localStorage.clear()
})

// resetMocks clears a spy's implementation but leaves it installed over
// Storage.prototype, breaking localStorage for every test added after.
afterEach(() => {
  jest.restoreAllMocks()
})

test('derives a stable stamp for the same copy', () => {
  expect(bannerVersion('Testing runs through July 17th.')).toBe(
    bannerVersion('Testing runs through July 17th.')
  )
})

test('derives a different stamp for different copy', () => {
  expect(bannerVersion('Testing runs through July 17th.')).not.toBe(
    bannerVersion('Testing is ongoing.')
  )
})

test('treats blank and whitespace-only copy as the default notice', () => {
  expect(bannerVersion('   ')).toBe(bannerVersion(''))
})

test('ignores surrounding whitespace, matching the rendered copy', () => {
  expect(bannerVersion('  Testing is ongoing.  ')).toBe(
    bannerVersion('Testing is ongoing.')
  )
})

test('records and reports a dismissal for one copy version only', () => {
  const current = bannerVersion('Testing is ongoing.')
  expect(isBannerDismissed(current)).toBe(false)

  setBannerDismissed(current)
  expect(isBannerDismissed(current)).toBe(true)
  // Replacing the copy re-surfaces the banner rather than staying dismissed.
  expect(isBannerDismissed(bannerVersion('Testing has ended.'))).toBe(false)
})

test('writes the dismissal under the documented key', () => {
  setBannerDismissed(bannerVersion('Testing is ongoing.'))
  // Pinned: renaming the key un-dismisses the banner for everyone.
  const raw = localStorage.getItem('ztmf_banner_dismissed')
  expect(JSON.parse(raw as string)).toEqual({
    v: bannerVersion('Testing is ongoing.'),
    t: expect.any(Number),
  })
})

test('expires a dismissal older than the TTL', () => {
  const version = bannerVersion('Testing is ongoing.')
  const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000
  localStorage.setItem(
    'ztmf_banner_dismissed',
    JSON.stringify({ v: version, t: eightDaysAgo })
  )
  expect(isBannerDismissed(version)).toBe(false)
})

test('honors a dismissal inside the TTL', () => {
  const version = bannerVersion('Testing is ongoing.')
  const sixDaysAgo = Date.now() - 6 * 24 * 60 * 60 * 1000
  localStorage.setItem(
    'ztmf_banner_dismissed',
    JSON.stringify({ v: version, t: sixDaysAgo })
  )
  expect(isBannerDismissed(version)).toBe(true)
})

// Records written before the TTL existed are bare stamps with no timestamp.
// They must read as not-dismissed and survive the read - clearing them is the
// trap #683 is open for.
test.each([
  ['a pre-TTL bare stamp', bannerVersion('Testing is ongoing.')],
  ['a record with no timestamp', JSON.stringify({ v: 'default' })],
  ['a non-numeric timestamp', JSON.stringify({ v: 'default', t: 'today' })],
  // A numeric string would coerce through the subtraction and read as fresh,
  // so the type guard is what rejects it rather than the NaN comparison.
  ['a stringified timestamp', `{"v":"default","t":"${Date.now()}"}`],
  ['unparseable content', '{not json'],
])('treats %s as not dismissed without clearing it', (_label, stored) => {
  localStorage.setItem('ztmf_banner_dismissed', stored)
  expect(isBannerDismissed(bannerVersion('Testing is ongoing.'))).toBe(false)
  expect(isBannerDismissed('default')).toBe(false)
  expect(localStorage.getItem('ztmf_banner_dismissed')).toBe(stored)
})

test('a later dismissal replaces the stamp rather than accumulating keys', () => {
  setBannerDismissed(bannerVersion('First notice.'))
  setBannerDismissed(bannerVersion('Second notice.'))
  expect(localStorage.length).toBe(1)
  expect(isBannerDismissed(bannerVersion('First notice.'))).toBe(false)
  expect(isBannerDismissed(bannerVersion('Second notice.'))).toBe(true)
})

test('reports not dismissed when storage throws', () => {
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('storage disabled')
  })
  expect(isBannerDismissed('anything')).toBe(false)
})

test('swallows a failed write', () => {
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('storage disabled')
  })
  expect(() => setBannerDismissed('anything')).not.toThrow()
})
