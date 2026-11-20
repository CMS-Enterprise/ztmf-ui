import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Spinner } from '@cmsgov/design-system'
import { colors } from '@/theme/tokens'
import Alert from '@mui/material/Alert'
import BreadCrumbs from '@/components/BreadCrumbs/BreadCrumbs'
import PageHeader from '@/components/ui/PageHeader'
import DatacallContextCard from '@/components/DatacallContextCard/DatacallContextCard'
import {
  FismaQuestion,
  FismaSystemType,
  QuestionChoice,
  QuestionScores,
} from '@/types'
import { Container } from '@mui/system'
import axiosInstance from '@/axiosConfig'
import { apiPaths, queryKeys } from '@/api/keys'
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom'
import {
  ERROR_MESSAGES,
  STATUS_MESSAGES,
  MAX_QUESTIONNAIRE_NOTES_LENGTH,
  CONFIRMATION_MESSAGE_QUESTION,
  NOTES_UPDATE_REQUIRED_MSG,
  COMPLETE_HINT_MSG,
  NEXT_HINT_MSG,
} from '@/constants'
import { isAuthHandled, notify } from '@/utils/notify'
import { useFismaSystems } from '@/utils/fismaSystems'
import { useSystemInsights } from '@/utils/insights'
import {
  functionOptionsQuery,
  useFunctionOptions,
} from '@/utils/functionOptions'
import {
  SystemQuestionsKey,
  systemQuestionsQuery,
  useSystemQuestions,
} from '@/utils/systemQuestions'
import { EMPTY_LIST } from '@/utils/emptyList'
import {
  QuestionScoreMap,
  indexScoresByOption,
  latestEditedAt,
  questionScoresQuery,
  useQuestionScores,
} from '@/utils/questionScores'
import Button from '@mui/material/Button'
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog'
import ScoreDiffModal from '@/components/ScoreDiffModal/ScoreDiffModal'
import EvidenceNotesField, {
  DEFAULT_NOTES_PROMPT,
} from './components/EvidenceNotesField'
import NotesFooter from './components/NotesFooter'
import CarryForwardStrip from './components/CarryForwardStrip'
import DraftStatusAlert from './components/DraftStatusAlert'
import QuestionNavFooter from './components/QuestionNavFooter'
import { useContextProp } from '../Title/Context'
import { isAdmin, isReadOnlyAdmin, hasSystemAccess } from '@/utils/userRoles'
import AnswerHistoryPanel, {
  ANSWER_HISTORY_PANEL_ID,
  UndoAnswerButton,
} from './AnswerHistoryPanel'
import { canUndoAnswer, undoPreview } from './undoState'
import {
  useAnswerHistory,
  classifyUndoError,
  UNDO_CONFLICT_MESSAGE,
} from './useAnswerHistory'
import {
  carryForwardState,
  isQuestionComplete,
  canConfirmCarryForward,
  buildScoreByFunction,
  buildConfirmSummary,
  type ConfirmSummary,
  type ConfirmSummaryEntry,
} from './confirmState'
import ConfirmSummaryDialog from './ConfirmSummaryDialog'
import InsightsPanel from './InsightsPanel/InsightsPanel'
import FipsBaselineStrip from './FipsBaselineStrip'
import { resolveFipsBaseline } from './fipsBaseline'
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
  addSpace,
  buildQuestionNav,
  indexQuestionsByFunction,
  type Category,
} from './helpers'
// Aliased because a local state variable named `datacall` shadows the type.
import type { datacall as Datacall } from '@/types'
import ClosedDatacallBanner from './components/ClosedDatacallBanner'
import PillarRail from './components/PillarRail'
import QuestionHeading from './components/QuestionHeading'
import SectionRail from './components/SectionRail'
import QuestionnaireProgress from './components/QuestionnaireProgress'
import Card from '@/components/ui/Card'
import { useQuestionDraft } from './useQuestionDraft'
import { deriveScoreSelection, shouldReseedAnswer } from './scoreSelection'
import {
  toSlug,
  encodeDatacallSlug,
  findSystemsByAcronym,
  resolveActiveDatacall,
  resolveFunctionTarget,
  parseSystemIdParam,
  questionnairePath,
} from './deepLink'

