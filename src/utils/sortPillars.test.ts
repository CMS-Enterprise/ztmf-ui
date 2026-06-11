import { sortPillars } from '@/utils/sortPillars'

test('orders pillars into the canonical sequence regardless of input order', () => {
  const input = [
    'Data',
    'Identity',
    'CrossCutting',
    'Networks',
    'Devices',
    'Applications',
  ]

  expect(sortPillars(input)).toEqual([
    'Identity',
    'Devices',
    'Networks',
    'Applications',
    'Data',
    'CrossCutting',
  ])
})

test('places unknown/unmapped pillar names at the end', () => {
  const input = ['BrandNewPillar', 'Devices', 'Identity']

  expect(sortPillars(input)).toEqual(['Identity', 'Devices', 'BrandNewPillar'])
})

test('does not mutate the input array', () => {
  const input = ['Data', 'Identity']
  const snapshot = [...input]

  sortPillars(input)

  expect(input).toEqual(snapshot)
})
