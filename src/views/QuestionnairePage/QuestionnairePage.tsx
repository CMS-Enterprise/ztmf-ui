import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useParams } from 'react-router-dom'
import { Spinner } from '@cmsgov/design-system'
import { colors, fonts, radius } from '@/theme/tokens'
import Alert from '@mui/material/Alert'
import BreadCrumbs from '@/components/BreadCrumbs/BreadCrumbs'
import PageHeader from '@/components/ds/PageHeader'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked'
import {
  FismaQuestion,
  QuestionOption,
  Question,
  QuestionChoice,
  QuestionScores,
} from '@/types'
import { Container } from '@mui/system'
import { styled } from '@mui/material/styles'
import axiosInstance from '@/axiosConfig'
import { useNavigate, useLocation } from 'react-router-dom'
import { RouteNames } from '@/router/constants'
import {
  ERROR_MESSAGES,
  STATUS_MESSAGES,
  MAX_QUESTIONNAIRE_NOTES_LENGTH,
  CONFIRMATION_MESSAGE_QUESTION,
} from '@/constants'
import { isAuthHandled, notify } from '@/utils/notify'
import { sortPillars } from '@/utils/sortPillars'
import { filterPillarsForSystem } from '@/utils/filterPillarsForSystem'
import { sortFunctions } from '@/utils/sortFunctions'
import Button from '@mui/material/Button'
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog'
import ScoreDiffModal from '@/components/ScoreDiffModal/ScoreDiffModal'
import { useContextProp } from '../Title/Context'
import { isAdmin, isReadOnlyAdmin } from '@/utils/userRoles'
import LastEditedFooter from './LastEditedFooter'
import { shouldPersistResponse } from './saveGuard'
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
  // Local "last saved" timestamp used by the save indicator under the
  // question card. Updated on every successful saveResponse() so the
  // indicator reads "Saved just now / 2 min ago" without depending on the
  // questionScores re-fetch round trip.
  const [lastSavedAt, setLastSavedAt] = React.useState<Date | null>(null)
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
  const navigate = useNavigate()
  const location = useLocation()
  const { fismaacronym } = useParams()

  // Direct/bookmarked navigation to /questionnaire/<acronym> has a null
  // location.state. Optional-chain instead of crashing on first render; the
  // missing-system path is handled by an early render guard below.
  const system = location.state?.fismasystemid as number | undefined
  const systemInfo = fismaSystems.find((s) => s.fismasystemid === system)
  const systemName = systemInfo?.fismaname ?? fismaacronym ?? ''
  const [selectedIndex, setSelectedIndex] = React.useState(1)
  const handleConfirmReturn = (confirm: boolean) => {
    if (confirm) {
      setLoadingQuestion(true)
      setSelectedIndex(stepId)
      setQuestionId(stepId)
    }
  }
  const handleListItemClick = (index: number) => {
    setLoadingQuestion(true)
    setSelectedIndex(index)
    setQuestionId(index)
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
      return
    }
    try {
      if (scoreid) {
        await axiosInstance.put(`scores/${scoreid}`, {
          fismasystemid: system,
          notes: notes,
          functionoptionid: selectQuestionOption,
          datacallid: datacallID,
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
      setLastSavedAt(new Date())
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
        try {
          let questionsEmpty = false
          let datacall = ''
          const isHistorical =
            selectedDatacall !== null &&
            selectedDatacall.datacallid !== latestDataCallId
          let activeDataCallId: number
          if (isHistorical && selectedDatacall) {
            setDatacallID(selectedDatacall.datacallid)
            datacall = selectedDatacall.datacall.replaceAll(' ', '_')
            setDatacall(datacall)
            setIsPastDeadline(true)
            activeDataCallId = selectedDatacall.datacallid
          } else {
            setDatacallID(latestDataCallId)
            datacall = latestDatacall.replaceAll(' ', '_')
            setDatacall(datacall)
            setIsPastDeadline(
              latestDeadline ? new Date() > new Date(latestDeadline) : true
            )
            activeDataCallId = latestDataCallId
          }
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
              const questionData: Record<number, Question> = {}
              data.forEach((question: FismaQuestion) => {
                if (!organizedData[question.pillar.pillar]) {
                  organizedData[question.pillar.pillar] = []
                }
                questionData[question.function.functionid] = {
                  question: question.question,
                  notesprompt: question.notesprompt,
                  description: question.function.description,
                  pillar: question.pillar.pillar,
                  function: question.function.function,
                }
                organizedData[question.pillar.pillar].push(question)
              })
              setQuestions(questionData)
              const sortedPillars = filterPillarsForSystem(
                sortPillars(Object.keys(organizedData)),
                systemInfo?.datacenterenvironment
              )
              let sortedFuncId: number[] = []
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
              setFunctionIdIdx(funcIdToIdx) // set a map of functionid -> index in sortedFunctId
              setQuestionId(sortedFuncId[0]) // sets the questionid(functionid) to the first value in the array
              setStepFunctionId(sortedFuncId) // contains an array of all functionid in order of render
              setCategories(categoriesData)
              navigate(
                `/${RouteNames.QUESTIONNAIRE}/${fismaacronym?.toLowerCase()}/${datacall}/${toSlug(categoriesData[0].name)}/${toSlug(categoriesData[0].steps[0].function.function)}`,
                {
                  state: { fismasystemid: system },
                  replace: true,
                }
              )
              setSelectedIndex(sortedFuncId[0]) // set the first selected item in the list (rendered) to be selected(highlighted)
              setQuestion(questionData[sortedFuncId[0]].question) // set the first question value to the page
              setDescription(questionData[sortedFuncId[0]].description)
              setNotePrompt(questionData[sortedFuncId[0]].notesprompt) // set the first note prompt to the page
            }
          } catch (error) {
            if (controller.signal.aborted) return
            if (isAuthHandled(error)) return
            notify(ERROR_MESSAGES.tryAgain, 'error')
            return
          }
          if (questionsEmpty) {
            return
          }
          try {
            const res = await axiosInstance.get(
              `scores?datacallid=${activeDataCallId}&fismasystemid=${system}&include=functionoption`,
              { signal: controller.signal }
            )
            const hashTable: questionScoreMap = Object.assign(
              {},
              ...res.data.data.map((item: QuestionScores) => ({
                [item.functionoptionid]: item,
              }))
            )
            setQuestionScores(hashTable)
          } catch (error) {
            if (controller.signal.aborted) return
            if (isAuthHandled(error)) return
            console.error('Error fetching question scores:', error)
            notify(ERROR_MESSAGES.tryAgain, 'error')
          }
        } catch (error) {
          if (controller.signal.aborted) return
          if (isAuthHandled(error)) return
          console.error('Error fetching data:', error)
        }
      }
      fetchData()
      return () => controller.abort()
    }
  }, [
    system,
    navigate,
    fismaacronym,
    selectedDatacall,
    latestDataCallId,
    latestDatacall,
    latestDeadline,
    systemInfo?.datacenterenvironment,
  ])
  React.useEffect(() => {
    if (questionId) {
      const controller = new AbortController()
      // Clear saved-state markers before async load so the last-edited
      // footer does not flash the previous question's editor during the
      // refetch window.
      setInitQuestionChoice(-1)
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
            }
            if (item.functionoptionid in questionScores) {
              funcOptId = item.functionoptionid
              choiceOpt.defaultChecked = true
            }
            choices.push(choiceOpt)
          })
          // Foundation of question
          setDescription(questionId ? questions[questionId].description : '')
          setQuestion(questionId ? questions[questionId].question : '')
          setNotePrompt(questionId ? questions[questionId].notesprompt : '')

          // Notes
          setNotes(funcOptId ? questionScores[funcOptId].notes : '')
          setInitNotes(funcOptId ? questionScores[funcOptId].notes : '')

          // Question options
          setSelectQuestionOption(funcOptId ? funcOptId : -1)
          setInitQuestionChoice(funcOptId ? funcOptId : -1)
          setScoreId(funcOptId ? questionScores[funcOptId].scoreid : 0)
          setOptions(choices ? choices : [])
        } catch (error) {
          if (controller.signal.aborted) return
          if (isAuthHandled(error)) return
          console.error('Error fetching data:', error)
        } finally {
          setLoadingQuestion(false)
        }
      }
      fetchOptions()
      return () => controller.abort()
    }
  }, [questionId, questionScores, questions])
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
  // Derived values used in the render block. Plain const (not useMemo)
  // because they sit below the early returns above; useMemo here would
  // violate React's rules-of-hooks ordering. Cheap O(n) over the pillar
  // list, which has < 10 elements.
  const totalQuestions = categories.reduce((acc, p) => acc + p.steps.length, 0)
  // Answered count = number of score rows for this (system, datacall). The
  // map is keyed by functionoptionid; each question has exactly one picked
  // option, so size === answered question count.
  const totalAnswered = Object.keys(questionScores).length
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

  const navigateToFunction = (pillarName: string, fn: FismaQuestion) => {
    if (selectedIndex === fn.function.functionid) return
    const dirty =
      !isReadOnly &&
      ((selectQuestionOption !== -1 &&
        initQuestionChoice !== selectQuestionOption) ||
        initNotes !== notes)
    if (dirty) {
      setStepId(fn.function.functionid)
      setOpenAlert(true)
      return
    }
    navigate(
      `/${RouteNames.QUESTIONNAIRE}/${fismaacronym?.toLowerCase()}/${datacall}/${toSlug(pillarName)}/${toSlug(fn.function.function)}`,
      {
        state: { fismasystemid: system },
        replace: true,
      }
    )
    handleListItemClick(fn.function.functionid)
  }

  return (
    <Box sx={{ py: 4 }}>
      <PageHeader
        breadcrumbs={<BreadCrumbs segmentLabels={breadcrumbSegmentLabels} />}
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
        subtitle={
          <SubtitleLine
            totalAnswered={totalAnswered}
            totalQuestions={totalQuestions}
            lastSavedAt={lastSavedAt}
          />
        }
        actions={
          <Button
            variant="outlined"
            color="primary"
            onClick={() => setDiffModalOpen(true)}
          >
            Compare datacalls
          </Button>
        }
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
          onPillarClick={(category) => {
            const first = category.steps[0]
            if (first) navigateToFunction(category.name, first)
          }}
        />
        <Card sx={{ p: 3 }}>
          <EyebrowLine
            pillar={currentCategoryName}
            functionName={currentFunctionName}
            current={currentFunctionIndex + 1}
            total={currentCategory?.steps.length ?? 0}
          />
          <Typography
            sx={{
              fontSize: 18,
              fontWeight: 700,
              color: colors.ink,
              mt: 0.75,
              mb: 0.5,
              lineHeight: 1.35,
            }}
          >
            {question || ' '}
          </Typography>
          {description && (
            <Typography
              sx={{
                fontSize: 13,
                color: colors.neutral500,
                mb: 2,
              }}
            >
              {description}
            </Typography>
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
              <OptionCardList
                options={options}
                selectedValue={selectQuestionOption}
                onChange={(v) => setSelectQuestionOption(v)}
                disabled={isReadOnly}
              />
              <Typography
                sx={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: colors.ink,
                  mt: 3,
                  mb: 0.5,
                }}
              >
                Supporting evidence{' '}
                <Box
                  component="span"
                  sx={{
                    color: colors.neutral500,
                    fontWeight: 500,
                  }}
                >
                  - optional
                </Box>
              </Typography>
              <CssTextField
                multiline
                rows={4}
                fullWidth
                value={notes}
                disabled={isReadOnly}
                placeholder={
                  notePrompt ||
                  'Link policies or screenshots in your evidence repo.'
                }
                inputProps={{ maxLength: MAX_QUESTIONNAIRE_NOTES_LENGTH }}
                onChange={(e) => setNotes(e.target.value)}
              />
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mt: 0.5,
                }}
              >
                <Typography sx={{ fontSize: 12, color: colors.neutral500 }}>
                  {notePrompt
                    ? notePrompt
                    : 'Link policies or screenshots in your evidence repo.'}
                </Typography>
                {!isReadOnly && (
                  <Typography
                    sx={{
                      fontSize: 12,
                      color:
                        notes.length >= MAX_QUESTIONNAIRE_NOTES_LENGTH
                          ? colors.danger
                          : notes.length >= MAX_QUESTIONNAIRE_NOTES_LENGTH * 0.9
                            ? '#A34200'
                            : colors.neutral500,
                    }}
                  >
                    {notes.length} / {MAX_QUESTIONNAIRE_NOTES_LENGTH}
                  </Typography>
                )}
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mt: 3,
                  pt: 2,
                  borderTop: `1px solid ${colors.neutral200}`,
                }}
              >
                <Button
                  variant="text"
                  color="primary"
                  disabled={selectedIndex === stepFunctionId[0]}
                  onClick={() => {
                    const id = stepFunctionId[functionIdIdx[selectedIndex] - 1]
                    if (
                      !isReadOnly &&
                      ((selectQuestionOption !== -1 &&
                        initQuestionChoice !== selectQuestionOption) ||
                        initNotes !== notes)
                    ) {
                      setStepId(id)
                      setOpenAlert(true)
                      return
                    }
                    if (questions[id]) {
                      const q = questions[id]
                      navigate(
                        `/${RouteNames.QUESTIONNAIRE}/${fismaacronym?.toLowerCase()}/${datacall}/${toSlug(q.pillar)}/${toSlug(q.function)}`,
                        {
                          state: { fismasystemid: system },
                          replace: true,
                        }
                      )
                    }
                    setLoadingQuestion(true)
                    setQuestionId(id)
                    setSelectedIndex(id)
                  }}
                  sx={{ fontSize: 13, fontWeight: 600 }}
                >
                  {'< Previous'}
                </Button>
                <SaveIndicator
                  lastSavedAt={lastSavedAt}
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
                  isReadOnly={isReadOnly}
                />
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => {
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
                          state: { fismasystemid: system },
                          replace: true,
                        }
                      )
                    }
                    setLoadingQuestion(true)
                    setQuestionId(id)
                    setSelectedIndex(id)
                    if (!isReadOnly) saveResponse()
                    setLoadingQuestion(false)
                  }}
                  sx={{ fontSize: 13 }}
                >
                  {selectedIndex === stepFunctionId[stepFunctionId.length - 1]
                    ? 'Complete'
                    : 'Next question >'}
                </Button>
              </Box>
            </>
          )}
        </Card>
        <SectionRail
          category={currentCategory}
          selectedIndex={selectedIndex}
          totalAnswered={totalAnswered}
          totalQuestions={totalQuestions}
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
      <ScoreDiffModal
        open={diffModalOpen}
        onClose={() => setDiffModalOpen(false)}
        fismasystemid={system ?? 0}
        systemName={systemName}
        systemAcronym={fismaacronym ?? ''}
        selectedDataCallId={selectedDatacall?.datacallid}
      />
    </Box>
  )
}

