import MockAdapter from 'axios-mock-adapter'

// Replace the app's axios instance with a bare one. The production module
// reads import.meta.env at load time, which throws under @swc/jest.
jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: '/api/v1/' }) }
})

import axiosInstance from '@/axiosConfig'
import {
  fetchSystemAttributes,
  optionsForField,
  booleanOptions,
  boolToSelectValue,
  selectValueToBool,
  formatBool,
  formatList,
  extendedFieldEqual,
  buildExtendedDiff,
  crossFieldClears,
  isCrossFieldHidden,
} from './systemMetadataVocab'
import type { SystemAttribute, FismaSystemType } from '@/types'

const mock = new MockAdapter(axiosInstance)
afterEach(() => mock.reset())

const ROWS: SystemAttribute[] = [
  {
    field: 'fips',
    value: 'High',
    selectable: true,
    ordr: 30,
  },
  {
    field: 'fips',
    value: 'Low',
    selectable: true,
    ordr: 10,
  },
  {
    field: 'fips',
    value: 'Moderate',
    selectable: true,
    ordr: 20,
  },
  {
    // non-selectable row: never offered as an option.
    field: 'fips',
    value: '',
    selectable: false,
    ordr: 0,
  },
  {
    field: 'cloud_service_model',
    value: 'IaaS',
    selectable: true,
    ordr: 10,
  },
]

describe('fetchSystemAttributes', () => {
  it('unwraps the { data: [...] } envelope', async () => {
    mock.onGet('/systemattributes').reply(200, { data: ROWS })
    await expect(fetchSystemAttributes()).resolves.toEqual(ROWS)
  })

  it('returns an empty array when data is null', async () => {
    mock.onGet('/systemattributes').reply(200, { data: null })
    await expect(fetchSystemAttributes()).resolves.toEqual([])
  })

  it('requests selectable_only by default and can opt out', async () => {
    mock.onGet('/systemattributes').reply((config) => {
      return [200, { data: [], params: config.params }]
    })

    await fetchSystemAttributes()
    expect(mock.history.get[0].params).toEqual({ selectable_only: true })

    await fetchSystemAttributes(undefined, false)
    expect(mock.history.get[1].params).toBeUndefined()
  })

  it('rejects on a server error', async () => {
    mock.onGet('/systemattributes').reply(500)
    await expect(fetchSystemAttributes()).rejects.toBeDefined()
  })
})

describe('optionsForField', () => {
  it('keeps a fields selectable rows, ordered by ordr', () => {
    expect(optionsForField(ROWS, 'fips')).toEqual([
      { value: 'Low', label: 'Low' },
      { value: 'Moderate', label: 'Moderate' },
      { value: 'High', label: 'High' },
    ])
  })

  it('excludes non-selectable help rows', () => {
    const values = optionsForField(ROWS, 'fips').map((o) => o.value)
    expect(values).not.toContain('')
  })

  it('narrows to the requested field only', () => {
    expect(optionsForField(ROWS, 'cloud_service_model')).toEqual([
      { value: 'IaaS', label: 'IaaS' },
    ])
  })

  it('returns an empty array for an unknown field', () => {
    expect(optionsForField(ROWS, 'nope')).toEqual([])
  })
})

describe('tri-state boolean conversions', () => {
  it('maps a boolean|null to its select value', () => {
    expect(boolToSelectValue(true)).toBe('true')
    expect(boolToSelectValue(false)).toBe('false')
    expect(boolToSelectValue(null)).toBe('')
    expect(boolToSelectValue(undefined)).toBe('')
  })

  it('maps a select value back to the wire boolean|null', () => {
    expect(selectValueToBool('true')).toBe(true)
    expect(selectValueToBool('false')).toBe(false)
    expect(selectValueToBool('')).toBeNull()
  })

  it('round-trips through both directions', () => {
    for (const v of [true, false, null] as const) {
      expect(selectValueToBool(boolToSelectValue(v))).toBe(v)
    }
  })
})

describe('booleanOptions', () => {
  it('defaults to Yes/No/Unknown', () => {
    expect(booleanOptions()).toEqual([
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
      { value: '', label: 'Unknown' },
    ])
  })

  it('overrides the true/false labels but keeps values and Unknown', () => {
    expect(booleanOptions({ true: 'Not funded', false: 'Funded' })).toEqual([
      { value: 'true', label: 'Not funded' },
      { value: 'false', label: 'Funded' },
      { value: '', label: 'Unknown' },
    ])
  })
})

