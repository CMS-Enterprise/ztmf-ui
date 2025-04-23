import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import ListSubheader from '@mui/material/ListSubheader'
import { useParams } from 'react-router-dom'
import { Button as CmsButton, ChoiceList, Spinner } from '@cmsgov/design-system'
import Grid from '@mui/material/Unstable_Grid2/Grid2'
import BreadCrumbs from '@/components/BreadCrumbs/BreadCrumbs'
import TextField from '@mui/material/TextField'
import {
  FismaQuestion,
  QuestionOption,
  Question,
  QuestionChoice,
  QuestionScores,
  functionScores,
} from '@/types'
import { Container, styled } from '@mui/system'
import axiosInstance from '@/axiosConfig'
import { useSnackbar } from 'notistack'
import { useNavigate, useLocation } from 'react-router-dom'
import { Routes, RouteNames } from '@/router/constants'
import { ArrowIcon } from '@cmsgov/design-system'
import {
  ERROR_MESSAGES,
  PILLAR_FUNCTION_MAP,
  CONFIRMATION_MESSAGE_QUESTION,
} from '@/constants'
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog'
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
  const [questionScores, setQuestionScores] = React.useState<questionScoreMap>(
    {}
  )
  const [questionId, setQuestionId] = React.useState<number | null>(null)
  const [openAlert, setOpenAlert] = React.useState<boolean>(false)
  const [options, setOptions] = React.useState<QuestionChoice[]>([])
  const [questions, setQuestions] = React.useState<Record<number, Question>>([])
  const [functionScores, setFunctionScores] = React.useState<functionScores>({})
  const [question, setQuestion] = React.useState<string>('')
  const [datacallID, setDatacallID] = React.useState<number>(0)
  const [datacall, setDatacall] = React.useState<string>('')
  // const { latestDatacall, latestDatacallId } = useContextProp()
  const [loadingQuestion, setLoadingQuestion] = React.useState<boolean>(true)
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
      console.error('Error fetching question scores:', error)
      routeToSignIn()
    }
  }
  const handleChoiceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectQuestionOption(Number(event.target.value))
  }
  const renderRadioGroup = (options: QuestionChoice[]) => {
    return (
      <ChoiceList
        choices={options}
        name={'radio-choices'}
        type={'radio'}
        label={undefined}
        className="ds-u-margin-top--05"
        size="small"
        onChange={handleChoiceChange}
      />
    )
  }

  const routeToSignIn = () => {
    navigate(Routes.SIGNIN, {
      replace: true,
      state: {
        message: ERROR_MESSAGES.expired,
      },
    })
  }
  const { enqueueSnackbar } = useSnackbar()
  const navigate = useNavigate()
  const location = useLocation()
  const { fismaacronym } = useParams()

  const system = location.state.fismasystemid
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

  const saveResponse = () => {
    if (scoreid) {
      axiosInstance
        .put(`scores/${scoreid}`, {
          fismasystemid: system,
          notes: notes,
          functionoptionid: selectQuestionOption,
          datacallid: datacallID,
        })
        .then(() => {
          // checkValidResponse(res.status)
          enqueueSnackbar(`Saved`, {
            variant: 'success',
            anchorOrigin: {
              vertical: 'top',
              horizontal: 'left',
            },
            autoHideDuration: 1500,
          })
          fetchQuestionScores(system, setQuestionScores)
        })
        .catch((error) => {
          console.error('Error updating score:', error)
          if (error.status === 401) {
            routeToSignIn()
          }
          if (error.response.status === 403) {
            enqueueSnackbar(error.response.data.error, {
              variant: 'error',
              anchorOrigin: {
                vertical: 'top',
                horizontal: 'left',
              },
              autoHideDuration: 2500,
            })
          } else {
            enqueueSnackbar(ERROR_MESSAGES.tryAgain, {
              variant: 'error',
              anchorOrigin: {
                vertical: 'top',
                horizontal: 'left',
              },
              autoHideDuration: 2500,
            })
          }
        })
    } else {
      axiosInstance
        .post(`scores`, {
          fismasystemid: system,
          notes: notes,
          functionoptionid: selectQuestionOption,
          datacallid: datacallID,
        })
        .then(() => {
          enqueueSnackbar(`Saved`, {
            variant: 'success',
            anchorOrigin: {
              vertical: 'top',
              horizontal: 'left',
            },
            autoHideDuration: 1500,
          })
          fetchQuestionScores(system, setQuestionScores)
        })
        .catch((error) => {
          console.error('Error posting score:', error)
          if (error.status === 401) {
            routeToSignIn()
          } else if (error.status === 403) {
            enqueueSnackbar(error.response.data.error, {
              variant: 'error',
              anchorOrigin: {
                vertical: 'top',
                horizontal: 'left',
              },
              autoHideDuration: 2500,
            })
          } else {
            enqueueSnackbar(ERROR_MESSAGES.tryAgain, {
              variant: 'error',
              anchorOrigin: {
                vertical: 'top',
                horizontal: 'left',
              },
              autoHideDuration: 2500,
            })
          }
        })
    }
  }

  React.useEffect(() => {
    if (system) {
      const fetchData = async () => {
        try {
          let datacall = ''
          const latestDataCallId = await axiosInstance
            .get(`/datacalls/latest`)
            .then((res) => {
              setDatacallID(res.data.data.datacallid)
              datacall = res.data.data.datacall.replace(' ', '_')
              setDatacall(datacall)
              return res.data.data.datacallid
            })
            .catch((error) => {
              if (error.response.status === 401) {
                navigate(Routes.SIGNIN, {
                  replace: true,
                  state: {
                    message: ERROR_MESSAGES.expired,
                  },
                })
              } else if (error.status === 403) {
                enqueueSnackbar(
                  `You don't have permission to get the datacall`,
                  {
                    variant: 'error',
                    anchorOrigin: {
                      vertical: 'top',
                      horizontal: 'left',
                    },
                    autoHideDuration: 2500,
                  }
                )
              } else {
                enqueueSnackbar(ERROR_MESSAGES.tryAgain, {
                  variant: 'error',
                  anchorOrigin: {
                    vertical: 'top',
                    horizontal: 'left',
                  },
                  autoHideDuration: 2500,
                })
              }
            })
          await axiosInstance
            .get(`/fismasystems/${system}/questions`)
            .then((response) => {
              const data = response.data.data
              const organizedData: Record<string, FismaQuestion[]> = {}
              const questionData: Record<number, Question> = {}
              const pillarOrder: Record<string, number> = {}
              data.forEach((question: FismaQuestion) => {
                if (!organizedData[question.pillar.pillar]) {
                  organizedData[question.pillar.pillar] = []
                  pillarOrder[question.pillar.pillar] = question.pillar.order
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
              const sortedPillars = Object.keys(organizedData).sort(
                (a, b) => pillarOrder[a] - pillarOrder[b]
              )
              const sortSteps = (
                steps: FismaQuestion[],
                order: string[]
              ): FismaQuestion[] => {
                return steps.sort(
                  (a, b) =>
                    order.indexOf(a.function.function) -
                    order.indexOf(b.function.function)
                )
              }
              let sortedFuncId: number[] = []
              const categoriesData: Category[] = sortedPillars.map((pillar) => {
                const sortedSteps = sortSteps(
                  organizedData[pillar],
                  PILLAR_FUNCTION_MAP[pillar]
                )
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
                `/${RouteNames.QUESTIONNAIRE}/${fismaacronym?.toLowerCase()}/${datacall}/${categoriesData[0].name.toLowerCase()}/${categoriesData[0].steps[0].function.function.toLowerCase()}`,
                {
                  state: { fismasystemid: system },
                  replace: true,
                }
              )
              setSelectedIndex(sortedFuncId[0]) // set the first selected item in the list (rendered) to be selected(highlighted)
              setQuestion(questionData[sortedFuncId[0]].question) // set the first question value to the page
              setDescription(questionData[sortedFuncId[0]].description)
              setNotePrompt(questionData[sortedFuncId[0]].notesprompt) // set the first note prompt to the page
            })
            .catch((error) => {
              if (error.status === 401) {
                navigate(Routes.SIGNIN, {
                  replace: true,
                  state: {
                    message: ERROR_MESSAGES.expired,
                  },
                })
              } else if (error.status === 403) {
                enqueueSnackbar(
                  `You don't have permission to the questions of this fismasystem`,
                  {
                    variant: 'error',
                    anchorOrigin: {
                      vertical: 'top',
                      horizontal: 'left',
                    },
                    autoHideDuration: 3000,
                  }
                )
              } else {
                enqueueSnackbar(ERROR_MESSAGES.tryAgain, {
                  variant: 'error',
                  anchorOrigin: {
                    vertical: 'top',
                    horizontal: 'left',
                  },
                  autoHideDuration: 3000,
                })
              }
            })
          await axiosInstance
            .get(
              `scores?datacallid=${latestDataCallId}&fismasystemid=${system}&include=functionoption`
            )
            .then((res) => {
              const funcScoreTable = {}
              const questionScoreMap: questionScoreMap = {}
              const hashTable: questionScoreMap = Object.assign(
                {},
                ...res.data.data.map((item: QuestionScores) => ({
                  [item.functionoptionid]: item,
                }))
              )
              // res.data.data.map((item: any) => {
              //   questionScoreMap[item.functionoptionid] = item
              //   funcScoreTable
              // })
              console.log(hashTable)
              setQuestionScores(hashTable)
            })
            .catch((error) => {
              console.error('Error fetching ´question scores:', error)
              if (error.response.status === 401) {
                navigate(Routes.SIGNIN, {
                  replace: true,
                  state: {
                    message: ERROR_MESSAGES.expired,
                  },
                })
              } else if (error.response.status === 403) {
                enqueueSnackbar(
                  `You don't have permission get the scores for this system`,
                  {
                    variant: 'error',
                    anchorOrigin: {
                      vertical: 'top',
                      horizontal: 'left',
                    },
                    autoHideDuration: 3000,
                  }
                )
              } else {
                enqueueSnackbar(ERROR_MESSAGES.tryAgain, {
                  variant: 'error',
                  anchorOrigin: {
                    vertical: 'top',
                    horizontal: 'left',
                  },
                  autoHideDuration: 3000,
                })
              }
            })
        } catch (error) {
          console.error('Error fetching data:', error)
          navigate(Routes.SIGNIN, {
            replace: true,
            state: {
              message: ERROR_MESSAGES.expired,
            },
          })
        }
      }
      fetchData()
    }
  }, [system, navigate, fismaacronym, enqueueSnackbar])
  React.useEffect(() => {
    if (questionId) {
      const choices: QuestionChoice[] = []
      let funcOptId: number = 0
      try {
        axiosInstance.get(`functions/${questionId}/options`).then((res) => {
          if (res.status !== 200 && res.status === 401) {
            navigate(Routes.SIGNIN, {
              replace: true,
              state: {
                message: ERROR_MESSAGES.expired,
              },
            })
          }
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
          setLoadingQuestion(false)
        })
      } catch (error) {
        console.error('Error fetching data:', error)
        navigate(Routes.SIGNIN, {
          replace: true,
          state: {
            message: ERROR_MESSAGES.error,
          },
        })
      }
    }
  }, [questionId, questionScores, questions, navigate])
  return (
    <>
      <BreadCrumbs />
      <Container>
        <Grid container columnSpacing={2} sx={{ mt: 2 }}>
          <Grid xs={3}>
            <List
              sx={{
                width: '100%',
                // maxWidth: 500,
                bgcolor: 'background.paper',
                position: 'relative',
                overflow: 'auto',
                overflowX: 'hidden',
                maxHeight: 600,
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
                                (selectQuestionOption !== -1 &&
                                  initQuestionChoice !==
                                    selectQuestionOption) ||
                                initNotes !== notes
                              ) {
                                setOpenAlert(true)
                              } else {
                                navigate(
                                  `/${RouteNames.QUESTIONNAIRE}/${fismaacronym?.toLowerCase()}/${datacall}/${pillar.name === 'CrossCutting' ? 'cross-cutting' : pillar.name.toLowerCase()}/${func.function.function.toLowerCase()}`,
                                  {
                                    state: { fismasystemid: system },
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
          <Grid xs={9}>
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
                  <Box sx={{ mb: 2 }}>{renderRadioGroup(options)}</Box>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    {notePrompt || ''}
                  </Typography>
                  <CssTextField
                    multiline
                    rows={4}
                    fullWidth
                    value={notes}
                    onChange={(e) => {
                      setNotes(e.target.value)
                    }}
                  />
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
                          (selectQuestionOption !== -1 &&
                            initQuestionChoice !== selectQuestionOption) ||
                          initNotes !== notes
                        ) {
                          setStepId(
                            stepFunctionId[functionIdIdx[selectedIndex] - 1]
                          )
                          setOpenAlert(true)
                        } else {
                          const id =
                            stepFunctionId[functionIdIdx[selectedIndex] - 1]
                          if (questions[id]) {
                            const q = questions[id]
                            navigate(
                              `/${RouteNames.QUESTIONNAIRE}/${fismaacronym?.toLowerCase()}/${datacall}/${q.pillar === 'CrossCutting' ? 'cross-cutting' : q.pillar.toLowerCase()}/${q.function.toLowerCase()}`,
                              {
                                state: { fismasystemid: system },
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
                        const id =
                          selectedIndex ===
                          stepFunctionId[stepFunctionId.length - 1]
                            ? stepFunctionId[0]
                            : stepFunctionId[functionIdIdx[selectedIndex] + 1]

                        if (questions[id]) {
                          const q = questions[id]
                          navigate(
                            `/${RouteNames.QUESTIONNAIRE}/${fismaacronym?.toLowerCase()}/${datacall}/${q.pillar === 'CrossCutting' ? 'cross-cutting' : q.pillar.toLowerCase()}/${q.function.toLowerCase()}`,
                            {
                              state: { fismasystemid: system },
                              replace: true,
                            }
                          )
                        }
                        setLoadingQuestion(true)
                        setQuestionId(id)
                        setSelectedIndex(id)
                        saveResponse()
                        setLoadingQuestion(false)
                      }}
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
    </>
  )
}