/* ------------------------------------------------------------------ */
/* Presentational sub-components                                      */
/* ------------------------------------------------------------------ */

function Card({ children, sx }: { children: React.ReactNode; sx?: object }) {
  return (
    <Box
      sx={{
        backgroundColor: colors.white,
        border: `1px solid ${colors.neutral200}`,
        borderRadius: `${radius.card}px`,
        p: 2.25,
        ...sx,
      }}
    >
      {children}
    </Box>
  )
}

function ClosedDatacallBanner({ readOnly }: { readOnly: boolean }) {
  const text = readOnly
    ? 'This datacall is closed. Responses are read-only. To edit, switch to an active datacall or contact your HHS admin.'
    : 'This datacall has closed. Changes will be recorded as post-deadline.'
  return (
    <Alert
      severity="warning"
      sx={{
        mb: 2,
        backgroundColor: '#FFF4E6',
        color: '#A34200',
        border: `1px solid #FBC97A`,
        borderRadius: `${radius.md}px`,
        '& .MuiAlert-icon': { color: '#A34200' },
      }}
    >
      {text}
    </Alert>
  )
}

function PillarRail({
  categories,
  currentCategoryName,
  onPillarClick,
}: {
  categories: Category[]
  currentCategoryName: string
  onPillarClick: (category: Category) => void
}) {
  // Cross-cutting pillars are kept in a separate group below the main pillar
  // list, matching the redesign mock's two-section layout.
  const main = categories.filter((c) => c.name !== 'CrossCutting')
  const cross = categories.filter((c) => c.name === 'CrossCutting')
  return (
    <Card sx={{ p: 1.5 }}>
      <PillarGroup
        eyebrow="Pillars"
        items={main}
        currentName={currentCategoryName}
        onClick={onPillarClick}
      />
      {cross.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <PillarGroup
            eyebrow="Cross-cutting"
            items={cross}
            currentName={currentCategoryName}
            onClick={onPillarClick}
          />
        </Box>
      )}
    </Card>
  )
}

