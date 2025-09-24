import { FismaSystemType } from '@/types'
import {
  DataGrid,
  GridColDef,
  GridFooterContainer,
  GridSlotsComponentsProps,
  GridRenderCellParams,
  GridActionsCellItem,
  GridToolbarQuickFilter,
  GridFooter,
  GridRowId,
  useGridApiRef,
  GridRowParams,
  useGridApiContext,
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
import { RouteNames, Routes } from '@/router/constants'
import { ERROR_MESSAGES } from '../../constants'
import EditIcon from '@mui/icons-material/Edit'
import QuestionAnswerOutlinedIcon from '@mui/icons-material/QuestionAnswerOutlined'
import BarChartIcon from '@mui/icons-material/BarChart'
import PillarScoresModal from '../../components/PillarScoresModal/PillarScoresModal'
// import BreadCrumbs from '@/components/BreadCrumbs/BreadCrumbs'
import { FismaTableProps } from '@/types'
type selectedRowsType = GridRowId[]
declare module '@mui/x-data-grid' {
  interface FooterPropsOverrides {
    selectedRows: selectedRowsType
    fismaSystems: FismaSystemType[]
    latestDataCallId: number
    scores: Record<number, number>
  }
}

export function CustomFooterSaveComponent(
  props: NonNullable<GridSlotsComponentsProps['footer']>
) {
  const [openSnackbar, setOpenSnackbar] = useState<boolean>(false)
  const [snackBarSeverity, setSnackBarSeverity] = useState<
    'success' | 'error' | 'warning' | 'info'
  >('error')
  const apiRef = useGridApiContext()
  const [errorMessage, setErrorMessage] = useState<string>('')
  const navigate = useNavigate()
  const handleCloseSnackbar = () => {
    setOpenSnackbar(false)
  }
  const saveSystemAnswers = async () => {
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
        if (error.response.status === 401) {
          navigate(Routes.SIGNIN, {
            replace: true,
            state: {
              message: ERROR_MESSAGES.error,
            },
          })
        } else if (error.response.status === 403) {
          setErrorMessage(ERROR_MESSAGES.permission)
          setSnackBarSeverity('warning')
          setOpenSnackbar(true)
        } else {
          setErrorMessage(ERROR_MESSAGES.tryAgain)
          setSnackBarSeverity('warning')
          setOpenSnackbar(true)
        }
      })
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
            <span>
              <IconButton
                sx={{ color: '#004297' }}
                onClick={saveSystemAnswers}
                disabled={apiRef.current.getSelectedRows().size === 0}
              >
                <FileDownloadSharpIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
        <GridFooter />
      </GridFooterContainer>
      <CustomSnackbar
        open={openSnackbar}
        handleClose={handleCloseSnackbar}
        severity={snackBarSeverity}
        text={errorMessage}
        duration={4000}
      />
    </>
  )
}

function QuickSearchToolbar() {
  return (
    <Box
      sx={{
        py: 0.5,
        pl: 1,
      }}
    >
      <GridToolbarQuickFilter
        debounceMs={250}
        sx={{
          // '& .MuiInputBase-root:before': {
          //   borderBottomColor: '#5666b8',
          //   borderBottomWidth: 2,
          // },
          '& .MuiInputBase-input::placeholder': {
            color: '#404040', // Change placeholder color to red
            opacity: 0.8, // Ensure it is fully visible (MUI reduces opacity by default)
          },
          '& .MuiInputBase-root:after': {
            borderBottomColor: '#5666b8', // Changes the underline color when active
          },
          '& .MuiInputBase-root:hover:not(.Mui-disabled):before': {
            borderBottomColor: '#5666b8', // Changes the underline color on hover
          },
        }}
      />
    </Box>
  )
}
// Cache for pillar scores to avoid repeated API calls
interface SystemScore {
  datacallid: number
  fismasystemid: number
  systemscore: number
  pillarscores: Array<{
    pillarid: number
    pillar: string
    score: number
  }>
}

interface CachedScore {
  data: SystemScore[]
  timestamp: number
}
const pillarScoresCache = new Map<number, CachedScore>()