describe('display formatting', () => {
  it('formats a tri-state boolean as Yes/No/Unknown', () => {
    expect(formatBool(true)).toBe('Yes')
    expect(formatBool(false)).toBe('No')
    expect(formatBool(null)).toBe('Unknown')
    expect(formatBool(undefined)).toBe('Unknown')
  })

  it('applies custom true/false labels, leaving Unknown', () => {
    const labels = { true: 'Not funded', false: 'Funded' }
    expect(formatBool(true, labels)).toBe('Not funded')
    expect(formatBool(false, labels)).toBe('Funded')
    expect(formatBool(null, labels)).toBe('Unknown')
  })

  it('joins a decomposed list, with a placeholder when empty', () => {
    expect(formatList(['IaaS', 'PaaS'])).toBe('IaaS, PaaS')
    expect(formatList([])).toBe('—')
    expect(formatList(null)).toBe('—')
    expect(formatList(undefined)).toBe('—')
  })
})

describe('extendedFieldEqual', () => {
  it('treats null and undefined as the same unset', () => {
    expect(extendedFieldEqual(null, undefined)).toBe(true)
    expect(extendedFieldEqual(undefined, null)).toBe(true)
  })

  it('compares scalars by value', () => {
    expect(extendedFieldEqual('High', 'High')).toBe(true)
    expect(extendedFieldEqual('High', 'Low')).toBe(false)
    expect(extendedFieldEqual(true, false)).toBe(false)
  })

  it('compares arrays order-insensitively', () => {
    expect(extendedFieldEqual(['IaaS', 'PaaS'], ['PaaS', 'IaaS'])).toBe(true)
    expect(extendedFieldEqual(['IaaS'], ['IaaS', 'PaaS'])).toBe(false)
  })

  it('treats an empty array and unset as the same stored state', () => {
    // Both mean "no values", so a diff against an unset baseline skips the
    // redundant clear rather than sending an empty array the backend already
    // reflects.
    expect(extendedFieldEqual([], null)).toBe(true)
    expect(extendedFieldEqual([], undefined)).toBe(true)
  })
})

describe('buildExtendedDiff', () => {
  const KEYS = [
    'hva',
    'fips',
    'cloud_system',
    'cloud_service_model',
    'cloud_vendor',
  ] as (keyof FismaSystemType)[]

  const base = {
    hva: true,
    fips: 'Low',
    cloud_system: true,
    cloud_service_model: ['IaaS'],
    cloud_vendor: 'AWS',
  } as unknown as FismaSystemType

  it('omits unchanged fields', () => {
    expect(buildExtendedDiff(base, base, KEYS)).toEqual({})
  })

  it('includes only changed fields, at their typed value', () => {
    const edited = { ...base, fips: 'High', hva: false } as FismaSystemType
    expect(buildExtendedDiff(edited, base, KEYS)).toEqual({
      fips: 'High',
      hva: false,
    })
  })

  it('sends each per-type clear signal for a cleared field', () => {
    const edited = {
      ...base,
      fips: '',
      cloud_system: null,
      cloud_service_model: [],
    } as unknown as FismaSystemType
    expect(buildExtendedDiff(edited, base, KEYS)).toEqual({
      fips: '',
      cloud_system: null,
      cloud_service_model: [],
    })
  })

  it('normalizes an unset changed field to null', () => {
    const edited = { ...base, cloud_vendor: undefined } as FismaSystemType
    expect(buildExtendedDiff(edited, base, KEYS)).toEqual({
      cloud_vendor: null,
    })
  })

  it('treats a missing baseline as every field unset (create path)', () => {
    const edited = {
      hva: false,
      fips: 'Low',
      cloud_system: null,
      cloud_service_model: [],
      cloud_vendor: null,
    } as unknown as FismaSystemType
    // Only the fields that differ from unset are sent: the booleans/arrays that
    // are already at their clear signal are omitted.
    expect(buildExtendedDiff(edited, null, KEYS)).toEqual({
      hva: false,
      fips: 'Low',
    })
  })
})

describe('crossFieldClears', () => {
  it('clears cloud model and vendor when cloud_system is set to No', () => {
    expect(crossFieldClears('cloud_system', false)).toEqual({
      cloud_service_model: [],
      cloud_vendor: '',
    })
  })

  it('does not cascade when cloud_system is Yes or Unknown', () => {
    expect(crossFieldClears('cloud_system', true)).toEqual({})
    expect(crossFieldClears('cloud_system', null)).toEqual({})
  })

  it('does not cascade for other fields', () => {
    expect(crossFieldClears('fips', 'Low')).toEqual({})
  })
})

describe('isCrossFieldHidden', () => {
  it('hides cloud model and vendor while cloud_system is No', () => {
    expect(
      isCrossFieldHidden('cloud_service_model', { cloud_system: false })
    ).toBe(true)
    expect(isCrossFieldHidden('cloud_vendor', { cloud_system: false })).toBe(
      true
    )
  })

  it('shows them when cloud_system is Yes or Unknown', () => {
    expect(
      isCrossFieldHidden('cloud_service_model', { cloud_system: true })
    ).toBe(false)
    expect(
      isCrossFieldHidden('cloud_service_model', { cloud_system: null })
    ).toBe(false)
  })

  it('never hides unrelated fields', () => {
    expect(isCrossFieldHidden('fips', { cloud_system: false })).toBe(false)
  })
})
