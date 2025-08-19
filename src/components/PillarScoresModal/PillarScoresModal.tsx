import React, { useState, useEffect, useMemo, useRef } from 'react'
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
  Collapse,
  Button,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import CloseIcon from '@mui/icons-material/Close'
import { Button as CmsButton } from '@cmsgov/design-system'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts'
import axiosInstance from '@/axiosConfig'

// Static cache for datacalls that persists across component instances
const datacallsCache: { data: DataCall[] | null; timestamp: number | null } = {
  data: null,
  timestamp: null,
}

interface PillarScore {
  pillarid: number
  pillar: string
  score: number
}

interface SystemScore {
  datacallid: number
  fismasystemid: number
  systemscore: number
  pillarscores: PillarScore[]
}

interface DataCall {
  datacallid: number
  datacall: string
  datecreated: string
  deadline: string
}

interface PillarScoresModalProps {
  open: boolean
  onClose: () => void
  systemName: string
  systemAcronym: string
  scores: SystemScore[]
}

const getMaturityLevel = (score: number) => {
  if (score >= 3.66)
    return {
      name: 'Optimal',
      color: '#0F5C4C', // Dark teal text
      backgroundColor: '#E8F8F6', // Very light teal background
    }
  if (score >= 2.75)
    return {
      name: 'Advanced',
      color: '#8B8000', // Dark yellow/gold text
      backgroundColor: '#FEFEF0', // Very light yellow background
    }
  if (score >= 1.75)
    return {
      name: 'Initial',
      color: '#CC5500', // Dark orange text
      backgroundColor: '#FFF4E6', // Very light orange background
    }
  if (score >= 1)
    return {
      name: 'Traditional',
      color: '#663399', // Dark purple text
      backgroundColor: '#F3F0FF', // Very light purple background
    }
  return {
    name: 'No Score',
    color: '#666666', // Gray text
    backgroundColor: '#F8F8F8', // Light gray background
  }
}

