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
} from '@mui/x-data-grid'
import Tooltip from '@mui/material/Tooltip'
import { Box, IconButton } from '@mui/material'
import { useState } from 'react'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import FileDownloadSharpIcon from '@mui/icons-material/FileDownloadSharp'
import QuestionnareModal from '../QuestionnareModal/QuestionnareModal'
import CustomSnackbar from '../Snackbar/Snackbar'
import axiosInstance from '@/axiosConfig'
import { useContextProp } from '../Title/Context'
import { useNavigate, Link } from 'react-router-dom'
import { RouteNames } from '@/router/constants'
import { ERROR_MESSAGES } from '../../constants'
import { isAuthHandled } from '@/utils/notify'
import VisibilityIcon from '@mui/icons-material/Visibility'
import QuestionAnswerOutlinedIcon from '@mui/icons-material/QuestionAnswerOutlined'
import BarChartIcon from '@mui/icons-material/BarChart'
import PillarScoresModal from '../../components/PillarScoresModal/PillarScoresModal'
// import BreadCrumbs from '@/components/BreadCrumbs/BreadCrumbs'
import { FismaTableProps } from '@/types'
import type { ScoreAggregate, SystemScoreEntry } from '@/types'
import { hasSystemAccess } from '@/utils/userRoles'
import { cellStyleForTier } from '@/utils/tierStyles'
type selectedRowsType = GridRowId[]
declare module '@mui/x-data-grid' {
  interface FooterPropsOverrides {
    selectedRows: selectedRowsType
    fismaSystems: FismaSystemType[]
    latestDataCallId: number
    scores: Record<number, SystemScoreEntry>
  }
}

export function CustomFooterSaveComponent(
  props: NonNullable<GridSlotsComponentsProps['footer']>
) {
  const [openSnackbar, setOpenSnackbar] = useState<boolean>(false)
  const [snackBarSeverity, setSnackBarSeverity] = useState<
    'success' | 'error' | 'warning' | 'info'
  >('error')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const handleCloseSnackbar = () => {
    setOpenSnackbar(false)
  }
  const saveSystemAnswers = async () => {
    let exportUrl = `/datacalls/${props.latestDataCallId}/export`
    if (props.selectedRows && props.selectedRows.length > 0) {
      exportUrl += '?'
      let idString: string = ''
      props.selectedRows.forEach((id, index) => {
        idString += 'fsids=' + id
        if (props.selectedRows && index < props.selectedRows.length - 1) {
          idString += '&'
        }
      })
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
        const data = new Blob([response.data], {
          type: typeof contentType === 'string' ? contentType : undefined,
        })
        const url = window.URL.createObjectURL(data)
        const tempLink = document.createElement('a')
        tempLink.href = url
        tempLink.setAttribute('download', filename)
        tempLink.setAttribute('target', '_blank')
        tempLink.click()
        window.URL.revokeObjectURL(url)
      })
      .catch((error) => {
        if (isAuthHandled(error)) return
        setErrorMessage(ERROR_MESSAGES.tryAgain)
        setSnackBarSeverity('warning')
        setOpenSnackbar(true)
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
            position: 'relative',
          }}
        >
          <Tooltip title="Download selected system answers">
            <span role="presentation">
              <IconButton
                sx={{ color: '#004297' }}
                onClick={saveSystemAnswers}
                disabled={
                  !props.selectedRows || props.selectedRows.length === 0
                }
                aria-label={`Download selected system answers${props.selectedRows && props.selectedRows.length > 0 ? ` (${props.selectedRows.length} selected)` : ' (no systems selected)'}`}
              >
                <FileDownloadSharpIcon />
              </IconButton>
            </span>
          </Tooltip>
          <span
            role="status"
            aria-live="polite"
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              overflow: 'hidden',
              clip: 'rect(0, 0, 0, 0)',
              whiteSpace: 'nowrap',
            }}
          >
            {props.selectedRows && props.selectedRows.length > 0
              ? `${props.selectedRows.length} system${props.selectedRows.length === 1 ? '' : 's'} selected. Download button available.`
              : ''}
          </span>
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
  const { showDecommissioned, setShowDecommissioned } = useContextProp()

  return (
    <Box
      sx={{
        py: 0.5,
        pl: 1,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
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
      <FormControlLabel
        control={
          <Switch
            checked={showDecommissioned}
            onChange={(e) => setShowDecommissioned(e.target.checked)}
            sx={{
              '& .MuiSwitch-switchBase.Mui-checked': {
                color: '#004297',
              },
              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                backgroundColor: '#004297',
              },
            }}
          />
        }
        label="Show Decommissioned"
        sx={{ mr: 2 }}
      />
    </Box>
  )
}
// Cache for pillar scores to avoid repeated API calls
interface CachedScore {
  data: ScoreAggregate[]
  timestamp: number
}
const pillarScoresCache = new Map<number, CachedScore>()

