import * as React from 'react'
import { Button as CmsButton } from '@cmsgov/design-system'
import {
  Alert,
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Typography,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
} from '@mui/material'
import { styled } from '@mui/material/styles'
import TextField from '@mui/material/TextField'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore'
import {
  FismaQuestion,
  QuestionOption,
  SystemDetailsModalProps,
  QuestionScores,
  LastEditedBy,
} from '@/types'
import LastEditedFooter from '../QuestionnairePage/LastEditedFooter'
import axiosInstance from '@/axiosConfig'
import CircularProgress from '@mui/material/CircularProgress'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import { MAX_QUESTIONNAIRE_NOTES_LENGTH, STATUS_MESSAGES } from '@/constants'
import { isAuthHandled, notify } from '@/utils/notify'
import { sortPillars } from '@/utils/sortPillars'
import { sortFunctions } from '@/utils/sortFunctions'
import { useContextProp } from '../Title/Context'
import { isAdmin, isReadOnlyAdmin } from '@/utils/userRoles'
const CssTextField = styled(TextField)({
  '& label.Mui-focused': {
    color: 'rgb(13, 36, 153)',
    marginTop: 0,
  },
  '& .MuiInputLabel-root': {
    marginTop: 0,
  },
  '& .MuiInput-underline:after': {
    borderBottomColor: '#B2BAC2',
  },
  '& .MuiOutlinedInput-root': {
    '& fieldset': {
      borderColor: '#E0E3E7',
      marginTop: 0,
    },
    '&:hover fieldset': {
      borderColor: '#B2BAC2',
    },
    '&.Mui-focused fieldset': {
      borderColor: 'rgb(13, 36, 153)',
    },
  },
})

