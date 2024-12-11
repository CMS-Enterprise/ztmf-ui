import * as React from 'react'
import TextField from '@mui/material/TextField'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import CustomDialogTitle from '../../components/DialogTitle/CustomDialogTitle'
import { Button as CmsButton } from '@cmsgov/design-system'
import { Box, Grid } from '@mui/material'
import { editSystemModalProps, FismaSystemType } from '@/types'
import MenuItem from '@mui/material/MenuItem'
import ValidatedTextField from './ValidatedTextField'
import { emailValidator } from './validators'
import { EMPTY_SYSTEM } from './emptySystem'
import { datacenterenvironment } from './dataEnvironment'
import CircularProgress from '@mui/material/CircularProgress'
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog'
import _ from 'lodash'
import axiosInstance from '@/axiosConfig'
import { useNavigate } from 'react-router-dom'
import { Routes } from '@/router/constants'
import { ERROR_MESSAGES } from '@/constants'
import { useSnackbar } from 'notistack'
/**
 * Component that renders a modal to edit fisma systems.
 * @param {boolean, function, FismaSystemType} editSystemModalProps - props to get populate dialog and function .
 * @returns {JSX.Element} Component that renders a dialog to edit details of a fisma systems.
 */

export default function EditSystemModal({
  open,
  onClose,
  system,
}: editSystemModalProps) {
  const formValid = React.useRef({ issoemail: false, datacallcontact: false })
  const navigate = useNavigate()
  const { enqueueSnackbar } = useSnackbar()
  const [loading, setLoading] = React.useState<boolean>(true)
  const [openAlert, setOpenAlert] = React.useState<boolean>(false)
  // const [confirmChanges, setConfirmChanges] = React.useState<boolean>(false)
  const handleConfirmReturn = (confirm: boolean) => {
    if (confirm) {
      onClose(EMPTY_SYSTEM)
    }
  }
  const [editedFismaSystem, setEditedFismaSystem] =
    React.useState<FismaSystemType>(EMPTY_SYSTEM)
  React.useEffect(() => {
    if (system && open) {
      setEditedFismaSystem(system)
      setLoading(false)
    }
  }, [system, open])
  const handleClose = () => {
    setEditedFismaSystem(EMPTY_SYSTEM)
    if (_.isEqual(system, editedFismaSystem)) {
      onClose(editedFismaSystem)
    } else {
      setOpenAlert(true)
    }
    return
  }
  const handleSave = async () => {
    // TODO: Set this axiosInstance to update into the database with the latest changes
    await axiosInstance
      .put(`fismasystems/${editedFismaSystem.fismasystemid}`, {
        fismauid: editedFismaSystem.fismauid,
        fismaacronym: editedFismaSystem.fismaacronym,
        fismaname: editedFismaSystem.fismaname,
        fismasubsystem: editedFismaSystem.fismasubsystem,
        component: editedFismaSystem.component,
        groupacronym: editedFismaSystem.groupacronym,
        groupname: editedFismaSystem.groupname,
        divisionname: editedFismaSystem.divisionname,
        datacenterenvironment: editedFismaSystem.datacenterenvironment,
        datacallcontact: editedFismaSystem.datacallcontact,
        issoemail: editedFismaSystem.issoemail,
      })
      .then((res) => {
        if (res.status !== 200 && res.status.toString()[0] === '4') {
          navigate(Routes.SIGNIN, {
            replace: true,
            state: {
              message: ERROR_MESSAGES.expired,
            },
          })
        }
        enqueueSnackbar(`Saved`, {
          variant: 'success',
          anchorOrigin: {
            vertical: 'top',
            horizontal: 'left',
          },
          autoHideDuration: 1000,
        })
      })
      .catch((error) => {
        console.error('Error fetching data:', error)
        navigate(Routes.SIGNIN, {
          replace: true,
          state: {
            message: ERROR_MESSAGES.error,
          },
        })
      })
    onClose(editedFismaSystem)
  }
  if (open && system) {
    if (loading) {
      return (
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
      )
    }
    return (
      <>
        <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
          <CustomDialogTitle title="Edit Fisma System" />
          <DialogContent>
            <Box sx={{ flexGrow: 1 }} component="form">
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    id="fismaname"
                    label="Fisma Name"
                    fullWidth
                    margin="normal"
                    variant="standard"
                    defaultValue={system?.fismaname}
                    InputLabelProps={{
                      sx: {
                        marginTop: 0,
                      },
                    }}
                    onChange={(e) => {
                      setEditedFismaSystem((prevState) => ({
                        ...prevState,
                        fismaname: e.target.value,
                      }))
                    }}
                  />
                  <TextField
                    id="fismaacronym"
                    label="Fisma Acronym"
                    variant="standard"
                    margin="normal"
                    defaultValue={system?.fismaacronym}
                    InputLabelProps={{
                      sx: {
                        marginTop: 0,
                      },
                    }}
                  />
                  <TextField
                    id="groupacronym"
                    label="Group Acronym"
                    variant="standard"
                    margin="normal"
                    defaultValue={system?.groupacronym}
                    InputLabelProps={{
                      sx: {
                        marginTop: 0,
                      },
                    }}
                    sx={{ ml: 2 }}
                    onChange={(e) => {
                      setEditedFismaSystem((prevState) => ({
                        ...prevState,
                        groupacronym: e.target.value,
                      }))
                    }}
                  />
                  <TextField
                    id="component"
                    label="Component"
                    variant="standard"
                    margin="normal"
                    defaultValue={system?.component}
                    InputLabelProps={{
                      sx: {
                        marginTop: 0,
                      },
                    }}
                    sx={{ ml: 2 }}
                    onChange={(e) => {
                      setEditedFismaSystem((prevState) => ({
                        ...prevState,
                        component: e.target.value,
                      }))
                    }}
                  />
                  <TextField
                    id="groupname"
                    label="Group Name"
                    variant="standard"
                    margin="normal"
                    fullWidth
                    defaultValue={system?.groupname}
                    InputLabelProps={{
                      sx: {
                        marginTop: 0,
                      },
                    }}
                    onChange={(e) => {
                      setEditedFismaSystem((prevState) => ({
                        ...prevState,
                        groupname: e.target.value,
                      }))
                    }}
                  />

                  <TextField
                    id="divisionname"
                    label="Division Name"
                    variant="standard"
                    margin="normal"
                    fullWidth
                    defaultValue={system?.divisionname}
                    InputLabelProps={{
                      sx: {
                        marginTop: 0,
                      },
                    }}
                    onChange={(e) => {
                      setEditedFismaSystem((prevState) => ({
                        ...prevState,
                        divisionname: e.target.value,
                      }))
                    }}
                  />
                  <TextField
                    id="fismasubsystem"
                    label="Fisma Subsystem"
                    variant="standard"
                    margin="normal"
                    fullWidth
                    defaultValue={system?.fismasubsystem}
                    InputLabelProps={{
                      sx: {
                        marginTop: 0,
                      },
                    }}
                    onChange={(e) => {
                      setEditedFismaSystem((prevState) => ({
                        ...prevState,
                        fismasubsystem: e.target.value,
                      }))
                    }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <ValidatedTextField
                    label="Data Call Contact"
                    validator={emailValidator}
                    dfValue={system?.datacallcontact}
                    isFullWidth={true}
                    onChange={(isValid, newValue) => {
                      formValid.current.datacallcontact = isValid
                      if (isValid) {
                        setEditedFismaSystem((prevState) => ({
                          ...prevState,
                          datacallcontact: newValue,
                        }))
                      }
                    }}
                  />
                  <ValidatedTextField
                    label="ISSO Email"
                    validator={emailValidator}
                    dfValue={system?.issoemail}
                    isFullWidth={true}
                    onChange={(isValid, newValue) => {
                      formValid.current.issoemail = isValid
                      if (isValid) {
                        setEditedFismaSystem((prevState) => ({
                          ...prevState,
                          issoemail: newValue,
                        }))
                      }
                    }}
                  />
                  <TextField
                    id="outlined-select-datacenterenvironment"
                    select
                    label="Datacenter Environment"
                    defaultValue={system?.datacenterenvironment}
                    fullWidth
                    InputLabelProps={{
                      sx: {
                        marginTop: 0,
                      },
                    }}
                    sx={{ mt: 2 }}
                    onChange={(e) => {
                      setEditedFismaSystem((prevState) => ({
                        ...prevState,
                        datacenterenvironment: e.target.value,
                      }))
                    }}
                  >
                    {datacenterenvironment.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <CmsButton variation="solid" onClick={handleSave}>
              Save
            </CmsButton>
            <CmsButton onClick={handleClose} color="primary">
              Close
            </CmsButton>
          </DialogActions>
        </Dialog>
        <ConfirmDialog
          open={openAlert}
          onClose={() => setOpenAlert(false)}
          confirmClick={handleConfirmReturn}
        />
      </>
    )
  }
  return <></>
}
