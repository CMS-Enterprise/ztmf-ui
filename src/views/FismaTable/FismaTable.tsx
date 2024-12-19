import { FismaSystemType } from '@/types'
import {
  DataGrid,
  GridColDef,
  GridFooterContainer,
  GridSlotsComponentsProps,
  GridRenderCellParams,
  GridActionsCellItem,
  GridFooter,
  GridRowId,
  useGridApiRef,
} from '@mui/x-data-grid'
import Tooltip from '@mui/material/Tooltip'
import { Box, IconButton } from '@mui/material'
import { useState } from 'react'
import FileDownloadSharpIcon from '@mui/icons-material/FileDownloadSharp'
import QuestionnareModal from '../QuestionnareModal/QuestionnareModal'
import EditSystemModal from '../EditSystemModal/EditSystemModal'
import CustomSnackbar from '../Snackbar/Snackbar'
import axiosInstance from '@/axiosConfig'
import { useContextProp } from '../Title/Context'
import { EMPTY_USER } from '../../constants'
import { useNavigate } from 'react-router-dom'
import { Routes } from '@/router/constants'
import { ERROR_MESSAGES } from '../../constants'
import EditIcon from '@mui/icons-material/Edit'
import QuestionAnswerOutlinedIcon from '@mui/icons-material/QuestionAnswerOutlined'
import { FismaTableProps } from '@/types'

type selectedRowsType = GridRowId[]
declare module '@mui/x-data-grid' {
  interface FooterPropsOverrides {
    selectedRows: selectedRowsType
    fismaSystems: FismaSystemType[]
    latestDataCallId: number
  }
}

