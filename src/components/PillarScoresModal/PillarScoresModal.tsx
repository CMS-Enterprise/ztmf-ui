import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Chip,
  IconButton,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import CloseIcon from '@mui/icons-material/Close'
import { Button as CmsButton } from '@cmsgov/design-system'
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

const getPillarColor = (score: number) => {
  if (score >= 1 && score <= 1.74) return '#DAA9EC'
  if (score >= 1.75 && score <= 2.74) return '#FFD5A5'
  if (score >= 2.75 && score <= 3.65) return '#F2FBC4'
  if (score >= 3.66) return '#93F0ED'
  return '#f5f5f5'
}

const PillarScoresModal: React.FC<PillarScoresModalProps> = ({
  open,
  onClose,
  systemName,
  systemAcronym,
  scores,
}) => {
  const [datacalls, setDatacalls] = useState<DataCall[]>([])

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
        color: '#FFA726',
        trend: '→',
        text: `No significant change (${Number(percentChange) >= 0 ? '+' : ''}${percentChange}%)`,
      }
    } else if (difference > 0) {
      return {
        color: '#66BB6A',
        trend: '↗',
        text: `Improved by ${difference.toFixed(2)} (+${percentChange}%)`,
      }
    } else {
      return {
        color: '#EF5350',
        trend: '↘',
        text: `Decreased by ${Math.abs(difference).toFixed(2)} (${percentChange}%)`,
      }
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            {systemName} ({systemAcronym})
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {hasValidData ? (
          <Box>
            {/* Overall System Score */}
            <Box mb={3} textAlign="center">
              <Typography variant="h4" gutterBottom>
                Overall Score
              </Typography>
              <Chip
                label={latestScore.systemscore?.toFixed(2) || 'N/A'}
                sx={{
                  backgroundColor: latestScore.systemscore
                    ? getPillarColor(latestScore.systemscore)
                    : '#f5f5f5',
                  fontSize: '1.5rem',
                  height: '60px',
                  width: '120px',
                  borderRadius: '12px',
                  fontWeight: 'bold',
                }}
              />
            </Box>

            {/* Pillar Scores */}
            <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2 }}>
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
                  <Grid item xs={12} sm={6} md={4} key={pillar.pillarid}>
                    <Box
                      sx={{
                        p: 2,
                        border: 1,
                        borderColor: 'darkgray',
                        borderRadius: 2,
                        textAlign: 'center',
                        backgroundColor: getPillarColor(currentScore),
                      }}
                    >
                      <Typography
                        variant="subtitle1"
                        fontWeight="bold"
                        gutterBottom
                      >
                        {pillar.pillar}
                      </Typography>

                      <Box
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        gap={1}
                        mb={1}
                      >
                        <Typography variant="h4" fontWeight="bold">
                          {currentScore > 0 ? currentScore.toFixed(2) : 'N/A'}
                        </Typography>
                        {trendInfo.trend && currentScore > 0 && (
                          <Typography
                            variant="h6"
                            sx={{
                              color: trendInfo.color,
                              fontWeight: 'bold',
                              fontSize: '1.2rem',
                            }}
                          >
                            {trendInfo.trend}
                          </Typography>
                        )}
                      </Box>

                      {previousPillarScore && currentScore > 0 && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'text.secondary',
                            fontSize: '0.9rem',
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
                            fontSize: '0.9rem',
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
                            fontSize: '0.8rem',
                            fontWeight: '500',
                            mt: 0.5,
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

            {/* Historical Data if multiple datacalls */}
            {scores.length > 1 && (
              <Box mt={4}>
                <Typography variant="h6" gutterBottom>
                  Historical Scores
                </Typography>
                {scores
                  .sort((a, b) => b.datacallid - a.datacallid)
                  .map((score, index, sortedScores) => {
                    const previousScore =
                      index < sortedScores.length - 1
                        ? sortedScores[index + 1].systemscore
                        : null
                    const currentSystemScore = score.systemscore ?? 0
                    const trendInfo = getTrendInfo(
                      currentSystemScore,
                      previousScore
                    )

                    return (
                      <Box
                        key={score.datacallid}
                        mb={3}
                        sx={{
                          p: 2,
                          border: 1,
                          borderColor: 'grey.300',
                          borderRadius: 1,
                        }}
                      >
                        <Box display="flex" alignItems="center" gap={2} mb={1}>
                          <Typography
                            variant="subtitle1"
                            sx={{ minWidth: '140px', fontSize: '1.1rem' }}
                          >
                            {getQuarterName(score.datacallid)}:
                          </Typography>
                          <Typography
                            variant="subtitle1"
                            sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}
                          >
                            Overall Score{' '}
                            {currentSystemScore > 0
                              ? currentSystemScore.toFixed(2)
                              : 'N/A'}
                          </Typography>
                          {trendInfo.trend && currentSystemScore > 0 && (
                            <Typography
                              variant="h6"
                              sx={{
                                color: trendInfo.color,
                                fontWeight: 'bold',
                                fontSize: '1.5rem',
                              }}
                              aria-label={`Trend: ${trendInfo.text}`}
                            >
                              {trendInfo.trend}
                            </Typography>
                          )}
                        </Box>
                        {trendInfo.text && currentSystemScore > 0 && (
                          <Typography
                            variant="body2"
                            sx={{
                              color: trendInfo.color,
                              ml: 2,
                              fontSize: '1rem',
                              fontWeight: '500',
                            }}
                          >
                            {trendInfo.text}
                          </Typography>
                        )}
                        {currentSystemScore === 0 && (
                          <Typography
                            variant="body2"
                            sx={{
                              color: 'text.secondary',
                              ml: 2,
                              fontSize: '1rem',
                              fontStyle: 'italic',
                            }}
                          >
                            No score data available for this period
                          </Typography>
                        )}
                      </Box>
                    )
                  })}
              </Box>
            )}
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
