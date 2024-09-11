import * as React from 'react'
import { Button as CmsButton } from '@cmsgov/design-system'
import {
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
import { styled } from '@mui/system'
import TextField from '@mui/material/TextField'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore'
import {
  FismaQuestion,
  QuestionOption,
  SystemDetailsModalProps,
  QuestionScores,
} from '@/types'
import axiosInstance from '@/axiosConfig'
import CircularProgress from '@mui/material/CircularProgress'

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
  const [activeCategoryIndex, setActiveCategoryIndex] =
    React.useState<number>(0)
  const [activeStepIndex, setActiveStepIndex] = React.useState<number>(0)
  const [questionId, setQuestionId] = React.useState<number | null>(null)
  const [categories, setCategories] = React.useState<Category[]>([])
  const [options, setOptions] = React.useState<QuestionOption[]>([])
  const [loadingQuestion, setLoadingQuestion] = React.useState<boolean>(true)
  const [questionScores, setQuestionScores] = React.useState<questionScoreMap>(
    {}
  )
  const [scoreid, setScoreId] = React.useState<number>(0)
  const [notes, setNotes] = React.useState<string>('')
  const [selectQuestionOption, setSelectQuestionOption] =
    React.useState<number>(0)
  const activeCategory = categories[activeCategoryIndex]
  const activeStep = activeCategory?.steps[activeStepIndex]

  const fetchQuestionScores = async (
    systemId: number | string | undefined,
    setQuestionScores: (scores: questionScoreMap) => void
  ) => {
    try {
      const response = await axiosInstance.get(
        `scores?datacallid=2&fismasystemid=${systemId}`
      )
      const hashTable: questionScoreMap = Object.assign(
        {},
        ...response.data.data.map((item: QuestionScores) => ({
          [item.functionoptionid]: item,
        }))
      )
      setQuestionScores(hashTable)
    } catch (error) {
      console.error('Error fetching question scores:', error)
    }
  }

  const handleQuestionnareNext = () => {
    // TODO: datacallid is hardcoded to 2, need to make it dynamic
    setLoadingQuestion(true)
    if (scoreid) {
      axiosInstance
        .put(`scores/${scoreid}`, {
          fismasystemid: system?.fismasystemid,
          notes: notes,
          functionoptionid: selectQuestionOption,
          datacallid: 2,
        })
        .then((res) => {
          if (res.status != 200) {
            console.error('Error updating score')
          }
        })
        .catch((error) => {
          console.error('Error updating score:', error)
        })
        .finally(() => {
          fetchQuestionScores(Number(system?.fismasystemid), setQuestionScores)
          setLoadingQuestion(false)
        })
    } else {
      axiosInstance
        .post(`scores`, {
          fismasystemid: system?.fismasystemid,
          notes: notes,
          functionoptionid: selectQuestionOption,
          datacallid: 2,
        })
        .then(() => {
          console.log('Created score')
        })
        .catch((error) => {
          console.error('Error creating score:', error)
        })
        .finally(() => {
          fetchQuestionScores(Number(system?.fismasystemid), setQuestionScores)
          setLoadingQuestion(false)
        })
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
    onClose()
  }
  React.useEffect(() => {
    if (open && system) {
      axiosInstance
        .get(`/fismasystems/${system.fismasystemid}/questions`)
        .then((response) => {
          const data = response.data.data
          const organizedData: Record<string, FismaQuestion[]> = {}
          data.forEach((question: FismaQuestion) => {
            if (!organizedData[question.pillar]) {
              organizedData[question.pillar] = []
            }
            organizedData[question.pillar].push(question)
          })

          // Convert the organized data into categories format
          const categoriesData: Category[] = Object.keys(organizedData).map(
            (pillar) => ({
              name: pillar,
              steps: organizedData[pillar],
            })
          )

          setCategories(categoriesData)
          if (data.length > 0) {
            setQuestionId(categoriesData[0]['steps'][0].function.functionid)
          }
        })
        .catch((error) => {
          console.error('Error fetching data:', error)
        })
      axiosInstance
        .get(`scores?datacallid=2&fismasystemid=${system.fismasystemid}`)
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
          console.error('Error fetching question scores:', error)
        })
    }
  }, [open, system])
  const handleQuestionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectQuestionOption(Number(event.target.value))
  }
  React.useEffect(() => {
    if (questionId && questionScores) {
      try {
        axiosInstance.get(`functions/${questionId}/options`).then((res) => {
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
          } else {
            setSelectQuestionOption(funcOptId)
            setScoreId(questionScores[funcOptId].scoreid)
            setNotes(questionScores[funcOptId].notes)
          }
          setLoadingQuestion(false)
        })
      } catch (error) {
        console.error('Error fetching data:', error)
      }
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
              control={<Radio />}
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
      <Dialog open={open} onClose={handClose} maxWidth="lg" fullWidth>
        <DialogTitle align="center">
          <div>
            <Typography variant="h3">{'Questionnare'}</Typography>
          </div>
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="row" sx={{ height: '50vh' }}>
            <Box
              display="flex"
              flexDirection="column"
              flex={0.3}
              overflow="auto"
              maxHeight="100%"
              sx={{ paddingRight: '40px' }}
            >
              {categories.map((category, categoryIndex) => (
                <Box key={category.name} marginBottom="16px">
                  <Typography variant="h6" align="center">
                    {category.name}
                  </Typography>
                  <Box>
                    {category.steps.map((step, stepIndex) => (
                      <Box
                        key={
                          step.pillar +
                          '_' +
                          step.questionid +
                          '_' +
                          step.function.functionid
                        }
                        padding="8px"
                        margin="8px"
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
                        style={{
                          cursor: 'pointer',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          width: '20vw',
                          textAlign: 'left',
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
                        {step.question}
                      </Box>
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>
            {loadingQuestion ? (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100vh',
                  width: '100%',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                }}
              >
                <CircularProgress size={80} />
              </Box>
            ) : (
              <Box
                flex={0.7}
                padding="16px"
                marginLeft={'10px'}
                bgcolor="grey.100"
                borderRadius="8px"
                position="relative"
                overflow="auto"
              >
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
                  onChange={(e) => setNotes(e.target.value)}
                />
                <Box
                  position="relative"
                  // bottom="10px"
                  display="flex"
                  width="100%"
                  justifyContent={'space-between'}
                  sx={{ marginTop: 1 }}
                >
                  <CmsButton
                    onClick={handleQuestionnareBack}
                    color="primary"
                    disabled={
                      activeCategoryIndex === 0 && activeStepIndex === 0
                    }
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
                  >
                    Next
                    <NavigateNextIcon sx={{ pt: '2px' }} />
                  </CmsButton>
                </Box>
              </Box>
            )}
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
