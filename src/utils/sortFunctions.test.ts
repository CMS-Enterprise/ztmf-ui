import { sortFunctions } from '@/utils/sortFunctions'
import { PILLAR_FUNCTION_MAP } from '@/constants'
import { FismaQuestion } from '@/types'

const makeStep = (fnName: string, pillarName = 'Identity'): FismaQuestion => ({
  questionid: 0,
  question: '',
  notesprompt: '',
  pillar: { pillarid: 0, pillar: pillarName, order: 0 },
  function: {
    functionid: 0,
    function: fnName,
    description: '',
    datacenterenvironment: '',
  },
})

test('sorts Identity functions into canonical CISA order', () => {
  const pillar = 'Identity'
  const shuffled = [...PILLAR_FUNCTION_MAP[pillar]]
    .reverse()
    .map((fn) => makeStep(fn))
  const sorted = sortFunctions(pillar, shuffled)
  expect(sorted.map((s) => s.function.function)).toEqual(
    PILLAR_FUNCTION_MAP[pillar]
  )
})

test('sorts Devices functions into canonical CISA order', () => {
  const pillar = 'Devices'
  const shuffled = [...PILLAR_FUNCTION_MAP[pillar]]
    .reverse()
    .map((fn) => makeStep(fn, pillar))
  const sorted = sortFunctions(pillar, shuffled)
  expect(sorted.map((s) => s.function.function)).toEqual(
    PILLAR_FUNCTION_MAP[pillar]
  )
})

test('sorts Networks functions into canonical CISA order', () => {
  const pillar = 'Networks'
  const shuffled = [...PILLAR_FUNCTION_MAP[pillar]]
    .reverse()
    .map((fn) => makeStep(fn, pillar))
  const sorted = sortFunctions(pillar, shuffled)
  expect(sorted.map((s) => s.function.function)).toEqual(
    PILLAR_FUNCTION_MAP[pillar]
  )
})

test('sorts Applications functions into canonical CISA order', () => {
  const pillar = 'Applications'
  const shuffled = [...PILLAR_FUNCTION_MAP[pillar]]
    .reverse()
    .map((fn) => makeStep(fn, pillar))
  const sorted = sortFunctions(pillar, shuffled)
  expect(sorted.map((s) => s.function.function)).toEqual(
    PILLAR_FUNCTION_MAP[pillar]
  )
})

test('sorts Data functions into canonical CISA order', () => {
  const pillar = 'Data'
  const shuffled = [...PILLAR_FUNCTION_MAP[pillar]]
    .reverse()
    .map((fn) => makeStep(fn, pillar))
  const sorted = sortFunctions(pillar, shuffled)
  expect(sorted.map((s) => s.function.function)).toEqual(
    PILLAR_FUNCTION_MAP[pillar]
  )
})

test('sorts CrossCutting functions into canonical CISA order', () => {
  const pillar = 'CrossCutting'
  const shuffled = [...PILLAR_FUNCTION_MAP[pillar]]
    .reverse()
    .map((fn) => makeStep(fn, pillar))
  const sorted = sortFunctions(pillar, shuffled)
  expect(sorted.map((s) => s.function.function)).toEqual(
    PILLAR_FUNCTION_MAP[pillar]
  )
})

test('unknown function names sort to the end, not the front', () => {
  const pillar = 'Identity'
  const steps = [
    makeStep('UnknownFunction'),
    makeStep('AccessManagement'),
    makeStep('Identity-Governance'),
  ]
  const sorted = sortFunctions(pillar, steps)
  expect(sorted.map((s) => s.function.function)).toEqual([
    'AccessManagement',
    'Identity-Governance',
    'UnknownFunction',
  ])
})

test('does not mutate the input array', () => {
  const pillar = 'Devices'
  const steps = [...PILLAR_FUNCTION_MAP[pillar]]
    .reverse()
    .map((fn) => makeStep(fn, pillar))
  const snapshot = [...steps]
  sortFunctions(pillar, steps)
  expect(steps).toEqual(snapshot)
})