const PillarScoresModal: React.FC<PillarScoresModalProps> = ({
  open,
  onClose,
  systemName,
  systemAcronym,
  scores,
}) => {
  const [datacalls, setDatacalls] = useState<DataCall[]>([])
  const [showDataTable, setShowDataTable] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const initialFocusRef = useRef<HTMLButtonElement>(null)

  // Get the latest datacall (highest datacallid)
  const latestScore =
    scores.length > 0
      ? scores.reduce((latest, current) =>
          current.datacallid > latest.datacallid ? current : latest
        )
      : null

  // Check if we have any valid score data
  const hasValidData =
    latestScore &&
    latestScore.pillarscores &&
    latestScore.pillarscores.length > 0

  // Prepare radar chart data
  const radarData = useMemo(() => {
    if (!hasValidData) return []

    const previousDatacall = scores
      .filter((s) => s.datacallid !== latestScore.datacallid)
      .sort((a, b) => b.datacallid - a.datacallid)[0]

    return latestScore.pillarscores.map((pillar) => {
      const previousPillarScore = previousDatacall?.pillarscores?.find(
        (p) => p.pillarid === pillar.pillarid
      )?.score

      return {
        pillar: pillar.pillar,
        current: pillar.score ?? 0,
        previous: previousPillarScore ?? 0,
      }
    })
  }, [scores, latestScore, hasValidData])

  // Fetch datacalls when modal opens (with caching)
  useEffect(() => {
    if (open) {
      const fetchDatacalls = async () => {
        try {
          const now = Date.now()
          const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes for datacalls

          // Check if cache is still valid
          if (
            datacallsCache.data &&
            datacallsCache.timestamp &&
            now - datacallsCache.timestamp < CACHE_DURATION
          ) {
            setDatacalls(datacallsCache.data)
          } else {
            // Fetch fresh data
            const response = await axiosInstance.get('/datacalls')
            const datacallsData = response.data.data
            setDatacalls(datacallsData)

            // Update cache
            datacallsCache.data = datacallsData
            datacallsCache.timestamp = now
          }
        } catch (error) {
          console.error('Error fetching datacalls:', error)
        }
      }
      fetchDatacalls()
    }
  }, [open])

  // Focus management for accessibility
  useEffect(() => {
    if (open && initialFocusRef.current) {
      // Small delay to ensure modal is fully rendered
      const timer = setTimeout(() => {
        initialFocusRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [open])

  // Helper function to get quarter name by datacallid
  const getQuarterName = (datacallid: number) => {
    const datacall = datacalls.find((dc) => dc.datacallid === datacallid)
    return datacall ? datacall.datacall : `Datacall ${datacallid}`
  }

  // Helper function to get trend information
  const getTrendInfo = (currentScore: number, previousScore: number | null) => {
    if (previousScore === null) return { color: '#666', trend: '', text: '' }

    const difference = currentScore - previousScore
    const percentChange = ((difference / previousScore) * 100).toFixed(1)

    if (Math.abs(difference) < 0.05) {
      return {
        color: '#8B4513',
        trend: '→',
        text: `No significant change (${Number(percentChange) >= 0 ? '+' : ''}${percentChange}%)`,
      }
    } else if (difference > 0) {
      return {
        color: '#0F4A0F',
        trend: '↗',
        text: `Improved by ${difference.toFixed(2)} (+${percentChange}%)`,
      }
    } else {
      return {
        color: '#8B0000',
        trend: '↘',
        text: `Decreased by ${Math.abs(difference).toFixed(2)} (${percentChange}%)`,
      }
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      ref={dialogRef}
      aria-labelledby="pillar-scores-modal-title"
      aria-describedby="pillar-scores-modal-description"
    >
      <DialogTitle>
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          position="relative"
        >
          <Typography
            variant="h6"
            sx={{ textAlign: 'center', flex: 1 }}
            id="pillar-scores-modal-title"
          >
            {systemName} ({systemAcronym}) - Pillar Scores
          </Typography>
          <IconButton
            ref={initialFocusRef}
            onClick={onClose}
            size="small"
            sx={{ position: 'absolute', right: 0 }}
            aria-label="Close pillar scores dialog"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box
          id="pillar-scores-modal-description"
          sx={{
            position: 'absolute',
            left: '-10000px',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
          }}
        >
          <Typography component="p">
            This dialog displays detailed pillar scores for {systemName}{' '}
            including overall system score, individual pillar breakdowns,
            historical trends, and an interactive radar chart visualization. A
            data table alternative is available for screen readers.
          </Typography>
        </Box>
        {hasValidData ? (
          <Box>
            {/* Overall System Score */}
            <Box mb={2} textAlign="center">
              <Typography variant="h5" gutterBottom>
                Overall Score
              </Typography>
              <Box
                sx={{
                  p: 2,
                  border: 1,
                  borderColor: 'darkgray',
                  borderRadius: 2,
                  backgroundColor: latestScore.systemscore
                    ? getMaturityLevel(latestScore.systemscore).backgroundColor
                    : '#F8F8F8',
                  maxWidth: '320px',
                  margin: '0 auto',
                }}
                role="region"
                aria-label={`Overall system score: ${latestScore.systemscore?.toFixed(2) || 'N/A'}`}
              >
                <Box textAlign="center">
                  <Typography variant="h4" fontWeight="bold" mb={0.5}>
                    {latestScore.systemscore?.toFixed(2) || 'N/A'}
                    {latestScore.systemscore && (
                      <Typography
                        component="span"
                        variant="h6"
                        color="text.secondary"
                        sx={{ fontWeight: 'normal' }}
                      >
                        {' / 4'}
                      </Typography>
                    )}
                  </Typography>

                  {/* Maturity Level Display */}
                  {latestScore.systemscore && (
                    <Typography
                      variant="body1"
                      sx={{
                        color: getMaturityLevel(latestScore.systemscore).color,
                        fontWeight: 'bold',
                        fontSize: '1rem',
                        mb: 1,
                      }}
                    >
                      {getMaturityLevel(latestScore.systemscore).name}
                    </Typography>
                  )}
                </Box>

                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  gap={1.5}
                >
                  {(() => {
                    // Find previous system score for trend calculation
                    const previousSystemScore = scores
                      .filter((s) => s.datacallid !== latestScore.datacallid)
                      .sort(
                        (a, b) => b.datacallid - a.datacallid
                      )[0]?.systemscore

                    if (latestScore.systemscore && previousSystemScore) {
                      const trendInfo = getTrendInfo(
                        latestScore.systemscore,
                        previousSystemScore
                      )
                      return (
                        <Typography
                          variant="h5"
                          sx={{
                            color: trendInfo.color,
                            fontWeight: 'bold',
                            fontSize: '1.2rem',
                          }}
                          aria-label={trendInfo.text}
                        >
                          {trendInfo.trend}
                        </Typography>
                      )
                    }
                    return null
                  })()}
                </Box>

                {(() => {
                  // Show previous score and change information
                  const previousSystemScore = scores
                    .filter((s) => s.datacallid !== latestScore.datacallid)
                    .sort((a, b) => b.datacallid - a.datacallid)[0]?.systemscore

                  if (latestScore.systemscore && previousSystemScore) {
                    const trendInfo = getTrendInfo(
                      latestScore.systemscore,
                      previousSystemScore
                    )
                    return (
                      <>
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'text.secondary',
                            fontSize: '0.85rem',
                            mb: 0.3,
                          }}
                        >
                          Previous: {previousSystemScore.toFixed(2)}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            color: trendInfo.color,
                            fontSize: '0.75rem',
                            fontWeight: '500',
                          }}
                        >
                          {trendInfo.text
                            .replace('Improved by ', '+')
                            .replace('Decreased by ', '-')}
                        </Typography>
                      </>
                    )
                  } else if (latestScore.systemscore && !previousSystemScore) {
                    return (
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'text.secondary',
                          fontSize: '0.85rem',
                        }}
                      >
                        No previous data
                      </Typography>
                    )
                  }
                  return null
                })()}
              </Box>
            </Box>

            {/* Pillar Scores */}
            <Typography
              variant="h6"
              gutterBottom
              sx={{ mt: 3, mb: 1.5, textAlign: 'center' }}
            >
              Pillar Scores - {getQuarterName(latestScore.datacallid)} (Latest)
            </Typography>
            <Grid container spacing={2}>
              {latestScore.pillarscores.map((pillar) => {
                // Find previous score for this pillar
                const previousDatacall = scores
                  .filter((s) => s.datacallid !== latestScore.datacallid)
                  .sort((a, b) => b.datacallid - a.datacallid)[0]

                const previousPillarScore =
                  previousDatacall?.pillarscores?.find(
                    (p) => p.pillarid === pillar.pillarid
                  )?.score

                const currentScore = pillar.score ?? 0
                const trendInfo = getTrendInfo(
                  currentScore,
                  previousPillarScore || null
                )

                return (
                  <Grid item xs={6} sm={4} md={2} key={pillar.pillarid}>
                    <Box
                      sx={{
                        p: 1.5,
                        border: 1,
                        borderColor: 'darkgray',
                        borderRadius: 1.5,
                        textAlign: 'center',
                        backgroundColor:
                          currentScore > 0
                            ? getMaturityLevel(currentScore).backgroundColor
                            : '#F8F8F8',
                      }}
                      role="region"
                      aria-label={`${pillar.pillar} pillar score: ${currentScore > 0 ? currentScore.toFixed(2) : 'N/A'}`}
                    >
                      <Typography
                        variant="subtitle2"
                        fontWeight="bold"
                        gutterBottom
                        sx={{ fontSize: '0.9rem' }}
                      >
                        {pillar.pillar}
                      </Typography>

                      <Box
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        gap={0.8}
                        mb={0.8}
                      >
                        <Typography variant="h5" fontWeight="bold">
                          {currentScore > 0 ? currentScore.toFixed(2) : 'N/A'}
                          {currentScore > 0 && (
                            <Typography
                              component="span"
                              variant="body2"
                              color="text.secondary"
                              sx={{ fontWeight: 'normal' }}
                            >
                              {' / 4'}
                            </Typography>
                          )}
                        </Typography>
                        {trendInfo.trend && currentScore > 0 && (
                          <Typography
                            variant="h6"
                            sx={{
                              color: trendInfo.color,
                              fontWeight: 'bold',
                              fontSize: '1rem',
                            }}
                            aria-label={trendInfo.text}
                          >
                            {trendInfo.trend}
                          </Typography>
                        )}
                      </Box>

                      {/* Maturity Level for Pillar */}
                      {currentScore > 0 && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: getMaturityLevel(currentScore).color,
                            fontWeight: 'bold',
                            fontSize: '0.8rem',
                            display: 'block',
                            mb: 0.5,
                          }}
                        >
                          {getMaturityLevel(currentScore).name}
                        </Typography>
                      )}

                      {previousPillarScore && currentScore > 0 && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'text.secondary',
                            fontSize: '0.75rem',
                          }}
                        >
                          Previous: {previousPillarScore.toFixed(2)}
                        </Typography>
                      )}

                      {!previousPillarScore && currentScore > 0 && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'text.secondary',
                            fontSize: '0.75rem',
                          }}
                        >
                          No previous data
                        </Typography>
                      )}

                      {trendInfo.text && currentScore > 0 && (
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            color: trendInfo.color,
                            fontSize: '0.65rem',
                            fontWeight: '500',
                            mt: 0.3,
                          }}
                        >
                          {trendInfo.text
                            .replace('Improved by ', '+')
                            .replace('Decreased by ', '-')}
                        </Typography>
                      )}
                    </Box>
                  </Grid>
                )
              })}
            </Grid>

            {/* Radar Chart */}
            <Box mt={2}>
              <Typography
                variant="h6"
                gutterBottom
                sx={{ textAlign: 'center', mb: 2 }}
              >
                Pillar Scores Radar Chart
              </Typography>
              <Box
                role="img"
                aria-label={`Radar chart showing pillar scores. Current scores: ${radarData.map((d) => `${d.pillar}: ${d.current.toFixed(2)}`).join(', ')}`}
              >
                <ResponsiveContainer width="100%" height={400}>
                  <RadarChart
                    data={radarData}
                    cx="50%"
                    cy="50%"
                    outerRadius="75%"
                  >
                    <PolarGrid />
                    <PolarAngleAxis dataKey="pillar" />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 4]}
                      tick={{ fontSize: 12 }}
                      tickCount={5}
                    />
                    <Radar
                      name="Current"
                      dataKey="current"
                      stroke="#8884d8"
                      fill="#8884d8"
                      fillOpacity={0.3}
                      strokeWidth={2}
                    />
                    {scores.length > 1 && (
                      <Radar
                        name="Previous"
                        dataKey="previous"
                        stroke="#82ca9d"
                        fill="#82ca9d"
                        fillOpacity={0.2}
                        strokeWidth={2}
                        strokeDasharray="5 5"
                      />
                    )}
                    <Legend
                      content={(props) => {
                        const { payload } = props
                        return (
                          <Box
                            display="flex"
                            justifyContent="center"
                            gap={3}
                            mt={2}
                          >
                            {payload?.map((entry, index) => (
                              <Box
                                key={index}
                                display="flex"
                                alignItems="center"
                                gap={1}
                              >
                                <Box
                                  sx={{
                                    width: 12,
                                    height: 12,
                                    backgroundColor: entry.color,
                                    border:
                                      entry.value === 'Previous'
                                        ? '1px dashed'
                                        : 'none',
                                    opacity:
                                      entry.value === 'Previous' ? 0.7 : 0.8,
                                  }}
                                />
                                <Typography
                                  variant="caption"
                                  sx={{ fontSize: '0.875rem' }}
                                >
                                  {entry.value}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        )
                      }}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        value.toFixed(2),
                        name === 'current' ? 'Current Score' : 'Previous Score',
                      ]}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </Box>

              {/* Accessible Data Table Alternative */}
              <Box mt={3}>
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  gap={2}
                  mb={2}
                >
                  <Typography variant="h6">Pillar Scores Data Table</Typography>
                  <Button
                    onClick={() => setShowDataTable(!showDataTable)}
                    variant="outlined"
                    size="small"
                    aria-expanded={showDataTable}
                    aria-controls="pillar-data-table"
                    aria-label={`${showDataTable ? 'Hide' : 'Show'} detailed pillar scores data table`}
                  >
                    {showDataTable ? 'Hide' : 'Show'} Data Table
                  </Button>
                </Box>

                <Collapse in={showDataTable}>
                  <TableContainer
                    component={Paper}
                    id="pillar-data-table"
                    aria-label="Detailed pillar scores comparison table"
                  >
                    <Table aria-label="Pillar scores data">
                      <TableHead>
                        <TableRow>
                          <TableCell>
                            <strong>Pillar Name</strong>
                          </TableCell>
                          <TableCell align="right">
                            <strong>Current Score</strong>
                          </TableCell>
                          {scores.length > 1 && (
                            <TableCell align="right">
                              <strong>Previous Score</strong>
                            </TableCell>
                          )}
                          <TableCell align="right">
                            <strong>Change</strong>
                          </TableCell>
                          <TableCell>
                            <strong>Trend</strong>
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {latestScore?.pillarscores?.map((pillar) => {
                          const previousDatacall = scores
                            .filter(
                              (s) => s.datacallid !== latestScore.datacallid
                            )
                            .sort((a, b) => b.datacallid - a.datacallid)[0]

                          const previousPillarScore =
                            previousDatacall?.pillarscores?.find(
                              (p) => p.pillarid === pillar.pillarid
                            )?.score

                          const currentScore = pillar.score ?? 0
                          const prevScore = previousPillarScore ?? 0
                          const change = prevScore
                            ? currentScore - prevScore
                            : null

                          const trendInfo =
                            currentScore > 0 && prevScore
                              ? getTrendInfo(currentScore, prevScore)
                              : {
                                  trend: '',
                                  text: 'No comparison data',
                                  color: '#666',
                                }

                          return (
                            <TableRow key={pillar.pillarid}>
                              <TableCell component="th" scope="row">
                                {pillar.pillar}
                              </TableCell>
                              <TableCell align="right">
                                {currentScore > 0
                                  ? currentScore.toFixed(2)
                                  : 'N/A'}
                              </TableCell>
                              {scores.length > 1 && (
                                <TableCell align="right">
                                  {prevScore > 0 ? prevScore.toFixed(2) : 'N/A'}
                                </TableCell>
                              )}
                              <TableCell align="right">
                                {change !== null ? (
                                  <span style={{ color: trendInfo.color }}>
                                    {change >= 0 ? '+' : ''}
                                    {change.toFixed(2)}
                                  </span>
                                ) : (
                                  'N/A'
                                )}
                              </TableCell>
                              <TableCell>
                                <span
                                  style={{ color: trendInfo.color }}
                                  aria-label={trendInfo.text}
                                >
                                  {trendInfo.trend}{' '}
                                  {trendInfo.text.split('(')[0].trim()}
                                </span>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Collapse>
              </Box>
            </Box>
          </Box>
        ) : (
          <Box textAlign="center" py={4}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Score Data Available
            </Typography>
            <Typography variant="body1" color="text.secondary">
              This system does not have any scoring data yet. Please check back
              after the next evaluation period.
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <CmsButton onClick={onClose}>Close</CmsButton>
      </DialogActions>
    </Dialog>
  )
}

export default PillarScoresModal
