import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import ListSubheader from '@mui/material/ListSubheader'
import { useParams } from 'react-router-dom'
import { Button as CmsButton, ChoiceList, Spinner } from '@cmsgov/design-system'
import Grid from '@mui/material/Grid'
import Alert from '@mui/material/Alert'
import BreadCrumbs from '@/components/BreadCrumbs/BreadCrumbs'
import TextField from '@mui/material/TextField'
import {
  FismaQuestion,
  QuestionOption,
  Question,
  QuestionChoice,
  QuestionScores,
  Insight,
  InsightPayload,
} from '@/types'
import { Container } from '@mui/system'
import { styled } from '@mui/material/styles'
import axiosInstance from '@/axiosConfig'
import { useNavigate, useLocation } from 'react-router-dom'
import { RouteNames } from '@/router/constants'
import { ArrowIcon } from '@cmsgov/design-system'
import {
  ERROR_MESSAGES,
  STATUS_MESSAGES,
  MAX_QUESTIONNAIRE_NOTES_LENGTH,
  CONFIRMATION_MESSAGE_QUESTION,
  NOTES_UPDATE_REQUIRED_MSG,
} from '@/constants'
import { isAuthHandled, notify } from '@/utils/notify'
import { sortPillars } from '@/utils/sortPillars'
import { filterPillarsForSystem } from '@/utils/filterPillarsForSystem'
import { toCategoryMap } from '@/utils/dataCenterEnvironments'
import { sortFunctions } from '@/utils/sortFunctions'
import Button from '@mui/material/Button'
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog'
import ScoreDiffModal from '@/components/ScoreDiffModal/ScoreDiffModal'
import AISummaryBadge from '@/components/AISummaryBadge/AISummaryBadge'
import { useContextProp } from '../Title/Context'
import { isAdmin, isReadOnlyAdmin } from '@/utils/userRoles'
import LastEditedFooter from './LastEditedFooter'
import InsightsPanel, {
  OptionInsightBadges,
} from './InsightsPanel/InsightsPanel'
import {
  shouldPersistResponse,
  needsNotesUpdateForChoiceChange,
} from './saveGuard'
import { saveDraft, loadDraft, clearDraft } from './draftStore'
import { deriveScoreSelection, shouldReseedAnswer } from './scoreSelection'
type Category = {
  name: string
  steps: FismaQuestion[]
}
type questionScoreMap = {
  [key: number]: QuestionScores
}
const CssTextField = styled(TextField)({
  '& .MuiOutlinedInput-root': {
    '& fieldset': {
      borderColor: '#000000',
      borderWidth: '2px',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#000000',
      borderWidth: '2px',
      boxShadow: '0px 0px 0px 3px #FFFFFF, 0px 0px 3px 6px #bd13b8',
    },
    '@supports (-moz-appearance:none)': {
      paddingTop: '30px',
      '& .MuiInputBase-inputMultiline': {
        // paddingTop: '-15px',
        height: '100%',
        width: '100%',
        scrollbarWidth: 'none',
      },
    },
    '& .MuiInputBase-inputMultiline': {
      msOverflowStyle: 'none', // Hide scrollbar in IE/Edge
      '&::-webkit-scrollbar': { display: 'none' },
    },
  },
})
const toSlug = (str: string) =>
  str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replaceAll(' ', '-')

