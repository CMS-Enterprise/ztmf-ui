import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import NotStartedPanel from './NotStartedPanel'
import { makeProgress, makeSystem } from '../testFixtures'
import type { NoProgressRow } from '../opdivAggregates'

/** More rows than any panel names by default. */
function manyRows(count: number): NoProgressRow[] {
  return Array.from({ length: count }, (_, i) => ({
    row: {
      system: makeSystem({
        fismasystemid: i + 1,
        fismaacronym: `SYS${String(i + 1).padStart(2, '0')}`,
      }),
      progress: makeProgress(i + 1, { questionsexpected: 6 }),
    },
    awaitingConfirmation: false,
  }))
}

function renderPanel(count: number) {
  return render(
    <MemoryRouter>
      <NotStartedPanel rows={manyRows(count)} systemsInCall={count} />
    </MemoryRouter>
  )
}

describe('capped worklists', () => {
  it('names only the first few until asked for the rest', () => {
    renderPanel(12)

    expect(screen.getByText('SYS01')).toBeInTheDocument()
    expect(screen.queryByText('SYS12')).not.toBeInTheDocument()
  })

  it('opens the full list in place rather than ending on a dead count', () => {
    // "and 4 more not started." was exactly the point at which someone wants
    // the other four, and the panel's purpose is to hand off into the work.
    renderPanel(12)

    expect(
      screen.getByRole('button', { name: /show all 12 not started/i })
    ).toBeInTheDocument()
  })

  it('reveals every row, each still linked to its questionnaire', async () => {
    const user = userEvent.setup()
    renderPanel(12)

    await user.click(
      screen.getByRole('button', { name: /show all 12 not started/i })
    )

    expect(screen.getByText('SYS12')).toBeInTheDocument()
    expect(screen.getByText('SYS12').closest('a')).toHaveAttribute('href')
  })

  it('collapses again', async () => {
    const user = userEvent.setup()
    renderPanel(12)

    await user.click(screen.getByRole('button', { name: /show all/i }))
    await user.click(screen.getByRole('button', { name: /show fewer/i }))

    expect(screen.queryByText('SYS12')).not.toBeInTheDocument()
  })

  it('offers no toggle when nothing is hidden', () => {
    renderPanel(3)

    expect(
      screen.queryByRole('button', { name: /show all/i })
    ).not.toBeInTheDocument()
  })
})