export default function QuestionnarePage() {
  const {
    userInfo,
    selectedDatacall,
    latestDataCallId,
    latestDatacall,
    latestDeadline,
    fismaSystems,
    fismaSystemsLoaded,
    datacalls,
    opdivs,
    opdivsLoaded,
  } = useContextProp()
  const queryClient = useQueryClient()
  const [isPastDeadline, setIsPastDeadline] = React.useState<boolean>(false)
  const [diffModalOpen, setDiffModalOpen] = React.useState(false)
  const isReadOnly =
    isReadOnlyAdmin(userInfo) || (isPastDeadline && !isAdmin(userInfo))
  const [questionId, setQuestionId] = React.useState<number | null>(null)
  const [openAlert, setOpenAlert] = React.useState<boolean>(false)
  // The function whose answer options are on screen. The question-load effect
  // moves it once the answer has been seeded for that question, as it used to
  // set the options themselves, so the choices and the seeded answer appear
  // together.
  const [optionsFunctionId, setOptionsFunctionId] = React.useState<
    number | null
  >(null)
  const options = useFunctionOptions(optionsFunctionId) ?? EMPTY_LIST
  // Two views of the questionnaire, each pointed at a cached query by its own
  // key. The sidebar's key moves as soon as the questions arrive, so the list
  // renders while scores are still loading. The questions map's key moves in
  // the same update as scores and questionId, so the question-load effect
  // (which depends on it) runs exactly once per load, never against the
  // previous system's question or scores.
  const [navQuestionsKey, setNavQuestionsKey] =
    React.useState<SystemQuestionsKey | null>(null)
  const [loadedKey, setLoadedKey] = React.useState<SystemQuestionsKey | null>(
    null
  )
  // Bumped at the end of every page load. A reload can land on the same
  // system, data call and question, which leaves the key, questionId and
  // datacallID unchanged. The question-load effect depends on this counter so
  // it still runs, re-seeds the answer and clears the spinner the load set.
  const [loadCount, setLoadCount] = React.useState(0)
  const navQuestions = useSystemQuestions(navQuestionsKey)
  const loadedQuestions = useSystemQuestions(loadedKey)
  const { categories, stepFunctionId, functionIdIdx } = React.useMemo(
    () => buildQuestionNav(navQuestions ?? EMPTY_LIST),
    [navQuestions]
  )
  const questions = React.useMemo(
    () => indexQuestionsByFunction(loadedQuestions ?? EMPTY_LIST),
    [loadedQuestions]
  )
  // Saved answers for the loaded system and data call, keyed by
  // functionoptionid. Same key as the questions map, so they switch together.
  const loadedScores = useQuestionScores(loadedKey)
  const questionScores = React.useMemo<QuestionScoreMap>(
    () => indexScoresByOption(loadedScores ?? EMPTY_LIST),
    [loadedScores]
  )
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
  const [scoreid, setScoreId] = React.useState<number>(0)
  const [initQuestionChoice, setInitQuestionChoice] = React.useState<number>(-1)
  const [initNotes, setInitNotes] = React.useState<string>('')
  const [notes, setNotes] = React.useState<string>('')
  const [notePrompt, setNotePrompt] = React.useState<string>('')
  const [description, setDescription] = React.useState<string>('')
  const [stepId, setStepId] = React.useState<number>(0)
  const [selectQuestionOption, setSelectQuestionOption] =
    React.useState<number>(-1)
  // Local "last saved" timestamp used by the save indicator under the
  // question card. Updated on every successful saveResponse() so the
  // indicator reads "Saved just now / 2 min ago" without depending on the
  // questionScores re-fetch round trip.
  const [lastSavedAt, setLastSavedAt] = React.useState<Date | null>(null)
  // Review state for a carried-forward prior response, scoped to one
  // system x data call x question x prior-text context. needsSave marks a
  // resolved required review as an unsaved current-call action even when the
  // resulting text is byte-for-byte identical to the seeded response.
  const [priorReview, setPriorReview] = React.useState<{
    contextId: string
    state: PriorReviewState
    needsSave: boolean
  }>({ contextId: '', state: 'not-required', needsSave: false })
  // Stable ref so fetchOptions always reads the latest scores without enrolling
  // questionScores as a dep of the questionId effect. Stale-closure-safe because
  // the ref updates synchronously on every render before any effect runs.
  const questionScoresRef = React.useRef(questionScores)
  questionScoresRef.current = questionScores
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
  // Rereads the answers from the server into the cache, which re-renders
  // questionScores when the system and data call are the loaded ones. Also
  // returns the fresh map, so a caller that must reason over the
  // authoritative data in the same tick (the Complete summary) does not have
  // to read a not-yet-rendered value. undefined on failure - callers fall
  // back to what they already had.
  const rereadQuestionScores = async (
    systemId: number | string | undefined
  ): Promise<QuestionScoreMap | undefined> => {
    try {
      const rows = await queryClient.fetchQuery({
        ...questionScoresQuery(datacallID, Number(systemId)),
        retry: false,
      })
      const hashTable = indexScoresByOption(rows)
      // Seed the "last saved" indicator from the freshest score row so the
      // header subtitle reads "last saved 2 min ago" on first paint instead
      // of waiting for a save in this session.
      const latest = latestEditedAt(rows)
      if (latest) setLastSavedAt(latest)
      return hashTable
    } catch (error) {
      if (isAuthHandled(error)) return undefined
      console.error('Error fetching question scores:', error)
      return undefined
    }
  }
  const handleChoiceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectQuestionOption(Number(event.target.value))
    draft.markEdited()
  }
  const renderRadioGroup = (options: QuestionChoice[]) => {
    // Native-radio group (see QuestionRadioGroup) rather than CMSDS ChoiceList:
    // it carries the same option insight badges plus the FIPS baseline treatment
    // (per-option warn styling, divider, above-baseline badge/notice) that a flat
    // ChoiceList can't express.
    //
    // The FIPS baseline (a federal-wide concept) comes from the system record via
    // fipsBaseline, so it renders for every OpDiv. showInsightBadges suppresses
    // only the Insights option chips for OpDivs without Insights.
    return (
      <QuestionRadioGroup
        options={options}
        name="radio-choices"
        selectedValue={selectQuestionOption}
        onChange={handleChoiceChange}
        disabled={isReadOnly}
        insight={currentInsight}
        baseline={fipsBaseline}
        showInsightBadges={showCmsInsights}
        viewedDatacall={datacall}
      />
    )
  }

  const navigate = useNavigate()
  const location = useLocation()
  // `function` is a reserved word, so the :function route param is aliased.
  const {
    fismasystemid: systemParam,
    fismaacronym: legacyAcronym,
    datacallid: datacallSlug,
    pillar: pillarSlug,
    function: functionSlug,
  } = useParams()

  // The route is keyed on fismasystemid (#732), the same key the System Detail
  // page uses, so a link always opens the system it was generated from: the
  // acronym is free text, not unique, changes on rename, and may contain a
  // slash. The id lives under a static `system` segment; the legacy acronym
  // route (Routes.QUESTIONNAIRE_LEGACY) renders this same page with
  // :fismaacronym set instead, and is handled by the redirect effect below
  // rather than resolved into a system here. The two shapes never overlap, so
  // an all-digit acronym cannot be mistaken for an id.
  const routeSystemId = parseSystemIdParam(systemParam)
  // Legacy acronym links: every active-list match. One match redirects to the
  // id form; the decommissioned list is only consulted when there is none.
  const legacyActiveMatches = React.useMemo(
    () => findSystemsByAcronym(fismaSystems, legacyAcronym),
    [fismaSystems, legacyAcronym]
  )
  const routeSystemActive =
    routeSystemId !== undefined &&
    fismaSystems.some((s) => s.fismasystemid === routeSystemId)
  // The context list holds active systems only, so a deep link to a
  // decommissioned system would read as "not found" and mislead (its real
  // state is "no questionnaire available"). When the id (or legacy acronym)
  // misses the active list, fetch the decommissioned list and retry against
  // it. Once loaded it stays: a disabled query still serves its cached rows.
  // null = not fetched; [] = fetched (empty or failed), so a failure lands on
  // the not-found warning rather than an indefinite spinner.
  const decommissionedLookup = useFismaSystems(true, {
    enabled:
      fismaSystemsLoaded &&
      (!!systemParam || !!legacyAcronym) &&
      !routeSystemActive &&
      legacyActiveMatches.length === 0,
  })
  const {
    fismaSystems: decommissionedRows,
    fismaSystemsFetchedDecommissioned: decommissionedFetched,
    fismaSystemsError: decommissionedFailed,
  } = decommissionedLookup
  const decommissionedSystems = React.useMemo<FismaSystemType[] | null>(
    () =>
      decommissionedFetched
        ? decommissionedRows
        : decommissionedFailed
          ? []
          : null,
    [decommissionedFetched, decommissionedRows, decommissionedFailed]
  )
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
  // The system is resolved by id from the lists the app loads (active, then
  // decommissioned), never from route state: the id in the URL is the whole
  // address, so refresh, paste and open-in-new-tab all land on the same system.
  const systemInfo = React.useMemo(
    () =>
      routeSystemId === undefined
        ? undefined
        : fismaSystems.find((s) => s.fismasystemid === routeSystemId) ??
          decommissionedSystems?.find((s) => s.fismasystemid === routeSystemId),
    [fismaSystems, decommissionedSystems, routeSystemId]
  )
  const system = systemInfo?.fismasystemid
  // Redirect a pre-#732 acronym bookmark to the id form once the systems list
  // can answer. Exactly one match (active, else decommissioned) rewrites the
  // first segment in place and keeps the datacall / pillar / function tail, so
  // a rename can never break a bookmark again. Zero or several matches cannot
  // name a questionnaire, so the link lands on the dashboard with the
  // not-found warning instead of guessing (guessing is how answers were once
  // saved against another system that shared the acronym, misc#386).
  React.useEffect(() => {
    if (!legacyAcronym || !fismaSystemsLoaded) return
    const matches =
      legacyActiveMatches.length > 0
        ? legacyActiveMatches
        : decommissionedSystems === null
          ? null
          : findSystemsByAcronym(decommissionedSystems, legacyAcronym)
    if (matches === null) return
    if (matches.length === 1) {
      navigate(
        questionnairePath(
          matches[0].fismasystemid,
          datacallSlug,
          pillarSlug,
          functionSlug
        ),
        { state: location.state, replace: true }
      )
      return
    }
    notify(
      `Could not find a system matching “${legacyAcronym}”. It may not exist, or you may not have access to it.`,
      'warning'
    )
    navigate('/', { replace: true })
  }, [
    legacyAcronym,
    legacyActiveMatches,
    fismaSystemsLoaded,
    decommissionedSystems,
    navigate,
    datacallSlug,
    pillarSlug,
    functionSlug,
    location.state,
  ])
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
  // the whole fetch - every cold deep-link used to hit /questions and /scores
  // twice (#524 review).
  const datacallStateRef = React.useRef<{
    datacallid?: number
    datacall?: string
    deadline?: string
  }>({})
  const systemName = systemInfo?.fismaname ?? ''

  // ZTMF Insights keyed by DB questionid, one read per system (one call
  // returns every question's row). Empty for every "off" case and on failure,
  // so the panel never renders and the page is unchanged. Until the system's
  // lookup settles, submission is held so a carried-forward response cannot be
  // submitted before its required review UI is known.
  const { insightsByQuestion, settled: insightsSettled } =
    useSystemInsights(system)
  const [selectedIndex, setSelectedIndex] = React.useState(1)
  const handleConfirmReturn = (confirm: boolean) => {
    if (confirm) {
      // User explicitly chose to abandon unsaved edits - clear the draft so it
      // doesn't reappear if they navigate back to this question.
      clearCurrentDraft()
      setLoadingQuestion(true)
      setSelectedIndex(stepId)
      setQuestionId(stepId)
    }
  }
  const handleListItemClick = (index: number) => {
    draft.invalidatePending()
    setLoadingQuestion(true)
    setSelectedIndex(index)
    setQuestionId(index)
  }

  // The localStorage draft for the question on screen (autosave, restore,
  // unmount flush). clearCurrentDraft removes it once the answer is saved or
  // abandoned.
  const draft = useQuestionDraft({
    userid: userInfo.userid,
    system,
    questionId,
    datacallID,
    isReadOnly,
    loadingQuestion,
    selectQuestionOption,
    notes,
    initQuestionChoice,
    initNotes,
  })
  const draftStatus = draft.status
  const {
    restore: restoreDraft,
    resetStatus: resetDraftStatus,
    isRestored: isDraftRestored,
  } = draft
  const clearCurrentDraft = draft.clear

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
  const insightsPending = !!system && (!insightsSettled || !opdivsLoaded)
  const currentInsight =
    currentDatabaseQuestionId != null
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
  // Held while insights load so the strip and the per-option markers appear
  // together; the payload fallback follows the same per-OpDiv gate as the rest
  // of the Insights layer.
  const fipsBaseline = insightsPending
    ? null
    : resolveFipsBaseline(
        systemInfo,
        showCmsInsights ? currentInsight : undefined
      )
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
    // The review gate reads scores.status (see untouchedThisCycle below), so a
    // status change is a context change. Without this the initializer
    // short-circuits on an unchanged contextId and cannot re-arm: undo returns
    // a row to not_started, but the blank-box + "Insert into response"
    // presentation every other unconfirmed carried-forward answer gets would
    // only reappear after navigating away and back (ztmf-misc#392). The saved
    // row, not the selected radio, or every radio click would reset the review.
    questionScores[initQuestionChoice]?.status ?? null,
    // Moves when the re-seed lands, so an undo that restores only the notes
    // re-runs the initializer against them rather than the edited text.
    initNotes,
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

  // Carried-forward confirmation state, read from scores.status - the same
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
  // Any deviation from the seeded answer/notes: the edit is the explicit act,
  // and Next saves it (flipping status server-side), so both the Confirm and
  // Undo buttons yield to avoid two visible paths to the same write. Hoisted
  // so they cannot drift; deliberately NOT the variants elsewhere in this file
  // that also fold in priorReviewNeedsSave.
  const answerDirty =
    selectQuestionOption !== initQuestionChoice || notes !== initNotes
  const priorReviewBlocked =
    priorReviewState === 'pending' || priorReviewState === 'initializing'
  const showConfirmButton = canConfirmCarryForward({
    state: currentCarryState,
    dirty: answerDirty,
    isReadOnly,
    priorReviewBlocked,
  })
  // Answer history and undo (ztmf-misc#392). The hook owns the drawer state
  // and both requests, so this page adds none of its own.
  const answerHistory = useAnswerHistory({
    scoreid,
    refetchScores: () => rereadQuestionScores(system),
    // Moves whenever this answer is written, which is what makes the Undo
    // button appear the instant a save lands instead of on the next
    // navigation. status is included because a confirm changes it.
    writeStamp: currentSavedScore
      ? `${currentSavedScore.last_edited_at ?? ''}|${currentSavedScore.status ?? ''}`
      : null,
  })
  // The head revision and the one below it: head.prev is what an undo restores,
  // and the earlier row's createdat is when that value was saved.
  const [undoTarget, undoPrior] = answerHistory.history.data?.revisions ?? []
  const showUndoButton = canUndoAnswer({
    headUndoable: answerHistory.head?.undoable ?? false,
    state: currentCarryState,
    dirty: answerDirty,
    isReadOnly,
    hasScore: scoreid !== 0,
    priorReviewBlocked,
    isOpenCall,
  })
  // Derived from the button so the sentence and the action it describes cannot
  // drift apart. !currentPriorResponse suppresses it on insights questions,
  // where the card owns the explanation - a resolved review unblocks the
  // button, so nothing else would.
  const showCarryForwardHelper = showConfirmButton && !currentPriorResponse
  const [confirming, setConfirming] = React.useState(false)
  // The Complete-time summary dialog. null = closed.
  const [confirmSummary, setConfirmSummary] =
    React.useState<ConfirmSummary | null>(null)

  // The explicit act behind "Confirm this answer is still accurate": flips
  // the row's status to done via the confirm endpoint - the ordinary PUT
  // cannot express agreement, its no-op guard (correctly) drops an unchanged
  // body (#412/#413). Shared with saveResponse's resolved-review path.
  const confirmScoreById = async (id: number): Promise<boolean> => {
    try {
      await axiosInstance.put(apiPaths.scores.confirm(id))
      void queryClient.invalidateQueries({ queryKey: queryKeys.scores.all })
      notify(STATUS_MESSAGES.saved, 'success', { autoHideDuration: 1500 })
      clearCurrentDraft()
      setPriorReview((current) =>
        current.contextId === priorReviewContextId
          ? { ...current, needsSave: false }
          : current
      )
      // Flip the badge immediately (role="status" announces the change);
      // the refetch then brings the authoritative row, audit fields included.
      if (system !== undefined) {
        queryClient.setQueryData(
          questionScoresQuery(datacallID, system).queryKey,
          (rows) =>
            rows?.map((row) =>
              row.scoreid === id ? { ...row, status: 'done' as const } : row
            )
        )
      }
      rereadQuestionScores(system)
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

  // The third sibling of saveResponse and confirmScoreById. Reverts to the
  // value the head revision replaced, sending that revision's id so the server
  // refuses rather than silently reverting a change this session never saw.
  const undoInFlight = React.useRef(false)
  // questionId, not scoreid: scoreid only moves once the next question loads.
  // The cycle is kept apart so a reload of its scores can tell whether it is
  // still the one on screen.
  const undoContextRef = React.useRef({ cycle: '', question: '' })
  React.useLayoutEffect(() => {
    undoContextRef.current = {
      cycle: `${system}:${datacallID}`,
      question: String(questionId),
    }
  }, [system, datacallID, questionId])
  const historyOpenRef = React.useRef(false)
  React.useLayoutEffect(() => {
    historyOpenRef.current = answerHistory.open
  }, [answerHistory.open])
  const handleUndoClick = async (revisionid: number) => {
    // isPending lags the click by a render; a double-click would otherwise
    // send the same token twice and report its own undo as a conflict.
    if (undoInFlight.current) return
    undoInFlight.current = true
    const { cycle, question } = undoContextRef.current
    const sameCycle = () => undoContextRef.current.cycle === cycle
    const movedOn = () =>
      !sameCycle() || undoContextRef.current.question !== question
    // The Undo button can unmount when history refetches; keep focus off
    // <body>. Skipped if the user has since moved to another question. The
    // drawer's state is read now, since it may have opened or closed since.
    const refocus = () => {
      if (movedOn()) return
      document
        .getElementById(
          historyOpenRef.current
            ? ANSWER_HISTORY_PANEL_ID
            : 'view-answer-history'
        )
        ?.focus()
    }
    try {
      await answerHistory.undo.mutateAsync({ scoreid, revisionid })
      notify(STATUS_MESSAGES.saved, 'success', { autoHideDuration: 1500 })
      // The draft state now belongs to whichever question is on screen.
      if (movedOn()) return
      clearCurrentDraft()
      refocus()
    } catch (error) {
      const outcome = classifyUndoError(error)
      // The hook has already refetched the undone row's history, which drops
      // a stale button. A warning about it is skipped once the user has moved
      // on, since it would read as being about the question on screen.
      if (outcome.kind === 'handled') {
        // A past-deadline 403 lands here.
        refocus()
        return
      }
      if (outcome.kind === 'conflict' || outcome.kind === 'refused') {
        // Someone else wrote the answer, or it drifted, so the one on screen
        // may be stale too.
        if (sameCycle()) rereadQuestionScores(system)
        if (movedOn()) return
        if (outcome.kind === 'conflict') {
          notify(UNDO_CONFLICT_MESSAGE, 'warning', { autoHideDuration: 4000 })
        } else {
          notify(outcome.message, 'warning', { autoHideDuration: 6000 })
        }
        refocus()
        return
      }
      notify(outcome.message, 'error', { autoHideDuration: 2500 })
      refocus()
    } finally {
      undoInFlight.current = false
    }
  }

  // Complete on the open call: save the current question as Next always has,
  // then show one end-of-questionnaire summary instead of silently looping
  // back to question 1. Built from a freshly-awaited scores fetch so the
  // just-saved answer counts; falls back to the on-screen map on failure.
  const handleCompleteClick = async () => {
    draft.invalidatePending()
    if (!isReadOnly) {
      await saveResponse()
    }
    const fresh = await rereadQuestionScores(system)
    if (fresh) {
      // Re-seed the current question's saved state from the fresh map. The
      // old Complete re-seeded implicitly by navigating to question 1; this
      // one stays put, and without a re-seed a just-POSTed answer would
      // still read as unsaved (scoreid 0) - a second Complete would POST a
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

  // Rewrite the URL's pillar/function segments for a question in place, with
  // the datacall context riding along (#501). Skipped for a functionid the
  // loaded questions do not have.
  const showQuestionInUrl = (functionid: number) => {
    const q = questions[functionid]
    if (!q || system === undefined) return
    navigate(
      questionnairePath(system, datacall, toSlug(q.pillar), toSlug(q.function)),
      { state: datacallStateRef.current, replace: true }
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
    showQuestionInUrl(entry.functionid)
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
      // still an affirmative act that must land - the ordinary PUT's no-op
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
        await axiosInstance.put(apiPaths.scores.detail(scoreid), {
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
        await axiosInstance.post(apiPaths.scores.root, {
          fismasystemid: system,
          notes: notes,
          functionoptionid: selectQuestionOption,
          datacallid: datacallID,
        })
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.scores.all })
      notify(STATUS_MESSAGES.saved, 'success', { autoHideDuration: 1500 })
      setLastSavedAt(new Date())
      clearCurrentDraft()
      setPriorReview((current) =>
        current.contextId === priorReviewContextId
          ? { ...current, needsSave: false }
          : current
      )
      rereadQuestionScores(system)
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
          // Dashboard route state, then the URL segment, then an explicit
          // pick, then the latest call. See resolveActiveDatacall (#500).
          // routeState is empty except on the dashboard path; see
          // datacallStateRef's declaration for why.
          const active = resolveActiveDatacall({
            route: {
              datacallid: routeDatacallId,
              datacall: routeDatacall,
              deadline: routeDeadline,
            },
            datacallSlug: datacallSlugRef.current,
            datacalls,
            selectedDatacall,
            latest: {
              datacallid: latestDataCallId,
              datacall: latestDatacall,
              deadline: latestDeadline,
            },
            now: new Date(),
          })
          const datacall = active.slug
          const activeDataCallId = active.datacallid
          setDatacall(datacall)
          setIsPastDeadline(active.isPastDeadline)
          datacallStateRef.current = active.routeState
          // Hoisted so both the questions block and the final batch can access them.
          const questionsKey = {
            systemId: system,
            datacallId: activeDataCallId,
          }
          let sortedFuncId: number[] = []
          // The function to open. Defaults to the first; overridden below when the
          // URL's :pillar/:function names a valid function (deep link, #500).
          let targetFuncId: number | undefined
          try {
            const data = await queryClient.fetchQuery({
              ...systemQuestionsQuery(system, activeDataCallId),
              retry: false,
            })
            if (controller.signal.aborted) return
            // Decommissioned systems have no questions (the fetcher reads the
            // backend's null as []). Surface a friendly message instead of
            // crashing on categoriesData[0] below.
            if (data.length === 0) {
              questionsEmpty = true
              setNoQuestions(true)
              setLoadingQuestion(false)
            } else {
              // The reduced-pillar rule is applied by the API for the cycle
              // requested above (ztmf#545), so whatever comes back is already
              // the right set, in the right order (ztmf-misc#393).
              const nav = buildQuestionNav(data)
              const categoriesData = nav.categories
              sortedFuncId = nav.stepFunctionId
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
              // Point the sidebar at these questions now so the list renders
              // while scores are still loading. The questions map, datacallID
              // and questionId move in the batch below - after scores arrive -
              // so the questionId effect fires exactly once with the correct
              // scores already in the ref.
              setNavQuestionsKey(questionsKey)
              navigate(
                questionnairePath(
                  system,
                  datacall,
                  toSlug(targetPillarName),
                  toSlug(targetFunctionName)
                ),
                { state: datacallStateRef.current, replace: true }
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
          try {
            // Awaited here so the batch below commits questions + scores +
            // datacallID + questionId together: useQuestionScores serves this
            // cache entry on the render the key moves.
            const rows = await queryClient.fetchQuery({
              ...questionScoresQuery(activeDataCallId, system),
              retry: false,
            })
            if (controller.signal.aborted) return
            // Same seed as rereadQuestionScores so a freshly-loaded page
            // shows "last saved <time>" without needing a save first.
            const latest = latestEditedAt(rows)
            if (latest) setLastSavedAt(latest)
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
            // The empty list goes into the cache: an observer moved onto a
            // key with no data would fetch it again at once. The next score
            // write invalidates it.
            queryClient.setQueryData(
              questionScoresQuery(activeDataCallId, system).queryKey,
              []
            )
          }
          // Batch questions + scores + datacallID + questionId so the questionId
          // effect fires exactly once with the correct scores already in
          // questionScoresRef. This prevents a second effect run (and its
          // accompanying draft-clearing race) that would occur if questionScores
          // arrived as a separate update after questionId was already set.
          setLoadedKey(questionsKey)
          setDatacallID(activeDataCallId)
          setQuestionId(targetFuncId ?? sortedFuncId[0])
          setLoadCount((n) => n + 1)
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
    routeDatacallId,
    routeDatacall,
    routeDeadline,
    selectedDatacall,
    latestDataCallId,
    latestDatacall,
    latestDeadline,
    datacalls,
    queryClient,
  ])
  React.useEffect(() => {
    if (questionId) {
      const activeQuestionId = questionId
      const controller = new AbortController()
      // Clear saved-state markers before async load so the last-edited
      // footer does not flash the previous question's editor during the
      // refetch window. Also resets draft indicators so stale status from
      // a previous question or datacall doesn't bleed into the next render.
      setInitQuestionChoice(-1)
      resetDraftStatus()
      let funcOptId: number = 0
      async function fetchOptions() {
        try {
          // Awaited so the seeding below runs against this question's options;
          // useFunctionOptions then serves the same entry once the id moves.
          const optionRows = await queryClient.fetchQuery({
            ...functionOptionsQuery(activeQuestionId),
            retry: false,
          })
          if (controller.signal.aborted) return
          const optionIds = optionRows.map((item) => item.functionoptionid)
          // The saved answer is whichever option has a score row.
          optionIds.forEach((id) => {
            if (id in questionScoresRef.current) funcOptId = id
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
          // server-side values set above. Read-only sessions evict it instead.
          const sys = systemRef.current
          if (controller.signal.aborted) return
          const stored = await restoreDraft(
            { system: sys, questionId, datacallID },
            optionIds,
            controller.signal
          )
          if (stored === undefined) return
          if (stored) {
            setNotes(stored.notes)
            // A notes-only draft (-1) restores the notes without pre-selecting
            // an answer.
            if (stored.selectQuestionOption !== -1) {
              setSelectQuestionOption(stored.selectQuestionOption)
            }
          }
          setOptionsFunctionId(activeQuestionId)
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
  }, [
    questionId,
    questions,
    loadCount,
    isReadOnly,
    datacallID,
    userInfo.userid,
    restoreDraft,
    resetDraftStatus,
    queryClient,
  ])

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
        await axiosInstance.post(apiPaths.events.view, {
          fismasystemid: system,
          datacallid: datacallID,
          questionid: viewedQuestionId,
        })
      } catch {
        // Analytics only - swallow errors (including auth-handled ones).
      }
    })()
  }, [system, datacallID, viewedQuestionId])

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
  // band - e.g. the user saves a question then navigates back before that save's
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
        draftRestored: isDraftRestored(),
      })
    ) {
      return
    }
    const sel = deriveScoreSelection(
      optionsRef.current.map((o) => Number(o.value)),
      questionScoresRef.current
    )
    // No change from the last-seeded state - nothing to correct.
    if (sel.choice === u.initQuestionChoice && sel.notes === u.initNotes) return
    setSelectQuestionOption(sel.choice)
    setInitQuestionChoice(sel.choice)
    setNotes(sel.notes)
    setInitNotes(sel.notes)
    setScoreId(sel.scoreid)
    setRadioKey((k) => k + 1)
  }, [questionScores, questionId, isDraftRestored])

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

  // The URL carries the id; the breadcrumb shows the acronym people know the
  // system by, once it has resolved.
  const breadcrumbSegmentLabels =
    systemParam && systemInfo
      ? { [systemParam]: systemInfo.fismaacronym }
      : undefined
  // The system crumb opens that system's detail page, not the bare
  // questionnaire URL its path segment belongs to.
  const breadcrumbSegmentLinks =
    systemParam && systemInfo
      ? { [systemParam]: `/systems/${systemInfo.fismasystemid}` }
      : undefined
  if (!system) {
    // Cold load (paste / refresh / bookmark): the systems list may still be in
    // flight, so the id can't be resolved yet - and if it missed the active
    // list, the decommissioned list is being checked before concluding
    // not-found. Show a spinner until both have answered; only then is the
    // link genuinely unresolvable. (#500 / #524 review) The gate is the loaded
    // flag, not an empty list: a user with no active systems still needs the
    // decommissioned lookup and the not-found state. A legacy acronym link
    // always spins here: the redirect effect moves it to the id form or the
    // dashboard.
    if (
      legacyAcronym ||
      !fismaSystemsLoaded ||
      decommissionedSystems === null
    ) {
      return (
        <>
          <BreadCrumbs
            segmentLabels={breadcrumbSegmentLabels}
            segmentLinks={breadcrumbSegmentLinks}
          />
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
        <BreadCrumbs
          segmentLabels={breadcrumbSegmentLabels}
          segmentLinks={breadcrumbSegmentLinks}
        />
        <Container maxWidth={false} disableGutters>
          <Alert severity="warning" sx={{ mt: 2 }}>
            Could not find a system matching “{systemParam}”. It may not exist,
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
      // Renders as a real <a>, so the CMS design system's global a:visited
      // rule would repaint the label purple after a click and break the button
      // look. Pin the link states to the button's own color.
      sx={{
        whiteSpace: 'nowrap',
        '&:link, &:visited': { color: 'primary.main' },
      }}
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
          <BreadCrumbs
            segmentLabels={breadcrumbSegmentLabels}
            segmentLinks={breadcrumbSegmentLinks}
          />
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
  // Derived values used in the render block. Plain const (not useMemo)
  // because they sit below the early returns above; useMemo here would
  // violate React's rules-of-hooks ordering. Cheap O(n) over the pillar
  // list, which has < 10 elements.
  const totalQuestions = categories.reduce((acc, p) => acc + p.steps.length, 0)
  // Completion requires more than an answer row on an open call: a
  // carried-forward `not_started` row stays incomplete until it is confirmed
  // or edited. Closed calls and pre-status responses preserve the legacy
  // row-presence behavior through isQuestionComplete.
  const answeredFunctionIds = new Set<number>()
  for (const id in questionScores) {
    const row = questionScores[Number(id)] as QuestionScores & {
      functionoption?: { functionid?: number }
    }
    const fid = row.functionoption?.functionid
    if (typeof fid === 'number' && isQuestionComplete(row, isOpenCall)) {
      answeredFunctionIds.add(fid)
    }
  }
  const answeredCountInCategory = (cat: Category): number =>
    cat.steps.reduce(
      (acc, s) =>
        answeredFunctionIds.has(s.function.functionid) ? acc + 1 : acc,
      0
    )
  // Score history can include functions that are no longer applicable after an
  // environment or scope change. Count only the same category steps used by
  // totalQuestions so the top progress numerator cannot exceed its denominator.
  const totalAnswered = categories.reduce(
    (acc, cat) => acc + answeredCountInCategory(cat),
    0
  )
  const currentCategory = categories.find((c) =>
    c.steps.some((s) => s.function.functionid === selectedIndex)
  )
  const currentCategoryName = currentCategory?.name ?? ''
  const currentFunctionIndex = currentCategory
    ? currentCategory.steps.findIndex(
        (s) => s.function.functionid === selectedIndex
      )
    : 0
  const currentFunctionName = currentCategory?.steps[currentFunctionIndex]
    ? addSpace(currentCategory.steps[currentFunctionIndex].function.function)
    : ''

  // Leaving the question would drop an edit: a changed answer or notes, or a
  // resolved prior-response review that still has to be saved. Moving away
  // asks first.
  const hasUnsavedEdits =
    !isReadOnly &&
    ((selectQuestionOption !== -1 &&
      initQuestionChoice !== selectQuestionOption) ||
      initNotes !== notes ||
      priorReviewNeedsSave)

  const handlePreviousClick = () => {
    const id = stepFunctionId[functionIdIdx[selectedIndex] - 1]
    if (hasUnsavedEdits) {
      setStepId(id)
      setOpenAlert(true)
      return
    }
    draft.invalidatePending()
    showQuestionInUrl(id)
    setLoadingQuestion(true)
    setQuestionId(id)
    setSelectedIndex(id)
  }

  // Next saves the current question on its own (#705). Complete on the open
  // call summarizes instead of silently wrapping to question 1; a closed call
  // keeps the wrap-around, harmless paging for a historical viewer.
  const handleNextClick = () => {
    if (isLastQuestion && isOpenCall) {
      void handleCompleteClick()
      return
    }
    draft.invalidatePending()
    const id = isLastQuestion
      ? stepFunctionId[0]
      : stepFunctionId[functionIdIdx[selectedIndex] + 1]
    showQuestionInUrl(id)
    if (id !== questionId) setLoadingQuestion(true)
    setQuestionId(id)
    setSelectedIndex(id)
    if (!isReadOnly) saveResponse()
  }

  const navigateToFunction = (pillarName: string, fn: FismaQuestion) => {
    if (selectedIndex === fn.function.functionid) return
    if (hasUnsavedEdits) {
      setStepId(fn.function.functionid)
      setOpenAlert(true)
      return
    }
    navigate(
      questionnairePath(
        system,
        datacall,
        toSlug(pillarName),
        toSlug(fn.function.function)
      ),
      { state: datacallStateRef.current, replace: true }
    )
    handleListItemClick(fn.function.functionid)
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
  // Hoisted so the button's label, its click handler, and the helper sentence
  // below cannot disagree about which question is last.
  const isLastQuestion =
    selectedIndex === stepFunctionId[stepFunctionId.length - 1]
  // The forward button's hint, empty wherever it would misstate the behavior.
  // A read-only session never saves, so neither variant applies. Complete's
  // wording holds only on an open call - a closed call keeps the old wrap-around
  // to question 1 instead of saving and summarizing. Next is unconditional
  // because it behaves the same on open and closed calls.
  const navHintMsg = isReadOnly
    ? ''
    : !isLastQuestion
      ? NEXT_HINT_MSG
      : isOpenCall
        ? COMPLETE_HINT_MSG
        : ''
  // The data call both header modals present as "current". Prefer the call this
  // questionnaire actually resolved (datacallID covers every entry path,
  // including URL deep links where no route state exists); fall back to the
  // route/selected/latest chain during the pre-fetch window.

  // The questionnaire resolves its own call from route state / the URL, which
  // can differ from the global dashboard selection (e.g. opened on a system's
  // historical call while the dashboard aggregates the current year). The
  // context card must describe THIS page's call, or its Active chip and dates
  // contradict the closed-call banner below it.
  const viewedDatacall =
    datacalls.find((dc) => dc.datacallid === datacallID) ?? null

  // The data call the Compare-datacalls modal presents as "current". Prefer
  // the call this questionnaire actually resolved (datacallID covers every
  // entry path, including URL deep links where no route state exists); fall
  // back to the route/selected/latest chain during the pre-fetch window.
  const viewedDataCallId =
    datacallID > 0
      ? datacallID
      : routeDatacallId ?? selectedDatacall?.datacallid ?? latestDataCallId

  // Picking a call in the card re-opens the questionnaire on it: same system,
  // same pillar/function, new datacall segment + route state (the resolution
  // effect keys on the route state and re-runs).
  const handleDatacallPick = (dc: Datacall) => {
    if (dc.datacallid === datacallID) return
    const dirty =
      !isReadOnly &&
      ((selectQuestionOption !== -1 &&
        initQuestionChoice !== selectQuestionOption) ||
        initNotes !== notes ||
        priorReviewNeedsSave)
    if (dirty) {
      notify(
        'Save or discard your changes before switching data calls.',
        'warning',
        { autoHideDuration: 3000 }
      )
      return
    }
    const q = questions[selectedIndex]
    navigate(
      questionnairePath(
        system,
        encodeDatacallSlug(dc.datacall),
        q && toSlug(q.pillar),
        q && toSlug(q.function)
      ),
      {
        state: {
          datacallid: dc.datacallid,
          datacall: dc.datacall,
          deadline: dc.deadline,
        },
        replace: true,
      }
    )
  }
  return (
    <Box sx={{ py: 4 }}>
      <PageHeader
        breadcrumbs={
          <BreadCrumbs
            segmentLabels={breadcrumbSegmentLabels}
            segmentLinks={breadcrumbSegmentLinks}
          />
        }
        title={
          <Box
            component="span"
            sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 1 }}
          >
            <Box component="span" sx={{ color: colors.ink }}>
              {systemName}
            </Box>
            <Box
              component="span"
              sx={{ color: colors.neutral500, fontWeight: 600 }}
            >
              · Questionnaire
            </Box>
          </Box>
        }
        actions={
          <>
            {/* Cross-navigation back to the system detail page (ui#610);
                systemInfoLink is a real router link so open-in-new-tab and
                copy-link work. */}
            {systemInfoLink}
            <Button
              variant="outlined"
              color="primary"
              // Same destination as the dashboard's Pillar Scores action
              // (a route in this app, not a modal) (ui#610).
              onClick={() => navigate(`/systems/${system}/pillar-scores`)}
            >
              Pillar scores
            </Button>
            <Button
              variant="outlined"
              color="primary"
              onClick={() => setDiffModalOpen(true)}
            >
              Compare datacalls
            </Button>
            {/* No submit affordance: each answer persists on its own when the
                user clicks Next or Complete (there is no submit endpoint), so
                a header "Submit" would only navigate away - which System Info
                already does. Leaving the questionnaire is that link or the
                breadcrumb, not a button dressed up as a submission. */}
          </>
        }
      />
      <QuestionnaireProgress answered={totalAnswered} total={totalQuestions} />
      <DatacallContextCard
        viewedDatacall={viewedDatacall}
        onPick={handleDatacallPick}
      />
      {isPastDeadline && <ClosedDatacallBanner readOnly={isReadOnly} />}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: '220px 1fr 260px',
          },
          gap: 1.75,
          alignItems: 'flex-start',
        }}
      >
        <PillarRail
          categories={categories}
          currentCategoryName={currentCategoryName}
          answeredCountInCategory={answeredCountInCategory}
          // Cross-pillar confirmation visibility: every pillar shows how many
          // carried-forward answers still need confirming, so the remaining
          // work is scannable without paging section by section. Same
          // classification the section rail's per-question markers use.
          toConfirmCountInCategory={(cat) =>
            cat.steps.reduce(
              (acc, s) =>
                carryForwardState(
                  scoreByFunction[s.function.functionid],
                  isOpenCall
                ) === 'unconfirmed'
                  ? acc + 1
                  : acc,
              0
            )
          }
          onPillarClick={(category) => {
            const first = category.steps[0]
            if (first) navigateToFunction(category.name, first)
          }}
        />
        <Card sx={{ p: 3 }}>
          <QuestionHeading
            pillar={currentCategoryName}
            functionName={currentFunctionName}
            current={currentFunctionIndex + 1}
            total={currentCategory?.steps.length ?? 0}
            question={question}
            description={description}
          />
          {insightsPending && (
            <Typography
              role="status"
              variant="caption"
              sx={{ color: 'text.secondary' }}
            >
              Checking for prior responses...
            </Typography>
          )}
          {fipsBaseline && <FipsBaselineStrip {...fipsBaseline} />}
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
                py: 4,
              }}
            >
              <Spinner size="big" />
            </Box>
          ) : (
            <>
              {/* QuestionRadioGroup (not OptionCardList) so each option keeps
                  its insight badges and the FIPS baseline treatment; the box
                  key remounts the subtree on an out-of-band re-seed. */}
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
                    draft.markEdited()
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
                <EvidenceNotesField
                  value={notes}
                  onChange={(value) => {
                    setNotes(value)
                    draft.markEdited()
                  }}
                  notePrompt={notePrompt}
                  disabled={isReadOnly}
                  errorText={
                    needsNotesUpdate ? NOTES_UPDATE_REQUIRED_MSG : undefined
                  }
                />
              )}
              {/* JustificationField renders its own prompt and counter. */}
              <NotesFooter
                showAiBadge={
                  selectQuestionOption >= 0 &&
                  questionScores[selectQuestionOption]?.notes_is_ai_summary ===
                    true
                }
                prompt={
                  hasJustificationContext
                    ? undefined
                    : notePrompt || DEFAULT_NOTES_PROMPT
                }
                count={
                  hasJustificationContext || isReadOnly
                    ? undefined
                    : notes.length
                }
              />
              <CarryForwardStrip
                state={currentCarryState}
                showConfirm={showConfirmButton}
                confirming={confirming}
                onConfirm={handleConfirmClick}
                showHelper={showCarryForwardHelper}
                // Hidden while the form is dirty: undoing saved state under
                // unsaved edits would discard them silently.
                undo={
                  showUndoButton &&
                  answerHistory.head && (
                    <UndoAnswerButton
                      head={answerHistory.head}
                      disabled={answerHistory.undo.isPending}
                      onUndo={handleUndoClick}
                      preview={undoPreview({
                        restoresOptionName: undoTarget?.prev?.optionname,
                        restoresNotes: !!undoTarget?.prev?.notes,
                        savedAt: undoPrior?.createdat,
                      })}
                    />
                  )
                }
              />
              {!isReadOnly && <DraftStatusAlert status={draftStatus} />}
              <AnswerHistoryPanel
                open={answerHistory.open}
                onClose={answerHistory.closeHistory}
                revisions={answerHistory.history.data?.revisions ?? []}
                isPending={answerHistory.history.isPending}
                isError={answerHistory.history.isError}
                isUndoing={answerHistory.undo.isPending}
                onUndo={handleUndoClick}
                canUndo={showUndoButton}
              />
              <QuestionNavFooter
                previousDisabled={selectedIndex === stepFunctionId[0]}
                onPrevious={handlePreviousClick}
                saveIndicator={{
                  lastSavedAt,
                  lastEditedAt: currentSavedScore?.last_edited_at ?? null,
                  lastEditedBy: currentSavedScore?.last_edited_by ?? null,
                  isReadOnly,
                }}
                onViewHistory={
                  answerHistory.head ? answerHistory.openHistory : undefined
                }
                nextDisabled={
                  needsNotesUpdate ||
                  insightsPending ||
                  priorReviewState === 'pending' ||
                  priorReviewState === 'initializing'
                }
                onNext={handleNextClick}
                nextLabel={isLastQuestion ? 'Complete' : 'Next question >'}
                navHint={navHintMsg}
              />
            </>
          )}
        </Card>
        <SectionRail
          category={currentCategory}
          selectedIndex={selectedIndex}
          answeredFunctionIds={answeredFunctionIds}
          // Sidebar confirmation marker: same classification the question
          // view's chip reads.
          carryStateFor={(functionid) =>
            carryForwardState(scoreByFunction[functionid], isOpenCall)
          }
          onFunctionClick={(fn) => {
            if (currentCategory) navigateToFunction(currentCategory.name, fn)
          }}
        />
      </Box>
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
      {/* Seeds the "To" picker default in ScoreDiffModal. Prefer the call this
          questionnaire actually resolved (datacallID covers every entry path,
          including URL deep links where no route state exists); fall back to
          the route/selected/latest chain during the pre-fetch window. */}
      <ScoreDiffModal
        open={diffModalOpen}
        onClose={() => setDiffModalOpen(false)}
        fismasystemid={system ?? 0}
        systemName={systemName}
        systemAcronym={systemInfo?.fismaacronym ?? ''}
        selectedDataCallId={viewedDataCallId}
      />
    </Box>
  )
}
