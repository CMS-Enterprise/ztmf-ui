// systemMetadataVocab (imported transitively for formatBool/formatList) loads
// axiosConfig, which reads import.meta.env at module load and throws under
// @swc/jest. Swap in a bare axios instance.
jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: '/api/v1/' }) }
})

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

function renderWithExtended(extra: Partial<FismaSystemType>) {
  return renderWithProviders(
    <SystemDetailReadView
      system={{ ...BASE_SYSTEM, ...extra } as FismaSystemType}
      decommissionedByName=""
      opdivName="CMS"
    />
  )
}

describe('extended metadata formatting', () => {
  test('renders tri-state booleans as Yes/No/Unknown, not raw values', () => {
    renderWithExtended({ hva: true, cloud_system: false, legacy: null })
    expect(screen.getByText('HVA')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('No')).toBeInTheDocument()
    // The raw boolean shape must never reach the page.
    expect(screen.queryByText('true')).not.toBeInTheDocument()
    expect(screen.queryByText('false')).not.toBeInTheDocument()
  })

  test('renders a decomposed multi-select as a comma list', () => {
    renderWithExtended({ cloud_service_model: ['IaaS', 'PaaS'] })
    expect(screen.getByText('Cloud Service Model')).toBeInTheDocument()
    expect(screen.getByText('IaaS, PaaS')).toBeInTheDocument()
  })

  test('applies the legacy field custom boolean labels', () => {
    // legacy is a funding disposition; its label is "Not Funded for
    // Remediation", so true reads "Not funded" rather than a double-negative
    // "Yes".
    renderWithExtended({ legacy: true })
    expect(screen.getByText('Not Funded for Remediation')).toBeInTheDocument()
    expect(screen.getByText('Not funded')).toBeInTheDocument()
    expect(screen.queryByText('Yes')).not.toBeInTheDocument()
  })

  test('hides the extended card when only an empty array is present', () => {
    renderWithExtended({ cloud_service_model: [] })
    expect(screen.queryByText('Cloud Service Model')).not.toBeInTheDocument()
  })

  test('shows the extended card when a boolean is explicitly No', () => {
    renderWithExtended({ cloud_system: false })
    expect(screen.getByText('Cloud System')).toBeInTheDocument()
  })

  test('hides the cloud dependents when cloud_system is No', () => {
    // Cloud service model and vendor do not apply to a non-cloud system, so the
    // read view omits them just as the edit view does.
    renderWithExtended({
      cloud_system: false,
      cloud_vendor: 'AWS',
      cloud_service_model: ['IaaS'],
    })
    expect(screen.getByText('Cloud System')).toBeInTheDocument()
    expect(screen.queryByText('Cloud Vendor')).not.toBeInTheDocument()
    expect(screen.queryByText('Cloud Service Model')).not.toBeInTheDocument()
  })
})