function PillarGroup({
  eyebrow,
  items,
  currentName,
  onClick,
}: {
  eyebrow: string
  items: Category[]
  currentName: string
  onClick: (category: Category) => void
}) {
  return (
    <Box>
      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 600,
          color: colors.neutral500,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          px: 1,
          mb: 0.5,
        }}
      >
        {eyebrow}
      </Typography>
      <Box>
        {items.map((cat) => {
          const isCurrent = cat.name === currentName
          // Pillar progress is conservatively reported as "total" for now,
          // since the FE doesn't have a stable option->function mapping
          // without per-function fetches. We can compute the real "answered"
          // count once the QuestionnairePage state denormalizes that.
          const total = cat.steps.length
          return (
            <Box
              key={cat.name}
              role="button"
              tabIndex={0}
              onClick={() => onClick(cat)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onClick(cat)
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 1,
                py: 0.75,
                borderRadius: `${radius.sm}px`,
                cursor: 'pointer',
                backgroundColor: isCurrent ? colors.primary50 : 'transparent',
                color: isCurrent ? colors.ink900 : colors.ink,
                fontWeight: isCurrent ? 600 : 500,
                '&:hover': {
                  backgroundColor: isCurrent
                    ? colors.primary50
                    : colors.neutral50,
                },
              }}
            >
              <Typography sx={{ fontSize: 13, fontWeight: 'inherit' }}>
                {cat.name === 'CrossCutting' ? 'Cross-cutting' : cat.name}
              </Typography>
              <Typography
                sx={{
                  fontFamily: fonts.mono,
                  fontSize: 12,
                  color: colors.neutral500,
                }}
              >
                {total}
              </Typography>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

function EyebrowLine({
  pillar,
  functionName,
  current,
  total,
}: {
  pillar: string
  functionName: string
  current: number
  total: number
}) {
  return (
    <Box
      sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
    >
      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 700,
          color: colors.ink900,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {pillar === 'CrossCutting' ? 'Cross-cutting' : pillar}
      </Typography>
      {functionName && (
        <>
          <Typography
            component="span"
            sx={{ fontSize: 13, color: colors.neutral500 }}
          >
            {functionName}
          </Typography>
          {total > 0 && (
            <Typography
              component="span"
              sx={{ fontSize: 13, color: colors.neutral500 }}
            >
              · Q{current} of {total}
            </Typography>
          )}
        </>
      )}
    </Box>
  )
}

function OptionCardList({
  options,
  selectedValue,
  onChange,
  disabled,
}: {
  options: QuestionChoice[]
  selectedValue: number
  onChange: (value: number) => void
  disabled: boolean
}) {
  if (!options.length) return null
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {options.map((opt) => {
        const value = Number(opt.value)
        const selected = value === selectedValue
        return (
          <Box
            key={value}
            role="radio"
            aria-checked={selected}
            tabIndex={disabled ? -1 : 0}
            onClick={() => {
              if (!disabled) onChange(value)
            }}
            onKeyDown={(e) => {
              if (disabled) return
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onChange(value)
              }
            }}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.5,
              p: 1.5,
              borderRadius: `${radius.md}px`,
              border: `1px solid ${selected ? colors.primary : colors.neutral200}`,
              backgroundColor: selected ? colors.primary50 : colors.white,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.7 : 1,
              transition: 'border-color 0.15s, background-color 0.15s',
              '&:hover': {
                borderColor: disabled
                  ? colors.neutral200
                  : selected
                    ? colors.primary
                    : colors.border,
              },
            }}
          >
            {selected ? (
              <RadioButtonCheckedIcon
                sx={{ fontSize: 18, color: colors.primary, mt: 0.25 }}
              />
            ) : (
              <RadioButtonUncheckedIcon
                sx={{ fontSize: 18, color: colors.neutral400, mt: 0.25 }}
              />
            )}
            <Typography
              sx={{
                fontSize: 13,
                color: colors.ink,
                fontWeight: selected ? 600 : 500,
                lineHeight: 1.5,
              }}
            >
              {String(opt.label)}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}

function SectionRail({
  category,
  selectedIndex,
  totalAnswered,
  totalQuestions,
  onFunctionClick,
}: {
  category: Category | undefined
  selectedIndex: number
  totalAnswered: number
  totalQuestions: number
  onFunctionClick: (fn: FismaQuestion) => void
}) {
  if (!category) {
    return (
      <Card sx={{ p: 2 }}>
        <Typography sx={{ fontSize: 13, color: colors.neutral500 }}>
          Loading section...
        </Typography>
      </Card>
    )
  }
  const sectionTotal = category.steps.length
  // We can't accurately tell which functions in THIS section are answered
  // without the option->function map; show a global "total answered /
  // total questions" progress here so the rail is honest about scope.
  const fill = totalQuestions
    ? Math.min(1, totalAnswered / totalQuestions) * 100
    : 0
  return (
    <Card sx={{ p: 2 }}>
      <Typography
        sx={{ fontSize: 13, fontWeight: 700, color: colors.ink, mb: 0.25 }}
      >
        Section progress
      </Typography>
      <Typography sx={{ fontSize: 12, color: colors.neutral500, mb: 1 }}>
        {category.name === 'CrossCutting' ? 'Cross-cutting' : category.name}
      </Typography>
      <Typography
        sx={{
          fontFamily: fonts.mono,
          fontSize: 12,
          color: colors.neutral500,
          mb: 0.5,
        }}
      >
        {totalAnswered} of {totalQuestions} answered
      </Typography>
      <Box
        sx={{
          height: 5,
          borderRadius: `${radius.sm}px`,
          backgroundColor: colors.neutral200,
          overflow: 'hidden',
          mb: 2,
        }}
      >
        <Box
          sx={{
            width: `${fill}%`,
            height: '100%',
            backgroundColor: colors.primary,
          }}
        />
      </Box>
      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 600,
          color: colors.neutral500,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          mb: 0.75,
        }}
      >
        Questions in this section
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        {category.steps.map((fn, i) => {
          const isCurrent = fn.function.functionid === selectedIndex
          return (
            <Box
              key={fn.function.functionid}
              role="button"
              tabIndex={0}
              onClick={() => onFunctionClick(fn)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onFunctionClick(fn)
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 0.75,
                py: 0.5,
                borderRadius: `${radius.sm}px`,
                cursor: 'pointer',
                backgroundColor: isCurrent ? colors.primary50 : 'transparent',
                color: isCurrent ? colors.ink900 : colors.ink,
                '&:hover': {
                  backgroundColor: isCurrent
                    ? colors.primary50
                    : colors.neutral50,
                },
              }}
            >
              <Typography
                sx={{
                  fontFamily: fonts.mono,
                  fontSize: 11,
                  color: colors.neutral500,
                  minWidth: 24,
                }}
              >
                Q{i + 1}
              </Typography>
              <Typography
                sx={{
                  fontSize: 13,
                  fontWeight: isCurrent ? 600 : 500,
                  flex: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {addSpace(fn.function.function)}
              </Typography>
            </Box>
          )
        })}
      </Box>
      {sectionTotal === 0 && (
        <Typography sx={{ fontSize: 12, color: colors.neutral500, mt: 1 }}>
          No questions in this section.
        </Typography>
      )}
    </Card>
  )
}

function SubtitleLine({
  totalAnswered,
  totalQuestions,
  lastSavedAt,
}: {
  totalAnswered: number
  totalQuestions: number
  lastSavedAt: Date | null
}) {
  const parts: string[] = []
  if (totalQuestions > 0) {
    parts.push(`${totalAnswered} of ${totalQuestions} questions answered`)
  }
  if (lastSavedAt) {
    parts.push(`last saved ${relativeTimeFrom(lastSavedAt)}`)
  }
  if (parts.length === 0) return null
  return <span>{parts.join(' · ')}</span>
}

function SaveIndicator({
  lastSavedAt,
  lastEditedAt,
  lastEditedBy,
  isReadOnly,
}: {
  lastSavedAt: Date | null
  lastEditedAt?: string | null
  lastEditedBy?: {
    userid: string
    name: string
    email: string
    role?: string
  } | null
  isReadOnly: boolean
}) {
  if (isReadOnly) {
    return (
      <Typography sx={{ fontSize: 12, color: colors.neutral500 }}>
        Read-only
      </Typography>
    )
  }
  const text = lastSavedAt
    ? `Saved ${relativeTimeFrom(lastSavedAt)}`
    : 'Saved automatically'
  const tooltipBody =
    lastEditedBy && lastEditedAt ? (
      <LastEditedFooter
        lastEditedAt={lastEditedAt}
        lastEditedBy={lastEditedBy as unknown as never}
      />
    ) : null
  return (
    <Tooltip title={tooltipBody ?? ''}>
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
        <CheckCircleIcon sx={{ fontSize: 12, color: colors.up }} />
        <Typography sx={{ fontSize: 12, color: colors.neutral500 }}>
          {text}
        </Typography>
      </Box>
    </Tooltip>
  )
}

function relativeTimeFrom(d: Date): string {
  const seconds = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000))
  if (seconds < 30) return 'just now'
  if (seconds < 90) return '1 min ago'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
