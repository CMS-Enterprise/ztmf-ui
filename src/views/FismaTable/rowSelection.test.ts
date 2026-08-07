import type { ScoreProgress, SystemScoreEntry } from '@/types'
import { isSystemSelectable } from './rowSelection'

const scores: Record<number, SystemScoreEntry> = { 1: { score: 3.5 } }
const progress: Record<number, ScoreProgress> = {
  2: {
    fismasystemid: 2,
    questionsexpected: 40,
    questionsanswered: 0,
    questionsupdated: 0,
    lastupdatedat: null,
    updatedsincestart: false,
  },
}

describe('isSystemSelectable', () => {
  it('selects a system that has a score row', () => {
    expect(isSystemSelectable(1, scores, progress)).toBe(true)
  })

  it('selects a not-started system present only in progress', () => {
    // The bug: a system with a progress row (40 expected / 0 updated) but no
    // score row was unselectable, dropping exactly the not-started systems.
    expect(isSystemSelectable(2, scores, progress)).toBe(true)
  })

  it('does not select a system absent from both maps', () => {
    expect(isSystemSelectable(99, scores, progress)).toBe(false)
  })

  it('still selects a scored system when progress is missing entirely', () => {
    // A failed /scores/progress fetch resolves to an empty map; the union with
    // scores keeps scored rows selectable rather than disabling every checkbox.
    expect(isSystemSelectable(1, scores, undefined)).toBe(true)
    expect(isSystemSelectable(2, scores, undefined)).toBe(false)
  })
})
