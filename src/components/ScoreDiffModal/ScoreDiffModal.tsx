import React, { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Autocomplete,
  TextField,
  Chip,
  Divider,
  Tooltip,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { Button as CmsButton } from '@cmsgov/design-system'
import axiosInstance from '@/axiosConfig'
import { isAuthHandled } from '@/utils/notify'
import type { datacall, ScoreDiffEntry } from '@/types'

const datacallsCache: { data: datacall[] | null; timestamp: number | null } = {
  data: null,
  timestamp: null,
}
const CACHE_DURATION = 10 * 60 * 1000

interface ScoreDiffModalProps {
  open: boolean
  onClose: () => void
  fismasystemid: number
  systemName: string
  systemAcronym: string
}

const ScoreDiffModal: React.FC<ScoreDiffModalProps> = ({
  open,
  onClose,
  fismasystemid,
  systemName,
  systemAcronym,
}) => {
  const [datacalls, setDatacalls] = useState<datacall[]>([])
  const [fromDatacall, setFromDatacall] = useState<datacall | null>(null)
  const [toDatacall, setToDatacall] = useState<datacall | null>(null)
  const [diffResults, setDiffResults] = useState<ScoreDiffEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const initialFocusRef = useRef<HTMLButtonElement>(null)

  // Focus close button on open for accessibility
  useEffect(() => {
    if (open && initialFocusRef.current) {
      const timer = setTimeout(() => {
        initialFocusRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [open])

  // Fetch datacalls with cache; set defaults on first open
  useEffect(() => {
    if (!open) return
    const fetchDatacalls = async () => {
      try {
        const now = Date.now()
        let sorted: datacall[]
        if (
          datacallsCache.data &&
          datacallsCache.timestamp &&
          now - datacallsCache.timestamp < CACHE_DURATION
        ) {
          sorted = datacallsCache.data
        } else {
          const res = await axiosInstance.get('/datacalls')
          sorted = [...res.data.data].sort(
            (a: datacall, b: datacall) => b.datacallid - a.datacallid
          )
          datacallsCache.data = sorted
          datacallsCache.timestamp = now
        }
        setDatacalls(sorted)
        setToDatacall(sorted[0] ?? null)
        setFromDatacall(sorted[1] ?? null)
      } catch (err) {
        if (isAuthHandled(err)) return
        console.error('Error fetching datacalls:', err)
      }
    }
    fetchDatacalls()
  }, [open])

  // Fetch diff whenever both pickers are set and different
  useEffect(() => {
    if (!fromDatacall || !toDatacall) return
    if (fromDatacall.datacallid === toDatacall.datacallid) return

    setLoading(true)
    setError(null)
    setDiffResults([])

    axiosInstance
      .get(
        `/scores/diff?from=${fromDatacall.datacallid}&to=${toDatacall.datacallid}&fismasystemid=${fismasystemid}`
      )
      .then((res) => {
        setDiffResults(res.data.data ?? [])
      })
      .catch((err) => {
        if (isAuthHandled(err)) return
        setError('Failed to load diff. Please try again.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [fromDatacall, toDatacall, fismasystemid])

  const renderOption = (
    props: React.HTMLAttributes<HTMLLIElement> & { key?: React.Key },
    option: datacall,
    latestId: number
  ) => {
    const isCurrent = option.datacallid === latestId
    const isClosed = new Date() > new Date(option.deadline)
    const { key, ...rest } = props
    const deadlineLabel = new Date(option.deadline).toLocaleDateString(
      'en-US',
      { month: 'short', day: 'numeric', year: 'numeric' }
    )
    return (
      <li key={key} {...rest}>
        <Box sx={{ width: '100%' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              gap: 1,
            }}
          >
            <Typography variant="body2">{option.datacall}</Typography>
            {isCurrent && (
              <Chip
                label="Current"
                size="small"
                variant="outlined"
                color="primary"
                sx={{ height: 18, fontSize: '0.65rem' }}
              />
            )}
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {isClosed ? 'Closed' : 'Active'} · deadline {deadlineLabel}
          </Typography>
        </Box>
      </li>
    )
  }

  const latestId = datacalls[0]?.datacallid ?? -1

  const renderSide = (side: ScoreDiffEntry['from'], label: string) => {
    if (!side) {
      return (
        <em style={{ color: '#666' }}>
          {label === 'from' ? 'Not answered' : 'Removed'}
        </em>
      )
    }
    return (
      <>
        <Typography variant="body2">{side.optionname}</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          score {side.score}/5
        </Typography>
      </>
    )
  }

  const renderNotes = (entry: ScoreDiffEntry) => {
    const fromNotes = entry.from?.notes ?? ''
    const toNotes = entry.to?.notes ?? ''
    if (fromNotes === toNotes) return '—'
    return (
      <Box>
        {fromNotes && (
          <Typography variant="caption" display="block">
            From: {fromNotes}
          </Typography>
        )}
        {toNotes && (
          <Typography variant="caption" display="block">
            To: {toNotes}
          </Typography>
        )}
      </Box>
    )
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      aria-labelledby="score-diff-modal-title"
      aria-describedby="score-diff-modal-description"
    >
      <DialogTitle>
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          position="relative"
        >
          <Typography
            variant="h2"
            sx={{ textAlign: 'center', flex: 1, fontSize: '1.25rem' }}
            id="score-diff-modal-title"
          >
            {systemName} ({systemAcronym}) — Compare Datacalls
          </Typography>
          <IconButton
            ref={initialFocusRef}
            onClick={onClose}
            size="small"
            sx={{ position: 'absolute', right: 0 }}
            aria-label="Close compare datacalls dialog"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box
          id="score-diff-modal-description"
          sx={{
            position: 'absolute',
            left: '-10000px',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
          }}
        >
          <Typography component="p">
            This dialog compares questionnaire answers between two data calls
            for {systemName}, showing functions whose answers changed and who
            made each change.
          </Typography>
        </Box>

        {/* Picker row */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            mb: 2,
            flexWrap: 'wrap',
          }}
        >
          <Box sx={{ flex: 1, minWidth: 220 }}>
            <Typography
              variant="caption"
              sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}
            >
              From
            </Typography>
            <Autocomplete
              size="small"
              options={datacalls}
              getOptionLabel={(dc) => dc.datacall}
              isOptionEqualToValue={(opt, val) =>
                opt.datacallid === val.datacallid
              }
              getOptionDisabled={(opt) =>
                opt.datacallid === toDatacall?.datacallid
              }
              value={fromDatacall ?? undefined}
              onChange={(_, dc) => {
                if (dc) setFromDatacall(dc)
              }}
              renderOption={(props, option) =>
                renderOption(props, option, latestId)
              }
              disableClearable
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  inputProps={{
                    ...params.inputProps,
                    'aria-label': 'From datacall',
                  }}
                />
              )}
            />
          </Box>

          <ArrowForwardIcon sx={{ mt: 2.5, color: 'text.secondary' }} />

          <Box sx={{ flex: 1, minWidth: 220 }}>
            <Typography
              variant="caption"
              sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}
            >
              To
            </Typography>
            <Autocomplete
              size="small"
              options={datacalls}
              getOptionLabel={(dc) => dc.datacall}
              isOptionEqualToValue={(opt, val) =>
                opt.datacallid === val.datacallid
              }
              getOptionDisabled={(opt) =>
                opt.datacallid === fromDatacall?.datacallid
              }
              value={toDatacall ?? undefined}
              onChange={(_, dc) => {
                if (dc) setToDatacall(dc)
              }}
              renderOption={(props, option) =>
                renderOption(props, option, latestId)
              }
              disableClearable
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  inputProps={{
                    ...params.inputProps,
                    'aria-label': 'To datacall',
                  }}
                />
              )}
            />
          </Box>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Results area */}
        {loading && (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress aria-label="Loading diff results" />
          </Box>
        )}

        {!loading && error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading &&
          !error &&
          diffResults.length === 0 &&
          fromDatacall &&
          toDatacall && (
            <Box textAlign="center" py={4}>
              <Typography variant="body1" color="text.secondary">
                No changes between these two datacalls.
              </Typography>
            </Box>
          )}

        {!loading && !error && diffResults.length > 0 && (
          <TableContainer
            component={Paper}
            aria-label="Questionnaire diff results"
          >
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#004297' }}>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>
                    Function
                  </TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>
                    Question
                  </TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>
                    From answer
                  </TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>
                    To answer
                  </TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>
                    Notes
                  </TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>
                    Changed by
                  </TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>
                    Changed at
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {diffResults.map((entry) => (
                  <TableRow
                    key={entry.functionid}
                    sx={{
                      '&:nth-of-type(even)': { backgroundColor: '#f5f5f5' },
                    }}
                  >
                    <TableCell component="th" scope="row">
                      <Typography variant="body2" fontWeight={500}>
                        {entry.function}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 240 }}>
                      <Tooltip title={entry.question} placement="top">
                        <Typography
                          variant="body2"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: 240,
                            cursor: 'default',
                          }}
                        >
                          {entry.question}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>{renderSide(entry.from, 'from')}</TableCell>
                    <TableCell>{renderSide(entry.to, 'to')}</TableCell>
                    <TableCell sx={{ maxWidth: 200 }}>
                      {renderNotes(entry)}
                    </TableCell>
                    <TableCell>
                      {entry.changed_by
                        ? `${entry.changed_by.name} (${entry.changed_by.role})`
                        : 'Unknown'}
                    </TableCell>
                    <TableCell>
                      {entry.changed_at
                        ? new Date(entry.changed_at).toLocaleDateString(
                            'en-US',
                            {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            }
                          )
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>

      <DialogActions>
        <CmsButton onClick={onClose}>Close</CmsButton>
      </DialogActions>
    </Dialog>
  )
}

export default ScoreDiffModal
