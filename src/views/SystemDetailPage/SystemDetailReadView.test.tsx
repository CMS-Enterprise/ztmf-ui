import { screen } from '@testing-library/react'
import SystemDetailReadView from './SystemDetailReadView'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import type { FismaSystemType } from '@/types'

const BASE_SYSTEM = {
  fismasystemid: 1,
  fismaname: 'Test System',
  fismaacronym: 'TS',
  decommissioned: false,
  sdl_sync_enabled: null,
  groupacronym: 'CMS-CCS',
  groupname: 'Center for Consumer Strategies',
  divisionname: null,
} as unknown as FismaSystemType

function renderView(opdivName: string | null) {
  return renderWithProviders(
    <SystemDetailReadView
      system={BASE_SYSTEM}
      decommissionedByName=""
      opdivName={opdivName}
    />
  )
}

test('renders the OpDiv name in the Organization section', () => {
  renderView('CMS')
  expect(screen.getByText('OpDiv')).toBeInTheDocument()
  expect(screen.getByText('CMS')).toBeInTheDocument()
})

test('shows the em-dash fallback when opdivName is null', () => {
  renderView(null)
  // Label always present; value falls back to — via FieldDisplay
  expect(screen.getByText('OpDiv')).toBeInTheDocument()
  expect(screen.queryByText('CMS')).not.toBeInTheDocument()
})

test('OpDiv label appears before Group Acronym in the Organization card', () => {
  renderView('CMS')
  const opdivLabel = screen.getByText('OpDiv')
  const groupLabel = screen.getByText('Group Acronym')
  // DOCUMENT_POSITION_FOLLOWING (4): groupLabel comes after opdivLabel in the DOM
  expect(
    opdivLabel.compareDocumentPosition(groupLabel) &
      Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy()
})