export default function FismaTable({ scores }: FismaTableProps) {
  const apiRef = useGridApiRef()
  const { fismaSystems, latestDataCallId, userInfo } = useContextProp()
  const hasSystemDetailAccess = hasSystemAccess(userInfo)
  const [open, setOpen] = useState<boolean>(false)
  const [selectedRow, setSelectedRow] = useState<FismaSystemType | null>(null)
  const [selectedRows, setSelectedRows] = useState<GridRowId[]>([])
  const navigate = useNavigate()
  const [pillarScoresModal, setPillarScoresModal] = useState<{
    open: boolean
    systemName: string
    systemAcronym: string
    fismasystemid: number
    scores: ScoreAggregate[]
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
  const columns: GridColDef[] = [
    {
      field: 'fismaname',
      headerName: 'System Name',
      flex: 2,
      minWidth: 300,
      maxWidth: 450,
      hideable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Link
          to={`/systems/${params.row.fismasystemid}`}
          style={{ color: '#004297', textDecoration: 'none' }}
          onClick={(e) => e.stopPropagation()}
        >
          {params.value}
        </Link>
      ),
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
      maxWidth: 240,
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
      width: 160,
      align: 'center',
      headerAlign: 'center',
      hideable: false,
      valueGetter: (value) => {
        const entry = scores[value.row.fismasystemid]
        if (!entry || !entry.score) {
          return 0
        }
        return entry.score.toFixed(2)
      },
      renderCell: (params) => {
        const entry = scores[params.row.fismasystemid]
        const score = entry?.score ?? 0
        // Tier comes from the backend on /scores/aggregate; do not derive
        // it from the numeric score. Cells without a tier render with no
        // background fill so a transient deploy mismatch reads as
        // "unknown" rather than a misleading color.
        const backgroundColor =
          cellStyleForTier(entry?.tier)?.backgroundColor ?? 'transparent'
        return (
          <Box
            sx={{
              border: 1,
              p: 1,
              px: 4,
              borderRadius: 2,
              borderColor: 'darkgray',
              backgroundColor,
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
          <Tooltip title="Questionnaire">
            <span>
              <GridActionsCellItem
                icon={<QuestionAnswerOutlinedIcon />}
                key={`question-${params.row.fismasystemid}`}
                label={`View Questionnaire for ${params.row.fismaname}`}
                className="textPrimary"
                role="button"
                onClick={(event) => {
                  event.stopPropagation()
                  navigate(
                    `/${RouteNames.QUESTIONNAIRE}/${params.row.fismaacronym.toLowerCase()}`,
                    {
                      state: { fismasystemid: params.row.fismasystemid },
                    }
                  )
                }}
                color="inherit"
              />
            </span>
          </Tooltip>
          <Tooltip title="Pillar Scores">
            <span>
              <GridActionsCellItem
                icon={<BarChartIcon />}
                key={`chart-${params.row.fismasystemid}`}
                label={`View Pillar Scores for ${params.row.fismaname}`}
                className="textPrimary"
                role="button"
                onClick={(event) => {
                  event.stopPropagation()
                  handleOpenPillarScores(params.row as FismaSystemType)
                }}
                color="inherit"
              />
            </span>
          </Tooltip>
          {hasSystemDetailAccess && (
            <Tooltip title="System Details">
              <span>
                <GridActionsCellItem
                  icon={<VisibilityIcon />}
                  key={`view-${params.row.fismasystemid}`}
                  label={`View system details for ${params.row.fismaname}`}
                  className="textPrimary"
                  role="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    navigate(`/systems/${params.row.fismasystemid}`)
                  }}
                  color="inherit"
                />
              </span>
            </Tooltip>
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
    </Box>
  )
}
