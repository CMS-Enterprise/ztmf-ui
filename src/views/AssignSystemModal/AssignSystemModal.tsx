import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Typography,
} from '@mui/material'
import { Button as CmsButton } from '@cmsgov/design-system'
import { GridRowId } from '@mui/x-data-grid'
import axiosInstance from '@/axiosConfig'
import CustomSnackbar from '../Snackbar/Snackbar'
import Checkbox from '@mui/material/Checkbox'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import { useSnackbar } from 'notistack'
import { useNavigate } from 'react-router-dom'
import { Routes } from '@/router/constants'
import { ERROR_MESSAGES } from '@/constants'
const icon = <CheckBoxOutlineBlankIcon fontSize="small" />
const checkedIcon = <CheckBoxIcon fontSize="small" />

type Props = {
  fismaSystemMap: Record<number, string>
  open: boolean
  handleClose: () => void
  userid: GridRowId
}

export default function AssignSystemModal({
  fismaSystemMap,
  open,
  handleClose,
  userid,
}: Props) {
  const [assignedSystems, setAssignedSystems] = React.useState<number[]>([])
  const [fismaSystems, setFismaSystems] = React.useState<number[]>([])
  const [openSnackBar, setOpenSnackBar] = React.useState<boolean>(false)
  const { enqueueSnackbar } = useSnackbar()
  const navigate = useNavigate()
  React.useEffect(() => {
    if (open && userid) {
      axiosInstance.get(`/users/${userid}/assignedfismasystems`).then((res) => {
        const assignedSys = res.data.data || []
        setAssignedSystems(assignedSys)
        // Include all systems in options
        const systemIds = Object.keys(fismaSystemMap).map(Number)
        setFismaSystems(systemIds)
      })
    }
  }, [open, userid, fismaSystemMap])

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
        <DialogTitle align="center">
          <div>
            <Typography variant="h3">Assign Fisma Systems</Typography>
          </div>
        </DialogTitle>
        <DialogContent sx={{ height: 500 }}>
          <Autocomplete
            multiple
            disableCloseOnSelect
            limitTags={2}
            options={fismaSystems}
            disableClearable
            getOptionLabel={(option) => fismaSystemMap[option] || ''}
            renderOption={(props, option, { selected }) => {
              const isAssigned = assignedSystems.includes(option)
              return (
                <li {...props}>
                  <Checkbox
                    icon={icon}
                    key={option}
                    checkedIcon={checkedIcon}
                    style={{ marginRight: 8 }}
                    checked={selected || isAssigned}
                    disabled={isAssigned}
                  />
                  {fismaSystemMap[option]}
                </li>
              )
            }}
            value={assignedSystems}
            onChange={(_event, newValue) => {
              const added = newValue.filter(
                (item) => !assignedSystems.includes(item)
              )
              const removed = assignedSystems.filter(
                (item) => !newValue.includes(item)
              )
              if (added.length) {
                axiosInstance
                  .post(`/users/${userid}/assignedfismasystems`, {
                    fismasystemid: added[0],
                  })
                  .then(() => {
                    enqueueSnackbar(`Saved - assign system`, {
                      variant: 'success',
                      anchorOrigin: {
                        vertical: 'top',
                        horizontal: 'left',
                      },
                    })
                  })
                  .catch((error) => {
                    if (error.response.status === 401) {
                      navigate(Routes.SIGNIN, {
                        replace: true,
                        state: {
                          message: ERROR_MESSAGES.error,
                        },
                      })
                    } else if (error.response.status === 403) {
                      enqueueSnackbar(
                        `You don't have permission to assign systems`,
                        {
                          variant: 'error',
                          anchorOrigin: {
                            vertical: 'top',
                            horizontal: 'left',
                          },
                          autoHideDuration: 1500,
                        }
                      )
                    } else {
                      enqueueSnackbar(
                        `An error occurred, please try again later`,
                        {
                          variant: 'error',
                          anchorOrigin: {
                            vertical: 'top',
                            horizontal: 'left',
                          },
                          autoHideDuration: 1500,
                        }
                      )
                    }
                  })
              } else if (removed.length) {
                axiosInstance
                  .delete(`/users/${userid}/assignedfismasystems/${removed[0]}`)
                  .then(() => {
                    enqueueSnackbar(`Saved - unassigned system`, {
                      variant: 'success',
                      anchorOrigin: {
                        vertical: 'top',
                        horizontal: 'left',
                      },
                    })
                  })
                  .catch((error) => {
                    if (error.response.status === 401) {
                      navigate(Routes.SIGNIN, {
                        replace: true,
                        state: {
                          message: ERROR_MESSAGES.error,
                        },
                      })
                    } else if (error.response.status === 403) {
                      enqueueSnackbar(
                        `You don't have permission to assign systems`,
                        {
                          variant: 'error',
                          anchorOrigin: {
                            vertical: 'top',
                            horizontal: 'left',
                          },
                          autoHideDuration: 1500,
                        }
                      )
                    } else {
                      enqueueSnackbar(
                        `An error occurred, please try again later`,
                        {
                          variant: 'error',
                          anchorOrigin: {
                            vertical: 'top',
                            horizontal: 'left',
                          },
                          autoHideDuration: 1500,
                        }
                      )
                    }
                  })
              }

              setAssignedSystems(newValue)
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Assign FISMA Systems"
                variant="filled"
                placeholder="FISMA Systems"
                InputLabelProps={{
                  sx: {
                    marginTop: 0, // Remove the margin top of the label
                  },
                }}
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <CmsButton onClick={handleClose}>Close</CmsButton>
        </DialogActions>
      </Dialog>
      <CustomSnackbar
        open={openSnackBar}
        handleClose={() => setOpenSnackBar(false)}
        severity="success"
        duration={2000}
        text="Saved"
      />
    </>
  )
}