const addSpace = (str: string) => {
  for (let i = 0; i < str.length; i++) {
    if (
      i > 0 &&
      str[i] === str[i].toUpperCase() &&
      // str[i - 1] !== '-' &&
      str[i - 1] !== ' '
    ) {
      str = str.slice(0, i) + ' ' + str.slice(i)
      i++
    }
  }
  return str
}
export default function QuestionnarePage() {
  const {
    userInfo,
    selectedDatacall,
    latestDataCallId,
    latestDatacall,
    latestDeadline,
    fismaSystems,
    datacenterEnvironments,
  } = useContextProp()
  const [isPastDeadline, setIsPastDeadline] = React.useState<boolean>(false)
  const [diffModalOpen, setDiffModalOpen] = React.useState(false)
  const isReadOnly =
    isReadOnlyAdmin(userInfo) || (isPastDeadline && !isAdmin(userInfo))
  const [questionScores, setQuestionScores] = React.useState<questionScoreMap>(
    {}
  )
  const [questionId, setQuestionId] = React.useState<number | null>(null)
  const [openAlert, setOpenAlert] = React.useState<boolean>(false)
  const [options, setOptions] = React.useState<QuestionChoice[]>([])
  const [questions, setQuestions] = React.useState<Record<number, Question>>([])
  // ZTMF Insights keyed by DB questionid. Empty for every "off" case (OpDiv not
  // enabled, not entitled, not yet synced) — the endpoint returns [] and the
  // panel simply never renders, leaving the page unchanged.
  const [insightsByQuestion, setInsightsByQuestion] = React.useState<
    Map<number, InsightPayload>
  >(new Map())
  const [question, setQuestion] = React.useState<string>('')
  const [datacallID, setDatacallID] = React.useState<number>(0)
  const [datacall, setDatacall] = React.useState<string>('')
  const [loadingQuestion, setLoadingQuestion] = React.useState<boolean>(true)
  const [noQuestions, setNoQuestions] = React.useState<boolean>(false)
  const [categories, setCategories] = React.useState<Category[]>([])
  const [stepFunctionId, setStepFunctionId] = React.useState<number[]>([])
  const [functionIdIdx, setFunctionIdIdx] = React.useState<{
    [key: number]: number
  }>({})
  const [scoreid, setScoreId] = React.useState<number>(0)
  const [initQuestionChoice, setInitQuestionChoice] = React.useState<number>(-1)
  const [initNotes, setInitNotes] = React.useState<string>('')
  const [notes, setNotes] = React.useState<string>('')
  const [notePrompt, setNotePrompt] = React.useState<string>('')
  const [description, setDescription] = React.useState<string>('')
  const [stepId, setStepId] = React.useState<number>(0)
  const [selectQuestionOption, setSelectQuestionOption] =
    React.useState<number>(-1)
  const [draftStatus, setDraftStatus] = React.useState<
    'idle' | 'restored' | 'saved' | 'error'
  >('idle')
  // Refs read inside setTimeout/event callbacks to get the current value
  // without enrolling the effects in those deps (prevents extra re-runs).
  const draftStatusRef = React.useRef(draftStatus)
  draftStatusRef.current = draftStatus
  // Stable ref so fetchOptions always reads the latest scores without enrolling
  // questionScores as a dep of the questionId effect. Stale-closure-safe because
  // the ref updates synchronously on every render before any effect runs.
  const questionScoresRef = React.useRef(questionScores)
  questionScoresRef.current = questionScores
  // Incremented on every explicit draft clear so in-flight debounced saves
  // that fire after a clear don't resurrect the just-removed draft.
  const saveGenRef = React.useRef(0)
  const unsavedRef = React.useRef({
    selectQuestionOption,
    initQuestionChoice,
    notes,
    initNotes,
  })
  unsavedRef.current = {
    selectQuestionOption,
    initQuestionChoice,
    notes,
    initNotes,
  }
  // Refs so the out-of-band re-seed effect can read current options and loading
  // state without enrolling them as effect dependencies.
  const optionsRef = React.useRef(options)
  optionsRef.current = options
  const loadingQuestionRef = React.useRef(loadingQuestion)
  loadingQuestionRef.current = loadingQuestion
  // Persisted data-call context so in-questionnaire navigation (Next/Back/
  // sidebar) can re-supply it via router state. Without this, the first
  // click-through drops location.state.datacall* and the load effect reverts to
  // the global data-call selector — opening a system for a specific picked call
  // (e.g. FY2025 Q3) would silently fall back to the latest call (FY25) on the
  // next click.
  const datacallStateRef = React.useRef<{
    datacallid: number
    datacall: string
    deadline?: string
  }>({ datacallid: 0, datacall: '' })
  // Bumped when a re-seed changes the answer so the uncontrolled radio ChoiceList
  // (which only reflects defaultChecked on mount) remounts and shows the
  // corrected selection.
  const [radioKey, setRadioKey] = React.useState(0)
  const fetchQuestionScores = async (
    systemId: number | string | undefined,
    setQuestionScores: (scores: questionScoreMap) => void
  ) => {
    try {
      const response = await axiosInstance.get(
        `scores?datacallid=${datacallID}&fismasystemid=${systemId}&include=functionoption`
      )
      const hashTable: questionScoreMap = Object.assign(
        {},
        ...response.data.data.map((item: QuestionScores) => ({
          [item.functionoptionid]: item,
        }))
      )
      setQuestionScores(hashTable)
    } catch (error) {
      if (isAuthHandled(error)) return
      console.error('Error fetching question scores:', error)
    }
  }
  const handleChoiceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectQuestionOption(Number(event.target.value))
    if (draftStatus === 'restored') setDraftStatus('idle')
  }
  const renderRadioGroup = (options: QuestionChoice[]) => {
    // Enrich each option label with insight badges (recommended answer / last
    // year's answer). When there is no insight for this question, the badge
    // component renders nothing and labels are just the option text.
    const choices = options.map((o) => ({
      label: (
        <Box
          component="span"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Box component="span">{o.label}</Box>
          <OptionInsightBadges score={o.score} insight={currentInsight} />
        </Box>
      ),
      value: o.value,
      defaultChecked: o.defaultChecked,
    }))
    return (
      <Box
        sx={{
          '& .ds-c-choice-wrapper': {
            maxWidth: 'none',
          },
        }}
      >
        <ChoiceList
          choices={choices}
          name={'radio-choices'}
          type={'radio'}
          label={undefined}
          className="ds-u-margin-top--05"
          size="small"
          onChange={handleChoiceChange}
          disabled={isReadOnly}
        />
      </Box>
    )
  }

  const navigate = useNavigate()
  const location = useLocation()
  const { fismaacronym } = useParams()

  // Direct/bookmarked navigation to /questionnaire/<acronym> has a null
  // location.state. Optional-chain instead of crashing on first render; the
  // missing-system path is handled by an early render guard below.
  const system = location.state?.fismasystemid as number | undefined
  // The dashboard opens the questionnaire for the system's own data call
  // (year-aggregated view, #467): the specific call id and name ride along in
  // the route state. Absent (deep link), fall back to the selected/latest call.
  const routeDatacallId = location.state?.datacallid as number | undefined
  const routeDatacall = location.state?.datacall as string | undefined
  const routeDeadline = location.state?.deadline as string | undefined
  const systemRef = React.useRef(system)
  systemRef.current = system
  const systemInfo = fismaSystems.find((s) => s.fismasystemid === system)
  const systemName = systemInfo?.fismaname ?? fismaacronym ?? ''

  // Fetch ZTMF Insights for this system once (not per question — one call
  // returns every question's row). Failures and empty responses both leave the
  // map empty so the questionnaire is never blocked or altered by insights.
  React.useEffect(() => {
    if (!system) return
    const controller = new AbortController()
    const load = async () => {
      try {
        const res = await axiosInstance.get<{ data: Insight[] }>('insights', {
          params: { fismasystemid: system },
          signal: controller.signal,
        })
        const map = new Map<number, InsightPayload>()
        for (const row of res.data?.data ?? []) {
          if (row?.questionid != null && row.payload) {
            map.set(row.questionid, row.payload)
          }
        }
        setInsightsByQuestion(map)
      } catch {
        if (!controller.signal.aborted) {
          // Insights are additive and optional; swallow errors and render the
          // page exactly as it is without them.
          setInsightsByQuestion(new Map())
        }
      }
    }
    void load()
    return () => controller.abort()
  }, [system])

  // Resolve the system's raw datacenter environment to its scoring category
  // for pillar filtering. Falls back to the raw value until the vocabulary
  // loads or for any value not in the map.
  const systemCategory =
    toCategoryMap(datacenterEnvironments)[
      systemInfo?.datacenterenvironment ?? ''
    ] ?? systemInfo?.datacenterenvironment
  const [selectedIndex, setSelectedIndex] = React.useState(1)
  const handleConfirmReturn = (confirm: boolean) => {
    if (confirm) {
      // User explicitly chose to abandon unsaved edits — clear the draft so it
      // doesn't reappear if they navigate back to this question.
      clearCurrentDraft()
      setLoadingQuestion(true)
      setSelectedIndex(stepId)
      setQuestionId(stepId)
    }
  }
  const handleListItemClick = (index: number) => {
    saveGenRef.current++
    setLoadingQuestion(true)
    setSelectedIndex(index)
    setQuestionId(index)
  }

  const clearCurrentDraft = () => {
    saveGenRef.current++
    if (system && questionId && datacallID > 0) {
      void clearDraft(userInfo.userid, system, questionId, datacallID)
    }
    setDraftStatus('idle')
  }

  const saveResponse = async () => {
    if (
      !shouldPersistResponse({
        selectQuestionOption,
        initQuestionChoice,
        notes,
        initNotes,
      })
    ) {
      clearCurrentDraft()
      return
    }
    // Backstop: the Next button is disabled when this fires, but a future
    // save trigger (autosave, dedicated Save, route-leave hook) would
    // reach saveResponse without knowing about the rule. Cheap insurance.
    if (
      needsNotesUpdateForChoiceChange({
        selectQuestionOption,
        initQuestionChoice,
        notes,
        initNotes,
      })
    ) {
      return
    }
    try {
      if (scoreid) {
        await axiosInstance.put(`scores/${scoreid}`, {
          fismasystemid: system,
          notes: notes,
          functionoptionid: selectQuestionOption,
          datacallid: datacallID,
          // The user is editing the note, so it is no longer an AI summary.
          // The dirty-check above skips this PUT when content is unchanged,
          // so an identical "edit" correctly keeps the badge.
          notes_is_ai_summary: false,
        })
      } else {
        await axiosInstance.post(`scores`, {
          fismasystemid: system,
          notes: notes,
          functionoptionid: selectQuestionOption,
          datacallid: datacallID,
        })
      }
      notify(STATUS_MESSAGES.saved, 'success', { autoHideDuration: 1500 })
      clearCurrentDraft()
      fetchQuestionScores(system, setQuestionScores)
    } catch (error) {
      if (isAuthHandled(error)) return
      console.error('Error saving score:', error)
      notify(ERROR_MESSAGES.tryAgain, 'error', { autoHideDuration: 2500 })
    }
  }

  React.useEffect(() => {
    if (system) {
      const controller = new AbortController()
      // Reset the empty-questionnaire flag so a previous decommissioned-system
      // view does not bleed into the next render when system changes.
      setNoQuestions(false)
      const fetchData = async () => {
        // Gate the debounce effect during the entire system/datacall transition
        // so stale pending saves don't fire while the question list reloads.
        setLoadingQuestion(true)
        try {
          let questionsEmpty = false
          let datacall = ''
          let activeDataCallId: number
          if (routeDatacallId && routeDatacall) {
            // Opened for a specific system's own call from the dashboard. Read
            // only when that call's own deadline has passed - not by comparing
            // to the global latest, since two calls can be open at once.
            datacall = routeDatacall.replaceAll(' ', '_')
            setDatacall(datacall)
            activeDataCallId = routeDatacallId
            setIsPastDeadline(
              routeDeadline ? new Date() > new Date(routeDeadline) : true
            )
            datacallStateRef.current = {
              datacallid: routeDatacallId,
              datacall,
              deadline: routeDeadline,
            }
          } else {
            const isHistorical =
              selectedDatacall !== null &&
              selectedDatacall.datacallid !== latestDataCallId
            if (isHistorical && selectedDatacall) {
              datacall = selectedDatacall.datacall.replaceAll(' ', '_')
              setDatacall(datacall)
              setIsPastDeadline(true)
              activeDataCallId = selectedDatacall.datacallid
              datacallStateRef.current = {
                datacallid: selectedDatacall.datacallid,
                datacall,
                deadline: selectedDatacall.deadline,
              }
            } else {
              datacall = latestDatacall.replaceAll(' ', '_')
              setDatacall(datacall)
              setIsPastDeadline(
                latestDeadline ? new Date() > new Date(latestDeadline) : true
              )
              activeDataCallId = latestDataCallId
              datacallStateRef.current = {
                datacallid: latestDataCallId,
                datacall,
                deadline: latestDeadline ?? undefined,
              }
            }
          }
          // Hoisted so both the questions block and the final batch can access them.
          const questionData: Record<number, Question> = {}
          let sortedFuncId: number[] = []
          try {
            const response = await axiosInstance.get(
              `/fismasystems/${system}/questions`,
              { signal: controller.signal }
            )
            // Decommissioned systems join to zero functions, so the questions
            // endpoint returns no rows. The Go backend serializes a nil
            // slice as JSON null, so the response can be either { data: null }
            // or { data: [] } depending on driver behavior - treat both as
            // the empty-state signal. Surface a friendly message instead of
            // crashing on categoriesData[0] below.
            const data = response.data?.data
            if (!data || (Array.isArray(data) && data.length === 0)) {
              questionsEmpty = true
              setNoQuestions(true)
              setLoadingQuestion(false)
            } else {
              const organizedData: Record<string, FismaQuestion[]> = {}
              data.forEach((question: FismaQuestion) => {
                if (!organizedData[question.pillar.pillar]) {
                  organizedData[question.pillar.pillar] = []
                }
                questionData[question.function.functionid] = {
                  questionid: question.questionid,
                  question: question.question,
                  notesprompt: question.notesprompt,
                  description: question.function.description,
                  pillar: question.pillar.pillar,
                  function: question.function.function,
                }
                organizedData[question.pillar.pillar].push(question)
              })
              const sortedPillars = filterPillarsForSystem(
                sortPillars(Object.keys(organizedData)),
                systemCategory
              )
              const categoriesData: Category[] = sortedPillars.map((pillar) => {
                const sortedSteps = sortFunctions(pillar, organizedData[pillar])
                const sortedStepFuncId = sortedSteps.map(
                  (d) => d.function.functionid
                )
                sortedFuncId = [...sortedFuncId, ...sortedStepFuncId]
                return {
                  name: pillar,
                  steps: sortedSteps,
                }
              })
              const funcIdToIdx = sortedFuncId.reduce(
                (
                  acc: { [key: number]: number },
                  num: number,
                  index: number
                ) => {
                  acc[num] = index
                  return acc
                },
                {}
              )
              // Update sidebar/nav state immediately so the question list
              // renders while scores are still loading. setQuestions,
              // setDatacallID, and setQuestionId are deferred to the batch
              // below — after scores arrive — so the questionId effect fires
              // exactly once with the correct scores already in the ref.
              setFunctionIdIdx(funcIdToIdx)
              setStepFunctionId(sortedFuncId)
              setCategories(categoriesData)
              navigate(
                `/${RouteNames.QUESTIONNAIRE}/${fismaacronym?.toLowerCase()}/${datacall}/${toSlug(categoriesData[0].name)}/${toSlug(categoriesData[0].steps[0].function.function)}`,
                {
                  state: {
                    fismasystemid: system,
                    datacallid: datacallStateRef.current.datacallid,
                    datacall: datacallStateRef.current.datacall,
                    deadline: datacallStateRef.current.deadline,
                  },
                  replace: true,
                }
              )
              setSelectedIndex(sortedFuncId[0])
            }
          } catch (error) {
            if (controller.signal.aborted) return
            if (isAuthHandled(error)) {
              setLoadingQuestion(false)
              return
            }
            notify(ERROR_MESSAGES.tryAgain, 'error')
            setLoadingQuestion(false)
            return
          }
          if (questionsEmpty) {
            return
          }
          let hashTable: questionScoreMap = {}
          try {
            const res = await axiosInstance.get(
              `scores?datacallid=${activeDataCallId}&fismasystemid=${system}&include=functionoption`,
              { signal: controller.signal }
            )
            hashTable = Object.assign(
              {},
              ...res.data.data.map((item: QuestionScores) => ({
                [item.functionoptionid]: item,
              }))
            )
          } catch (error) {
            if (controller.signal.aborted) return
            if (!isAuthHandled(error)) {
              console.error('Error fetching question scores:', error)
              notify(ERROR_MESSAGES.tryAgain, 'error')
            }
            // Fall through to the batch below with an empty scores map so the
            // sidebar/URL commit together with questions/datacallID/questionId,
            // even when the scores call 403s without redirecting (auth-handled,
            // component stays mounted). Returning here instead would leave the
            // sidebar/URL on the new system while the content stayed on the old
            // one. The [questionId] effect's finally clears the spinner.
          }
          // Batch questions + scores + datacallID + questionId so the questionId
          // effect fires exactly once with the correct scores already in
          // questionScoresRef. This prevents a second effect run (and its
          // accompanying draft-clearing race) that would occur if questionScores
          // arrived as a separate update after questionId was already set.
          setQuestions(questionData)
          setQuestionScores(hashTable)
          setDatacallID(activeDataCallId)
          setQuestionId(sortedFuncId[0])
        } catch (error) {
          if (controller.signal.aborted) return
          if (isAuthHandled(error)) {
            setLoadingQuestion(false)
            return
          }
          console.error('Error fetching data:', error)
          setLoadingQuestion(false)
        }
      }
      fetchData()
      return () => controller.abort()
    }
  }, [
    system,
    navigate,
    fismaacronym,
    routeDatacallId,
    routeDatacall,
    routeDeadline,
    selectedDatacall,
    latestDataCallId,
    latestDatacall,
    latestDeadline,
    systemCategory,
  ])
  React.useEffect(() => {
    if (questionId) {
      const controller = new AbortController()
      // Clear saved-state markers before async load so the last-edited
      // footer does not flash the previous question's editor during the
      // refetch window. Also resets draft indicators so stale status from
      // a previous question or datacall doesn't bleed into the next render.
      setInitQuestionChoice(-1)
      setDraftStatus('idle')
      const choices: QuestionChoice[] = []
      let funcOptId: number = 0
      async function fetchOptions() {
        try {
          const res = await axiosInstance.get(
            `functions/${questionId}/options`,
            { signal: controller.signal }
          )
          res.data.data.forEach((item: QuestionOption) => {
            const choiceOpt: QuestionChoice = {
              label: item.description,
              value: item.functionoptionid,
              score: item.score,
            }
            if (item.functionoptionid in questionScoresRef.current) {
              funcOptId = item.functionoptionid
              choiceOpt.defaultChecked = true
            }
            choices.push(choiceOpt)
          })
          // Foundation of question
          setDescription(questions[questionId ?? 0]?.description ?? '')
          setQuestion(questions[questionId ?? 0]?.question ?? '')
          setNotePrompt(questions[questionId ?? 0]?.notesprompt ?? '')

          // Notes
          setNotes(funcOptId ? questionScoresRef.current[funcOptId].notes : '')
          setInitNotes(
            funcOptId ? questionScoresRef.current[funcOptId].notes : ''
          )

          // Question options
          setSelectQuestionOption(funcOptId ? funcOptId : -1)
          setInitQuestionChoice(funcOptId ? funcOptId : -1)
          setScoreId(
            funcOptId ? questionScoresRef.current[funcOptId].scoreid : 0
          )

          // Restore any in-progress draft from localStorage, overriding the
          // server-side values set above. Skipped for read-only sessions.
          const sys = systemRef.current
          const uid = userInfo.userid
          if (controller.signal.aborted) return
          // Read-only sessions never load the draft again, so evict any lingering
          // entry instead of letting it sit for the full TTL. Bump the save
          // generation first: an autosave that fired just before isReadOnly
          // flipped may still be mid-flight, and without the bump its isCurrent()
          // checks would pass and rewrite the draft after this clear.
          if (isReadOnly && sys && questionId && datacallID > 0) {
            saveGenRef.current++
            void clearDraft(uid, sys, questionId, datacallID)
          }
          const draft =
            !isReadOnly && sys && questionId && datacallID > 0
              ? await loadDraft(uid, sys, questionId, datacallID)
              : null
          // Guard: if the user navigated away while loadDraft was running
          // (crypto.subtle.decrypt is genuinely async), discard its result
          // rather than writing it into the now-active question's state.
          if (controller.signal.aborted) return
          if (draft) {
            if (draft.selectQuestionOption === -1) {
              // Notes-only draft — restore notes without pre-selecting an answer.
              setNotes(draft.notes)
              setDraftStatus('restored')
            } else if (
              choices.some((c) => c.value === draft.selectQuestionOption)
            ) {
              choices.forEach(
                (c) =>
                  (c.defaultChecked = c.value === draft.selectQuestionOption)
              )
              setSelectQuestionOption(draft.selectQuestionOption)
              setNotes(draft.notes)
              setDraftStatus('restored')
            } else {
              // Draft references an option that no longer exists — evict it.
              if (sys && questionId && datacallID > 0)
                await clearDraft(uid, sys, questionId, datacallID)
              if (controller.signal.aborted) return
              setDraftStatus('idle')
            }
          } else {
            setDraftStatus('idle')
          }
          setOptions(choices)
        } catch (error) {
          if (controller.signal.aborted) return
          if (isAuthHandled(error)) return
          console.error('Error fetching data:', error)
        } finally {
          if (!controller.signal.aborted) setLoadingQuestion(false)
        }
      }
      fetchOptions()
      return () => controller.abort()
    }
  }, [questionId, questions, isReadOnly, datacallID, userInfo.userid])

  // Debounced draft save: 1 second after the user pauses editing, persist
  // the current answer and notes to localStorage so a reload can recover them.
  // Only fires when the user has actually changed something from the server-side
  // initial values — prevents question-load state transitions from being
  // mistakenly recorded as drafts on questions the user never touched.
  React.useEffect(() => {
    if (
      isReadOnly ||
      !system ||
      !questionId ||
      datacallID <= 0 ||
      loadingQuestion
    ) {
      if (draftStatusRef.current !== 'idle') setDraftStatus('idle')
      return
    }
    if (selectQuestionOption === initQuestionChoice && notes === initNotes) {
      saveGenRef.current++
      // Skip clearDraft when a draft was just restored from storage — the draft
      // values matching the server state does not mean the user reverted manually.
      // Clearing it here would delete a valid in-progress draft on every page load
      // when the server happens to be at the same state as the draft.
      if (
        system &&
        questionId &&
        datacallID > 0 &&
        draftStatusRef.current !== 'restored'
      )
        void clearDraft(userInfo.userid, system, questionId, datacallID)
      if (draftStatusRef.current !== 'idle') setDraftStatus('idle')
      return
    }
    const currentGen = saveGenRef.current
    const timer = setTimeout(() => {
      if (saveGenRef.current !== currentGen) return
      saveDraft(
        userInfo.userid,
        system,
        questionId,
        datacallID,
        { selectQuestionOption, notes },
        () => saveGenRef.current === currentGen
      ).then((saved) => {
        if (saveGenRef.current !== currentGen) return
        if (saved) {
          if (draftStatusRef.current !== 'restored') setDraftStatus('saved')
        } else {
          setDraftStatus('error')
        }
      })
    }, 1000)
    return () => clearTimeout(timer)
  }, [
    selectQuestionOption,
    notes,
    isReadOnly,
    system,
    questionId,
    datacallID,
    initQuestionChoice,
    initNotes,
    loadingQuestion,
    userInfo.userid,
  ])

  // Warn before tab close or hard refresh when the active question has edits
  // that haven't been committed to the backend yet.
  React.useEffect(() => {
    if (isReadOnly) return
    const handle = (e: BeforeUnloadEvent) => {
      const s = unsavedRef.current
      const hasPendingEdits =
        shouldPersistResponse(s) ||
        (s.selectQuestionOption === -1 && s.notes !== s.initNotes)
      if (hasPendingEdits) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handle)
    return () => window.removeEventListener('beforeunload', handle)
  }, [isReadOnly])

  // Re-seed the current question's answer when the scores map refreshes out of
  // band — e.g. the user saves a question then navigates back before that save's
  // scores GET resolves, so the questionId effect seeded from a stale snapshot.
  // Only runs when idle (the questionId effect owns seeding while loading) with no
  // unsaved edits and no restored draft, so an in-progress change is never
  // overwritten. Without this the display can show a just-saved answer as
  // unanswered, and re-answering it would POST a duplicate score.
  React.useEffect(() => {
    const u = unsavedRef.current
    if (
      !shouldReseedAnswer({
        hasQuestion: !!questionId,
        loadingQuestion: loadingQuestionRef.current,
        hasUnsavedEdits:
          u.selectQuestionOption !== u.initQuestionChoice ||
          u.notes !== u.initNotes,
        draftRestored: draftStatusRef.current === 'restored',
      })
    ) {
      return
    }
    const sel = deriveScoreSelection(
      optionsRef.current.map((o) => Number(o.value)),
      questionScoresRef.current
    )
    // No change from the last-seeded state — nothing to correct.
    if (sel.choice === u.initQuestionChoice && sel.notes === u.initNotes) return
    setOptions((prev) =>
      prev.map((o) => ({
        ...o,
        defaultChecked: Number(o.value) === sel.funcOptId,
      }))
    )
    setSelectQuestionOption(sel.choice)
    setInitQuestionChoice(sel.choice)
    setNotes(sel.notes)
    setInitNotes(sel.notes)
    setScoreId(sel.scoreid)
    setRadioKey((k) => k + 1)
  }, [questionScores, questionId])

  const breadcrumbSegmentLabels = fismaacronym
    ? { [fismaacronym]: fismaacronym.toUpperCase() }
    : undefined
  if (!system) {
    return (
      <>
        <BreadCrumbs segmentLabels={breadcrumbSegmentLabels} />
        <Container maxWidth={false} disableGutters>
          <Alert severity="warning" sx={{ mt: 2 }}>
            Cannot load questionnaire from a direct link. Please open it from
            the system list.
          </Alert>
        </Container>
      </>
    )
  }
  if (noQuestions) {
    return (
      <>
        <BreadCrumbs segmentLabels={breadcrumbSegmentLabels} />
        <Container maxWidth={false} disableGutters>
          <Alert severity="info" sx={{ mt: 2 }}>
            No questionnaire is available for this system. This typically
            applies to systems whose data center environment is no longer in
            scope for the current data call.
          </Alert>
        </Container>
      </>
    )
  }
  // Inline validation: when the user has flipped their answer without
  // substantially editing the notes, we block the save (Next button) and
  // surface the reason under the notes field. See saveGuard.ts for the rule.
  const needsNotesUpdate = needsNotesUpdateForChoiceChange({
    selectQuestionOption,
    initQuestionChoice,
    notes,
    initNotes,
  })
  // Insight for the question currently on screen. questionId holds the current
  // functionid; the Question record carries the DB questionid the insight rows
  // are keyed by. Undefined for any question without a synced insight row, in
  // which case the panel is not rendered and the page is unchanged.
  const currentInsight =
    questionId != null
      ? insightsByQuestion.get(questions[questionId]?.questionid ?? -1)
      : undefined
  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <BreadCrumbs segmentLabels={breadcrumbSegmentLabels} />
        <Button
          variant="outlined"
          size="small"
          onClick={() => setDiffModalOpen(true)}
          sx={{ whiteSpace: 'nowrap' }}
        >
          Compare Datacalls
        </Button>
      </Box>
      {isPastDeadline && !isReadOnly && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This datacall has closed. Changes will be recorded as post-deadline.
        </Alert>
      )}
      <Container maxWidth={false} disableGutters>
        <Grid container columnSpacing={2} sx={{ mt: 2 }}>
          <Grid item xs={3}>
            <List
              sx={{
                width: '100%',
                // maxWidth: 500,
                bgcolor: 'background.paper',
                position: 'relative',
                overflow: 'auto',
                overflowX: 'hidden',
                maxHeight: 'calc(100vh - 240px)',
                '& ul': { padding: 0 },
                msOverflowStyle: 'none', // Hide scrollbar in IE/Edge
                '&::-webkit-scrollbar': { display: 'none' },
                '@supports (-moz-appearance:none)': {
                  scrollbarWidth: 'none',
                },
              }}
              subheader={<li />}
            >
              {categories.map((pillar) => (
                <li key={`${pillar.name}-section`}>
                  <ul>
                    <ListSubheader
                      sx={{
                        backgroundColor: '#07124d',
                        color: 'white',
                        textAlign: 'center',
                      }}
                    >
                      {pillar.name === 'CrossCutting'
                        ? 'CROSS CUTTING'
                        : pillar.name.toUpperCase()}
                    </ListSubheader>
                    {pillar.steps.map((func) => {
                      // console.log(func)
                      const text = addSpace(func.function.function)
                      const customFontSize =
                        text.length > 33 ? '0.9rem' : '1rem'
                      // TODO: refactor this code such that it's going to be a single component instead of being rerendered everytime
                      return (
                        <ListItemButton
                          key={`item-${pillar.name}-${func.function.functionid}`}
                          selected={selectedIndex === func.function.functionid}
                          onClick={() => {
                            // prevent clicking on the same question to break list
                            if (selectedIndex !== func.function.functionid) {
                              setStepId(func.function.functionid)
                              if (
                                !isReadOnly &&
                                ((selectQuestionOption !== -1 &&
                                  initQuestionChoice !==
                                    selectQuestionOption) ||
                                  initNotes !== notes)
                              ) {
                                setOpenAlert(true)
                              } else {
                                navigate(
                                  `/${RouteNames.QUESTIONNAIRE}/${fismaacronym?.toLowerCase()}/${datacall}/${toSlug(pillar.name)}/${toSlug(func.function.function)}`,
                                  {
                                    state: {
                                      fismasystemid: system,
                                      datacallid:
                                        datacallStateRef.current.datacallid,
                                      datacall:
                                        datacallStateRef.current.datacall,
                                      deadline:
                                        datacallStateRef.current.deadline,
                                    },
                                    replace: true,
                                  }
                                )
                                handleListItemClick(func.function.functionid)
                              }
                            }
                          }}
                        >
                          <ListItemText
                            primary={`${text}`}
                            sx={{ fontSize: customFontSize }}
                          />
                        </ListItemButton>
                      )
                    })}
                  </ul>
                </li>
              ))}
            </List>
          </Grid>
          <Grid item xs={9}>
            <Box>
              <Box
                sx={{
                  color: '#5a5a5a',
                  mb: 0,
                  borderRadius: 1,
                }}
              >
                {description}
              </Box>
              <Typography variant="h6" sx={{ mt: 1, mb: 0 }}>
                {question}
              </Typography>
              {currentInsight && <InsightsPanel payload={currentInsight} />}
              {loadingQuestion ? (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    maxHeight: '100%',
                  }}
                >
                  <Spinner size="big" />
                </Box>
              ) : (
                <Box>
                  <Box key={radioKey} sx={{ mb: 2 }}>
                    {renderRadioGroup(options)}
                  </Box>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    {notePrompt || ''}
                  </Typography>
                  <CssTextField
                    multiline
                    rows={4}
                    fullWidth
                    value={notes}
                    disabled={isReadOnly}
                    error={needsNotesUpdate}
                    helperText={
                      needsNotesUpdate ? NOTES_UPDATE_REQUIRED_MSG : undefined
                    }
                    inputProps={{ maxLength: MAX_QUESTIONNAIRE_NOTES_LENGTH }}
                    onChange={(e) => {
                      setNotes(e.target.value)
                      if (draftStatus === 'restored') setDraftStatus('idle')
                    }}
                  />
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      mt: 0.5,
                    }}
                  >
                    <AISummaryBadge
                      show={
                        selectQuestionOption >= 0 &&
                        questionScores[selectQuestionOption]
                          ?.notes_is_ai_summary === true
                      }
                    />
                    {!isReadOnly && (
                      <Typography
                        variant="caption"
                        sx={{
                          ml: 'auto',
                          color:
                            notes.length >= MAX_QUESTIONNAIRE_NOTES_LENGTH
                              ? 'error.main'
                              : notes.length >=
                                  MAX_QUESTIONNAIRE_NOTES_LENGTH * 0.9
                                ? 'warning.main'
                                : 'text.secondary',
                        }}
                      >
                        {notes.length}/{MAX_QUESTIONNAIRE_NOTES_LENGTH}
                      </Typography>
                    )}
                  </Box>
                  <Box
                    position="relative"
                    display="flex"
                    width="100%"
                    justifyContent={'space-between'}
                    sx={{ mt: 1 }}
                  >
                    <CmsButton
                      onClick={() => {
                        if (
                          !isReadOnly &&
                          ((selectQuestionOption !== -1 &&
                            initQuestionChoice !== selectQuestionOption) ||
                            initNotes !== notes)
                        ) {
                          setStepId(
                            stepFunctionId[functionIdIdx[selectedIndex] - 1]
                          )
                          setOpenAlert(true)
                        } else {
                          saveGenRef.current++
                          const id =
                            stepFunctionId[functionIdIdx[selectedIndex] - 1]
                          if (questions[id]) {
                            const q = questions[id]
                            navigate(
                              `/${RouteNames.QUESTIONNAIRE}/${fismaacronym?.toLowerCase()}/${datacall}/${toSlug(q.pillar)}/${toSlug(q.function)}`,
                              {
                                state: {
                                  fismasystemid: system,
                                  datacallid:
                                    datacallStateRef.current.datacallid,
                                  datacall: datacallStateRef.current.datacall,
                                  deadline: datacallStateRef.current.deadline,
                                },
                                replace: true,
                              }
                            )
                          }
                          setLoadingQuestion(true)
                          setQuestionId(id)
                          setSelectedIndex(id)
                        }
                      }}
                      color="primary"
                      disabled={selectedIndex === stepFunctionId[0]}
                      style={{ marginBottom: '8px', marginTop: '8px' }}
                    >
                      <ArrowIcon direction="left" />
                      {` Back`}
                    </CmsButton>
                    <CmsButton
                      onClick={() => {
                        saveGenRef.current++
                        const id =
                          selectedIndex ===
                          stepFunctionId[stepFunctionId.length - 1]
                            ? stepFunctionId[0]
                            : stepFunctionId[functionIdIdx[selectedIndex] + 1]

                        if (questions[id]) {
                          const q = questions[id]
                          navigate(
                            `/${RouteNames.QUESTIONNAIRE}/${fismaacronym?.toLowerCase()}/${datacall}/${toSlug(q.pillar)}/${toSlug(q.function)}`,
                            {
                              state: {
                                fismasystemid: system,
                                datacallid: datacallStateRef.current.datacallid,
                                datacall: datacallStateRef.current.datacall,
                                deadline: datacallStateRef.current.deadline,
                              },
                              replace: true,
                            }
                          )
                        }
                        if (id !== questionId) setLoadingQuestion(true)
                        setQuestionId(id)
                        setSelectedIndex(id)
                        if (!isReadOnly) {
                          saveResponse()
                        }
                      }}
                      disabled={needsNotesUpdate}
                      style={{ marginBottom: '8px', marginTop: '8px' }}
                    >
                      {selectedIndex ===
                      stepFunctionId[stepFunctionId.length - 1] ? (
                        <Typography>Complete</Typography>
                      ) : (
                        <Typography>
                          Next <ArrowIcon direction="right" />
                        </Typography>
                      )}
                      {/* <NavigateNextIcon sx={{ pt: '2px' }} /> */}
                    </CmsButton>
                  </Box>
                  {draftStatus !== 'idle' && !isReadOnly && (
                    <Alert
                      severity={
                        draftStatus === 'saved'
                          ? 'success'
                          : draftStatus === 'error'
                            ? 'error'
                            : 'warning'
                      }
                      icon={false}
                      sx={{ mt: 1, py: 0.5 }}
                    >
                      {draftStatus === 'saved'
                        ? 'Draft saved — click Next or Complete to save permanently.'
                        : draftStatus === 'error'
                          ? 'Draft could not be saved — click Next or Complete to save permanently.'
                          : 'Draft restored — click Next or Complete to save permanently.'}
                    </Alert>
                  )}
                  <LastEditedFooter
                    lastEditedAt={
                      initQuestionChoice !== -1 &&
                      questionScores[initQuestionChoice]
                        ? questionScores[initQuestionChoice].last_edited_at
                        : null
                    }
                    lastEditedBy={
                      initQuestionChoice !== -1 &&
                      questionScores[initQuestionChoice]
                        ? questionScores[initQuestionChoice].last_edited_by
                        : null
                    }
                  />
                </Box>
              )}
            </Box>
          </Grid>
          <ConfirmDialog
            confirmationText={CONFIRMATION_MESSAGE_QUESTION}
            open={openAlert}
            onClose={() => setOpenAlert(false)}
            confirmClick={handleConfirmReturn}
          />
        </Grid>
      </Container>
      {/* Seeds the "To" picker default in ScoreDiffModal. Prefer the call this
          questionnaire was opened for (the row's own call), since the dashboard
          may be aggregating a whole year and selectedDatacall is then null. */}
      <ScoreDiffModal
        open={diffModalOpen}
        onClose={() => setDiffModalOpen(false)}
        fismasystemid={system ?? 0}
        systemName={systemName}
        systemAcronym={fismaacronym ?? ''}
        selectedDataCallId={
          routeDatacallId ?? selectedDatacall?.datacallid ?? latestDataCallId
        }
      />
    </>
  )
}
