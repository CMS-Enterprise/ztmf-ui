import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { styled } from '@mui/material/styles'
import type { InsightPayload } from '@/types'
import {
  buildInsightJustification,
  priorResponseFor,
} from './justificationContext'

export type PriorReviewState =
  | 'not-required'
  | 'initializing'
  | 'pending'
  | 'accepted'
  | 'dismissed'

type Props = {
  contextId?: string
  label: string
  value: string
  onChange: (value: string) => void
  insight?: InsightPayload
  priorResponse?: { label: string; text: string }
  showInsightSuggestion?: boolean
  viewedDatacall?: string
  priorReviewState: PriorReviewState
  onPriorReview: (state: PriorReviewState) => void
  disabled?: boolean
  error?: boolean
  helperText?: string
  maxLength: number
}

const ResponseTextField = styled(TextField)({
  flex: 1,
  minHeight: 0,
  '& .MuiOutlinedInput-root': {
    height: '100%',
    alignItems: 'flex-start',
    borderRadius: 0,
    '& fieldset': {
      border: 0,
      borderTop: '1px solid #d6d7d9',
    },
    '&.Mui-focused fieldset': {
      border: 0,
      borderTop: '1px solid #d6d7d9',
      boxShadow: 'inset 0 0 0 3px #ffffff, inset 0 0 0 6px #bd13b8',
    },
  },
  '& .MuiInputBase-inputMultiline': {
    height: '100% !important',
    overflow: 'auto !important',
  },
})

function appendText(current: string, addition: string): string {
  if (!current.trim()) return addition
  if (current.includes(addition)) return current
  return `${current.trimEnd()}\n\n${addition}`
}

type TextRange = { start: number; end: number }

function exactTextRange(value: string, text?: string): TextRange | null {
  if (!text) return null
  const start = value.lastIndexOf(text)
  return start < 0 ? null : { start, end: start + text.length }
}

/** Keep an inserted source's range aligned with one textarea replacement. */
function remapTextRange(
  before: string,
  after: string,
  range: TextRange | null
): TextRange | null {
  if (!range || before === after) return range

  let changeStart = 0
  while (
    changeStart < before.length &&
    changeStart < after.length &&
    before[changeStart] === after[changeStart]
  ) {
    changeStart++
  }

  let oldEnd = before.length
  let newEnd = after.length
  while (
    oldEnd > changeStart &&
    newEnd > changeStart &&
    before[oldEnd - 1] === after[newEnd - 1]
  ) {
    oldEnd--
    newEnd--
  }

  const delta = newEnd - oldEnd
  if (oldEnd <= range.start) {
    return { start: range.start + delta, end: range.end + delta }
  }
  if (changeStart >= range.end) return range

  const start = changeStart <= range.start ? changeStart : range.start
  const end = oldEnd >= range.end ? newEnd : range.end + delta
  if (end <= start || !after.slice(start, end).trim()) return null
  return { start, end }
}

function hasTrackedText(value: string, range: TextRange | null): boolean {
  return Boolean(range && value.slice(range.start, range.end).trim())
}

type ContextCardProps = {
  title: string
  author: string
  text: string
  required?: boolean
  state: 'available' | 'accepted' | 'dismissed'
  primaryLabel: string
  primaryAriaLabel: string
  secondaryLabel: string
  secondaryAriaLabel: string
  onPrimary: () => void
  onSecondary: () => void
  onRestore?: () => void
  primaryDisabled?: boolean
  primaryDisabledReason?: string
  primaryDisabledReasonSeverity?: 'error' | 'info'
  disabled?: boolean
}