export default function FismaTable({ scores }: FismaTableProps) {
  const apiRef = useGridApiRef()
  const { fismaSystems, latestDataCallId } = useContextProp()
  const [open, setOpen] = useState<boolean>(false)
  const { userInfo } = useContextProp() || EMPTY_USER
  const [selectedRow, setSelectedRow] = useState<FismaSystemType | null>(null)
  const [selectedRows, setSelectedRows] = useState<GridRowId[]>([])
  const navigate = useNavigate()
  const [openEditModal, setOpenEditModal] = useState<boolean>(false)
  const [pillarScoresModal, setPillarScoresModal] = useState<{
    open: boolean
    systemName: string
    systemAcronym: string
    fismasystemid: number
    scores: SystemScore[]
  }>({
    open: false,
    systemName: '',
    systemAcronym: '',
    fismasystemid: 0,
    scores: [],
  })
  const handleCloseModal = () => {
    setOpen(false)
    setSelectedRow(null)
  }

  const handleOpenPillarScores = async (row: FismaSystemType) => {
    try {
      // Check cache first
      const cached = pillarScoresCache.get(row.fismasystemid)
      const now = Date.now()
      const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

      let scoresData
      if (cached && now - cached.timestamp < CACHE_DURATION) {
        // Use cached data
        scoresData = cached.data
      } else {
        // Fetch fresh data
        const response = await axiosInstance.get(
          `/scores/aggregate?fismasystemid=${row.fismasystemid}&include_pillars=true`
        )
        scoresData = response.data.data

        // Store in cache
        pillarScoresCache.set(row.fismasystemid, {
          data: scoresData,
          timestamp: now,
        })
      }

      setPillarScoresModal({
        open: true,
        systemName: row.fismaname,
        systemAcronym: row.fismaacronym,
        fismasystemid: row.fismasystemid,
        scores: scoresData,
      })
    } catch (error) {
      console.error('Error fetching pillar scores:', error)
    }
  }

  const handleClosePillarScores = () => {
    setPillarScoresModal((prev) => ({ ...prev, open: false }))
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
      flex: 2,
      minWidth: 300,
      maxWidth: 450,
      hideable: false,
    },
    {
      field: 'fismaacronym',
      headerName: 'Acronym',
      flex: 0.8,
      minWidth: 100,
    },
    {
      field: 'issoemail',
      headerName: 'ISSO Name',
      flex: 1.2,
      minWidth: 120,
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
      minWidth: 140,
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
      flex: 1.5,
      minWidth: 180,
      hideable: false,
    },
    {
      field: 'actions',
      headerName: 'Actions',
      headerAlign: 'center',
      align: 'center',
      width: 140,
      minWidth: 140,
      hideable: false,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams) => (
        <>
          <Tooltip title="View Questionnare">
            <span>
              <GridActionsCellItem
                icon={<QuestionAnswerOutlinedIcon />}
                key={`question-${params.row.fismasystemid}`}
                label="View Questionnare"
                className="textPrimary"
                onClick={(event) => {
                  event.stopPropagation()
                  navigate(
                    `/${RouteNames.QUESTIONNAIRE}/${params.row.fismaacronym.toLowerCase()}`,
                    {
                      state: { fismasystemid: params.row.fismasystemid },
                    }
                  )
                  // handleOpenModal(params.row as FismaSystemType)
                }}
                color="inherit"
              />
            </span>
          </Tooltip>
          <Tooltip title="View Pillar Scores">
            <span>
              <GridActionsCellItem
                icon={<BarChartIcon />}
                key={`chart-${params.row.fismasystemid}`}
                label="View Pillar Scores"
                className="textPrimary"
                onClick={(event) => {
                  event.stopPropagation()
                  handleOpenPillarScores(params.row as FismaSystemType)
                }}
                color="inherit"
              />
            </span>
          </Tooltip>
          {userInfo.role === 'ADMIN' && (
            <GridActionsCellItem
              icon={<EditIcon />}
              key={`edit-${params.row.fismasystemid}`}
              label="Edit"
              className="textPrimary"
              onClick={(event) => {
                event.stopPropagation()
                handleEditOpenModal(event, params.row as FismaSystemType)
              }}
              color="inherit"
            />
          )}
        </>
      ),
    },
  ]

  return (
    <Box sx={{ height: 600, width: '100%', mb: 2 }}>
      <DataGrid
        rows={fismaSystems}
        isRowSelectable={(params: GridRowParams) =>
          params.row.fismasystemid in scores
        }
        columns={columns}
        checkboxSelection
        apiRef={apiRef}
        getRowId={(row) => row.fismasystemid}
        onRowSelectionModelChange={(ids) => {
          const selectedIDs = Array.from(ids)
          setSelectedRows(selectedIDs)
        }}
        slotProps={{
          footer: { selectedRows, fismaSystems, latestDataCallId, scores },
          filterPanel: {
            sx: {
              '& .MuiFormLabel-root': {
                marginTop: 1,
              },
            },
          },
        }}
        slots={{
          toolbar: QuickSearchToolbar,
          footer: CustomFooterSaveComponent,
        }}
        disableColumnFilter
        disableColumnSelector
        disableDensitySelector
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
      <PillarScoresModal
        open={pillarScoresModal.open}
        onClose={handleClosePillarScores}
        systemName={pillarScoresModal.systemName}
        systemAcronym={pillarScoresModal.systemAcronym}
        scores={pillarScoresModal.scores}
      />
      <EditSystemModal
        title={'Edit'}
        open={openEditModal}
        onClose={handleCloseEditModal}
        system={selectedRow}
        mode={'edit'}
      />
    </Box>
  )
}
