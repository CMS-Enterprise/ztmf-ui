import * as React from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import Typography from '@mui/material/Typography'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import ListSubheader from '@mui/material/ListSubheader'
import { useParams } from 'react-router-dom'
import { Button as CmsButton, Spinner } from '@cmsgov/design-system'
import Grid from '@mui/material/Grid'
import Alert from '@mui/material/Alert'
import BreadCrumbs from '@/components/BreadCrumbs/BreadCrumbs'
import TextField from '@mui/material/TextField'
import {
  FismaQuestion,
  FismaSystemType,
  QuestionOption,
  Question,
  QuestionChoice,
  QuestionScores,
  Insight,
  InsightPayload,
  ScoreAggregate,
} from '@/types'
import { Container } from '@mui/system'
import { styled } from '@mui/material/styles'
import axiosInstance from '@/axiosConfig'
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom'
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
import { sortFunctions } from '@/utils/sortFunctions'
import Button from '@mui/material/Button'
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog'
import ScoreDiffModal from '@/components/ScoreDiffModal/ScoreDiffModal'
import PillarScoresModal from '@/components/PillarScoresModal/PillarScoresModal'
import AISummaryBadge from '@/components/AISummaryBadge/AISummaryBadge'
import { useContextProp } from '../Title/Context'
import { isAdmin, isReadOnlyAdmin, hasSystemAccess } from '@/utils/userRoles'
import LastEditedFooter from './LastEditedFooter'
import InsightsPanel from './InsightsPanel/InsightsPanel'
import QuestionRadioGroup from './QuestionRadioGroup'
import JustificationField, {
  type PriorReviewState,
} from './JustificationField/JustificationField'
import {
  buildInsightJustification,
  priorResponseFor,
} from './JustificationField/justificationContext'
import {
  shouldPersistResponse,
  needsNotesUpdateForChoiceChange,
} from './saveGuard'
import {
  carryForwardState,
  canConfirmCarryForward,
  buildScoreByFunction,
  buildConfirmSummary,
  type ConfirmSummary,
  type ConfirmSummaryEntry,
} from './confirmState'
import ConfirmSummaryDialog from './ConfirmSummaryDialog'
import { saveDraft, loadDraft, clearDraft } from './draftStore'
import { deriveScoreSelection, shouldReseedAnswer } from './scoreSelection'
import {
  toSlug,
  encodeDatacallSlug,
  resolveSystemIdByAcronym,
  resolveDatacallBySlug,
  resolveFunctionTarget,
} from './deepLink'
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
// Ties the carried-forward guidance line to the Confirm button it explains, so
// a screen reader hears the reason with the action.
const CARRY_FORWARD_HELPER_ID = 'carried-forward-confirm-helper'

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
    datacalls,
    opdivs,
    opdivsLoaded,
  } = useContextProp()
  const [isPastDeadline, setIsPastDeadline] = React.useState<boolean>(false)
  const [diffModalOpen, setDiffModalOpen] = React.useState(false)
  // PillarScoresModal takes its rows as a prop rather than fetching (unlike
  // ScoreDiffModal), so the header button fetches before opening (ui#610).
  const [pillarScores, setPillarScores] = React.useState<{
    open: boolean
    scores: ScoreAggregate[]
  }>({ open: false, scores: [] })
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
  // Tracks which system the insights map belongs to and whether that system's
  // one-shot lookup has settled. The initial lookup briefly blocks submission so
  // a carried-forward response cannot be submitted before its required-review
  // UI is known.
  const [insightsLoadState, setInsightsLoadState] = React.useState<{
    system?: number
    settled: boolean
  }>({ settled: false })
  const [question, setQuestion] = React.useState<string>('')
  const [datacallID, setDatacallID] = React.useState<number>(0)
  const [datacall, setDatacall] = React.useState<string>('')
  const [loadingQuestion, setLoadingQuestion] = React.useState<boolean>(true)
  // The context (system x data call x question) the current answer/notes were
  // last seeded for. The prior-review initializer only runs once fetchOptions
  // has settled this to the on-screen context.
  const [loadedResponseContextId, setLoadedResponseContextId] =
    React.useState('')
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
  // Review state for a carried-forward prior response, scoped to one
  // system x data call x question x prior-text context. needsSave marks a
  // resolved required review as an unsaved current-call action even when the
  // resulting text is byte-for-byte identical to the seeded response.
  const [priorReview, setPriorReview] = React.useState<{
    contextId: string
    state: PriorReviewState
    needsSave: boolean
  }>({ contextId: '', state: 'not-required', needsSave: false })
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
  // Mirrors the payload the debounced draft save would write, so unmount can
  // flush it. The debounce cleanup cancels its own pending timer, and a route
  // change away from this page (System Info, the Dashboard breadcrumb, browser
  // back) tears the component down without firing beforeunload, so an edit made
  // inside the 1s window was dropped. Carries the generation so a flush cannot
  // resurrect a draft clearCurrentDraft deleted after the timer was scheduled.
  const pendingDraftRef = React.useRef<{
    userid: string
    system: number
    questionId: number
    datacallID: number
    draft: { selectQuestionOption: number; notes: string }
    gen: number
  } | null>(null)
  const unsavedRef = React.useRef({
    selectQuestionOption,
    initQuestionChoice,
    notes,
    initNotes,
    priorReviewNeedsSave: false,
  })
  // unsavedRef.current is assigned below, once priorReviewNeedsSave has been
  // derived, so the beforeunload and re-seed effects read it too.
  // Refs so the out-of-band re-seed effect can read current options and loading
  // state without enrolling them as effect dependencies.
  const optionsRef = React.useRef(options)
  optionsRef.current = options
  const loadingQuestionRef = React.useRef(loadingQuestion)
  loadingQuestionRef.current = loadingQuestion
  // Bumped on a re-seed to remount the radio group. QuestionRadioGroup is now
  // controlled (reflects selectQuestionOption directly), so this is no longer
  // strictly required for the selection to update, but it is retained as a clean
  // reset of the subtree when a re-seed changes the answer out of band.
  const [radioKey, setRadioKey] = React.useState(0)
  // Returns the fresh map alongside committing it to state, so a caller that
  // must reason over the authoritative data in the same tick (the Complete
  // summary) does not have to read a not-yet-rendered state value. undefined
  // on failure — callers fall back to the state they already had.
  const fetchQuestionScores = async (
    systemId: number | string | undefined,
    setQuestionScores: (scores: questionScoreMap) => void
  ): Promise<questionScoreMap | undefined> => {
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
      return hashTable
    } catch (error) {
      if (isAuthHandled(error)) return undefined
      console.error('Error fetching question scores:', error)
      return undefined
    }
  }
  const handleChoiceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectQuestionOption(Number(event.target.value))
    if (draftStatus === 'restored') setDraftStatus('idle')
  }
  const renderRadioGroup = (options: QuestionChoice[]) => {
    // Native-radio group (see QuestionRadioGroup) rather than CMSDS ChoiceList:
    // it carries the same option insight badges plus the FIPS baseline treatment
    // (per-option warn styling, divider, above-baseline badge/notice) that a flat
    // ChoiceList can't express.
    //
    // Systems whose OpDiv has insights disabled do not surface the internal
    // ZTMF Insights layer. Always pass insight so the FIPS baseline markers (a
    // federal-wide concept) render for every system regardless of OpDiv.
    // showInsightBadges suppresses the insights option chips (suggested +
    // prior-answer) for disabled OpDivs while leaving the baseline treatment
    // intact. The Insights panel, suggestion, and per-option insight badges are
    // each separately gated (showInsights / showInsightSuggestion /
    // showInsightBadges) — all derive from showCmsInsights.
    return (
      <QuestionRadioGroup
        options={options}
        name="radio-choices"
        selectedValue={selectQuestionOption}
        onChange={handleChoiceChange}
        disabled={isReadOnly}
        insight={currentInsight}
        showInsightBadges={showCmsInsights}
        viewedDatacall={datacall}
      />
    )
  }

  const navigate = useNavigate()
  const location = useLocation()
  // `function` is a reserved word, so the :function route param is aliased.
  const {
    fismaacronym,
    datacallid: datacallSlug,
    pillar: pillarSlug,
    function: functionSlug,
  } = useParams()

  // Direct/bookmarked navigation to /questionnaire/<acronym> has a null
  // location.state. On such a cold load (paste / refresh / bookmark) fall back
  // to resolving :fismaacronym against the systems list the app already loads,
  // so the questionnaire is self-addressable (#500). In-app navigation keeps
  // carrying the id in location.state, which takes precedence.
  const stateSystem = location.state?.fismasystemid as number | undefined
  const resolvedSystem = React.useMemo(
    () => resolveSystemIdByAcronym(fismaSystems, fismaacronym),
    [fismaSystems, fismaacronym]
  )
  // The context list holds active systems only, so a deep link to a
  // decommissioned system would read as "not found" and mislead (its real
  // state is "no questionnaire available"). When the acronym misses the active
  // list, lazily fetch the decommissioned list once and retry against it.
  // null = not fetched; [] = fetched (empty or failed).
  const [decommissionedSystems, setDecommissionedSystems] = React.useState<
    FismaSystemType[] | null
  >(null)
  // OpDivs whose systems surface the internal ZTMF Insights layer
  // (opdivs.insights_enabled - CMS today). The gate keys on the SYSTEM's OpDiv,
  // not the viewed data call's name: the FY23-25 era used call tenant (CMS-named
  // vs ZTM-named calls) as a proxy, which broke when FY2026 unified every OpDiv
  // into one HHS-named call and silently hid the layer for every
  // insights-enabled system. Derived from the shared context list, which carries
  // inactive rows - the backend serves insights for an insights-enabled OpDiv
  // regardless of its active flag, so the UI gate must match.
  const insightsOpdivIds = React.useMemo(
    () =>
      new Set(
        opdivs.filter((o) => o.insights_enabled === true).map((o) => o.opdiv_id)
      ),
    [opdivs]
  )
  const resolvedDecommissioned = React.useMemo(
    () => resolveSystemIdByAcronym(decommissionedSystems ?? [], fismaacronym),
    [decommissionedSystems, fismaacronym]
  )
  const system = stateSystem ?? resolvedSystem ?? resolvedDecommissioned
  React.useEffect(() => {
    if (
      system !== undefined ||
      fismaSystems.length === 0 ||
      !fismaacronym ||
      decommissionedSystems !== null
    )
      return
    const controller = new AbortController()
    const load = async () => {
      try {
        const res = await axiosInstance.get(
          'fismasystems?decommissioned=true',
          {
            signal: controller.signal,
          }
        )
        setDecommissionedSystems(res.data?.data ?? [])
      } catch (error) {
        if (controller.signal.aborted) return
        if (isAuthHandled(error)) return
        // Resolution proceeds without the list; the not-found warning is the
        // fallback rather than an indefinite spinner.
        setDecommissionedSystems([])
      }
    }
    void load()
    return () => controller.abort()
  }, [system, fismaSystems.length, fismaacronym, decommissionedSystems])
  // Deep-link URL params, read via refs inside the data-fetch effect so honoring
  // them doesn't enroll them as effect deps (which would refetch on every
  // in-survey question change, since those rewrite :pillar/:function).
  const pillarSlugRef = React.useRef(pillarSlug)
  pillarSlugRef.current = pillarSlug
  const functionSlugRef = React.useRef(functionSlug)
  functionSlugRef.current = functionSlug
  const datacallSlugRef = React.useRef(datacallSlug)
  datacallSlugRef.current = datacallSlug
  // The dashboard opens the questionnaire for the system's own data call
  // (year-aggregated view, #467): the specific call id and name ride along in
  // the route state. Absent (deep link), fall back to the selected/latest call.
  const routeDatacallId = location.state?.datacallid as number | undefined
  const routeDatacall = location.state?.datacall as string | undefined
  const routeDeadline = location.state?.deadline as string | undefined
  const systemRef = React.useRef(system)
  systemRef.current = system
  // The in-survey navigate() calls (Next, Back, sidebar, canonical redirect)
  // reset router state and would drop a picker-chosen data call, reverting the
  // survey to the latest call (#501). Persist the dashboard-opened call here
  // and re-supply it in every internal navigation so the choice survives.
  //
  // Populated ONLY on the dashboard path (route state present). For URL-driven
  // flows (deep link / selected / latest) it stays empty on purpose: the URL's
  // datacall segment already carries the cycle across navigations, and writing
  // these values into location.state from the fetch effect's own navigate()
  // would flip the routeDatacall* deps from undefined to defined and re-run
  // the whole fetch — every cold deep-link used to hit /questions and /scores
  // twice (#524 review).
  const datacallStateRef = React.useRef<{
    datacallid?: number
    datacall?: string
    deadline?: string
  }>({})
  const systemInfo =
    fismaSystems.find((s) => s.fismasystemid === system) ??
    decommissionedSystems?.find((s) => s.fismasystemid === system)
  const systemName = systemInfo?.fismaname ?? fismaacronym ?? ''

  // Fetch ZTMF Insights for this system once (not per question — one call
  // returns every question's row). The initial lookup briefly blocks submission
  // so a carried-forward response cannot be submitted before its required
  // review UI is known. Failures and empty responses then leave the map empty.
  React.useEffect(() => {
    if (!system) return
    const controller = new AbortController()
    // Clear the previous system's insights up front so a system change can't
    // briefly render stale badges/panel while the new fetch is in flight.
    setInsightsByQuestion(new Map())
    setInsightsLoadState({ system, settled: false })
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
      } finally {
        if (!controller.signal.aborted) {
          setInsightsLoadState({ system, settled: true })
        }
      }
    }
    void load()
    return () => controller.abort()
  }, [system])
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

  // Same aggregate call the dashboard's Pillar Scores action makes. Not cached:
  // the dashboard memoizes across many rows, this page is one system and one
  // click. On failure nothing opens and the user is told, rather than opening an
  // empty modal that reads as "this system has no scores".
  const handleOpenPillarScores = async () => {
    try {
      const res = await axiosInstance.get(
        `/scores/aggregate?fismasystemid=${system}&include_pillars=true`
      )
      setPillarScores({ open: true, scores: res.data?.data ?? [] })
    } catch (error) {
      if (isAuthHandled(error)) return
      console.error('Error fetching pillar scores:', error)
      notify(ERROR_MESSAGES.tryAgain, 'error')
    }
  }

  // Keep insight, review, and card state scoped to one system x data call x
  // database question. React reuses this route component as those route values
  // change, so everything below is keyed on that context.
  //
  // questionId holds the current functionid; the Question record carries the DB
  // questionid the insight rows are keyed by. currentInsight is undefined for
  // any question without a synced insight row, in which case the panel is not
  // rendered and the page is unchanged.
  const currentDatabaseQuestionId =
    questionId != null ? questions[questionId]?.questionid : undefined
  // Pending until BOTH lookups settle: the per-system insights rows and the
  // per-OpDiv capability list the gate below keys on. Without the second
  // condition a fast /insights response could enable Next/Complete before
  // /opdivs resolves, letting the panel pop in after the user advanced.
  const insightsPending =
    !!system &&
    (insightsLoadState.system !== system ||
      !insightsLoadState.settled ||
      !opdivsLoaded)
  const currentInsight =
    insightsLoadState.system === system && currentDatabaseQuestionId != null
      ? insightsByQuestion.get(currentDatabaseQuestionId)
      : undefined
  // ZTMF Insights are a per-OpDiv capability (opdivs.insights_enabled), so
  // the gate keys on the SYSTEM's OpDiv. Gating on the viewed call's tenant
  // (the FY23-25 behavior) hid the layer for every system once FY2026 merged
  // all OpDivs into a single HHS-named call. The carried-forward
  // prior-response review is deliberately NOT gated here, so a copied answer
  // is affirmatively reviewed for every system regardless of OpDiv.
  const systemOpdivId = systemInfo?.opdiv_id
  // Single source of truth for all internal insight UI gates.
  const showCmsInsights =
    systemOpdivId != null && insightsOpdivIds.has(systemOpdivId)
  const showInsights = Boolean(currentInsight) && showCmsInsights
  const currentSuggestion = showCmsInsights
    ? buildInsightJustification(currentInsight)
    : undefined
  const currentPriorResponse = priorResponseFor(currentInsight, datacall)
  const hasJustificationContext = Boolean(
    currentPriorResponse || currentSuggestion
  )
  const justificationContextId = JSON.stringify([
    system ?? null,
    datacallID,
    currentDatabaseQuestionId ?? null,
  ])
  const priorReviewContextId = JSON.stringify([
    justificationContextId,
    currentPriorResponse?.text ?? null,
    isReadOnly,
  ])
  // A context that has not yet been evaluated is synchronously treated as
  // initializing. This keeps the editor and Next button blocked during the
  // render before the initializer effect runs.
  const priorReviewState: PriorReviewState =
    !currentPriorResponse || isReadOnly
      ? 'not-required'
      : loadedResponseContextId === justificationContextId &&
          priorReview.contextId === priorReviewContextId
        ? priorReview.state
        : 'initializing'
  const priorReviewNeedsSave =
    priorReview.contextId === priorReviewContextId && priorReview.needsSave
  const updatePriorReviewState = (state: PriorReviewState) => {
    setPriorReview((current) => ({
      contextId: priorReviewContextId,
      state,
      // Resolving a required review is an unsaved current-call action even if
      // the resulting text is byte-for-byte identical to the seeded response.
      needsSave:
        (current.contextId === priorReviewContextId && current.needsSave) ||
        priorReviewState === 'pending',
    }))
  }
  unsavedRef.current = {
    selectQuestionOption,
    initQuestionChoice,
    notes,
    initNotes,
    priorReviewNeedsSave,
  }

  // Carried-forward confirmation state, read from scores.status — the same
  // persisted fact the Data Call Progress fraction counts. Open call only:
  // historical rows are legitimately not_started forever. Read-only sessions
  // see the badges but never the Confirm button.
  const isOpenCall = !isPastDeadline
  const scoreByFunction = React.useMemo(
    () => buildScoreByFunction(questionScores),
    [questionScores]
  )
  // The saved row backing the current question. Keyed by initQuestionChoice
  // (the seeded answer), not selectQuestionOption, so flipping the radio does
  // not detach the badge from the row it describes.
  const currentSavedScore =
    initQuestionChoice !== -1 ? questionScores[initQuestionChoice] : undefined
  const currentCarryState = carryForwardState(currentSavedScore, isOpenCall)
  const showConfirmButton = canConfirmCarryForward({
    state: currentCarryState,
    // Any deviation from the seeded answer/notes: the edit is the explicit
    // act, and Next saves it (flipping status server-side), so the button
    // yields to avoid two visible paths to the same write.
    dirty: selectQuestionOption !== initQuestionChoice || notes !== initNotes,
    isReadOnly,
    priorReviewBlocked:
      priorReviewState === 'pending' || priorReviewState === 'initializing',
  })
  // Derived from the button so the sentence and the action it describes cannot
  // drift apart. !currentPriorResponse suppresses it on insights questions,
  // where the card owns the explanation — a resolved review unblocks the
  // button, so nothing else would.
  const showCarryForwardHelper = showConfirmButton && !currentPriorResponse
  const [confirming, setConfirming] = React.useState(false)
  // The Complete-time summary dialog. null = closed.
  const [confirmSummary, setConfirmSummary] =
    React.useState<ConfirmSummary | null>(null)

  // The explicit act behind "Confirm this answer is still accurate": flips
  // the row's status to done via the confirm endpoint — the ordinary PUT
  // cannot express agreement, its no-op guard (correctly) drops an unchanged
  // body (#412/#413). Shared with saveResponse's resolved-review path.
  const confirmScoreById = async (id: number): Promise<boolean> => {
    try {
      await axiosInstance.put(`scores/${id}/confirm`)
      notify(STATUS_MESSAGES.saved, 'success', { autoHideDuration: 1500 })
      clearCurrentDraft()
      setPriorReview((current) =>
        current.contextId === priorReviewContextId
          ? { ...current, needsSave: false }
          : current
      )
      // Flip the badge immediately (role="status" announces the change);
      // the refetch then brings the authoritative row, audit fields included.
      setQuestionScores((prev) => {
        const entry = Object.entries(prev).find(([, s]) => s.scoreid === id)
        if (!entry) return prev
        return { ...prev, [entry[0]]: { ...entry[1], status: 'done' } }
      })
      fetchQuestionScores(system, setQuestionScores)
      return true
    } catch (error) {
      if (isAuthHandled(error)) return false
      console.error('Error confirming score:', error)
      notify(ERROR_MESSAGES.tryAgain, 'error', { autoHideDuration: 2500 })
      return false
    }
  }

  const handleConfirmClick = async () => {
    if (!currentSavedScore || confirming) return
    setConfirming(true)
    try {
      await confirmScoreById(currentSavedScore.scoreid)
    } finally {
      setConfirming(false)
    }
  }

  // Complete on the open call: save the current question as Next always has,
  // then show one end-of-questionnaire summary instead of silently looping
  // back to question 1. Built from a freshly-awaited scores fetch so the
  // just-saved answer counts; falls back to the on-screen map on failure.
  const handleCompleteClick = async () => {
    saveGenRef.current++
    if (!isReadOnly) {
      await saveResponse()
    }
    const fresh = await fetchQuestionScores(system, setQuestionScores)
    if (fresh) {
      // Re-seed the current question's saved state from the fresh map. The
      // old Complete re-seeded implicitly by navigating to question 1; this
      // one stays put, and without a re-seed a just-POSTed answer would
      // still read as unsaved (scoreid 0) — a second Complete would POST a
      // duplicate row and double-weight the question in the pillar average.
      const sel = deriveScoreSelection(
        optionsRef.current.map((o) => Number(o.value)),
        fresh
      )
      setInitQuestionChoice(sel.choice)
      setInitNotes(sel.notes)
      setScoreId(sel.scoreid)
    }
    setConfirmSummary(
      buildConfirmSummary(
        categories,
        fresh ? buildScoreByFunction(fresh) : scoreByFunction,
        isOpenCall
      )
    )
  }

  // Jump link from the Complete summary: same slug navigation + list-click
  // path the sidebar uses, so the datacall context rides along (#501).
  const jumpToSummaryEntry = (entry: ConfirmSummaryEntry) => {
    setConfirmSummary(null)
    // Already on this question (e.g. the last question is itself unanswered):
    // just close the dialog. handleListItemClick would set loading for a
    // questionId change that never fires, stranding the spinner.
    if (entry.functionid === questionId) return
    const q = questions[entry.functionid]
    if (q) {
      navigate(
        `/${RouteNames.QUESTIONNAIRE}/${fismaacronym?.toLowerCase()}/${datacall}/${toSlug(q.pillar)}/${toSlug(q.function)}`,
        {
          state: { fismasystemid: system, ...datacallStateRef.current },
          replace: true,
        }
      )
    }
    handleListItemClick(entry.functionid)
  }

  const saveResponse = async () => {
    // Resolving a required carried-forward review is itself a current-call
    // action, even when the final text is byte-for-byte identical to the
    // seeded notes. Persist it so the audit trail records the affirmative
    // review.
    const resolvedPriorReview =
      priorReviewNeedsSave && selectQuestionOption >= 0
    if (
      !shouldPersistResponse({
        selectQuestionOption,
        initQuestionChoice,
        notes,
        initNotes,
      })
    ) {
      // Nothing changed on the answer fields. A resolved required review is
      // still an affirmative act that must land — the ordinary PUT's no-op
      // guard would silently drop an identical body, so route it through the
      // confirm endpoint.
      if (resolvedPriorReview && scoreid) {
        await confirmScoreById(scoreid)
        return
      }
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
      setPriorReview((current) =>
        current.contextId === priorReviewContextId
          ? { ...current, needsSave: false }
          : current
      )
      fetchQuestionScores(system, setQuestionScores)
    } catch (error) {
      if (isAuthHandled(error)) return
      console.error('Error saving score:', error)
      notify(ERROR_MESSAGES.tryAgain, 'error', { autoHideDuration: 2500 })
    }
  }

  React.useEffect(() => {
    // Wait for the data calls to load before fetching: a cold deep link can
    // resolve `system` (from the systems list) before the datacall context is
    // ready, and firing early would query scores with datacallid=0. (#500)
    if (system && latestDataCallId > 0) {
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
            datacall = encodeDatacallSlug(routeDatacall)
            setDatacall(datacall)
            activeDataCallId = routeDatacallId
            setIsPastDeadline(
              routeDeadline ? new Date() > new Date(routeDeadline) : true
            )
            datacallStateRef.current = {
              datacallid: routeDatacallId,
              datacall: routeDatacall,
              deadline: routeDeadline,
            }
          } else {
            // Cold deep link (no route state): resolve the cycle from the URL's
            // data-call segment. Falls through to the selected/latest call when
            // the segment is absent or unrecognized. (#500)
            //
            // These branches leave datacallStateRef empty — see its declaration.
            // The cycle rides in the URL segment written by the canonical
            // navigate below, so it survives re-runs and in-survey navigation
            // without route state; a stale ref from a previous dashboard-opened
            // call is also cleared here so it can't hijack a later system
            // switch.
            datacallStateRef.current = {}
            const deepLinkDatacall = resolveDatacallBySlug(
              datacalls,
              datacallSlugRef.current
            )
            const isHistorical =
              selectedDatacall !== null &&
              selectedDatacall.datacallid !== latestDataCallId
            if (deepLinkDatacall) {
              datacall = encodeDatacallSlug(deepLinkDatacall.datacall)
              setDatacall(datacall)
              setIsPastDeadline(
                deepLinkDatacall.deadline
                  ? new Date() > new Date(deepLinkDatacall.deadline)
                  : true
              )
              activeDataCallId = deepLinkDatacall.datacallid
            } else if (isHistorical && selectedDatacall) {
              datacall = encodeDatacallSlug(selectedDatacall.datacall)
              setDatacall(datacall)
              setIsPastDeadline(true)
              activeDataCallId = selectedDatacall.datacallid
            } else {
              datacall = encodeDatacallSlug(latestDatacall)
              setDatacall(datacall)
              setIsPastDeadline(
                latestDeadline ? new Date() > new Date(latestDeadline) : true
              )
              activeDataCallId = latestDataCallId
            }
          }
          // Hoisted so both the questions block and the final batch can access them.
          const questionData: Record<number, Question> = {}
          let sortedFuncId: number[] = []
          // The function to open. Defaults to the first; overridden below when the
          // URL's :pillar/:function names a valid function (deep link, #500).
          let targetFuncId: number | undefined
          try {
            const response = await axiosInstance.get(
              `/fismasystems/${system}/questions?datacallid=${activeDataCallId}`,
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
              // The reduced-pillar rule is applied by the API for the cycle
              // requested above (ztmf#545), so whatever comes back is already
              // the right set.
              const sortedPillars = sortPillars(Object.keys(organizedData))
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
              // Honor the URL's :pillar/:function when they name a valid
              // function; otherwise open the first (#500).
              const target = resolveFunctionTarget(
                categoriesData,
                pillarSlugRef.current,
                functionSlugRef.current
              )
              targetFuncId = target?.functionid ?? sortedFuncId[0]
              const targetPillarName =
                target?.pillarName ?? categoriesData[0].name
              const targetFunctionName =
                target?.functionName ??
                categoriesData[0].steps[0].function.function
              // Update sidebar/nav state immediately so the question list
              // renders while scores are still loading. setQuestions,
              // setDatacallID, and setQuestionId are deferred to the batch
              // below — after scores arrive — so the questionId effect fires
              // exactly once with the correct scores already in the ref.
              setFunctionIdIdx(funcIdToIdx)
              setStepFunctionId(sortedFuncId)
              setCategories(categoriesData)
              navigate(
                `/${RouteNames.QUESTIONNAIRE}/${fismaacronym?.toLowerCase()}/${datacall}/${toSlug(targetPillarName)}/${toSlug(targetFunctionName)}`,
                {
                  state: { fismasystemid: system, ...datacallStateRef.current },
                  replace: true,
                }
              )
              setSelectedIndex(targetFuncId)
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
          setQuestionId(targetFuncId ?? sortedFuncId[0])
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
    datacalls,
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
          // Mark this system x data call x question as the context the current
          // answer/notes were seeded for, so the prior-review initializer runs
          // only once the loaded state matches what is on screen.
          setLoadedResponseContextId(
            JSON.stringify([
              sys ?? null,
              datacallID,
              questions[questionId ?? -1]?.questionid ?? null,
            ])
          )
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

  // Record that the user opened this question, so time-spent analytics can
  // bound how long it was worked on before the next question is opened (only
  // views bound a view; saves are not boundaries). Fire-and-forget for all
  // sessions (viewers are captured too); a failed ping must never disrupt
  // answering. Editor-vs-viewer is decided server-side from role + deadline, so
  // the client sends no such flag.
  // Keyed on the system x data call x question context so it fires exactly once
  // per question open (initial load, Next/Back, or sidebar). questionId holds
  // the functionid; the recorded questionid is the DB question it maps to.
  const viewedQuestionId = questionId ? questions[questionId]?.questionid : null
  React.useEffect(() => {
    if (!system || datacallID <= 0 || !viewedQuestionId) return
    void (async () => {
      try {
        await axiosInstance.post('events/view', {
          fismasystemid: system,
          datacallid: datacallID,
          questionid: viewedQuestionId,
        })
      } catch {
        // Analytics only — swallow errors (including auth-handled ones).
      }
    })()
  }, [system, datacallID, viewedQuestionId])

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
      pendingDraftRef.current = null
      if (draftStatusRef.current !== 'idle') setDraftStatus('idle')
      return
    }
    if (selectQuestionOption === initQuestionChoice && notes === initNotes) {
      pendingDraftRef.current = null
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
    const pending = {
      userid: userInfo.userid,
      system,
      questionId,
      datacallID,
      draft: { selectQuestionOption, notes },
      gen: currentGen,
    }
    pendingDraftRef.current = pending
    const timer = setTimeout(() => {
      if (saveGenRef.current !== currentGen) return
      saveDraft(
        pending.userid,
        pending.system,
        pending.questionId,
        pending.datacallID,
        pending.draft,
        () => saveGenRef.current === currentGen
      ).then((saved) => {
        if (saveGenRef.current !== currentGen) return
        // Clear by identity, not generation: a newer edit re-runs this effect
        // and replaces the ref with a NEW object under the SAME generation
        // (saveGenRef only moves on explicit clears), so a generation check
        // here would let the older save's completion discard the newer edit's
        // payload while its own debounce is still pending — and an unmount in
        // that window would then flush nothing (#640 review). Gated on `saved`
        // so a failed write stays in the ref for the unmount flush to retry.
        if (saved && pendingDraftRef.current === pending)
          pendingDraftRef.current = null
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

  // Flush a pending draft on unmount. beforeunload below covers tab close and
  // hard refresh, but it does not fire on in-app navigation, and the debounce
  // cleanup cancels the timer that would have written the draft. Mount-once so
  // the cleanup runs on unmount only, never on a dep change (flushing on every
  // dep change would defeat the debounce and write on each keystroke).
  // saveDraft takes primitives and touches no component state, so the write
  // completes after this component is gone.
  React.useEffect(() => {
    return () => {
      const pending = pendingDraftRef.current
      // Reading the live generation is the point of this guard, not a staleness
      // bug: it must reflect any clearCurrentDraft that ran after the timer was
      // scheduled, so a flush cannot resurrect a just-deleted draft. Copying it
      // into the effect body would freeze it at its mount value.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (!pending || saveGenRef.current !== pending.gen) return
      void saveDraft(
        pending.userid,
        pending.system,
        pending.questionId,
        pending.datacallID,
        pending.draft
      )
    }
  }, [])

  // Warn before tab close or hard refresh when the active question has edits
  // that haven't been committed to the backend yet.
  React.useEffect(() => {
    if (isReadOnly) return
    const handle = (e: BeforeUnloadEvent) => {
      const s = unsavedRef.current
      const hasPendingEdits =
        shouldPersistResponse(s) ||
        (s.selectQuestionOption === -1 && s.notes !== s.initNotes) ||
        s.priorReviewNeedsSave
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
          u.notes !== u.initNotes ||
          u.priorReviewNeedsSave,
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

  // A score copied from the prior data call has no edit event for the current
  // call. When its notes exactly match last_score_notes, keep that text as
  // context rather than silently treating it as the current submitted answer.
  // The context id makes this an initializer: accepting/dismissing cannot be
  // reset by the resulting notes state change, but navigating to a new question
  // can.
  React.useEffect(() => {
    if (loadingQuestion || loadedResponseContextId !== justificationContextId)
      return
    const currentScore =
      selectQuestionOption >= 0
        ? questionScores[selectQuestionOption]
        : undefined
    if (priorReview.contextId === priorReviewContextId) return

    // "Untouched this cycle": prefer the persisted scores.status so this gate
    // and the progress count cannot diverge; fall back to the older
    // no-edit-event proxy for a backend that does not serve status yet.
    const untouchedThisCycle = currentScore?.status
      ? currentScore.status === 'not_started'
      : !currentScore?.last_edited_at
    const isUnreviewedCarryForward =
      !isReadOnly &&
      !!currentPriorResponse &&
      !!currentScore &&
      untouchedThisCycle &&
      draftStatus !== 'restored' &&
      notes.trim() === currentPriorResponse.text.trim()
    setPriorReview({
      contextId: priorReviewContextId,
      state: isUnreviewedCarryForward ? 'pending' : 'not-required',
      needsSave: false,
    })
  }, [
    currentPriorResponse,
    draftStatus,
    isReadOnly,
    loadingQuestion,
    loadedResponseContextId,
    notes,
    priorReview.contextId,
    priorReviewContextId,
    justificationContextId,
    questionScores,
    selectQuestionOption,
  ])

  const breadcrumbSegmentLabels = fismaacronym
    ? { [fismaacronym]: fismaacronym.toUpperCase() }
    : undefined
  if (!system) {
    // Cold load (paste / refresh / bookmark): the systems list may still be in
    // flight, so :fismaacronym can't be resolved yet — and if it missed the
    // active list, the decommissioned list is being checked before concluding
    // not-found. Show a spinner until both have answered; only then is the
    // link genuinely unresolvable. (#500 / #524 review)
    if (fismaSystems.length === 0 || decommissionedSystems === null) {
      return (
        <>
          <BreadCrumbs segmentLabels={breadcrumbSegmentLabels} />
          <Container maxWidth={false} disableGutters>
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Spinner size="big" />
            </Box>
          </Container>
        </>
      )
    }
    return (
      <>
        <BreadCrumbs segmentLabels={breadcrumbSegmentLabels} />
        <Container maxWidth={false} disableGutters>
          <Alert severity="warning" sx={{ mt: 2 }}>
            Could not find a system matching “{fismaacronym}”. It may not exist,
            or you may not have access to it.
          </Alert>
        </Container>
      </>
    )
  }
  // Cross-navigation back to this system's detail page (ui#610). A real router
  // link rather than onClick + navigate, so open-in-new-tab and copy-link work.
  // Gated on the same hasSystemAccess check the dashboard puts on its own System
  // Details action. Every current role passes it (delegates included), so in
  // practice this only suppresses the link while userInfo is unloaded or carries
  // an unrecognized role - but it is the gate that moves if system-detail access
  // ever narrows.
  const systemInfoLink = hasSystemAccess(userInfo) ? (
    <Button
      variant="outlined"
      size="small"
      component={RouterLink}
      to={`/systems/${system}`}
      sx={{ whiteSpace: 'nowrap' }}
    >
      System Info
    </Button>
  ) : null
  if (noQuestions) {
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
          {/* Without this the flow System Info -> Questionnaire -> "no
              questionnaire available" is one-way, which the #609 button makes
              reachable for any out-of-scope or decommissioned system (#640
              review). */}
          {systemInfoLink}
        </Box>
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
  // The data call both header modals present as "current". Prefer the call this
  // questionnaire actually resolved (datacallID covers every entry path,
  // including URL deep links where no route state exists); fall back to the
  // route/selected/latest chain during the pre-fetch window.
  const viewedDataCallId =
    datacallID > 0
      ? datacallID
      : routeDatacallId ?? selectedDatacall?.datacallid ?? latestDataCallId
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
        <Box sx={{ display: 'flex', gap: 1 }}>
          {systemInfoLink}
          <Button
            variant="outlined"
            size="small"
            onClick={handleOpenPillarScores}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Pillar Scores
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setDiffModalOpen(true)}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Compare Datacalls
          </Button>
        </Box>
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
                      // Sidebar confirmation marker: same classification the
                      // question view's badge reads. Text-bearing, not
                      // color-only (508); rendered as ListItemText secondary
                      // so it is part of the button's accessible name.
                      const sidebarCarryState = carryForwardState(
                        scoreByFunction[func.function.functionid],
                        isOpenCall
                      )
                      // TODO: refactor this code such that it's going to be a single component instead of being rerendered everytime
                      return (
                        <ListItem
                          key={`item-${pillar.name}-${func.function.functionid}`}
                          disablePadding
                        >
                          <ListItemButton
                            selected={
                              selectedIndex === func.function.functionid
                            }
                            onClick={() => {
                              // prevent clicking on the same question to break list
                              if (selectedIndex !== func.function.functionid) {
                                setStepId(func.function.functionid)
                                if (
                                  !isReadOnly &&
                                  ((selectQuestionOption !== -1 &&
                                    initQuestionChoice !==
                                      selectQuestionOption) ||
                                    initNotes !== notes ||
                                    priorReviewNeedsSave)
                                ) {
                                  setOpenAlert(true)
                                } else {
                                  navigate(
                                    `/${RouteNames.QUESTIONNAIRE}/${fismaacronym?.toLowerCase()}/${datacall}/${toSlug(pillar.name)}/${toSlug(func.function.function)}`,
                                    {
                                      state: {
                                        fismasystemid: system,
                                        ...datacallStateRef.current,
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
                              secondary={
                                sidebarCarryState === 'unconfirmed'
                                  ? 'Not yet confirmed'
                                  : sidebarCarryState === 'updated'
                                    ? 'Updated'
                                    : undefined
                              }
                              secondaryTypographyProps={{
                                fontSize: '0.75rem',
                                color:
                                  sidebarCarryState === 'unconfirmed'
                                    ? 'warning.dark'
                                    : 'success.dark',
                              }}
                              sx={{ fontSize: customFontSize }}
                            />
                          </ListItemButton>
                        </ListItem>
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
              {/* The question is the page's main heading — render as <h1>
                  (keeping the h6 styling) so the page has a level-one heading. */}
              <Typography variant="h6" component="h1" sx={{ mt: 1, mb: 0 }}>
                {question}
              </Typography>
              {insightsPending && (
                <Typography
                  role="status"
                  variant="caption"
                  sx={{ color: 'text.secondary' }}
                >
                  Checking for prior responses…
                </Typography>
              )}
              {showInsights && currentInsight && (
                <InsightsPanel
                  payload={currentInsight}
                  questionId={currentDatabaseQuestionId}
                />
              )}
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
                  {hasJustificationContext ? (
                    // Carried-forward prior response and/or an Insights
                    // suggestion exist: render the review-aware justification
                    // editor. It owns its own label, char counter, and (for
                    // CMS calls) the suggestion card.
                    <JustificationField
                      key={justificationContextId}
                      contextId={justificationContextId}
                      label={notePrompt || 'Justification'}
                      value={notes}
                      onChange={(value) => {
                        setNotes(value)
                        if (draftStatus === 'restored') setDraftStatus('idle')
                      }}
                      insight={currentInsight}
                      priorResponse={currentPriorResponse}
                      showInsightSuggestion={showCmsInsights}
                      viewedDatacall={datacall}
                      priorReviewState={priorReviewState}
                      onPriorReview={updatePriorReviewState}
                      disabled={isReadOnly}
                      error={needsNotesUpdate}
                      helperText={
                        needsNotesUpdate ? NOTES_UPDATE_REQUIRED_MSG : undefined
                      }
                      maxLength={MAX_QUESTIONNAIRE_NOTES_LENGTH}
                    />
                  ) : (
                    <>
                      {/* h2 under the question's h1 so the heading order is valid. */}
                      <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
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
                          needsNotesUpdate
                            ? NOTES_UPDATE_REQUIRED_MSG
                            : undefined
                        }
                        inputProps={{
                          maxLength: MAX_QUESTIONNAIRE_NOTES_LENGTH,
                          // The multiline field has no visible <label>; the
                          // prompt above is styling-only. Give it an accessible
                          // name (508).
                          'aria-label': 'Justification notes',
                        }}
                        onChange={(e) => {
                          setNotes(e.target.value)
                          if (draftStatus === 'restored') setDraftStatus('idle')
                        }}
                      />
                    </>
                  )}
                  {/* Sits where the prior-response flow puts its own review
                      message, so both variants instruct in the same place.
                      "before continuing" is advisory on purpose: Next is not
                      blocked on this variant. Plain text, not a live region —
                      the chip below owns the announcement. */}
                  {showCarryForwardHelper && (
                    <Typography
                      id={CARRY_FORWARD_HELPER_ID}
                      sx={{ mt: 0.5, fontSize: 12, color: '#8a4b00' }}
                    >
                      Review the carried-forward answer and confirm it, or write
                      a new justification, before continuing.
                    </Typography>
                  )}
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
                    {!hasJustificationContext && !isReadOnly && (
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
                  {/* Carried-forward confirmation strip, in the same zone
                      where the prior-response flow surfaces its "review
                      before continuing" message, so every system shares one
                      review area. The chip is a role="status" live region, so
                      confirming — which swaps its label in place — is
                      announced (508). The button yields the moment the
                      question is dirty (the edit is the explicit act; Next
                      saves it), and Next itself never writes on an untouched
                      question (#413). */}
                  {currentCarryState !== 'none' && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 1,
                        mt: 1.5,
                      }}
                    >
                      <Chip
                        role="status"
                        size="small"
                        variant="outlined"
                        color={
                          currentCarryState === 'unconfirmed'
                            ? 'warning'
                            : 'success'
                        }
                        label={
                          currentCarryState === 'unconfirmed'
                            ? 'Carried forward — not yet confirmed'
                            : 'Updated this data call'
                        }
                      />
                      {showConfirmButton && (
                        <Button
                          variant="outlined"
                          color="success"
                          size="small"
                          startIcon={<CheckCircleOutlineIcon />}
                          onClick={handleConfirmClick}
                          disabled={confirming}
                          aria-describedby={
                            showCarryForwardHelper
                              ? CARRY_FORWARD_HELPER_ID
                              : undefined
                          }
                          sx={{ textTransform: 'none' }}
                        >
                          Confirm this answer is still accurate
                        </Button>
                      )}
                    </Box>
                  )}
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
                            initNotes !== notes ||
                            priorReviewNeedsSave)
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
                                  ...datacallStateRef.current,
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
                        const isLastQuestion =
                          selectedIndex ===
                          stepFunctionId[stepFunctionId.length - 1]
                        // Complete on the open call summarizes instead of
                        // silently wrapping to question 1. A closed call
                        // keeps the wrap-around — harmless paging for a
                        // historical viewer.
                        if (isLastQuestion && isOpenCall) {
                          void handleCompleteClick()
                          return
                        }
                        saveGenRef.current++
                        const id = isLastQuestion
                          ? stepFunctionId[0]
                          : stepFunctionId[functionIdIdx[selectedIndex] + 1]

                        if (questions[id]) {
                          const q = questions[id]
                          navigate(
                            `/${RouteNames.QUESTIONNAIRE}/${fismaacronym?.toLowerCase()}/${datacall}/${toSlug(q.pillar)}/${toSlug(q.function)}`,
                            {
                              state: {
                                fismasystemid: system,
                                ...datacallStateRef.current,
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
                      disabled={
                        needsNotesUpdate ||
                        insightsPending ||
                        priorReviewState === 'pending' ||
                        priorReviewState === 'initializing'
                      }
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
          <ConfirmSummaryDialog
            summary={confirmSummary}
            onClose={() => setConfirmSummary(null)}
            onJump={jumpToSummaryEntry}
          />
        </Grid>
      </Container>
      <ScoreDiffModal
        open={diffModalOpen}
        onClose={() => setDiffModalOpen(false)}
        fismasystemid={system ?? 0}
        systemName={systemName}
        systemAcronym={fismaacronym ?? ''}
        selectedDataCallId={viewedDataCallId}
      />
      {/* Same modal the dashboard's Pillar Scores action opens. The acronym
          comes from the resolved system rather than the lowercased URL param so
          the title matches the dashboard's casing. */}
      <PillarScoresModal
        open={pillarScores.open}
        onClose={() => setPillarScores((prev) => ({ ...prev, open: false }))}
        systemName={systemName}
        systemAcronym={
          systemInfo?.fismaacronym ?? fismaacronym?.toUpperCase() ?? ''
        }
        scores={pillarScores.scores}
        selectedDataCallId={viewedDataCallId}
      />
    </>
  )
}
