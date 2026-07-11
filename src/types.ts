/**
 * Type definitions for the application.
 * @module types
 */

export type AppConfig = AppFeatureFlags & AppEnvironment

export type AppFeatureFlags = {
  IDP_ENABLED: boolean
}

// Environment-derived settings. IS_NONPROD gates the development banner; the
// DEV_* overrides let the deployed dev environment inject testing-specific copy
// and contact links at build time without committing them to the repo.
export type AppEnvironment = {
  IS_NONPROD: boolean
  DEV_BANNER_MESSAGE: string
  DEV_FEEDBACK_URL: string
  DEV_CONTACT_EMAIL: string
}

export type FormField = {
  name: string
  label?: string
  type: string
  required?: boolean
  disabled?: boolean
  multiline?: boolean
  value?: string | number | boolean | null
  component: React.ElementType
}
export type UserRole =
  | 'OWNER'
  | 'HHS_ADMIN'
  | 'HHS_READONLY_ADMIN'
  | 'OPDIV_ADMIN'
  | 'OPDIV_READONLY_ADMIN'
  | 'ISSO'
  | 'ISSM'
  | 'ADMIN'
  | 'READONLY_ADMIN'

export type OpDiv = {
  opdiv_id: number
  code: string
  name: string
  is_parent: boolean
  active: boolean
}

// One known datacenter environment from GET /api/v1/datacenterenvironments.
// `datacenterenvironment` is the raw value stored on a system; `category` is
// the reporting bucket the raw value resolves to (and the dropdown label);
// `selectable` marks values offered in the picker (legacy/alias values are
// still returned so existing systems resolve). Rows arrive ordered by `ordr`.
export type DataCenterEnvironment = {
  datacenterenvironment: string
  category: string
  scoring_key: string | null
  selectable: boolean
  ordr: number
}

export type userData = {
  userid: string
  email: string
  fullname: string
  role: UserRole
  assignedfismasystems?: number[]
  identity_provider?: 'okta' | 'entra'
  assignedopdivids?: number[] | null
}
export type RequestOptions = {
  method: string
  headers: Headers
  redirect: 'follow' | 'error' | 'manual'
}
export type FismaSystemType = {
  fismasystemid: number
  fismauid: string
  fismaacronym: string
  fismaname: string
  fismasubsystem: string
  component: string
  mission: string
  fismaimpactlevel: string
  issoemail: string | null
  sdl_sync_enabled: boolean | null
  datacenterenvironment: string
  datacallcontact?: string
  groupacronym?: string
  groupname?: string
  divisionname?: string
  decommissioned: boolean
  decommissioned_date: string | null
  decommissioned_by: string | null
  decommissioned_notes: string | null
  reactivated_by: string | null
  reactivated_date: string | null
  reactivation_notes: string | null
  opdiv_id?: number | null
  // Extended metadata fields (migration 0044+)
  isso_name?: string | null
  hva?: string | null
  fips?: string | null
  system_type?: string | null
  cloud_system?: string | null
  cloud_service_model?: string | null
  cloud_vendor?: string | null
  system_operator?: string | null
  goco_coco_gogo?: string | null
  system_owner?: string | null
  system_owner_email?: string | null
  legacy?: string | null
  // Risk-based target maturity (ztmf#398). null = no target asserted yet;
  // the UI presents the Advanced default.
  target_maturity_tier?: string | null
  target_maturity_justification?: string | null
}
export type FismaSystems = {
  fismaSystems: FismaSystemType[]
}

export type functionScores = {
  [key: number]: number
}

export type FismaFunction = {
  functionid: number
  function: string
  description: string
  datacenterenvironment: string
}
export type FismaQuestion = {
  questionid: number
  question: string
  notesprompt: string
  pillar: questionPillar
  function: FismaFunction
}

export type QuestionOption = {
  description: string
  functionid: number
  functionoptionid: number
  optionname: string
  score: number
}

export type questionPillar = {
  pillar: string
  pillarid: number
  order: number
}

export type LastEditedBy = {
  userid: string
  name: string
  email: string
  role?: UserRole
}

export type QuestionScores = {
  scoreid: number
  fismasystemid: number
  datecalculated: number
  notes: string
  functionoptionid: number
  datacallid: number
  last_edited_at?: string | null
  last_edited_by?: LastEditedBy | null
  notes_is_ai_summary?: boolean
}

export type Question = {
  questionid: number
  question: string
  notesprompt: string
  description: string
  pillar: string
  function: string
}

export type SystemDetailsModalProps = {
  open: boolean
  onClose: () => void
  system: FismaSystemType | null
}

export type EmailModalProps = {
  openModal: boolean
  closeModal: () => void
}

export type SentEmailDialogProps = {
  openModal: boolean
  closeModal: () => void
  emails: string[]
  group: string
}

export type editSystemModalProps = {
  title: string
  open: boolean
  onClose: (data: FismaSystemType) => void
  system: FismaSystemType | null
  mode: string
  // Datacenter-environment vocabulary for the dropdown. Passed from Title
  // (the modal renders outside the outlet, so it can't read context).
  datacenterEnvironments: DataCenterEnvironment[]
}

export type datacallModalProps = {
  open: boolean
  onClose: () => void
}

export type ScoreData = {
  datacallid: number
  fismasystemid: number
  systemscore: number
}

export type ScoreTier =
  | 'Optimal'
  | 'Advanced'
  | 'Initial'
  | 'Traditional'
  | 'Not Assessed'

export type PillarScore = {
  pillarid: number
  pillar: string
  score: number
  tier?: ScoreTier
}

export type ScoreAggregate = {
  datacallid: number
  fismasystemid: number
  systemscore: number
  systemtier?: ScoreTier
  pillarscores?: PillarScore[]
}

