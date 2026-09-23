import { groupQuestionsByPillar } from '@/utils/groupQuestionsByPillar'
import { FismaQuestion } from '@/types'

let nextId = 0

const makeQuestion = (pillarName: string, fnName: string): FismaQuestion => {
  nextId += 1
  return {
    questionid: nextId,
    question: '',
    notesprompt: '',
    pillar: { pillarid: 0, pillar: pillarName, order: 0 },
    function: {
      functionid: nextId,
      function: fnName,
      description: '',
      datacenterenvironment: '',
      order: 0,
    },
  }
}

test('keeps pillars in the order the API returned them', () => {
  const grouped = groupQuestionsByPillar([
    makeQuestion('Devices', 'PolicyEnforcement'),
    makeQuestion('Identity', 'Authentication-Users'),
  ])

  expect(grouped.map((c) => c.name)).toEqual(['Devices', 'Identity'])
})

test('keeps a pillar’s functions in the order the API returned them', () => {
  const grouped = groupQuestionsByPillar([
    makeQuestion('Identity', 'Identity-Governance'),
    makeQuestion('Identity', 'Authentication-Users'),
  ])

  expect(grouped[0].steps.map((s) => s.function.function)).toEqual([
    'Identity-Governance',
    'Authentication-Users',
  ])
})

test('ranks a pillar by its first appearance even if rows are interleaved', () => {
  const grouped = groupQuestionsByPillar([
    makeQuestion('Identity', 'Authentication-Users'),
    makeQuestion('Devices', 'PolicyEnforcement'),
    makeQuestion('Identity', 'AccessManagement'),
  ])

  expect(grouped.map((c) => c.name)).toEqual(['Identity', 'Devices'])
  expect(grouped[0].steps).toHaveLength(2)
})

test('returns no categories for an empty payload', () => {
  expect(groupQuestionsByPillar([])).toEqual([])
})

test('does not mutate the input array', () => {
  const input = [
    makeQuestion('Identity', 'Authentication-Users'),
    makeQuestion('Devices', 'PolicyEnforcement'),
  ]
  const snapshot = [...input]

  groupQuestionsByPillar(input)

  expect(input).toEqual(snapshot)
})
