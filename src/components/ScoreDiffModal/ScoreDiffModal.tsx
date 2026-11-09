import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Box,
  Typography,
  Button,
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
} from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import Modal from '@/components/ui/Modal'
import axiosInstance from '@/axiosConfig'
import { useScoreDiff } from '@/utils/scores'
import { EMPTY_LIST } from '@/utils/emptyList'
import { apiPaths } from '@/api/keys'
import { isAuthHandled } from '@/utils/notify'
import { sortDatacallsByDeadline } from '@/utils/sortDatacallsByDeadline'
import AnswerSideCell from '@/components/AnswerSideCell/AnswerSideCell'
import type { datacall, ScoreDiffEntry } from '@/types'
import { formatDate, formatDateTime } from '@/utils/dates'

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
  selectedDataCallId?: number
}

const ScoreDiffModal: React.FC<ScoreDiffModalProps> = ({
  open,
  onClose,
  fismasystemid,
  systemName,
  systemAcronym,
  selectedDataCallId,
}) => {
  const [datacalls, setDatacalls] = useState<datacall[]>([])
  const [fromDatacall, setFromDatacall] = useState<datacall | null>(null)
  const [toDatacall, setToDatacall] = useState<datacall | null>(null)
  const diffQuery = useScoreDiff(
    fromDatacall?.datacallid,
    toDatacall?.datacallid,
    fismasystemid
  )
  const diffResults = diffQuery.data ?? EMPTY_LIST
  const loading = diffQuery.isPending && diffQuery.isFetching
  const error = diffQuery.isError
    ? 'Failed to load diff. Please try again.'
    : null
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

  // Reopening serves the cached diff, but a failed one is not worth keeping:
  // the modal has no other retry, so without this a transient failure sticks
  // until the pickers change or the page reloads.
  const wasOpen = useRef(open)
  useEffect(() => {
    const reopened = open && !wasOpen.current
    wasOpen.current = open
    if (reopened && diffQuery.isError) void diffQuery.refetch()
  }, [open, diffQuery])

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
          const res = await axiosInstance.get(apiPaths.datacalls.root)
          // Order by deadline (furthest-out first), datacallid only as a
          // tiebreak: historical loads can out-id the real current call (#393).
          sorted = sortDatacallsByDeadline(res.data.data as datacall[])
          datacallsCache.data = sorted
          datacallsCache.timestamp = now
        }
        setDatacalls(sorted)
        const toId = selectedDataCallId
        const toDefault =
          sorted.find((dc) => dc.datacallid === toId) ?? sorted[0] ?? null
        // The default "from" is the call immediately older than "to" - i.e. the
        // next entry in the deadline-sorted list, not the next-lower datacallid.
        const toIndex = sorted.findIndex(
          (dc) => dc.datacallid === toDefault?.datacallid
        )
        const fromDefault = toIndex >= 0 ? sorted[toIndex + 1] ?? null : null
        setToDatacall(toDefault)
        setFromDatacall(fromDefault)
      } catch (err) {
        if (isAuthHandled(err)) return
        console.error('Error fetching datacalls:', err)
      }
    }
    fetchDatacalls()
  }, [open, selectedDataCallId])

  // Group diff results by pillar. Rows arrive in questionnaire order
  // (scorediff.go sorts by pillars.ordr, questions.ordr, functions.ordr,
  // functionid) and carry their own pillar (ztmf-misc#395), so first
  // appearance is pillar order and the two cycles may pin different versions.
  const groupedResults = useMemo(() => {
    type PillarGroup = {
      pillar: { pillarid: number; pillar: string }
      entries: ScoreDiffEntry[]
    }
    const groups = new Map<number, PillarGroup>()
    const uncategorized: ScoreDiffEntry[] = []
    diffResults.forEach((entry) => {
      if (entry.pillarid == null || entry.pillar == null) {
        uncategorized.push(entry)
        return
      }
      if (!groups.has(entry.pillarid)) {
        groups.set(entry.pillarid, {
          pillar: { pillarid: entry.pillarid, pillar: entry.pillar },
          entries: [],
        })
      }
      groups.get(entry.pillarid)!.entries.push(entry)
    })
    const sorted = Array.from(groups.values())
    if (uncategorized.length > 0) {
      sorted.push({
        pillar: { pillar: 'Other', pillarid: -1 },
        entries: uncategorized,
      })
    }
    return sorted
  }, [diffResults])

  // Fetch diff whenever both pickers are set and different.
  const renderOption = (
    props: React.HTMLAttributes<HTMLLIElement> & { key?: React.Key },
    option: datacall,
    latestId: number
  ) => {
    const isLatest = option.datacallid === latestId
    const isClosed = new Date() > new Date(option.deadline)
    const { key, ...rest } = props
    const deadlineLabel = formatDate(option.deadline)
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
            {/* Latest-by-deadline call: "Current" while open, "Latest" once
                its deadline has passed (#393). */}
            {isLatest && (
              <Chip
                label={isClosed ? 'Latest' : 'Current'}
                size="small"
                variant="outlined"
                color={isClosed ? 'default' : 'primary'}
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xxl"
      eyebrow={systemAcronym ? `${systemAcronym} - Compare` : 'Compare'}
      title={`Compare datacalls - ${systemName}`}
      footer={
        <Button
          ref={initialFocusRef}
          variant="contained"
          color="primary"
          onClick={onClose}
        >
          Close
        </Button>
      }
    >
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
          This dialog compares questionnaire answers between two data calls for{' '}
          {systemName}, showing functions whose answers changed and who made
          each change.
        </Typography>
      </Box>

      {/* Picker row - hidden behind a spinner until datacalls are loaded */}
      {datacalls.length === 0 ? (
        <Box display="flex" justifyContent="center" py={2}>
          <CircularProgress size={24} aria-label="Loading datacalls" />
        </Box>
      ) : (
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
      )}

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
                  Changed by
                </TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 700 }}>
                  Changed at
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {groupedResults.map(({ pillar, entries }) => (
                <React.Fragment key={pillar.pillarid}>
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      sx={{
                        backgroundColor: '#e8edf7',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: '#004297',
                        py: 0.75,
                        borderTop: '2px solid #b3c2e8',
                      }}
                    >
                      {pillar.pillar}
                    </TableCell>
                  </TableRow>
                  {entries.map((entry, i) => (
                    <TableRow
                      key={`${entry.functionid}-${i}`}
                      sx={{
                        backgroundColor: i % 2 === 1 ? '#f5f5f5' : 'inherit',
                      }}
                    >
                      <TableCell component="th" scope="row">
                        <Typography variant="body2" fontWeight={500}>
                          {entry.function}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {entry.question}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <AnswerSideCell side={entry.from} />
                      </TableCell>
                      <TableCell>
                        <AnswerSideCell side={entry.to} />
                      </TableCell>
                      <TableCell>
                        {entry.changed_by
                          ? `${entry.changed_by.name} (${entry.changed_by.role})`
                          : 'Unknown'}
                      </TableCell>
                      <TableCell>{formatDateTime(entry.changed_at)}</TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Modal>
  )
}

export default ScoreDiffModal