function ContextCard({
  title,
  author,
  text,
  required,
  state,
  primaryLabel,
  primaryAriaLabel,
  secondaryLabel,
  secondaryAriaLabel,
  onPrimary,
  onSecondary,
  onRestore,
  primaryDisabled,
  primaryDisabledReason,
  primaryDisabledReasonSeverity = 'error',
  disabled,
}: ContextCardProps) {
  const [expanded, setExpanded] = React.useState(false)
  const [canExpand, setCanExpand] = React.useState(false)
  const textRef = React.useRef<HTMLParagraphElement>(null)
  const primaryDisabledReasonId = React.useId()
  const restoreLabel = `Review again: ${title}`
  const expandLabel = `${expanded ? 'Show less' : 'Show all'}: ${title}`
  const statusLabel = state === 'accepted' ? 'Added to response' : 'Not used'

  const measureOverflow = React.useCallback(() => {
    if (state !== 'available' || expanded || !text) return
    const element = textRef.current
    if (!element) return
    setCanExpand(element.scrollHeight > element.clientHeight + 1)
  }, [expanded, state, text])

  React.useLayoutEffect(() => {
    measureOverflow()
    window.addEventListener('resize', measureOverflow)
    const element = textRef.current
    const observer =
      element && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(measureOverflow)
        : undefined
    if (element) observer?.observe(element)
    return () => {
      window.removeEventListener('resize', measureOverflow)
      observer?.disconnect()
    }
  }, [measureOverflow])

  if (state !== 'available') {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 0.75,
          borderBottom: '1px solid #d6d7d9',
          bgcolor: '#f5f5f5',
        }}
      >
        <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{title}</Typography>
        <Chip
          size="small"
          label={statusLabel}
          color={state === 'accepted' ? 'success' : 'default'}
          sx={{ height: 22, fontSize: 11 }}
        />
        {onRestore && !disabled && (
          <Tooltip title={restoreLabel}>
            <Button
              size="small"
              variant="text"
              aria-label={restoreLabel}
              onClick={onRestore}
              sx={{ ml: 'auto', fontSize: 11 }}
            >
              Review again
            </Button>
          </Tooltip>
        )}
      </Box>
    )
  }

  return (
    <Box
      sx={{
        px: 1.5,
        py: 1,
        borderBottom: '1px solid #d6d7d9',
        bgcolor: '#f5f5f5',
        color: '#454545',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flex: '1 1 260px',
            minWidth: 0,
            flexWrap: 'wrap',
          }}
        >
          <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
            {title}
          </Typography>
          <Typography sx={{ fontSize: 11, color: '#666' }}>
            by {author}
          </Typography>
          {required && (
            <Chip
              size="small"
              label="Review required"
              color="warning"
              sx={{ height: 22, fontSize: 11 }}
            />
          )}
        </Box>
        {!disabled && (
          <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5, flexShrink: 0 }}>
            <Button
              size="small"
              variant="outlined"
              aria-label={secondaryAriaLabel}
              onClick={onSecondary}
              sx={{
                minHeight: 26,
                px: 1,
                py: 0.25,
                fontSize: 10.5,
                borderRadius: '6px',
              }}
            >
              {secondaryLabel}
            </Button>
            <Button
              size="small"
              variant="contained"
              aria-label={primaryAriaLabel}
              aria-describedby={
                primaryDisabled && primaryDisabledReason
                  ? primaryDisabledReasonId
                  : undefined
              }
              onClick={onPrimary}
              disabled={primaryDisabled}
              sx={{
                minHeight: 26,
                px: 1,
                py: 0.25,
                fontSize: 10.5,
                borderRadius: '6px',
              }}
            >
              {primaryLabel}
            </Button>
          </Box>
        )}
      </Box>
      <Typography
        ref={textRef}
        sx={
          expanded
            ? { mt: 0.5, fontSize: 13, whiteSpace: 'pre-wrap' }
            : {
                mt: 0.5,
                fontSize: 13,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }
        }
      >
        {text}
      </Typography>
      {canExpand && (
        <Tooltip title={expandLabel}>
          <Button
            size="small"
            variant="text"
            aria-label={expandLabel}
            onClick={() => setExpanded((value) => !value)}
            sx={{ mt: 0.5, minWidth: 0, px: 0.5, fontSize: 11 }}
          >
            {expanded ? 'Show less' : 'Show all'}
          </Button>
        </Tooltip>
      )}
      {primaryDisabled && primaryDisabledReason && (
        <Typography
          id={primaryDisabledReasonId}
          role={primaryDisabledReasonSeverity === 'error' ? 'alert' : 'status'}
          sx={{
            mt: 0.5,
            fontSize: 11,
            color:
              primaryDisabledReasonSeverity === 'error'
                ? 'error.main'
                : 'text.secondary',
          }}
        >
          {primaryDisabledReason}
        </Typography>
      )}
    </Box>
  )
}

