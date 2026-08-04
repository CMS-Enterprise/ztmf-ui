import {
  carryForwardState,
  canConfirmCarryForward,
  buildScoreByFunction,
  buildConfirmSummary,
} from './confirmState'
import type { QuestionScores, FismaQuestion, ScoreStatus } from '@/types'

const score = (over: Partial<QuestionScores> = {}): QuestionScores => ({
  scoreid: 1,
  fismasystemid: 10,
  datecalculated: 0,
  notes: 'carried notes',
  functionoptionid: 100,
  datacallid: 5,
  ...over,
})

const question = (
  functionid: number,
  name = `fn-${functionid}`
): FismaQuestion => ({
  questionid: functionid + 1000,
  question: `Q ${functionid}`,
  notesprompt: '',
  pillar: { pillar: 'Devices', pillarid: 1, order: 1 },
  function: {
    functionid,
    function: name,
    description: '',
    datacenterenvironment: 'Hybrid',
  },
})

describe('carryForwardState', () => {
  it('classifies a not_started row on the open call as unconfirmed', () => {
    expect(carryForwardState(score({ status: 'not_started' }), true)).toBe(
      'unconfirmed'
    )
  })

  it('classifies a done row on the open call as updated', () => {
    expect(carryForwardState(score({ status: 'done' }), true)).toBe('updated')
  })

  it('renders nothing on a past call — historical rows are legitimately not_started forever', () => {
    expect(carryForwardState(score({ status: 'not_started' }), false)).toBe(
      'none'
    )
    expect(carryForwardState(score({ status: 'done' }), false)).toBe('none')
  })

  it('renders nothing when the backend does not serve status (pre-deploy degrade)', () => {
    expect(carryForwardState(score(), true)).toBe('none')
  })

  it('renders nothing without an answer row', () => {
    expect(carryForwardState(undefined, true)).toBe('none')
  })
})

describe('canConfirmCarryForward', () => {
  const confirmable = {
    state: 'unconfirmed' as const,
    dirty: false,
    isReadOnly: false,
    priorReviewBlocked: false,
  }

  it('allows confirming an untouched carried-forward answer', () => {
    expect(canConfirmCarryForward(confirmable)).toBe(true)
  })

  it('hides while dirty — the edit is the explicit act and Next saves it', () => {
    expect(canConfirmCarryForward({ ...confirmable, dirty: true })).toBe(false)
  })

  it('hides for read-only sessions', () => {
    expect(canConfirmCarryForward({ ...confirmable, isReadOnly: true })).toBe(
      false
    )
  })

  it('hides while the CMS prior-response review blanks the field', () => {
    expect(
      canConfirmCarryForward({ ...confirmable, priorReviewBlocked: true })
    ).toBe(false)
  })

  it('hides for updated and stateless questions', () => {
    expect(canConfirmCarryForward({ ...confirmable, state: 'updated' })).toBe(
      false
    )
    expect(canConfirmCarryForward({ ...confirmable, state: 'none' })).toBe(
      false
    )
  })
})

describe('buildScoreByFunction', () => {
  it('re-keys rows by their owning functionid', () => {
    const byFunction = buildScoreByFunction({
      100: score({
        functionoptionid: 100,
        functionoption: {
          functionoptionid: 100,
          functionid: 7,
          score: 2,
          optionname: 'Defined',
          description: '',
        },
      }),
    })
    expect(byFunction[7]?.functionoptionid).toBe(100)
  })

  it('skips rows without functionoption — they cannot be attributed to a question', () => {
    expect(buildScoreByFunction({ 100: score() })).toEqual({})
  })
})

describe('buildConfirmSummary', () => {
  const withStatus = (
    functionid: number,
    status?: ScoreStatus
  ): QuestionScores =>
    score({
      scoreid: functionid,
      status,
      functionoption: {
        functionoptionid: functionid * 10,
        functionid,
        score: 1,
        optionname: 'Traditional',
        description: '',
      },
    })

  const categories = [
    { name: 'Devices', steps: [question(1), question(2)] },
    { name: 'Networks', steps: [question(3), question(4)] },
  ]

  it('buckets unconfirmed, updated, and unanswered in sidebar order', () => {
    const summary = buildConfirmSummary(
      categories,
      {
        1: withStatus(1, 'not_started'),
        2: withStatus(2, 'done'),
        3: withStatus(3, 'not_started'),
        // 4 has no row at all.
      },
      true
    )
    expect(summary.total).toBe(4)
    expect(summary.updated).toBe(1)
    expect(summary.unconfirmed.map((e) => e.functionid)).toEqual([1, 3])
    expect(summary.unconfirmed[0]).toEqual({
      functionid: 1,
      functionName: 'fn-1',
      pillarName: 'Devices',
    })
    expect(summary.unanswered.map((e) => e.functionid)).toEqual([4])
    expect(summary.hasStatusData).toBe(true)
  })

  it('keeps the unanswered list but flags missing status data pre-deploy', () => {
    const summary = buildConfirmSummary(
      categories,
      {
        1: withStatus(1),
        2: withStatus(2),
        3: withStatus(3),
      },
      true
    )
    // Answered rows without status land in no bucket: not unconfirmed (that
    // would badge everything) and not updated (that would claim knowledge the
    // backend has not served).
    expect(summary.unconfirmed).toEqual([])
    expect(summary.updated).toBe(0)
    expect(summary.unanswered.map((e) => e.functionid)).toEqual([4])
    expect(summary.hasStatusData).toBe(false)
  })

  it('lists nothing as unconfirmed on a past call', () => {
    const summary = buildConfirmSummary(
      categories,
      { 1: withStatus(1, 'not_started') },
      false
    )
    expect(summary.unconfirmed).toEqual([])
  })

  it('ignores score rows whose function is not in the questionnaire (inapplicable after an environment change)', () => {
    const summary = buildConfirmSummary(
      categories,
      { 99: withStatus(99, 'not_started') },
      true
    )
    expect(summary.unconfirmed).toEqual([])
    expect(summary.total).toBe(4)
  })
})
