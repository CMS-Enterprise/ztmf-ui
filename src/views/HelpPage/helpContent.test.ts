import { HELP_CONTENT, PUBLIC_SIGNIN_HELP, helpAudience } from './helpContent'
import { SCORING_FORMULA, tierForScore } from '@/utils/tierStyles'
import { UNKNOWN_EMAIL_MESSAGE } from '@/utils/authCodes'

describe('helpAudience', () => {
  it.each([
    ['entra', 'hhs'],
    ['okta', 'cms'],
    [undefined, 'cms'],
  ] as const)('maps %p to %p', (idp, audience) => {
    expect(helpAudience({ identity_provider: idp })).toBe(audience)
  })
})

describe('HELP_CONTENT', () => {
  const text = (audience: 'cms' | 'hhs') =>
    JSON.stringify(HELP_CONTENT[audience])

  it('gives each audience its own sign-in guidance', () => {
    expect(text('cms')).toContain('CMS IDM (Okta)')
    expect(text('hhs')).toContain('HHS Entra')
    expect(text('hhs')).not.toContain('CMS IDM (Okta)')
  })

  it('explains scoring with the formula the app uses', () => {
    expect(text('cms')).toContain(SCORING_FORMULA)
    expect(text('hhs')).toContain(SCORING_FORMULA)
  })

  it('covers System Delegates for HHS and says CMS does not use them', () => {
    expect(HELP_CONTENT.hhs.topics.map((t) => t.id)).toContain('delegates')
    expect(HELP_CONTENT.cms.topics.map((t) => t.id)).not.toContain('delegates')
    expect(text('cms')).toContain('not used at CMS')
  })

  it('keeps the CMS content to CMS', () => {
    // cms.hhs.gov is the CMS email domain, not an HHS reference.
    const cms = text('cms').replace(/cms\.hhs\.gov/g, '')
    expect(cms).not.toMatch(/HHS|Entra|OpDiv representative|zerotrust@/)
  })

  it('gives every topic a unique id', () => {
    for (const audience of ['cms', 'hhs'] as const) {
      const ids = HELP_CONTENT[audience].topics.map((t) => t.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('shows the same tier cutoffs the app scores with', () => {
    const scoring = HELP_CONTENT.cms.topics.find((t) => t.id === 'scoring')
    const table = scoring?.blocks.find((b) => b.kind === 'table')
    if (table?.kind !== 'table') throw new Error('scoring table missing')
    const rows = table.rows.map(([tier, range]) => {
      const [low, high] = range.match(/\d+\.\d+/g)!.map(Number)
      return { tier, low, high }
    })
    for (const { tier, low } of rows) {
      expect(tierForScore(low)).toBe(tier)
      expect(tierForScore(low - 0.01)).not.toBe(tier)
    }
    for (const { tier, high } of rows.filter((r) => r.high !== undefined)) {
      expect(tierForScore(high)).toBe(tier)
      expect(tierForScore(high + 0.01)).not.toBe(tier)
    }
  })
})

describe('PUBLIC_SIGNIN_HELP', () => {
  it('covers both audiences and never names a ZTMF mailbox', () => {
    const text = JSON.stringify(PUBLIC_SIGNIN_HELP)
    expect(text).toContain('CMS IDM (Okta)')
    expect(PUBLIC_SIGNIN_HELP.intro).toContain(UNKNOWN_EMAIL_MESSAGE)
    expect(text).toContain('HHS Entra')
    expect(text).not.toMatch(/zerotrust@|ISPGZeroTrust/i)
  })
})
