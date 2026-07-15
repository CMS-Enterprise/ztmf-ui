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
  FormControl,
  Select,
  MenuItem,
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
import type { ScoreAggregate } from '@/types'
import { tierStyle, TIERS } from '@/utils/tierStyles'
import { sortDatacallsByDeadline } from '@/utils/sortDatacallsByDeadline'
import { parseDatacallName } from '@/utils/datacallGrouping'
import { useContextProp } from '@/views/Title/Context'

interface PillarScoresModalProps {
  open: boolean
  onClose: () => void
  systemName: string
  systemAcronym: string
  scores: ScoreAggregate[]
  selectedDataCallId: number
}

// Background color used when the API has not (yet) returned a tier
// string for this score. Matches TIERS['Not Assessed'] so a
// missing-tier cell visually reads as "no data" rather than a blank.
const FALLBACK_BACKGROUND = TIERS['Not Assessed'].chip.backgroundColor

const PillarScoresModal: React.FC<PillarScoresModalProps> = ({
  open,
  onClose,
  systemName,
  systemAcronym,
  scores,
  selectedDataCallId,
}) => {
  const { datacalls } = useContextProp()
  const [showDataTable, setShowDataTable] = useState(false)
  // undefined = not set by user (use deadline-based default)
  // null      = user explicitly selected "None" (no comparison)
  // number    = user selected a specific datacall
  const [selectedComparisonId, setSelectedComparisonId] = useState<
    number | null | undefined
  >(undefined)
  const dialogRef = useRef<HTMLDivElement>(null)
  const initialFocusRef = useRef<HTMLButtonElement>(null)

  // Data calls this system actually has a score for, deadline-sorted. The
  // comparison must be self-scoped: `datacalls` is the full cross-tenant list
  // (CMS quarterly `FY## Q#` and HHS annual `FY## ZTM` interleaved by deadline),
  // so a raw deadline-neighbor is frequently a call this system can never have
  // scored — e.g. an HHS system's chronological predecessor is a CMS quarterly,
  // which would show "No data" by default. Scoping to scored calls keeps the
  // #393 deadline ordering while restoring the "nearest call this system has
  // data for" comparison semantics.
  const scoredDatacalls = useMemo(
    () =>
      sortDatacallsByDeadline(
        datacalls.filter((dc) =>
          scores.some((s) => s.datacallid === dc.datacallid)
        )
      ),
    [datacalls, scores]
  )

  // Use the selected datacall if it exists in the scores, otherwise fall back
  // to the deadline-latest scored call. scoredDatacalls[0] is furthest-out by
  // deadline (same ordering used everywhere else in this modal), avoiding the
  // "highest datacallid wins" pitfall (#393). When datacalls hasn't loaded yet
  // scoredDatacalls is empty and the expression resolves to null, which is safe.
  const latestScore =
    scores.find((s) => s.datacallid === selectedDataCallId) ??
    scores.find((s) => s.datacallid === scoredDatacalls[0]?.datacallid) ??
    null

  // Check if we have any valid score data
  const hasValidData =
    latestScore &&
    latestScore.pillarscores &&
    latestScore.pillarscores.length > 0

  // Scored calls strictly older than the anchor by deadline — the valid
  // "previous" candidates. Excludes the anchor itself and anything newer, so a
  // comparison always means an earlier submission and the trend wording
  // (improved/declined) points the right way even when the anchor (the row's
  // most-recently-updated call) is not the system's latest call by deadline.
  const olderScoredDatacalls = (() => {
    if (!latestScore) return []
    const idx = scoredDatacalls.findIndex(
      (dc) => dc.datacallid === latestScore.datacallid
    )
    return idx >= 0 ? scoredDatacalls.slice(idx + 1) : []
  })()

  // The scored datacall immediately preceding the current one by deadline order.
  // Tracked separately from its score so we can still label the comparison.
  const previousDatacall = olderScoredDatacalls[0] ?? null

  // Score entry for the previous datacall; null if no submission for that call.
  const previousScoreEntry = previousDatacall
    ? scores.find((s) => s.datacallid === previousDatacall.datacallid) ?? null
    : null

  // Effective comparison entry based on selection state.
  const comparisonScoreEntry =
    selectedComparisonId === undefined
      ? previousScoreEntry
      : selectedComparisonId === null
        ? null
        : scores.find((s) => s.datacallid === selectedComparisonId) ?? null

  // True whenever a comparison is active (default or user-chosen call),
  // false when the user explicitly picked "None" or there is no predecessor
  // at all. Distinguishes "selected a call with no score → show 'No data for <name>'"
  // from "None / no comparison possible → hide entirely".
  const comparisonActive =
    selectedComparisonId !== null &&
    (selectedComparisonId !== undefined || previousDatacall !== null)

  const hasComparisonPillarData =
    (comparisonScoreEntry?.pillarscores?.length ?? 0) > 0

  // Prepare radar chart data
  const radarData = useMemo(() => {
    if (!hasValidData || !latestScore?.pillarscores) return []
    return latestScore.pillarscores.map((pillar) => {
      const comparisonPillarScore = comparisonScoreEntry?.pillarscores?.find(
        (p) => p.pillarid === pillar.pillarid
      )?.score
      return {
        pillar: pillar.pillar,
        current: pillar.score ?? 0,
        previous: comparisonPillarScore ?? 0,
      }
    })
  }, [hasValidData, latestScore, comparisonScoreEntry])

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

  // Reset to default whenever the modal opens or the target system/call changes.
  // Depending on latestScore.datacallid alone misses the case where two different
  // systems share the same active datacall — the stale comparison would persist.
  useEffect(() => {
    if (open) setSelectedComparisonId(undefined)
  }, [open, selectedDataCallId])

  // Returns "{name} · {tenant}" to match the year-grouped selector styling.
  const getQuarterName = (datacallid: number) => {
    const datacall = datacalls.find((dc) => dc.datacallid === datacallid)
    if (!datacall) return `Datacall ${datacallid}`
    const { tenant } = parseDatacallName(datacall.datacall)
    return `${datacall.datacall} · ${tenant}`
  }

  // Show 'Current'/'Previous' until the datacalls fetch resolves so labels
  // don't flash 'Datacall {id}' during the initial load.
  const currentDatacallName =
    latestScore && datacalls.length > 0
      ? getQuarterName(latestScore.datacallid)
      : 'Current'
  // Resolve which datacall id is being compared against — from explicit selection,
  // the default predecessor call, or nothing (None selected).
  const comparisonDatacallId =
    selectedComparisonId === undefined
      ? previousDatacall?.datacallid
      : selectedComparisonId ?? undefined

  const comparisonDatacallName =
    comparisonDatacallId != null && datacalls.length > 0
      ? getQuarterName(comparisonDatacallId)
      : 'Previous'

  // Helper function to get trend information
  const getTrendInfo = (currentScore: number, previousScore: number | null) => {
    if (previousScore === null) return { color: '#525252', trend: '', text: '' }

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
            variant="h2"
            sx={{ textAlign: 'center', flex: 1, fontSize: '1.25rem' }}
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
            {/* Comparison selector — shown whenever other scores exist (synchronous
                check so the picker appears on the first render, not after the
                async datacalls fetch resolves). Dropdown options use
                olderScoredDatacalls (the system's scored calls before the
                anchor) which may briefly be empty while the fetch is in flight. */}
            {scores.length > 1 && (
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                mb={2}
              >
                <Typography variant="body2" color="text.secondary">
                  Viewing: <strong>{currentDatacallName}</strong>
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="body2" color="text.secondary">
                    Compare with:
                  </Typography>
                  <FormControl size="small">
                    <Select
                      value={
                        scoredDatacalls.length === 0
                          ? ''
                          : selectedComparisonId === undefined
                            ? previousDatacall?.datacallid ?? ''
                            : selectedComparisonId ?? ''
                      }
                      onChange={(e) => {
                        const val = e.target.value
                        setSelectedComparisonId(val === '' ? null : Number(val))
                      }}
                      displayEmpty
                      sx={{ minWidth: 160, maxWidth: 260 }}
                    >
                      <MenuItem value="">None</MenuItem>
                      {olderScoredDatacalls.map((dc) => (
                        <MenuItem key={dc.datacallid} value={dc.datacallid}>
                          {getQuarterName(dc.datacallid)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              </Box>
            )}
            {/* Overall System Score */}
            <Box mb={2} textAlign="center">
              <Typography variant="h3" sx={{ fontSize: '1.5rem' }} gutterBottom>
                Overall Score
              </Typography>
              <Box
                sx={{
                  p: 2,
                  border: 1,
                  borderColor: 'darkgray',
                  borderRadius: 2,
                  backgroundColor: latestScore.systemscore
                    ? tierStyle(latestScore.systemtier)?.chip.backgroundColor ??
                      FALLBACK_BACKGROUND
                    : FALLBACK_BACKGROUND,
                  maxWidth: '320px',
                  margin: '0 auto',
                }}
                role="region"
                aria-label={`Overall system score: ${latestScore.systemscore?.toFixed(2) || 'N/A'}`}
              >
                <Box textAlign="center">
                  <Typography
                    variant="h4"
                    fontWeight="bold"
                    mb={0.5}
                    sx={{ fontSize: '2.125rem' }}
                  >
                    {latestScore.systemscore?.toFixed(2) || 'N/A'}
                    {latestScore.systemscore && (
                      <Typography
                        component="span"
                        variant="body1"
                        color="text.secondary"
                        sx={{ fontWeight: 'normal', fontSize: '1.25rem' }}
                      >
                        {' / 5'}
                      </Typography>
                    )}
                  </Typography>

                  {/* Maturity Level Display - keyed on tier presence so
                      an explicit "Not Assessed" with a score of 0 still
                      renders the chip instead of silently disappearing. */}
                  {latestScore.systemtier && (
                    <Typography
                      variant="body1"
                      sx={{
                        color: TIERS[latestScore.systemtier]?.chip.color,
                        fontWeight: 'bold',
                        fontSize: '1rem',
                        mb: 1,
                      }}
                    >
                      {latestScore.systemtier}
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
                    const previousSystemScore =
                      comparisonScoreEntry?.systemscore

                    if (latestScore.systemscore && previousSystemScore) {
                      const trendInfo = getTrendInfo(
                        latestScore.systemscore,
                        previousSystemScore
                      )
                      return (
                        <Typography
                          variant="body1"
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
                  const previousSystemScore = comparisonScoreEntry?.systemscore

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
                          {`Compared with ${comparisonDatacallName}: ${previousSystemScore.toFixed(2)}`}
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
                  } else if (
                    latestScore.systemscore &&
                    comparisonActive &&
                    !previousSystemScore
                  ) {
                    return (
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'text.secondary',
                          fontSize: '0.85rem',
                        }}
                      >
                        No data for {comparisonDatacallName}
                      </Typography>
                    )
                  }
                  return null
                })()}
              </Box>
            </Box>

            {/* Pillar Scores */}
            <Typography
              variant="h3"
              gutterBottom
              sx={{ mt: 3, mb: 1.5, textAlign: 'center', fontSize: '1.25rem' }}
            >
              Pillar Scores - {currentDatacallName}
            </Typography>
            <Grid container spacing={2}>
              {(latestScore.pillarscores ?? []).map((pillar) => {
                const previousPillarScore =
                  comparisonScoreEntry?.pillarscores?.find(
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
                        height: '100%',
                        backgroundColor:
                          currentScore > 0
                            ? tierStyle(pillar.tier)?.chip.backgroundColor ??
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

                      <Box
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        gap={0.8}
                        mb={0.8}
                      >
                        <Typography
                          variant="h4"
                          fontWeight="bold"
                          sx={{ fontSize: '1.5rem' }}
                        >
                          {currentScore > 0 ? currentScore.toFixed(2) : 'N/A'}
                          {currentScore > 0 && (
                            <Typography
                              component="span"
                              variant="body2"
                              color="text.secondary"
                              sx={{ fontWeight: 'normal' }}
                            >
                              {' / 5'}
                            </Typography>
                          )}
                        </Typography>
                        {trendInfo.trend && currentScore > 0 && (
                          <Typography
                            variant="body1"
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

                      {/* Maturity Level for Pillar - keyed on tier
                          presence so an explicit "Not Assessed" with a
                          0 score still renders the chip. */}
                      {pillar.tier && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: TIERS[pillar.tier]?.chip.color,
                            fontWeight: 'bold',
                            fontSize: '0.8rem',
                            display: 'block',
                            mb: 0.5,
                          }}
                        >
                          {pillar.tier}
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
                          {`Compared with ${comparisonDatacallName}: ${previousPillarScore.toFixed(2)}`}
                        </Typography>
                      )}

                      {comparisonActive &&
                        !previousPillarScore &&
                        currentScore > 0 && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'text.secondary',
                              fontSize: '0.75rem',
                            }}
                          >
                            No data for {comparisonDatacallName}
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
                variant="h3"
                gutterBottom
                sx={{ textAlign: 'center', mb: 2, fontSize: '1.25rem' }}
              >
                Pillar Scores Radar Chart
              </Typography>
              <Box
                role="img"
                aria-label={`Radar chart showing pillar scores. ${currentDatacallName} scores: ${radarData.map((d) => `${d.pillar}: ${d.current.toFixed(2)}`).join(', ')}`}
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
                      domain={[0, 5]}
                      tick={{ fontSize: 12 }}
                      tickCount={6}
                    />
                    <Radar
                      name={currentDatacallName}
                      dataKey="current"
                      stroke="#8884d8"
                      fill="#8884d8"
                      fillOpacity={0.3}
                      strokeWidth={2}
                    />
                    {hasComparisonPillarData && (
                      <Radar
                        name={comparisonDatacallName}
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
                                      entry.value === comparisonDatacallName
                                        ? '1px dashed'
                                        : 'none',
                                    opacity:
                                      entry.value === comparisonDatacallName
                                        ? 0.7
                                        : 0.8,
                                  }}
                                />
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontSize: '0.875rem',
                                    maxWidth: 200,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={entry.value}
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
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <Box
                            sx={{
                              backgroundColor: 'background.paper',
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 1,
                              p: 1,
                              maxWidth: 280,
                            }}
                          >
                            <Typography
                              variant="caption"
                              display="block"
                              fontWeight="bold"
                              sx={{
                                mb: 0.5,
                                overflowWrap: 'anywhere',
                              }}
                            >
                              {label}
                            </Typography>
                            {payload.map((entry, i) => (
                              <Typography
                                key={i}
                                variant="caption"
                                display="block"
                                sx={{
                                  color: entry.color,
                                  overflowWrap: 'anywhere',
                                }}
                              >
                                {entry.name}: {Number(entry.value).toFixed(2)}
                              </Typography>
                            ))}
                          </Box>
                        )
                      }}
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
                  <Typography variant="h3" sx={{ fontSize: '1.25rem' }}>
                    Pillar Scores Data Table
                  </Typography>
                  <Button
                    onClick={() => setShowDataTable(!showDataTable)}
                    variant="outlined"
                    size="small"
                    sx={{
                      color: '#3B4DA0',
                      borderColor: '#3B4DA0',
                      '&:hover': {
                        borderColor: '#2E3D7A',
                        color: '#2E3D7A',
                      },
                    }}
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
                            <strong>{currentDatacallName}</strong>
                          </TableCell>
                          {hasComparisonPillarData && (
                            <TableCell align="right">
                              <strong>{comparisonDatacallName}</strong>
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
                          const previousPillarScore =
                            comparisonScoreEntry?.pillarscores?.find(
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
                                  color: '#525252',
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
                              {hasComparisonPillarData && (
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
            <Typography
              variant="h3"
              color="text.secondary"
              gutterBottom
              sx={{ fontSize: '1.25rem' }}
            >
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