// Per-system score lookup shape passed from Home.tsx down to the list
// views. Carries the authoritative tier string alongside the numeric
// score so downstream cells do not have to re-derive a tier label from
// the number. `tier` is optional to keep the type honest during the
// brief cutover window when an older backend has not yet shipped tier
// strings.
export type SystemScoreEntry = {
  score: number
  tier?: ScoreTier
}

// One system's questionnaire progress within a data call, as returned by
// GET /scores/progress. "Updated" counts answers genuinely touched this
// cycle - answers pre-populated from the previous data call do not count
// until a user saves them, so a carried-over untouched questionnaire reads
// as not updated (ztmf#299).
export type ScoreProgress = {
  fismasystemid: number
  questionsexpected: number
  questionsupdated: number
  lastupdatedat?: string | null
  updatedsincestart: boolean
}

export type QuestionChoice = {
  label: string
  value: number
  // Maturity score (1-4) of this answer option. Carried so the radio group can
  // match an option against a ZTMF Insight's suggested/prior score for badging.
  score?: number
  defaultChecked?: boolean
}
export type users = {
  assignedfismasystems: number[]
  assignedopdivids?: number[] | null
  email: string
  fullname: string
  role: UserRole
  userid: string
  deleted?: boolean
  isNew?: boolean
  identity_provider?: 'okta' | 'entra'
}

export type datacall = {
  datacallid: number
  datacall: string
  datecreated: string
  deadline: string
}

export type FormValidType = {
  [key: string]: boolean
}

export type FormValidHelperText = {
  [key: string]: string
}

export type FismaTableProps = {
  scores: Record<number, SystemScoreEntry>
  // Per-system questionnaire progress for the active data call, keyed by
  // fismasystemid. Optional so the table degrades to an em-dash column if
  // the progress fetch fails - score display must not depend on it.
  progress?: Record<number, ScoreProgress>
  // Which active data call(s) each system has scores in, keyed by
  // fismasystemid, so per-row actions target the system's own call.
  systemCallMap?: Record<number, number[]>
}

export type ThemeColor =
  | 'primary'
  | 'secondary'
  | 'error'
  | 'warning'
  | 'info'
  | 'success'

export type ThemeSkin = 'filled' | 'light' | 'light-static'

export type CfactsSystemType = {
  fisma_uuid: string
  fisma_acronym: string
  authorization_package_name: string | null
  primary_isso_name: string | null
  primary_isso_email: string | null
  is_active: boolean | null
  is_retired: boolean | null
  is_decommissioned: boolean | null
  lifecycle_phase: string | null
  component_acronym: string | null
  division_name: string | null
  group_acronym: string | null
  group_name: string | null
  ato_expiration_date: string | null
  decommission_date: string | null
  last_modified_date: string | null
  synced_at: string
}

export type ScoreDiffSide = {
  scoreid: number
  functionoptionid: number
  optionname: string
  score: number
  notes: string | null
  notes_is_ai_summary?: boolean
}

export type ScoreDiffEntry = {
  fismasystemid: number
  functionid: number
  function: string
  question: string
  from: ScoreDiffSide | null
  to: ScoreDiffSide | null
  changed_at?: string
  changed_by?: {
    userid: string
    name: string
    email: string
    role: string
  }
}

// ── ZTMF Insights (GET /api/v1/insights) ───────────────────────────────
// Evidence-backed maturity suggestion per system x question, synced daily
// from Snowflake. The endpoint returns [] for every "should not show" case
// (OpDiv not enabled, caller not entitled, not yet synced), so the UI is
// driven purely off row presence — see InsightsPanel.
//
// `payload` is an opaque, additive document owned by the pipeline. Treat
// every key as optional and render defensively; the string index signature
// keeps forward-added keys type-safe without an API change here.

export type InsightKionFinding = {
  id?: string
  nist_controls?: string
  description?: string
  remediation?: string
}

export type InsightSecHubFinding = {
  id?: string
  title?: string
  severity?: string
  description?: string
  remediation?: string
}

export type InsightHardenizeFinding = {
  id?: string
  title?: string
  severity?: string
}

export type InsightFindings = {
  kion?: InsightKionFinding[]
  sechub?: InsightSecHubFinding[]
  hardenize?: InsightHardenizeFinding[]
}

export type InsightPayload = {
  // The suggestion
  suggested_score?: number | null
  suggested_label?: string | null
  evidence_sources?: string | null
  score_floor_source?: string | null
  score_direction?: string | null

  // Prior self-reported score (for comparison)
  last_score?: number | null
  last_score_label?: string | null
  last_score_date?: string | null
  last_score_notes?: string | null
  last_datacall?: string | null

  // Per-source suggested scores + availability flags
  has_kion_data?: boolean
  kion_suggested_score?: number | null
  kion_suggested_label?: string | null
  kion_remediation?: string | null

  has_sechub_data?: boolean
  sechub_suggested_score?: number | null
  sechub_suggested_label?: string | null
  sechub_remediation?: string | null

  has_hardenize_data?: boolean
  hardenize_suggested_score?: number | null
  hardenize_suggested_label?: string | null
  hardenize_remediation?: string | null

  cfacts_suggested_score?: number | null
  cfacts_suggested_label?: string | null
  cfacts_auth_methods?: string | null
  cfacts_reasoning?: string | null

  ars_maturity?: number | null
  ars_control_score?: number | null
  ars_controls_total?: number | null
  ars_controls_satisfied?: number | null

  findings?: InsightFindings

  // Additive: the pipeline may add keys at any time.
  [key: string]: unknown
}

export type Insight = {
  fismasystemid: number
  questionid: number
  payload: InsightPayload
  synced_at: string
}