export default function JustificationField({
  contextId,
  label,
  value,
  onChange,
  insight,
  priorResponse,
  showInsightSuggestion = true,
  viewedDatacall,
  priorReviewState,
  onPriorReview,
  disabled = false,
  error = false,
  helperText,
  maxLength,
}: Props) {
  const prior = priorResponse ?? priorResponseFor(insight, viewedDatacall)
  const suggestion = showInsightSuggestion
    ? buildInsightJustification(insight)
    : undefined
  const contextKey = JSON.stringify([
    contextId ?? null,
    viewedDatacall ?? null,
    prior?.text ?? null,
    suggestion ?? null,
  ])
  const [suggestionOpen, setSuggestionOpen] = React.useState(true)
  const [priorOpen, setPriorOpen] = React.useState(true)
  const [suggestionRange, setSuggestionRange] =
    React.useState<TextRange | null>(null)
  const [priorRange, setPriorRange] = React.useState<TextRange | null>(null)

  React.useEffect(() => {
    setSuggestionOpen(true)
    setPriorOpen(true)
    setSuggestionRange(null)
    setPriorRange(null)
  }, [contextKey])

  const priorInitializing = priorReviewState === 'initializing'
  const priorPending =
    priorReviewState === 'pending' || priorReviewState === 'initializing'
  const interactionDisabled = disabled || priorInitializing
  const displayedValue =
    priorPending && prior && value.trim() === prior.text.trim() ? '' : value
  const suggestionResult = suggestion
    ? appendText(displayedValue, suggestion)
    : displayedValue
  const suggestionExactRange = exactTextRange(displayedValue, suggestion)
  const effectiveSuggestionRange = suggestionExactRange ?? suggestionRange
  const suggestionAlreadyIncluded = Boolean(suggestionExactRange)
  const suggestionFits = suggestionResult.length <= maxLength
  const priorExactRange = exactTextRange(displayedValue, prior?.text)
  const effectivePriorRange = priorExactRange ?? priorRange
  const priorTextIncluded = Boolean(priorExactRange)
  const priorAlreadyIncluded = priorTextIncluded && !priorPending
  const priorResult = prior
    ? appendText(displayedValue, prior.text)
    : displayedValue
  const hasContext = Boolean(suggestion || prior)
  const suggestionState =
    suggestionAlreadyIncluded ||
    hasTrackedText(displayedValue, effectiveSuggestionRange)
      ? 'accepted'
      : 'dismissed'
  const priorState =
    priorTextIncluded || hasTrackedText(displayedValue, effectivePriorRange)
      ? 'accepted'
      : 'dismissed'

  const changeResponse = (nextValue: string) => {
    setSuggestionRange(
      remapTextRange(displayedValue, nextValue, effectiveSuggestionRange)
    )
    setPriorRange(
      remapTextRange(displayedValue, nextValue, effectivePriorRange)
    )
    onChange(nextValue)
  }

  return (
    <Box>
      <Typography component="h3" variant="h6" sx={{ mb: 1 }}>
        {label}
      </Typography>
      <Box
        sx={{
          height: hasContext ? 'auto' : 400,
          maxHeight: 400,
          display: 'flex',
          flexDirection: 'column',
          border: `2px solid ${error ? '#b50909' : '#323232'}`,
          borderRadius: '6px',
          overflow: 'hidden',
          bgcolor: '#fff',
        }}
      >
        {hasContext && (
          <Box sx={{ maxHeight: 190, overflowY: 'auto', flexShrink: 0 }}>
            {suggestion && (
              <ContextCard
                title="Suggested justification"
                author="ZTMF Insights"
                text={suggestion}
                state={suggestionOpen ? 'available' : suggestionState}
                primaryLabel="Insert into response"
                primaryAriaLabel="Insert suggested justification into current response"
                secondaryLabel={
                  suggestionState === 'dismissed' ? 'Dismiss' : 'Close'
                }
                secondaryAriaLabel={
                  suggestionState === 'dismissed'
                    ? 'Dismiss suggested justification'
                    : 'Close suggested justification review'
                }
                primaryDisabled={suggestionAlreadyIncluded || !suggestionFits}
                primaryDisabledReason={
                  suggestionAlreadyIncluded
                    ? 'Already included in the current response.'
                    : 'Not enough space remaining to insert this suggestion.'
                }
                primaryDisabledReasonSeverity={
                  suggestionAlreadyIncluded ? 'info' : 'error'
                }
                disabled={interactionDisabled}
                onPrimary={() => {
                  setSuggestionRange(
                    exactTextRange(suggestionResult, suggestion)
                  )
                  onChange(suggestionResult)
                  setSuggestionOpen(false)
                }}
                onSecondary={() => setSuggestionOpen(false)}
                onRestore={() => setSuggestionOpen(true)}
              />
            )}
            {prior && (
              <ContextCard
                title={prior.label}
                author="ISSO"
                text={prior.text}
                required={priorPending}
                state={priorOpen ? 'available' : priorState}
                primaryLabel="Insert into response"
                primaryAriaLabel="Insert previous ISSO response into current response"
                secondaryLabel={
                  priorState === 'dismissed' ? 'Dismiss' : 'Close'
                }
                secondaryAriaLabel={
                  priorState === 'dismissed'
                    ? 'Dismiss previous ISSO response'
                    : 'Close previous ISSO response review'
                }
                primaryDisabled={
                  priorAlreadyIncluded || priorResult.length > maxLength
                }
                primaryDisabledReason={
                  priorAlreadyIncluded
                    ? 'Already included in the current response.'
                    : 'Not enough space remaining to insert the previous response.'
                }
                primaryDisabledReasonSeverity={
                  priorAlreadyIncluded ? 'info' : 'error'
                }
                disabled={interactionDisabled}
                onPrimary={() => {
                  const nextValue =
                    priorPending && !displayedValue.trim()
                      ? prior.text
                      : appendText(displayedValue, prior.text)
                  setPriorRange(exactTextRange(nextValue, prior.text))
                  onChange(nextValue)
                  onPriorReview('accepted')
                  setPriorOpen(false)
                }}
                onSecondary={() => {
                  if (priorState !== 'dismissed') {
                    setPriorOpen(false)
                    return
                  }
                  if (priorPending && value.trim() === prior.text.trim()) {
                    onChange('')
                  }
                  onPriorReview('dismissed')
                  setPriorOpen(false)
                }}
                onRestore={() => setPriorOpen(true)}
              />
            )}
          </Box>
        )}
        <Box
          sx={{
            px: 1.5,
            pt: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
              Current response
            </Typography>
            <Typography sx={{ fontSize: 11, color: '#666' }}>
              Only the text in this field will be submitted.
            </Typography>
          </Box>
          {!disabled && (
            <Typography
              variant="caption"
              sx={{
                color:
                  displayedValue.length >= maxLength
                    ? 'error.main'
                    : displayedValue.length >= maxLength * 0.9
                      ? 'warning.main'
                      : 'text.secondary',
              }}
            >
              {displayedValue.length}/{maxLength}
            </Typography>
          )}
        </Box>
        <ResponseTextField
          multiline
          fullWidth
          value={displayedValue}
          disabled={interactionDisabled}
          error={error}
          helperText={helperText}
          placeholder="Add your current justification here…"
          inputProps={{
            maxLength,
            'aria-label': 'Current response',
            'aria-describedby': priorPending
              ? 'previous-response-review-message'
              : undefined,
          }}
          onChange={(event) => changeResponse(event.target.value)}
          sx={hasContext ? { flex: '0 0 160px', height: 160 } : undefined}
        />
      </Box>
      {priorPending && (
        <Typography
          id="previous-response-review-message"
          role="status"
          sx={{ mt: 0.5, fontSize: 12, color: '#8a4b00' }}
        >
          {priorInitializing
            ? 'Checking the previous response…'
            : 'Review the previous response before continuing.'}
        </Typography>
      )}
    </Box>
  )
}
