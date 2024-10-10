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
  fismauid: string | number
  fismaacronym: string
  fismaname: string
  fismasubsystem: string
  component: string
  mission: string
  fismaimpactlevel: string
  issoemail: string
  datacenterenvironment: string
}
export type FismaSystems = {
  fismaSystems: FismaSystemType[]
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
export type SystemDetailsModalProps = {
  open: boolean
  onClose: () => void
  system: FismaSystemType | null
}
export type ScoreData = {
  datacallid: number
  fismasystemid: number
  systemscore: number
}

export type users = {
  assignedfismasystems: number[]
  email: string
  fullname: string
  role: string
  userid: string
  isNew?: boolean
}

export type ThemeColor =
  | 'primary'
  | 'secondary'
  | 'error'
  | 'warning'
  | 'info'
  | 'success'

export type ThemeSkin = 'filled' | 'light' | 'light-static'
