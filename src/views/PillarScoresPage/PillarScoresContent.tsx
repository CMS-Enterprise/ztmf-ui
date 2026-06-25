import React, { useState, useEffect, useMemo } from 'react'
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Collapse,
  Button,
  Grid,
} from '@mui/material'
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
import type { ScoreAggregate } from '@/types'
import { styleForTier, TIER_STYLES } from '@/utils/tierStyles'

// Static cache for datacalls that persists across component instances.
const datacallsCache: { data: DataCall[] | null; timestamp: number | null } = {
  data: null,
  timestamp: null,
}

interface DataCall {
  datacallid: number
  datacall: string
  datecreated: string
  deadline: string
}

/** Props for {@link PillarScoresContent}. */
export interface PillarScoresContentProps {
  /** Score aggregates for the system across one or more datacalls. */
  scores: ScoreAggregate[]
  /** The datacall to show as the current period. */
  selectedDataCallId: number
}

// Background color when the API has not returned a tier for a score. Matches
// the Not Assessed pastel so a missing-tier cell reads as "no data".
const FALLBACK_BACKGROUND = TIER_STYLES['Not Assessed'].backgroundColor

/**
 * The pillar-scores read-out: overall score, per-pillar cards with trends, a
 * radar chart of this system's pillars across datacalls, and an accessible
 * data-table alternative. Extracted from the former modal so it can render as
 * a full page. All trends compare datacalls this system actually has; there is
 * no fabricated OpDiv-average overlay.
 * @param {PillarScoresContentProps} props - Scores and the current datacall id.
 * @returns {JSX.Element} The pillar-scores content block.
 */
