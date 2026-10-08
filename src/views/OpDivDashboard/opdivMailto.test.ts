import { MAILTO_MAX_LENGTH, bareAddress, buildOpDivMailto } from './opdivMailto'
import { makeSystem } from './testFixtures'

describe('buildOpDivMailto', () => {
  it('collects ISSO and data-call contacts, deduped case-insensitively', () => {
    const systems = [
      makeSystem({
        fismasystemid: 1,
        issoemail: 'isso@example.gov',
        datacallcontact: 'poc@example.gov',
      }),
      makeSystem({
        fismasystemid: 2,
        // Same person, different capitalization across systems.
        issoemail: 'ISSO@example.gov',
        datacallcontact: 'poc@example.gov',
      }),
    ]
    const result = buildOpDivMailto(systems, 'NIH')
    expect(result.count).toBe(2)
    expect(result.addresses).toEqual(['isso@example.gov', 'poc@example.gov'])
  })

  it('puts recipients in bcc so contacts are not disclosed to each other', () => {
    const result = buildOpDivMailto(
      [
        makeSystem({
          fismasystemid: 1,
          issoemail: 'a@example.gov',
          datacallcontact: undefined,
        }),
      ],
      'NIH'
    )
    expect(result.href).toContain('bcc=')
    expect(result.href).not.toContain('to=')
  })

  it('skips blank and whitespace-only addresses', () => {
    const systems = [
      makeSystem({ fismasystemid: 1, issoemail: '', datacallcontact: '   ' }),
      makeSystem({
        fismasystemid: 2,
        issoemail: null,
        datacallcontact: undefined,
      }),
    ]
    const result = buildOpDivMailto(systems, 'NIH')
    expect(result.count).toBe(0)
    expect(result.addresses).toEqual([])
  })

  it('drops the recipient list rather than letting a client truncate it silently', () => {
    // Long links get cut by mail clients without warning, which would silently
    // lose recipients; the caller offers the full list to copy instead.
    const systems = Array.from({ length: 200 }, (_, i) =>
      makeSystem({
        fismasystemid: i + 1,
        issoemail: `a-very-long-address-${i}@example.gov`,
        datacallcontact: undefined,
      })
    )
    const result = buildOpDivMailto(systems, 'NIH')
    expect(result.truncated).toBe(true)
    expect(result.href).not.toContain('bcc=')
    expect(result.href.length).toBeLessThanOrEqual(MAILTO_MAX_LENGTH)
    // Nothing is lost - the addresses are still returned for the fallback.
    expect(result.addresses).toHaveLength(200)
  })

  it('names the OpDiv in the subject', () => {
    const result = buildOpDivMailto(
      [makeSystem({ fismasystemid: 1, issoemail: 'a@example.gov' })],
      'NIH'
    )
    expect(decodeURIComponent(result.href)).toContain(
      'NIH Zero Trust data call'
    )
  })

  it('strips display names so a comma in one cannot split the list', () => {
    // mail.ParseAddress on the backend accepts both of these forms.
    const result = buildOpDivMailto(
      [
        makeSystem({
          fismasystemid: 1,
          issoemail: '"Doe, Jane" <jane@example.gov>',
          datacallcontact: 'poc@example.gov (Pat Contact)',
        }),
        makeSystem({
          fismasystemid: 2,
          issoemail: 'JANE@example.gov',
          datacallcontact: undefined,
        }),
      ],
      'NIH'
    )
    expect(result.addresses).toEqual(['jane@example.gov', 'poc@example.gov'])
    expect(decodeURIComponent(result.href)).toContain(
      'bcc=jane@example.gov,poc@example.gov&'
    )
  })
})

describe('bareAddress', () => {
  it.each([
    ['a@example.gov', 'a@example.gov'],
    ['Jane <a@example.gov>', 'a@example.gov'],
    ['"Doe, Jane" <a@example.gov>', 'a@example.gov'],
    ['a@example.gov (Jane)', 'a@example.gov'],
  ])('%s -> %s', (raw, expected) => {
    expect(bareAddress(raw)).toBe(expected)
  })
})
