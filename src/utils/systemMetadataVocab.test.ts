import {
  fetchSystemMetadataVocab,
  SYSTEM_METADATA_VOCAB,
  toSelectOptionsWithCurrent,
  parseCombo,
  serializeCombo,
  multiSelectOptionsWithCurrent,
} from './systemMetadataVocab'

describe('fetchSystemMetadataVocab', () => {
  test('resolves the canonical vocabulary (stopgap until the endpoint)', async () => {
    const vocab = await fetchSystemMetadataVocab()
    expect(vocab).toBe(SYSTEM_METADATA_VOCAB)
    expect(vocab.fips).toEqual(['High', 'Moderate', 'Low'])
    expect(vocab.goco_coco_gogo).toEqual(['GOCO', 'COCO', 'GOGO'])
    expect(vocab.cloud_service_model).toEqual(['IaaS', 'PaaS', 'SaaS', 'Other'])
  })
})

describe('toSelectOptionsWithCurrent', () => {
  const allowed = ['High', 'Moderate', 'Low']

  test('maps allowed values to value/label options', () => {
    expect(toSelectOptionsWithCurrent(allowed, null)).toEqual([
      { value: 'High', label: 'High' },
      { value: 'Moderate', label: 'Moderate' },
      { value: 'Low', label: 'Low' },
    ])
  })

  test('appends a legacy value not in the set as a disabled option', () => {
    const opts = toSelectOptionsWithCurrent(allowed, 'Undefined')
    expect(opts).toHaveLength(4)
    expect(opts[3]).toEqual({
      value: 'Undefined',
      label: 'Undefined',
      disabled: true,
    })
  })

  test('does not duplicate a current value already in the set', () => {
    expect(toSelectOptionsWithCurrent(allowed, 'Low')).toHaveLength(3)
  })

  test('adds nothing for a null/empty current value', () => {
    expect(toSelectOptionsWithCurrent(allowed, null)).toHaveLength(3)
    expect(toSelectOptionsWithCurrent(allowed, '')).toHaveLength(3)
    expect(toSelectOptionsWithCurrent(allowed, undefined)).toHaveLength(3)
  })
})

describe('parseCombo', () => {
  test('splits a slash combo into trimmed parts', () => {
    expect(parseCombo('IaaS/PaaS')).toEqual(['IaaS', 'PaaS'])
  })

  test('tolerates legacy comma/semicolon delimiters and whitespace', () => {
    expect(parseCombo('IaaS, PaaS')).toEqual(['IaaS', 'PaaS'])
    expect(parseCombo('IaaS;PaaS ; SaaS')).toEqual(['IaaS', 'PaaS', 'SaaS'])
  })

  test('returns an empty array for null/empty', () => {
    expect(parseCombo(null)).toEqual([])
    expect(parseCombo('')).toEqual([])
    expect(parseCombo(undefined)).toEqual([])
  })
})

describe('serializeCombo', () => {
  test('sorts and slash-joins for a stable stored string', () => {
    expect(serializeCombo(['PaaS', 'IaaS'])).toBe('IaaS/PaaS')
    expect(serializeCombo(['SaaS', 'IaaS', 'PaaS'])).toBe('IaaS/PaaS/SaaS')
  })

  test('de-duplicates and trims', () => {
    expect(serializeCombo(['IaaS', 'IaaS ', ' PaaS'])).toBe('IaaS/PaaS')
  })

  test('empty selection serializes to null (unset stays unset)', () => {
    expect(serializeCombo([])).toBeNull()
    expect(serializeCombo(['', '  '])).toBeNull()
  })

  test('round-trips with parseCombo', () => {
    expect(serializeCombo(parseCombo('SaaS/IaaS'))).toBe('IaaS/SaaS')
  })
})

describe('multiSelectOptionsWithCurrent', () => {
  const allowed = ['IaaS', 'PaaS', 'SaaS', 'Other']

  test('returns the canonical parts when the current parts are all canonical', () => {
    expect(multiSelectOptionsWithCurrent(allowed, ['IaaS'])).toEqual(allowed)
  })

  test('appends a legacy part not in the canon so it is not dropped', () => {
    expect(multiSelectOptionsWithCurrent(allowed, ['IaaS', 'FaaS'])).toEqual([
      ...allowed,
      'FaaS',
    ])
  })
})
