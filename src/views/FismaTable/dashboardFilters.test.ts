import type { FismaSystemType, ScoreProgress } from '@/types'
import {
  applyDashboardFilters,
  isNotUpdated,
  hasNoActiveFilters,
  EMPTY_DASHBOARD_FILTERS,
} from './dashboardFilters'

// Minimal rows — only the fields the filter reads. Cast through unknown, the
// repo's pattern for grid-row fixtures.
const ROWS = [
  { fismasystemid: 1, datacenterenvironment: 'aws', opdiv_id: 10 },
  { fismasystemid: 2, datacenterenvironment: 'onprem', opdiv_id: 20 },
  { fismasystemid: 3, datacenterenvironment: 'saas', opdiv_id: 10 },
  { fismasystemid: 4, datacenterenvironment: 'aws', opdiv_id: null },
] as unknown as FismaSystemType[]

// raw datacenterenvironment -> category label
const CATEGORY_MAP: Record<string, string> = {
  aws: 'Cloud',
  saas: 'Cloud',
  onprem: 'On-Premises',
}

const prog = (
  fismasystemid: number,
  questionsexpected: number,
  questionsupdated: number
): ScoreProgress =>
  ({
    fismasystemid,
    questionsexpected,
    questionsupdated,
    updatedsincestart: questionsupdated > 0,
  }) as ScoreProgress

// sys1 not updated, sys2 partial, sys3 fully updated, sys4 N/A (no questionnaire)
const PROGRESS: Record<number, ScoreProgress> = {
  1: prog(1, 40, 0),
  2: prog(2, 40, 30),
  3: prog(3, 40, 40),
  4: prog(4, 0, 0),
}

const filters = (over: Partial<typeof EMPTY_DASHBOARD_FILTERS> = {}) => ({
  ...EMPTY_DASHBOARD_FILTERS,
  ...over,
})

test('empty filters return the input rows unchanged', () => {
  expect(hasNoActiveFilters(EMPTY_DASHBOARD_FILTERS)).toBe(true)
  expect(applyDashboardFilters(ROWS, PROGRESS, CATEGORY_MAP, filters())).toBe(
    ROWS
  )
})

test('environment filter matches by resolved category', () => {
  const out = applyDashboardFilters(
    ROWS,
    PROGRESS,
    CATEGORY_MAP,
    filters({ environments: ['Cloud'] })
  )
  expect(out.map((r) => r.fismasystemid)).toEqual([1, 3, 4]) // aws, saas, aws
})

test('opdiv filter matches by opdiv_id and drops null opdivs', () => {
  const out = applyDashboardFilters(
    ROWS,
    PROGRESS,
    CATEGORY_MAP,
    filters({ opdivIds: [10] })
  )
  expect(out.map((r) => r.fismasystemid)).toEqual([1, 3])
})

test('not-updated filter keeps only laggards with a questionnaire', () => {
  const out = applyDashboardFilters(
    ROWS,
    PROGRESS,
    CATEGORY_MAP,
    filters({ notUpdatedOnly: true })
  )
  // sys1 only: sys2 partial, sys3 full, sys4 is 0/0 N/A (excluded)
  expect(out.map((r) => r.fismasystemid)).toEqual([1])
})

test('isNotUpdated classifies each progress bucket correctly', () => {
  expect(isNotUpdated(prog(1, 40, 0))).toBe(true) // not updated
  expect(isNotUpdated(prog(2, 40, 30))).toBe(false) // partial
  expect(isNotUpdated(prog(3, 40, 40))).toBe(false) // full
  expect(isNotUpdated(prog(4, 0, 0))).toBe(false) // N/A 0/0
  expect(isNotUpdated(undefined)).toBe(false) // no data
})

test('facets combine with AND', () => {
  const out = applyDashboardFilters(
    ROWS,
    PROGRESS,
    CATEGORY_MAP,
    filters({ environments: ['Cloud'], opdivIds: [10], notUpdatedOnly: true })
  )
  // Cloud ∩ opdiv 10 = {1,3}; not-updated of those = {1}
  expect(out.map((r) => r.fismasystemid)).toEqual([1])
})

test('a row whose environment is not in the category map is excluded when env filter is active', () => {
  const rows = [
    { fismasystemid: 9, datacenterenvironment: 'unknown-env', opdiv_id: 10 },
  ] as unknown as FismaSystemType[]
  const out = applyDashboardFilters(
    rows,
    {},
    CATEGORY_MAP,
    filters({ environments: ['Cloud'] })
  )
  expect(out).toHaveLength(0)
})
