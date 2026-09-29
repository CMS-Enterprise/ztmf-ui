/**
 * Fixture builders for the OpDiv dashboard's unit tests.
 * @module views/OpDivDashboard/testFixtures
 */
import type { FismaSystemType, ScoreProgress } from '@/types'

let nextId = 1

/**
 * A minimally-populated active FISMA system, overridable per test.
 * @param {Partial<FismaSystemType>} [overrides] - Fields the test cares about.
 * @returns {FismaSystemType} A system fixture.
 */
export function makeSystem(
  overrides: Partial<FismaSystemType> = {}
): FismaSystemType {
  const id = overrides.fismasystemid ?? nextId++
  return {
    fismasystemid: id,
    fismauid: `uid-${id}`,
    fismaacronym: `SYS${id}`,
    fismaname: `System ${id}`,
    fismasubsystem: '',
    component: '',
    mission: '',
    fismaimpactlevel: '',
    issoemail: `isso${id}@example.gov`,
    sdl_sync_enabled: true,
    datacenterenvironment: 'AWS',
    datacallcontact: `contact${id}@example.gov`,
    decommissioned: false,
    decommissioned_date: null,
    decommissioned_by: null,
    decommissioned_notes: null,
    reactivated_by: null,
    reactivated_date: null,
    reactivation_notes: null,
    opdiv_id: 1,
    ...overrides,
  }
}

/**
 * A progress row for a system.
 * @param {number} fismasystemid - The system.
 * @param {Partial<ScoreProgress>} [overrides] - Fields the test cares about.
 * @returns {ScoreProgress} A progress fixture.
 */
export function makeProgress(
  fismasystemid: number,
  overrides: Partial<ScoreProgress> = {}
): ScoreProgress {
  const questionsexpected = overrides.questionsexpected ?? 10
  const questionsanswered = overrides.questionsanswered ?? questionsexpected
  return {
    fismasystemid,
    questionsexpected,
    questionsanswered,
    // Defaults to the answered count rather than a fixed number: nothing can
    // be confirmed that has not been answered, so a fixture saying "answered
    // 0" must not silently also claim ten confirmations. Set it explicitly to
    // model carried-forward answers (answered high, updated zero).
    questionsupdated: questionsanswered,
    lastupdatedat: null,
    updatedsincestart: true,
    ...overrides,
  }
}