type Category = {
  name: string
  steps: FismaQuestion[]
}
type questionScoreMap = {
  [key: number]: QuestionScores
}
export default function QuestionnareModal({
  open,
  onClose,
  system,
}: SystemDetailsModalProps) {
  const { userInfo } = useContextProp()
  const [isPastDeadline, setIsPastDeadline] = React.useState<boolean>(false)
  const isReadOnly =
    isReadOnlyAdmin(userInfo) || (isPastDeadline && !isAdmin(userInfo))
  const [activeCategoryIndex, setActiveCategoryIndex] =
    React.useState<number>(0)
  const [activeStepIndex, setActiveStepIndex] = React.useState<number>(0)
  const [questionId, setQuestionId] = React.useState<number | null>(null)
  const [categories, setCategories] = React.useState<Category[]>([])
  const [options, setOptions] = React.useState<QuestionOption[]>([])
  const [datacallID, setDatacallID] = React.useState<number>(0)
  const [loadingQuestion, setLoadingQuestion] = React.useState<boolean>(true)
  const [questionScores, setQuestionScores] = React.useState<questionScoreMap>(
    {}
  )
  const [scoreid, setScoreId] = React.useState<number>(0)
  const [notes, setNotes] = React.useState<string>('')
  const [selectQuestionOption, setSelectQuestionOption] =
    React.useState<number>(0)
  // Loaded-state snapshot for the dirty check on Next/Back. The product
  // rule is "save on real change, not on read-through" -- otherwise a
  // user walking past a question already answered by someone else gets
  // stamped as the new editor and overwrites the prior cycle's history.
  // The backend enforces the same rule as defense in depth, but the FE
  // check saves a wasted PUT roundtrip on every read-through navigation.
  const [loadedNotes, setLoadedNotes] = React.useState<string>('')
  const [loadedSelectQuestionOption, setLoadedSelectQuestionOption] =
    React.useState<number>(0)
  // Saved-state mirror for the last-edited footer. The page component
  // tracks an `initQuestionChoice` funcOptId and looks the score up live;
  // the modal does not, so we cache the two fields directly when the load
  // effect resolves. Updated alongside `scoreid` / `notes` to stay in
  // lockstep with the saved score.
  const [savedLastEditedAt, setSavedLastEditedAt] = React.useState<
    string | null
  >(null)
  const [savedLastEditedBy, setSavedLastEditedBy] =
    React.useState<LastEditedBy | null>(null)
  const activeCategory = categories[activeCategoryIndex]
  const activeStep = activeCategory?.steps[activeStepIndex]

  const fetchQuestionScores = async (
    systemId: number | string | undefined,
    setQuestionScores: (scores: questionScoreMap) => void
  ) => {
    try {
      const response = await axiosInstance.get(
        `scores?datacallid=${datacallID}&fismasystemid=${systemId}`
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
  const handleQuestionnareNext = () => {
    setLoadingQuestion(true)
    // Dirty check: skip the API call entirely when nothing changed. The
    // questionnaire intentionally shows last cycle's answer as a default
    // (rolled forward by copyPreviousScores), so clicking Next without
    // editing is a read-through, not an edit. PUTting on a read-through
    // would overwrite the prior cycle's editor in the audit trail with
    // whoever happens to be scrolling. The backend enforces the same
    // rule, but skipping here saves the wasted PUT roundtrip.
    const isReadThrough =
      !isReadOnly &&
      scoreid !== 0 &&
      selectQuestionOption === loadedSelectQuestionOption &&
      (notes ?? '') === (loadedNotes ?? '')
    if (!isReadOnly && !isReadThrough) {
      if (scoreid) {
        axiosInstance
          .put(`scores/${scoreid}`, {
            fismasystemid: system?.fismasystemid,
            notes: notes,
            functionoptionid: selectQuestionOption,
            datacallid: datacallID,
          })
          .then(() => {
            notify(STATUS_MESSAGES.saved, 'success')
            fetchQuestionScores(
              Number(system?.fismasystemid),
              setQuestionScores
            )
            setLoadingQuestion(false)
          })
          .catch((error) => {
            if (isAuthHandled(error)) return
            console.error('Error updating score:', error)
          })
      } else {
        axiosInstance
          .post(`scores`, {
            fismasystemid: system?.fismasystemid,
            notes: notes,
            functionoptionid: selectQuestionOption,
            datacallid: datacallID,
          })
          .then(() => {
            fetchQuestionScores(
              Number(system?.fismasystemid),
              setQuestionScores
            )
            setLoadingQuestion(false)
          })
          .catch((error) => {
            if (isAuthHandled(error)) return
            console.error('Error posting score:', error)
          })
      }
    }
    let nextCategoryIndex = activeCategoryIndex
    let nextStepIndex = activeStepIndex + 1

    if (nextStepIndex >= activeCategory.steps.length) {
      nextCategoryIndex += 1
      nextStepIndex = 0
    }

    if (nextCategoryIndex < categories.length) {
      const nextStep = categories[nextCategoryIndex].steps[nextStepIndex]
      setActiveCategoryIndex(nextCategoryIndex)
      setActiveStepIndex(nextStepIndex)
      handleStepClick(
        nextCategoryIndex,
        nextStepIndex,
        nextStep.function.functionid
      )
    }
  }

  const handleQuestionnareBack = () => {
    let prevCategoryIndex = activeCategoryIndex
    let prevStepIndex = activeStepIndex - 1
    if (prevStepIndex < 0) {
      prevCategoryIndex -= 1
      if (prevCategoryIndex >= 0) {
        prevStepIndex = categories[prevCategoryIndex].steps.length - 1
      }
    }

    if (prevCategoryIndex >= 0) {
      const prevStep = categories[prevCategoryIndex].steps[prevStepIndex]
      setActiveCategoryIndex(prevCategoryIndex)
      setActiveStepIndex(prevStepIndex)
      handleStepClick(
        prevCategoryIndex,
        prevStepIndex,
        prevStep.function.functionid
      )
    }
  }

  const handleStepClick = (
    categoryIndex: number,
    stepIndex: number,
    id: number | null
  ) => {
    setLoadingQuestion(true)
    setActiveCategoryIndex(categoryIndex)
    setActiveStepIndex(stepIndex)
    setQuestionId(id)
  }
  const handClose = () => {
    setQuestionId(null)
    setLoadingQuestion(true)
    setActiveCategoryIndex(0)
    setActiveStepIndex(0)
    setNotes('')
    setIsPastDeadline(false)
    onClose()
  }
  const handleQuestionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectQuestionOption(Number(event.target.value))
  }
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
  React.useEffect(() => {
    if (!open || !system) return
    const controller = new AbortController()
    const fetchData = async () => {
      try {
        const latestDataCallId = await axiosInstance
          .get(`/datacalls/latest`, { signal: controller.signal })
          .then((res) => {
            setDatacallID(res.data.data.datacallid)
            if (new Date() > new Date(res.data.data.deadline)) {
              setIsPastDeadline(true)
            }
            return res.data.data.datacallid
          })
          .catch((error) => {
            if (controller.signal.aborted) return
            if (isAuthHandled(error)) return
            console.error('Error fetching latest datacall:', error)
          })

        await axiosInstance
          .get(`/fismasystems/${system.fismasystemid}/questions`, {
            signal: controller.signal,
          })
          .then((response) => {
            const data = response.data.data
            const organizedData: Record<string, FismaQuestion[]> = {}
            data.forEach((question: FismaQuestion) => {
              if (!organizedData[question.pillar.pillar]) {
                organizedData[question.pillar.pillar] = []
              }
              organizedData[question.pillar.pillar].push(question)
            })
            const sortedPillars = sortPillars(Object.keys(organizedData))
            const categoriesData: Category[] = sortedPillars.map((pillar) => ({
              name: pillar,
              steps: sortFunctions(pillar, organizedData[pillar]),
            }))
            // const categoriesData: Category[] = sortedPillars.map(
            //   (pillar) => ({
            //     name: pillar,
            //     steps: organizedData[pillar],
            //   })
            // )
            // console.log(categoriesData)
            setCategories(categoriesData)
            if (data.length > 0) {
              // console.log(categoriesData)
              setQuestionId(categoriesData[0]['steps'][0].function.functionid)
            }
          })
          .catch((error) => {
            if (controller.signal.aborted) return
            if (isAuthHandled(error)) return
            console.error('Error fetching questions:', error)
          })
        await axiosInstance
          .get(
            `scores?datacallid=${latestDataCallId}&fismasystemid=${system.fismasystemid}`,
            { signal: controller.signal }
          )
          .then((res) => {
            const hashTable: questionScoreMap = Object.assign(
              {},
              ...res.data.data.map((item: QuestionScores) => ({
                [item.functionoptionid]: item,
              }))
            )
            setQuestionScores(hashTable)
          })
          .catch((error) => {
            if (controller.signal.aborted) return
            if (isAuthHandled(error)) return
            console.error('Error fetching question scores:', error)
          })
      } catch (error) {
        if (controller.signal.aborted) return
        if (isAuthHandled(error)) return
        console.error('Error fetching data:', error)
      }
    }
    fetchData()
    return () => {
      controller.abort()
    }
  }, [open, system])
  React.useEffect(() => {
    if (!questionId) return
    const controller = new AbortController()
    try {
      axiosInstance
        .get(`functions/${questionId}/options`, { signal: controller.signal })
        .then((res) => {
          setOptions(res.data.data)
          let isValidOption: boolean = false
          let funcOptId: number = 0
          res.data.data.forEach((item: QuestionOption) => {
            if (item.functionoptionid in questionScores) {
              isValidOption = true
              funcOptId = item.functionoptionid
            }
          })
          if (!isValidOption) {
            setSelectQuestionOption(0)
            setScoreId(0)
            setNotes('')
            setLoadedSelectQuestionOption(0)
            setLoadedNotes('')
            setSavedLastEditedAt(null)
            setSavedLastEditedBy(null)
          } else {
            const id = questionScores[funcOptId].scoreid
            const notes = questionScores[funcOptId].notes
            setSelectQuestionOption(funcOptId)
            setScoreId(id)
            setNotes(notes)
            // Snapshot the loaded answer so handleQuestionnareNext can
            // detect "no real change" and skip the PUT. Without this the
            // backend's no-op guard still preserves history, but we
            // would still pay a wasted roundtrip on every Next click.
            setLoadedSelectQuestionOption(funcOptId)
            setLoadedNotes(notes)
            setSavedLastEditedAt(
              questionScores[funcOptId].last_edited_at ?? null
            )
            setSavedLastEditedBy(
              questionScores[funcOptId].last_edited_by ?? null
            )
          }
          setLoadingQuestion(false)
        })
    } catch (error) {
      if (controller.signal.aborted) return
      if (isAuthHandled(error)) return
      console.error('Error fetching data:', error)
    }
    return () => {
      controller.abort()
    }
  }, [questionId, questionScores])
  const renderRadioGroup = (options: QuestionOption[]) => {
    return (
      <FormControl component="fieldset">
        <RadioGroup
          value={selectQuestionOption}
          onChange={handleQuestionChange}
        >
          {options.map((option) => (
            <FormControlLabel
              key={option.functionoptionid}
              value={option.functionoptionid}
              control={<Radio disabled={isReadOnly} />}
              label={option.description}
              sx={{
                m: '3px',
              }}
              checked={
                selectQuestionOption === option.functionoptionid ? true : false
              }
            />
          ))}
        </RadioGroup>
      </FormControl>
    )
  }
  return (
    <>
      <Dialog open={open} onClose={handClose} maxWidth="xl" fullWidth>
        <DialogTitle align="center">
          <div>
            <Typography variant="h3">{'Questionnaire'}</Typography>
          </div>
        </DialogTitle>
        <DialogContent>
          {isPastDeadline && !isReadOnly && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              This datacall has closed. Changes will be recorded as
              post-deadline.
            </Alert>
          )}
          <Box
            display="flex"
            flexDirection="row"
            sx={{ height: { md: '60vh', lg: '70vh' } }}
          >
            <Box
              display="flex"
              flexDirection="column"
              flex={0.3}
              overflow="auto"
              maxHeight="100%"
              sx={{ paddingRight: '40px' }}
            >
              {categories.map((category, categoryIndex) => (
                <Box key={category.name} sx={{ mb: 2, mt: 0 }}>
                  <Typography variant="h6" align="center">
                    {category.name === 'CrossCutting'
                      ? 'Cross Cutting'
                      : category.name}
                  </Typography>
                  <Box>
                    {category.steps.map((step, stepIndex) => {
                      const text = addSpace(step.function.function)
                      const fontSize = text.length > 33 ? '0.9rem' : '1rem'
                      return (
                        <Box
                          key={
                            step.pillar +
                            '_' +
                            step.questionid +
                            '_' +
                            step.function.functionid
                          }
                          bgcolor={
                            activeCategoryIndex === categoryIndex &&
                            activeStepIndex === stepIndex
                              ? 'rgb(13, 36, 153)'
                              : 'grey.300'
                          }
                          color={
                            activeCategoryIndex === categoryIndex &&
                            activeStepIndex === stepIndex
                              ? 'primary.contrastText'
                              : 'text.primary'
                          }
                          borderRadius="4px"
                          boxShadow={
                            activeCategoryIndex === categoryIndex &&
                            activeStepIndex === stepIndex
                              ? 2
                              : 1
                          }
                          sx={{
                            p: 1,
                            m: 1,
                            cursor: 'pointer',
                            width: '100%',
                            textAlign: 'center',
                            // whiteSpace: 'nowrap',
                            fontSize: fontSize,
                          }}
                          onClick={() => {
                            if (
                              activeCategoryIndex !== categoryIndex ||
                              activeStepIndex !== stepIndex
                            ) {
                              handleStepClick(
                                categoryIndex,
                                stepIndex,
                                step.function.functionid
                              )
                            }
                          }}
                        >
                          {text}
                          <Tooltip
                            title={step.function.description}
                            placement="top-start"
                          >
                            <IconButton size="small">
                              <InfoOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      )
                    })}
                  </Box>
                </Box>
              ))}
            </Box>
            <Box
              flex={0.7}
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                maxHeight: '100%',
                overflow: 'auto',
                backgroundColor: 'rgb(245,245,245)',
              }}
            >
              {loadingQuestion ? (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    maxHeight: '100%',
                  }}
                >
                  <CircularProgress size={80} />
                </Box>
              ) : (
                <Box sx={{ maxHeight: '100%', pl: 2, pr: 2 }}>
                  <Typography variant="h5">{activeStep?.question}</Typography>
                  <Box
                    display="flex"
                    flexDirection="column"
                    flex={0.3}
                    sx={{ paddingRight: '40px' }}
                  >
                    {renderRadioGroup(options)}
                  </Box>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {activeStep?.notesprompt || ''}
                  </Typography>
                  <CssTextField
                    multiline
                    label="Notes"
                    rows={4}
                    fullWidth
                    value={notes}
                    disabled={isReadOnly}
                    inputProps={{ maxLength: MAX_QUESTIONNAIRE_NOTES_LENGTH }}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  {!isReadOnly && (
                    <Typography
                      variant="caption"
                      sx={{
                        color:
                          notes.length >= MAX_QUESTIONNAIRE_NOTES_LENGTH
                            ? 'error.main'
                            : notes.length >=
                                MAX_QUESTIONNAIRE_NOTES_LENGTH * 0.9
                              ? 'warning.main'
                              : 'text.secondary',
                        display: 'block',
                        mt: 0.5,
                      }}
                    >
                      {notes.length}/{MAX_QUESTIONNAIRE_NOTES_LENGTH}
                    </Typography>
                  )}
                  <Box
                    position="relative"
                    display="flex"
                    width="100%"
                    justifyContent={'space-between'}
                  >
                    <CmsButton
                      onClick={handleQuestionnareBack}
                      color="primary"
                      disabled={
                        activeCategoryIndex === 0 && activeStepIndex === 0
                      }
                      style={{ marginBottom: '8px', marginTop: '8px' }}
                    >
                      <NavigateBeforeIcon sx={{ pt: '2px' }} />
                      Back
                    </CmsButton>
                    <CmsButton
                      onClick={handleQuestionnareNext}
                      disabled={
                        activeCategoryIndex === categories.length - 1 &&
                        activeStepIndex === activeCategory.steps.length - 1
                      }
                      style={{ marginBottom: '8px', marginTop: '8px' }}
                    >
                      Next
                      <NavigateNextIcon sx={{ pt: '2px' }} />
                    </CmsButton>
                  </Box>
                  <LastEditedFooter
                    lastEditedAt={savedLastEditedAt}
                    lastEditedBy={savedLastEditedBy}
                  />
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <CmsButton onClick={handClose} color="primary">
            Close
          </CmsButton>
        </DialogActions>
      </Dialog>
    </>
  )
}
