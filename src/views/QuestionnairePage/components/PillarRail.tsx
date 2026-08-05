import Box from '@mui/material/Box'
import Card from './Card'
import PillarGroup from './PillarGroup'
import type { Category } from '../helpers'

/** Props for {@link PillarRail}. */
export type PillarRailProps = {
  /** All pillar groups available in the questionnaire. */
  categories: Category[]
  /** Currently-active pillar name. */
  currentCategoryName: string
  /** Counts the answered functions inside a pillar. */
  answeredCountInCategory: (cat: Category) => number
  /**
   * Counts the carried-forward, not-yet-confirmed functions inside a pillar
   * ("N to confirm" line). Omit to render no confirmation lines.
   */
  toConfirmCountInCategory?: (cat: Category) => number
  /** Fired when the user picks a pillar. */
  onPillarClick: (category: Category) => void
}

/**
 * Left rail of the Questionnaire page: pillar list with X/Y progress badges
 * and the Cross-cutting group rendered as a separate section below the main
 * pillars (matching the redesign mock's two-section layout). Delegates each
 * group's render to {@link PillarGroup}; this component just splits the
 * categories and arranges them on the rail.
 * @param {PillarRailProps} props - Component props.
 * @returns {JSX.Element} The pillar rail card.
 */
export default function PillarRail({
  categories,
  currentCategoryName,
  answeredCountInCategory,
  toConfirmCountInCategory,
  onPillarClick,
}: PillarRailProps) {
  const main = categories.filter((c) => c.name !== 'CrossCutting')
  const cross = categories.filter((c) => c.name === 'CrossCutting')
  return (
    <Card sx={{ p: 1.5 }}>
      <PillarGroup
        eyebrow="Pillars"
        items={main}
        currentName={currentCategoryName}
        answeredCountInCategory={answeredCountInCategory}
        toConfirmCountInCategory={toConfirmCountInCategory}
        onClick={onPillarClick}
      />
      {cross.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <PillarGroup
            eyebrow="Cross-cutting"
            items={cross}
            currentName={currentCategoryName}
            answeredCountInCategory={answeredCountInCategory}
            toConfirmCountInCategory={toConfirmCountInCategory}
            onClick={onPillarClick}
          />
        </Box>
      )}
    </Card>
  )
}