const PillarScoresContent: React.FC<PillarScoresContentProps> = ({
  scores,
  selectedDataCallId,
}) => {
  const [datacalls, setDatacalls] = useState<DataCall[]>([])
  const [showDataTable, setShowDataTable] = useState(false)

  // Use the selected datacall if present, otherwise the highest datacallid.
  const latestScore =
    scores.length > 0
      ? scores.find((s) => s.datacallid === selectedDataCallId) ??
        scores.reduce((latest, current) =>
          current.datacallid > latest.datacallid ? current : latest
        )
      : null

  const hasValidData =
    latestScore &&
    latestScore.pillarscores &&
    latestScore.pillarscores.length > 0

  const radarData = useMemo(() => {
    if (!hasValidData || !latestScore?.pillarscores) return []
    const previousDatacall = scores
      .filter((s) => s.datacallid < latestScore.datacallid)
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

  useEffect(() => {
    const controller = new AbortController()
    const fetchDatacalls = async () => {
      try {
        const now = Date.now()
        const CACHE_DURATION = 10 * 60 * 1000
        if (
          datacallsCache.data &&
          datacallsCache.timestamp &&
          now - datacallsCache.timestamp < CACHE_DURATION
        ) {
          setDatacalls(datacallsCache.data)
        } else {
          const response = await axiosInstance.get('/datacalls', {
            signal: controller.signal,
          })
          const datacallsData = response.data.data
          setDatacalls(datacallsData)
          datacallsCache.data = datacallsData
          datacallsCache.timestamp = now
        }
      } catch (error) {
        if (controller.signal.aborted) return
        console.error('Error fetching datacalls:', error)
      }
    }
    fetchDatacalls()
    return () => {
      controller.abort()
    }
  }, [])

  const getQuarterName = (datacallid: number) => {
    const datacall = datacalls.find((dc) => dc.datacallid === datacallid)
    return datacall ? datacall.datacall : `Datacall ${datacallid}`
  }

  const getTrendInfo = (currentScore: number, previousScore: number | null) => {
    if (previousScore === null) return { color: '#525252', trend: '', text: '' }
    const difference = currentScore - previousScore
    const percentChange = ((difference / previousScore) * 100).toFixed(1)
    if (Math.abs(difference) < 0.05) {
      return {
        color: '#8B4513',
        trend: 'No change',
        text: `No significant change (${Number(percentChange) >= 0 ? '+' : ''}${percentChange}%)`,
      }
    } else if (difference > 0) {
      return {
        color: '#0F5C4C',
        trend: 'Up',
        text: `Improved by ${difference.toFixed(2)} (+${percentChange}%)`,
      }
    } else {
      return {
        color: '#9B2E1E',
        trend: 'Down',
        text: `Decreased by ${Math.abs(difference).toFixed(2)} (${percentChange}%)`,
      }
    }
  }

  if (!hasValidData) {
    return (
      <Box textAlign="center" py={6}>
        <Typography
          variant="h3"
          color="text.secondary"
          gutterBottom
          sx={{ fontSize: '1.25rem' }}
        >
          No score data available
        </Typography>
        <Typography variant="body1" color="text.secondary">
          This system does not have any scoring data yet. Please check back
          after the next evaluation period.
        </Typography>
      </Box>
    )
  }

  return (
    <Box>
      {/* Overall System Score */}
      <Box mb={3} textAlign="center">
        <Typography variant="h3" sx={{ fontSize: '1.25rem' }} gutterBottom>
          Overall score
        </Typography>
        <Box
          sx={{
            p: 2,
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            backgroundColor: latestScore.systemscore
              ? styleForTier(latestScore.systemtier)?.backgroundColor ??
                FALLBACK_BACKGROUND
              : FALLBACK_BACKGROUND,
            maxWidth: '320px',
            margin: '0 auto',
          }}
          role="region"
          aria-label={`Overall system score: ${latestScore.systemscore?.toFixed(2) || 'N/A'}`}
        >
          <Typography
            variant="h4"
            fontWeight="bold"
            mb={0.5}
            sx={{ fontSize: '2.125rem' }}
          >
            {latestScore.systemscore?.toFixed(2) || 'N/A'}
          </Typography>
          {latestScore.systemtier && (
            <Typography
              variant="body1"
              sx={{
                color: TIER_STYLES[latestScore.systemtier].color,
                fontWeight: 'bold',
                fontSize: '1rem',
              }}
            >
              {latestScore.systemtier}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Pillar Scores */}
      <Typography
        variant="h3"
        gutterBottom
        sx={{ mt: 3, mb: 1.5, textAlign: 'center', fontSize: '1.25rem' }}
      >
        Pillar scores - {getQuarterName(latestScore.datacallid)}
      </Typography>
      <Grid container spacing={2}>
        {(latestScore.pillarscores ?? []).map((pillar) => {
          const previousDatacall = scores
            .filter((s) => s.datacallid < latestScore.datacallid)
            .sort((a, b) => b.datacallid - a.datacallid)[0]
          const previousPillarScore = previousDatacall?.pillarscores?.find(
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
                  borderColor: 'divider',
                  borderRadius: 1.5,
                  textAlign: 'center',
                  height: '100%',
                  backgroundColor:
                    currentScore > 0
                      ? styleForTier(pillar.tier)?.backgroundColor ??
                        FALLBACK_BACKGROUND
                      : FALLBACK_BACKGROUND,
                }}
                role="region"
                aria-label={`${pillar.pillar} pillar score: ${currentScore > 0 ? currentScore.toFixed(2) : 'N/A'}`}
              >
                <Typography
                  variant="h4"
                  fontWeight="bold"
                  gutterBottom
                  sx={{ fontSize: '0.9rem' }}
                >
                  {pillar.pillar}
                </Typography>
                <Typography
                  variant="h4"
                  fontWeight="bold"
                  sx={{ fontSize: '1.5rem' }}
                >
                  {currentScore > 0 ? currentScore.toFixed(2) : 'N/A'}
                </Typography>
                {pillar.tier && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: TIER_STYLES[pillar.tier].color,
                      fontWeight: 'bold',
                      fontSize: '0.8rem',
                      display: 'block',
                    }}
                  >
                    {pillar.tier}
                  </Typography>
                )}
                {previousPillarScore && currentScore > 0 && (
                  <Typography
                    variant="caption"
                    sx={{ color: trendInfo.color, fontSize: '0.7rem' }}
                  >
                    {trendInfo.text
                      .replace('Improved by ', '+')
                      .replace('Decreased by ', '-')
                      .split('(')[0]
                      .trim()}
                  </Typography>
                )}
              </Box>
            </Grid>
          )
        })}
      </Grid>

      {/* Radar Chart */}
      <Box mt={4}>
        <Typography
          variant="h3"
          gutterBottom
          sx={{ textAlign: 'center', mb: 2, fontSize: '1.25rem' }}
        >
          Pillar scores radar
        </Typography>
        <Box
          role="img"
          aria-label={`Radar chart showing pillar scores. Current scores: ${radarData.map((d) => `${d.pillar}: ${d.current.toFixed(2)}`).join(', ')}`}
        >
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
              <PolarGrid />
              <PolarAngleAxis dataKey="pillar" />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 5]}
                tick={{ fontSize: 12 }}
                tickCount={6}
              />
              <Radar
                name="Current"
                dataKey="current"
                stroke="#1B4DAB"
                fill="#1B4DAB"
                fillOpacity={0.25}
                strokeWidth={2}
              />
              {scores.length > 1 && (
                <Radar
                  name="Previous"
                  dataKey="previous"
                  stroke="#9AA3B2"
                  fill="#9AA3B2"
                  fillOpacity={0.18}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
              )}
              <Legend />
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
        <Box mt={3} textAlign="center">
          <Button
            onClick={() => setShowDataTable(!showDataTable)}
            variant="outlined"
            color="primary"
            size="small"
            aria-expanded={showDataTable}
            aria-controls="pillar-data-table"
            aria-label={`${showDataTable ? 'Hide' : 'Show'} detailed pillar scores data table`}
          >
            {showDataTable ? 'Hide' : 'Show'} data table
          </Button>
          <Collapse in={showDataTable}>
            <TableContainer
              component={Paper}
              id="pillar-data-table"
              variant="outlined"
              sx={{ mt: 2, textAlign: 'left' }}
            >
              <Table aria-label="Pillar scores data">
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <strong>Pillar name</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>Current score</strong>
                    </TableCell>
                    {scores.length > 1 && (
                      <TableCell align="right">
                        <strong>Previous score</strong>
                      </TableCell>
                    )}
                    <TableCell align="right">
                      <strong>Change</strong>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {latestScore?.pillarscores?.map((pillar) => {
                    const previousDatacall = scores
                      .filter((s) => s.datacallid < latestScore.datacallid)
                      .sort((a, b) => b.datacallid - a.datacallid)[0]
                    const previousPillarScore =
                      previousDatacall?.pillarscores?.find(
                        (p) => p.pillarid === pillar.pillarid
                      )?.score
                    const currentScore = pillar.score ?? 0
                    const prevScore = previousPillarScore ?? 0
                    const change = prevScore ? currentScore - prevScore : null
                    const changeColor =
                      change === null
                        ? '#525252'
                        : change >= 0
                          ? '#0F5C4C'
                          : '#9B2E1E'
                    return (
                      <TableRow key={pillar.pillarid}>
                        <TableCell component="th" scope="row">
                          {pillar.pillar}
                        </TableCell>
                        <TableCell align="right">
                          {currentScore > 0 ? currentScore.toFixed(2) : 'N/A'}
                        </TableCell>
                        {scores.length > 1 && (
                          <TableCell align="right">
                            {prevScore > 0 ? prevScore.toFixed(2) : 'N/A'}
                          </TableCell>
                        )}
                        <TableCell align="right">
                          {change !== null ? (
                            <span style={{ color: changeColor }}>
                              {change >= 0 ? '+' : ''}
                              {change.toFixed(2)}
                            </span>
                          ) : (
                            'N/A'
                          )}
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
  )
}

export default PillarScoresContent