export function CustomFooterSaveComponent(
  props: NonNullable<GridSlotsComponentsProps['footer']>
) {
  const [openSnackbar, setOpenSnackbar] = useState<boolean>(false)
  const navigate = useNavigate()
  const handleCloseSnackbar = () => {
    setOpenSnackbar(false)
  }
  const saveSystemAnswers = async () => {
    if (props.selectedRows && props.selectedRows.length === 0) {
      setOpenSnackbar(true)
    } else {
      let exportUrl = `/datacalls/${props.latestDataCallId}/export`
      if (
        props.selectedRows &&
        props.fismaSystems &&
        props.selectedRows.length < props.fismaSystems.length
      ) {
        exportUrl += '?'
        let idString: string = ''
        if (props.selectedRows) {
          props.selectedRows.forEach((id, index) => {
            idString += 'fsids=' + id
            if (index < (props.selectedRows ?? []).length - 1) {
              idString += '&'
            }
          })
        }
        exportUrl += idString
      }
      return await axiosInstance
        .get(exportUrl, {
          responseType: 'blob',
        })
        .then((response) => {
          if (response.status !== 200) {
            navigate(Routes.SIGNIN, {
              replace: true,
              state: {
                message: ERROR_MESSAGES.expired,
              },
            })
          }
          const [, filename] =
            response.headers['content-disposition'].split('filename=')
          const contentType = response.headers['content-type']
          const data = new Blob([response.data], { type: contentType })
          const url = window.URL.createObjectURL(data)
          const tempLink = document.createElement('a')
          tempLink.href = url
          tempLink.setAttribute('download', filename)
          tempLink.setAttribute('target', '_blank')
          tempLink.click()
          window.URL.revokeObjectURL(url)
        })
        .catch((error) => {
          console.error('Error saving system answers: ', error)
          navigate(Routes.SIGNIN, {
            replace: true,
            state: {
              message: ERROR_MESSAGES.error,
            },
          })
        })
    }
  }
  return (
    <>
      <GridFooterContainer>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 1,
            ml: 1,
          }}
        >
          <Tooltip title="Save System Answers">
            <IconButton sx={{ color: '#004297' }} onClick={saveSystemAnswers}>
              <FileDownloadSharpIcon />
            </IconButton>
          </Tooltip>
        </Box>
        <GridFooter />
      </GridFooterContainer>
      <CustomSnackbar
        open={openSnackbar}
        handleClose={handleCloseSnackbar}
        severity="error"
        text="No systems selected"
      />
    </>
  )
}
export default function FismaTable({
  scores,
  latestDataCallId,
}: FismaTableProps) {
  const apiRef = useGridApiRef()
  const { fismaSystems } = useContextProp()
  const [open, setOpen] = useState<boolean>(false)
  const { userInfo } = useContextProp() || EMPTY_USER
  const [selectedRow, setSelectedRow] = useState<FismaSystemType | null>(null)
  const [selectedRows, setSelectedRows] = useState<GridRowId[]>([])
  const [openEditModal, setOpenEditModal] = useState<boolean>(false)
  const handleOpenModal = (row: FismaSystemType) => {
    setSelectedRow(row)
    setOpen(true)
  }
  const handleCloseModal = () => {
    setOpen(false)
    setSelectedRow(null)
  }
  const handleEditOpenModal = (
    event: React.MouseEvent<HTMLButtonElement>,
    row: FismaSystemType
  ) => {
    event.stopPropagation()
    setSelectedRow(row)
    setOpenEditModal(true)
  }
  const handleCloseEditModal = (newRowData: FismaSystemType) => {
    if (selectedRow) {
      const row = apiRef.current.getRow(selectedRow?.fismasystemid)
      if (row) {
        apiRef.current.updateRows([newRowData])
      }
    }
    setOpenEditModal(false)
    setSelectedRow(null)
  }
  const columns: GridColDef[] = [
    {
      field: 'fismaname',
      headerName: 'System Name',
      width: 430,
      hideable: false,
    },
    {
      field: 'issoemail',
      headerName: 'ISSO Name',
      flex: 1,
      hideable: false,
      valueGetter: (value) => {
        const name = value.row.issoemail.split('@')
        const fullName = name[0].replace(/[0-9]/g, '').split('.')
        return fullName.length > 1
          ? `${fullName[0]} ${fullName[1]}`
          : fullName[0]
      },
      renderCell: (params) => {
        const name = params.row.issoemail.split('@')
        const fullName = name[0].replace(/[0-9]/g, '').split('.')
        let firstName = ''
        let lastName = ''
        if (fullName.length > 1) {
          firstName = fullName[0][0].toUpperCase() + fullName[0].slice(1)
          lastName = fullName[1][0].toUpperCase() + fullName[1].slice(1)
        }
        return fullName.length > 1 ? `${firstName} ${lastName}` : fullName[0]
      },
    },
    {
      field: 'Score',
      headerName: 'Zero Trust Score',
      type: 'number',
      flex: 1,
      align: 'center',
      hideable: false,
      valueGetter: (value) => {
        if (!scores[value.row.fismasystemid]) {
          return 0
        }
        return scores[value.row.fismasystemid].toFixed(2)
      },
      renderCell: (params) => {
        let score: number = 0
        let backgroundColor: string = ''
        if (scores[params.row.fismasystemid]) {
          score = scores[params.row.fismasystemid]
          if (score >= 1 && score <= 1.74) {
            backgroundColor = '#DAA9EC'
          } else if (score >= 1.75 && score <= 2.74) {
            backgroundColor = '#FFD5A5'
          } else if (score >= 2.75 && score <= 3.65) {
            backgroundColor = '#F2FBC4'
          } else if (score >= 3.66) {
            backgroundColor = '#93F0ED'
          }
        }
        return (
          <Box
            sx={{
              border: 1,
              p: 1,
              px: 4,
              borderRadius: 2,
              borderColor: 'darkgray',
              backgroundColor: backgroundColor,
            }}
          >
            {score.toFixed(2)}
          </Box>
        )
      },
    },
    {
      field: 'datacenterenvironment',
      headerName: 'Data Center Environment',
      flex: 1,
      hideable: false,
    },
    {
      field: 'actions',
      headerName: 'Actions',
      headerAlign: 'center',
      align: 'center',
      flex: 0.5,
      hideable: false,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams) => (
        <>
          <Tooltip title="View Questionnare">
            <GridActionsCellItem
              icon={<QuestionAnswerOutlinedIcon />}
              key={`question-${params.row.fismasystemid}`}
              label="View Questionnare"
              className="textPrimary"
              onClick={() => handleOpenModal(params.row as FismaSystemType)}
              color="inherit"
            />
          </Tooltip>
          {userInfo.role === 'ADMIN' && (
            <GridActionsCellItem
              icon={<EditIcon />}
              key={`edit-${params.row.fismasystemid}`}
              label="Edit"
              className="textPrimary"
              onClick={(event) =>
                handleEditOpenModal(event, params.row as FismaSystemType)
              }
              color="inherit"
            />
          )}
        </>
      ),
    },
  ]

  return (
    <div style={{ height: 600, width: '100%' }}>
      <DataGrid
        rows={fismaSystems}
        columns={columns}
        checkboxSelection
        apiRef={apiRef}
        getRowId={(row) => row.fismasystemid}
        onRowSelectionModelChange={(ids) => {
          const selectedIDs = Array.from(ids)
          setSelectedRows(selectedIDs)
        }}
        slotProps={{
          footer: { selectedRows, fismaSystems, latestDataCallId },
          filterPanel: {
            sx: {
              '& .MuiFormLabel-root': {
                marginTop: 1,
              },
            },
          },
        }}
        slots={{
          footer: CustomFooterSaveComponent,
        }}
        disableColumnSelector
        sx={{
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: '#004297',
            color: '#fff',
          },
          '& .MuiDataGrid-menuIconButton': {
            color: '#fff',
          },
          '& .MuiDataGrid-menuIcon': {
            color: '#fff',
          },
          '& .MuiDataGrid-sortIcon': {
            color: '#fff',
          },
          '& .MuiFormControl-root.MuiTextField-root': {
            marginTop: 0,
          },
          '& .MuiTablePagination-selectLabel': {
            marginBottom: 2,
          },
          '& .MuiTablePagination-displayedRows': {
            marginBottom: 2,
          },
          '& .MuiDataGrid-columnHeaders .MuiSvgIcon-root': {
            color: 'white',
          },
        }}
      />
      <QuestionnareModal
        open={open}
        onClose={handleCloseModal}
        system={selectedRow}
      />
      <EditSystemModal
        title={'Edit'}
        open={openEditModal}
        onClose={handleCloseEditModal}
        system={selectedRow}
        mode={'edit'}
      />
    </div>
  )
}
