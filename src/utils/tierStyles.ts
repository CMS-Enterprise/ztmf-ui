import type { ScoreTier } from '@/types'

// Two style sub-keys per tier: chip (soft pastels + dark text for modal
// chips; AAA contrast at chip text size) and cell (high-contrast pastels
// that pass 508/WCAG color-distinguishability on table score cells;
// black-on-pastel is >10:1 for every entry).
// Not Assessed cell is transparent so a score-0 table row reads as
// "no signal" rather than a false tier color.
export const TIERS: Record<
  ScoreTier,
  {
    chip: { color: string; backgroundColor: string }
    cell: { backgroundColor: string }
  }
> = {
  Optimal: {
    chip: { color: '#0F5C4C', backgroundColor: '#E8F8F6' },
    cell: { backgroundColor: '#93F0ED' },
  },
  Advanced: {
    chip: { color: '#6B6200', backgroundColor: '#FEFEF0' },
    cell: { backgroundColor: '#F2FBC4' },
  },
  Initial: {
    chip: { color: '#A34200', backgroundColor: '#FFF4E6' },
    cell: { backgroundColor: '#FFD5A5' },
  },
  Traditional: {
    chip: { color: '#663399', backgroundColor: '#F3F0FF' },
    cell: { backgroundColor: '#DAA9EC' },
  },
  'Not Assessed': {
    chip: { color: '#525252', backgroundColor: '#F8F8F8' },
    cell: { backgroundColor: 'transparent' },
  },
}

export const tierStyle = (tier: ScoreTier | undefined) =>
  tier ? TIERS[tier] : undefined
