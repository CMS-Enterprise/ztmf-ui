import React, { useState, useEffect, useRef, useMemo } from 'react'
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
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { Button as CmsButton } from '@cmsgov/design-system'
import axiosInstance from '@/axiosConfig'
import { isAuthHandled } from '@/utils/notify'
import { PILLAR_ORDER, PILLAR_FUNCTION_MAP } from '@/constants'
import type {
  datacall,
  ScoreDiffEntry,
  FismaQuestion,
  questionPillar,
} from '@/types'

const datacallsCache: { data: datacall[] | null; timestamp: number | null } = {
  data: null,
  timestamp: null,
}

const questionsCache = new Map<
  number,
  { data: FismaQuestion[]; timestamp: number }
>()
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
  const [functionPillarMap, setFunctionPillarMap] = useState<
    Map<number, questionPillar>
  >(new Map())
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

  // Fetch function→pillar map for the current system (used to group diff rows)
  useEffect(() => {
    if (!open || !fismasystemid) return
    const fetchQuestions = async () => {
      try {
        const now = Date.now()
        const cached = questionsCache.get(fismasystemid)
        let questions: FismaQuestion[]
        if (cached && now - cached.timestamp < CACHE_DURATION) {
          questions = cached.data
        } else {
          const res = await axiosInstance.get(
            `/fismasystems/${fismasystemid}/questions`
          )
          questions = res.data?.data ?? []
          questionsCache.set(fismasystemid, { data: questions, timestamp: now })
        }
        const map = new Map<number, questionPillar>()
        questions.forEach((q: FismaQuestion) => {
          if (!map.has(q.function.functionid)) {
            map.set(q.function.functionid, q.pillar)
          }
        })
        setFunctionPillarMap(map)
      } catch (err) {
        if (isAuthHandled(err)) return
        console.error('Error fetching questions for pillar grouping:', err)
      }
    }
    fetchQuestions()
  }, [open, fismasystemid])

  // Group and sort diff results by pillar order.
  // Falls back to a flat list under a single group when pillar info
  // is not yet available (e.g. questions fetch still in-flight).
  const groupedResults = useMemo(() => {
    if (diffResults.length === 0) return []
    type PillarGroup = { pillar: questionPillar; entries: ScoreDiffEntry[] }
    const groups = new Map<number, PillarGroup>()
    const uncategorized: ScoreDiffEntry[] = []
    diffResults.forEach((entry) => {
      const pillar = functionPillarMap.get(entry.functionid)
      if (!pillar) {
        uncategorized.push(entry)
        return
      }
      if (!groups.has(pillar.pillarid)) {
        groups.set(pillar.pillarid, { pillar, entries: [] })
      }
      groups.get(pillar.pillarid)!.entries.push(entry)
    })
    const pillarRank = (name: string) => {
      const i = PILLAR_ORDER.indexOf(name)
      return i === -1 ? Number.MAX_SAFE_INTEGER : i
    }
    const fnRank = (pillarName: string, fnName: string) => {
      const i = (PILLAR_FUNCTION_MAP[pillarName] ?? []).indexOf(fnName)
      return i === -1 ? Number.MAX_SAFE_INTEGER : i
    }
    const sorted = Array.from(groups.values()).sort(
      (a, b) => pillarRank(a.pillar.pillar) - pillarRank(b.pillar.pillar)
    )
    sorted.forEach((group) => {
      group.entries.sort(
        (a, b) =>
          fnRank(group.pillar.pillar, a.function) -
          fnRank(group.pillar.pillar, b.function)
      )
    })
    if (uncategorized.length > 0) {
      sorted.push({
        pillar: { pillar: 'Other', pillarid: -1, order: 999 },
        entries: uncategorized,
      })
    }
    return sorted
  }, [diffResults, functionPillarMap])

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

  const renderSide = (side: ScoreDiffEntry['from']) => {
    if (!side) {
      return <em style={{ color: '#666' }}>{'No answer'}</em>
    }
    return (
      <>
        <Typography variant="body2">{side.optionname}</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          score {side.score}/5
        </Typography>
        {side.notes && (
          <Typography
            variant="caption"
            display="block"
            sx={{ color: 'text.secondary', fontStyle: 'italic', mt: 0.5 }}
          >
            {side.notes}
          </Typography>
        )}
      </>
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

        {/* Picker row — hidden behind a spinner until datacalls are loaded */}
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
                    {entries.map((entry) => (
                      <TableRow
                        key={entry.functionid}
                        sx={{
                          '&:nth-of-type(even)': {
                            backgroundColor: '#f5f5f5',
                          },
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
                        <TableCell>{renderSide(entry.from)}</TableCell>
                        <TableCell>{renderSide(entry.to)}</TableCell>
                        <TableCell>
                          {entry.changed_by
                            ? `${entry.changed_by.name} (${entry.changed_by.role})`
                            : 'Unknown'}
                        </TableCell>
                        <TableCell>
                          {entry.changed_at
                            ? new Date(entry.changed_at).toLocaleString(
                                'en-US',
                                {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                }
                              )
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
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
