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
