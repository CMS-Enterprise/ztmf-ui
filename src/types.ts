/**
 * Type definitions for the application.
 * @module types
 */

// TODO: maybe provide environment and other things to log?
export type AppConfig = AppFeatureFlags

export type AppFeatureFlags = {
  IDP_ENABLED: boolean
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
  issoemail: string
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
