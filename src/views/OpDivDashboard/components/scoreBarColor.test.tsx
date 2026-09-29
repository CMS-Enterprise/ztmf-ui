/**
 * Tier colour on a score bar is only legible because the tier is also printed
 * beside it.
 *
 * Checked as adjacent fills the tier palette fails: Advanced (#C19A00) and
 * Initial (#D85C00) sit at ΔE 14.7 for normal vision and 7.4 under
 * deuteranopia. What makes it safe here is that no two fills are adjacent -
 * every bar has its own row - and every one carries its tier as text. Drop
 * the text and the colour becomes the only channel, which is the failure the
 * palette check describes.
 */
import { render, screen } from '@testing-library/react'
import { OpDivScorePanel, PillarPanel } from './DistributionPanels'
import type { PillarAverage } from '../opdivPillars'
import type { OpDivAverage } from '../opdivByOpDiv'

const PILLARS: PillarAverage[] = [
  {
    pillarid: 1,
    pillar: 'Identity',
    avg: 3.46,
    n: 10,
    outOfScope: 0,
    tier: 'Advanced',
    delta: null,
    deltaN: 0,
  },
  {
    pillarid: 6,
    pillar: 'CrossCutting',
    avg: 3.01,
    n: 10,
    outOfScope: 0,
    tier: 'Initial',
    delta: null,
    deltaN: 0,
  },
]

const OPDIVS: OpDivAverage[] = [
  {
    opdivId: 1,
    code: 'FDA',
    avg: 4.31,
    tier: 'Optimal',
    scored: 128,
    systems: 128,
  },
  {
    opdivId: 2,
    code: 'CMS',
    avg: 2.15,
    tier: 'Initial',
    scored: 173,
    systems: 252,
  },
]

describe('score bars name their tier as well as colouring it', () => {
  it('prints the tier beside every pillar bar', () => {
    // 3.46 and 3.01 look near-identical as bar lengths but straddle the
    // Advanced boundary - which is the information the colour adds, and the
    // text is what makes it readable without relying on the colour.
    render(
      <PillarPanel
        averages={PILLARS}
        extremes={{ weakest: null, strongest: null, systems: 10 }}
        anchorCall={null}
        isPending={false}
      />
    )
    const identity = screen.getByText('Identity').closest('li') as HTMLElement
    expect(identity).toHaveTextContent('Advanced')
    const crossCutting = screen
      .getByText('CrossCutting')
      .closest('li') as HTMLElement
    expect(crossCutting).toHaveTextContent('Initial')
  })

  it('prints the tier beside every OpDiv bar', () => {
    render(<OpDivScorePanel rows={OPDIVS} />)
    const fda = screen.getByText('FDA').closest('li') as HTMLElement
    expect(fda).toHaveTextContent('Optimal')
    const cms = screen.getByText('CMS').closest('li') as HTMLElement
    expect(cms).toHaveTextContent('Initial')
    // The denominator survives alongside the tier.
    expect(cms).toHaveTextContent('173 of 252 scored')
  })
})
