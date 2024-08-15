import * as React from 'react'
import { Button as CmsButton } from '@cmsgov/design-system'
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Typography,
} from '@mui/material'
import { styled } from '@mui/system'
import TextField from '@mui/material/TextField'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore'
// export interface IAppProps {
// }
interface QuestionnareProps {
  name: string
  steps: string[]
}
const categories: QuestionnareProps[] = [
  {
    name: 'IDENTITY',
    steps: [
      'ACCESS MANAGEMENT',
      'AUTOMATION & ORCHESTRATION',
      'GOVERNANCE CAPABILITY',
      'IDENTITY STORES',
      'RISK ASSESSMENT',
      'USER AUTH',
      'VISABILITY & ANALYTICS',
    ],
  },
  {
    name: 'DEVICES',
    steps: [
      'ASSET RISK MANAGEMENT',
      'AUTOMATION & ORCHESTRATION',
      'GOVERNANCE',
      'THREAT PROTECTION',
      'POLICY ENFORCEMENT',
      'VISIBILITY ANALYTICS',
      'RESOURCE ACCESS',
    ],
  },
  {
    name: 'NETWORK',
    steps: [
      'AUTOMATION & ORCHESTRATION',
      'ENCRYPTION',
      'GOVERNANCE CAPABILITY',
      'RESILIENCE',
      'NETWORK SEGMENTATION',
      'TRAFFIC MANAGEMENT',
      'VISIBILITY & ANALYTICS',
    ],
  },
  {
    name: 'APPLICATION',
    steps: [
      'ACCESSABILITY',
      'ACCESS AUTHORIZATION-USERS',
      'AUTOMATION & ORCHESTRATION',
      'GOVERNANCE',
      'SECURE DEVELOPER DEPLOY WORKFLOW',
      'SECURITY TESTING',
      'THREAT PROTECTION',
      'VISIBILITY & ANALYTICS',
    ],
  },
  {
    name: 'DATA',
    steps: [
      'ACCESS DETERMINATION',
      'AUTOMATION & ORCHESTRATION',
      'AVAILABILITY',
      'CATEGORIZATION',
      'ENCRYPTION',
      'GOVERNANCE CAPABILITY',
      'INVENTORY MANAGEMENT',
      'VISIBILITY & ANALYTICS',
    ],
  },
]

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

export function QuestionnareModal() {
  const [activeCategoryIndex, setActiveCategoryIndex] =
    React.useState<number>(0)
  const [activeStepIndex, setActiveStepIndex] = React.useState<number>(0)
  const [open, setOpen] = React.useState(false)

  const activeCategory = categories[activeCategoryIndex]
  const activeStep = activeCategory.steps[activeStepIndex]

  const handleQuestionnareNext = () => {
    if (activeStepIndex < activeCategory.steps.length - 1) {
      setActiveStepIndex((prevIndex: number) => prevIndex + 1)
    } else if (activeCategoryIndex < categories.length - 1) {
      setActiveCategoryIndex((prevIndex: number) => prevIndex + 1)
      setActiveStepIndex(0)
    }
  }

  const handleQuestionnareBack = () => {
    if (activeStepIndex > 0) {
      setActiveStepIndex((prevIndex: number) => prevIndex - 1)
    } else if (activeCategoryIndex > 0) {
      setActiveCategoryIndex((prevIndex: number) => prevIndex - 1)
      setActiveStepIndex(categories[activeCategoryIndex - 1].steps.length - 1)
    }
  }
  const handleStepClick = (categoryIndex: number, stepIndex: number) => {
    setActiveCategoryIndex(categoryIndex)
    setActiveStepIndex(stepIndex)
  }

  const handleDialogOpen = () => {
    setOpen(true)
  }

  const handleDialogClose = () => {
    setOpen(false)
    setActiveCategoryIndex(0)
    setActiveStepIndex(0)
  }
  return (
    <>
      <CmsButton onClick={handleDialogOpen}>Click to show modal</CmsButton>
      <Dialog open={open} onClose={handleDialogClose} maxWidth="lg" fullWidth>
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
              // padding="16px"
              overflow="auto"
              maxHeight="100%"
              sx={{ paddingRight: '40px' }}
            >
              {categories.map((category, categoryIndex) => (
                <Box key={category.name} marginBottom="16px">
                  <Typography variant="h6" align="center">
                    {category.name}
                  </Typography>
                  <Box
                    // display="flex"
                    // flexDirection="row"
                    flexWrap="wrap"
                  >
                    {category.steps.map((step, stepIndex) => (
                      <Box
                        key={step}
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
                        onClick={() =>
                          handleStepClick(categoryIndex, stepIndex)
                        }
                      >
                        {step}
                      </Box>
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>

            {/* Right Side: Content Area */}
            <Box
              flex={0.7}
              padding="16px"
              marginLeft={'10px'}
              bgcolor="grey.100"
              borderRadius="8px"
              position="relative"
              overflow="hidden"
            >
              <Typography variant="h5">Content Area</Typography>
              <Typography variant="body1">
                {`You have selected the step: ${activeStep} from category: ${activeCategory.name}.`}
              </Typography>
              <CssTextField
                label="Notes"
                placeholder="Notes"
                multiline
                rows={4}
                fullWidth
              />
              <Box
                position="absolute"
                bottom="10px"
                display="flex"
                width="100%"
                // padding="16px"
                justifyContent={'space-between'}
              >
                <CmsButton
                  onClick={handleQuestionnareBack}
                  color="primary"
                  disabled={activeCategoryIndex === 0 && activeStepIndex === 0}
                >
                  <NavigateBeforeIcon sx={{ pt: '2px' }} />
                  Back
                </CmsButton>
                <CmsButton
                  className="ds-u-margin-right--4"
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
          </Box>
        </DialogContent>
        <DialogActions>
          <CmsButton onClick={handleDialogClose} color="primary">
            Close
          </CmsButton>
        </DialogActions>
      </Dialog>
    </>
  )
}
