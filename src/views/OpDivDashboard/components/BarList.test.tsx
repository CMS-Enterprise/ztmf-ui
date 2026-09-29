import { render, screen } from '@testing-library/react'
import BarList from './BarList'
import { stageColor } from './stageColor'
import { NO_SCORE_LABEL } from '../opdivAggregates'

/** Reads the rendered fill width off a row, as a number of percent. */
function fillPct(label: string): number {
  const row = screen.getByText(label).closest('li') as HTMLElement
  const fill = row.querySelector('[aria-hidden="true"] > *') as HTMLElement
  return Number.parseFloat(fill.style.width)
}

describe('BarList scale', () => {
  it('measures counts from zero', () => {
    render(
      <BarList
        items={[
          { label: 'Cloud', value: 25 },
          { label: 'On-premises', value: 75 },
        ]}
        max={100}
      />
    )
    expect(fillPct('Cloud')).toBeCloseTo(25)
    expect(fillPct('On-premises')).toBeCloseTo(75)
  })

  it('measures scores from the floor of the 1-5 scale, not from zero', () => {
    // A score of 1.00 is the bottom of the scale - nothing achieved. Measured
    // from zero it rendered a fifth full, which reads as progress that does
    // not exist, and compressed the real 1-5 spread into the rest of the bar.
    render(
      <BarList
        items={[
          { label: 'Floor', value: 1 },
          { label: 'Middle', value: 3 },
          { label: 'Ceiling', value: 5 },
        ]}
        max={5}
        min={1}
      />
    )
    expect(fillPct('Floor')).toBeCloseTo(0)
    expect(fillPct('Middle')).toBeCloseTo(50)
    expect(fillPct('Ceiling')).toBeCloseTo(100)
  })

  it('never renders a NaN width when every value is zero', () => {
    render(<BarList items={[{ label: 'None', value: 0 }]} />)
    expect(fillPct('None')).toBe(0)
  })

  it('clamps a value past the ceiling rather than overflowing the track', () => {
    render(<BarList items={[{ label: 'Over', value: 9 }]} max={5} min={1} />)
    expect(fillPct('Over')).toBe(100)
  })
})

describe('stageColor', () => {
  it('gives "No score" a different neutral from "Not Assessed"', () => {
    // These were the identical hex, which rendered the two largest buckets of
    // a mostly-unscored OpDiv as one flat grey ring - throwing away the exact
    // distinction the two buckets exist to draw.
    expect(stageColor(NO_SCORE_LABEL)).not.toBe(stageColor('Not Assessed'))
  })

  it('keeps each scored tier on its own color', () => {
    const tiers = ['Optimal', 'Advanced', 'Initial', 'Traditional']
    const colors = tiers.map(stageColor)
    expect(new Set(colors).size).toBe(tiers.length)
  })
})
