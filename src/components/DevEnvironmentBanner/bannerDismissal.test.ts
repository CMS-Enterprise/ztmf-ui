import {
  bannerVersion,
  isBannerDismissed,
  setBannerDismissed,
} from './bannerDismissal'

beforeEach(() => {
  localStorage.clear()
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
