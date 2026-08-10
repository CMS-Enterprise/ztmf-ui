import { reducedPillarScopeApplies } from './reducedPillarScope'
import type { datacall } from '@/types'

const call = (
  datacallid: number,
  datacall: string,
  deadline: string
): datacall => ({ datacallid, datacall, datecreated: '', deadline })

// Ids deliberately unordered relative to deadlines - the backfill carries the
// highest id.
const FY25 = call(3, 'FY2025 Q3', '2025-05-07T23:59:59Z')
const FY26 = call(53, 'FY2026 ZTM', '2026-09-11T23:59:59Z')
const FY27 = call(4, 'FY2027 ZTM', '2027-09-11T23:59:59Z')
const FY23_BACKFILL = call(99, 'FY23 ZTM', '2023-09-30T23:59:59Z')

const ALL = [FY23_BACKFILL, FY26, FY25, FY27]

describe('reducedPillarScopeApplies', () => {
  it('applies to the FY26 anchor cycle', () => {
    expect(reducedPillarScopeApplies(ALL, FY26.datacallid)).toBe(true)
  })

  // Both true at once: a latest-only gate would flip FY26 back to the full set.
  it('applies to every cycle after the anchor, not just the latest', () => {
    expect(reducedPillarScopeApplies(ALL, FY27.datacallid)).toBe(true)
    expect(reducedPillarScopeApplies(ALL, FY26.datacallid)).toBe(true)
  })

  it('does not apply to cycles earlier than the anchor', () => {
    expect(reducedPillarScopeApplies(ALL, FY25.datacallid)).toBe(false)
  })

  it('treats a late-loaded backfill as history despite its higher id', () => {
    expect(reducedPillarScopeApplies(ALL, FY23_BACKFILL.datacallid)).toBe(false)
  })

  it('matches both the FY2026 and FY26 name prefixes', () => {
    const shortName = call(60, 'FY26 ZTM', '2026-09-11T23:59:59Z')
    expect(
      reducedPillarScopeApplies([FY25, shortName], shortName.datacallid)
    ).toBe(true)
  })

  it('is case-insensitive on the prefix match', () => {
    const lower = call(61, 'fy2026 ztm', '2026-09-11T23:59:59Z')
    expect(reducedPillarScopeApplies([FY25, lower], lower.datacallid)).toBe(
      true
    )
  })

  // Unknowable cases fall back to the full question set.
  it('does not apply when there is no FY26 cycle at all', () => {
    expect(
      reducedPillarScopeApplies([FY25, FY23_BACKFILL], FY25.datacallid)
    ).toBe(false)
  })

  it('does not apply for an unrecognized call id', () => {
    expect(reducedPillarScopeApplies(ALL, 12345)).toBe(false)
  })

  it('does not apply while the data call list is still loading', () => {
    expect(reducedPillarScopeApplies([], FY26.datacallid)).toBe(false)
    expect(reducedPillarScopeApplies(undefined, FY26.datacallid)).toBe(false)
  })

  it('does not apply without a call id', () => {
    expect(reducedPillarScopeApplies(ALL, undefined)).toBe(false)
    expect(reducedPillarScopeApplies(ALL, 0)).toBe(false)
  })

  it('trims the name before matching, as the backend does', () => {
    const padded = call(71, '  FY2026 ZTM', '2026-09-11T23:59:59Z')
    expect(reducedPillarScopeApplies([FY25, padded], padded.datacallid)).toBe(
      true
    )
  })

  // An FY26 name is authoritative, so a broken deadline on the cycle itself is
  // still in scope; a non-FY26 call can only qualify by deadline, so it is not.
  it('trusts the name over an unparseable deadline', () => {
    const brokenFY26 = call(70, 'FY2026 Broken', 'not-a-date')
    expect(reducedPillarScopeApplies([brokenFY26], brokenFY26.datacallid)).toBe(
      true
    )

    const brokenOther = call(72, 'Ad Hoc', 'not-a-date')
    expect(
      reducedPillarScopeApplies([FY26, brokenOther], brokenOther.datacallid)
    ).toBe(false)
  })

  it('applies to every FY26 cycle when there are several', () => {
    const fy26Q1 = call(50, 'FY2026 Q1', '2026-01-31T23:59:59Z')
    const fy26Q4 = call(51, 'FY2026 Q4', '2026-09-30T23:59:59Z')
    const calls = [fy26Q4, fy26Q1, FY25]

    expect(reducedPillarScopeApplies(calls, fy26Q1.datacallid)).toBe(true)
    expect(reducedPillarScopeApplies(calls, fy26Q4.datacallid)).toBe(true)
    expect(reducedPillarScopeApplies(calls, FY25.datacallid)).toBe(false)
  })

  // A non-FY26 call qualifies only once it is past EVERY FY26 cycle, so a cycle
  // interleaved between two FY26 calls stays out.
  it('requires a later cycle to be past every FY26 deadline', () => {
    const fy26Q1 = call(50, 'FY2026 Q1', '2026-01-31T23:59:59Z')
    const fy26Q4 = call(51, 'FY2026 Q4', '2026-09-30T23:59:59Z')
    const between = call(52, 'Ad Hoc', '2026-06-01T23:59:59Z')
    const after = call(53, 'Ad Hoc Later', '2026-12-01T23:59:59Z')
    const calls = [fy26Q4, fy26Q1, between, after]

    expect(reducedPillarScopeApplies(calls, between.datacallid)).toBe(false)
    expect(reducedPillarScopeApplies(calls, after.datacallid)).toBe(true)
  })

  // The regression the name check prevents: an FY26 call mis-dated before a
  // closed cycle must not drag that closed cycle into scope and restate it.
  it('does not pull a closed cycle into scope via a mis-dated FY26 call', () => {
    const misdatedFY26 = call(54, 'FY2026 Q1', '2024-06-01T23:59:59Z')
    const calls = [misdatedFY26, FY25, FY26]

    expect(reducedPillarScopeApplies(calls, FY25.datacallid)).toBe(false)
    expect(reducedPillarScopeApplies(calls, misdatedFY26.datacallid)).toBe(true)
  })
})
