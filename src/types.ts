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
export type userData = {
  userid: string
  email: string
  fullname: string
  role: string
  assignedfismasystems?: number[]
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

export type QuestionScores = {
  scoreid: number
  fismasystemid: number
  datecalculated: number
  notes: string
  functionoptionid: number
  datacallid: number
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

export type QuestionChoice = {
  label: string
  value: number
  defaultChecked?: boolean
}
export type users = {
  assignedfismasystems: number[]
  email: string
  fullname: string
  role: string
  userid: string
  isNew?: boolean
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
  scores: Record<number, number>
  latestDataCallId: number
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
