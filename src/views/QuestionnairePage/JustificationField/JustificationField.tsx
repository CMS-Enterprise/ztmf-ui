import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { styled } from '@mui/material/styles'
import type { InsightPayload } from '@/types'
import {
  buildInsightJustification,
  priorResponseFor,
} from './justificationContext'

export type PriorReviewState =
  | 'not-required'
  | 'pending'
  | 'accepted'
  | 'dismissed'

type Props = {
  label: string
  value: string
  onChange: (value: string) => void
  insight?: InsightPayload
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
  disabled,
}: ContextCardProps) {
  const [expanded, setExpanded] = React.useState(false)
  const [canExpand, setCanExpand] = React.useState(false)
  const textRef = React.useRef<HTMLParagraphElement>(null)

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
          label={state === 'accepted' ? 'Added to response' : 'Not used'}
          color={state === 'accepted' ? 'success' : 'default'}
          sx={{ height: 22, fontSize: 11 }}
        />
        {onRestore && !disabled && (
          <Button
            size="small"
            variant="text"
            onClick={onRestore}
            sx={{ ml: 'auto', fontSize: 11 }}
          >
            Review again
          </Button>
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
        <Button
          size="small"
          variant="text"
          onClick={() => setExpanded((value) => !value)}
          sx={{ mt: 0.5, minWidth: 0, px: 0.5, fontSize: 11 }}
        >
          {expanded ? 'Show less' : 'Show all'}
        </Button>
      )}
    </Box>
  )
}

export default function JustificationField({
  label,
  value,
  onChange,
  insight,
  viewedDatacall,
  priorReviewState,
  onPriorReview,
  disabled = false,
  error = false,
  helperText,
  maxLength,
}: Props) {
  const prior = priorResponseFor(insight, viewedDatacall)
  const suggestion = buildInsightJustification(insight)
  const contextKey = `${viewedDatacall ?? ''}:${prior?.text ?? ''}:${suggestion ?? ''}`
  const [suggestionState, setSuggestionState] = React.useState<
    'available' | 'accepted' | 'dismissed'
  >('available')

  React.useEffect(() => setSuggestionState('available'), [contextKey])

  const priorPending = priorReviewState === 'pending'
  const displayedValue =
    priorPending && prior && value.trim() === prior.text.trim() ? '' : value
  const suggestionResult = suggestion
    ? appendText(displayedValue, suggestion)
    : displayedValue
  const suggestionFits = suggestionResult.length <= maxLength
  const hasContext = Boolean(suggestion || prior)

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
                state={suggestionState}
                primaryLabel="Insert into response"
                primaryAriaLabel="Insert suggested justification into current response"
                secondaryLabel="Dismiss"
                secondaryAriaLabel="Dismiss suggested justification"
                primaryDisabled={!suggestionFits}
                disabled={disabled}
                onPrimary={() => {
                  onChange(suggestionResult)
                  setSuggestionState('accepted')
                }}
                onSecondary={() => setSuggestionState('dismissed')}
                onRestore={() => setSuggestionState('available')}
              />
            )}
            {prior && (
              <ContextCard
                title={prior.label}
                author="ISSO"
                text={prior.text}
                required={priorPending}
                state={
                  priorReviewState === 'accepted'
                    ? 'accepted'
                    : priorReviewState === 'dismissed'
                      ? 'dismissed'
                      : 'available'
                }
                primaryLabel="Insert into response"
                primaryAriaLabel="Insert previous ISSO response into current response"
                secondaryLabel="Dismiss"
                secondaryAriaLabel="Dismiss previous ISSO response"
                primaryDisabled={
                  appendText(displayedValue, prior.text).length > maxLength
                }
                disabled={disabled}
                onPrimary={() => {
                  onChange(
                    priorPending && !displayedValue.trim()
                      ? prior.text
                      : appendText(displayedValue, prior.text)
                  )
                  onPriorReview('accepted')
                }}
                onSecondary={() => {
                  if (priorPending && value.trim() === prior.text.trim()) {
                    onChange('')
                  }
                  onPriorReview('dismissed')
                }}
                onRestore={() => onPriorReview('not-required')}
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
          disabled={disabled}
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
          onChange={(event) => onChange(event.target.value)}
          sx={hasContext ? { flex: '0 0 160px', height: 160 } : undefined}
        />
      </Box>
      {priorPending && (
        <Typography
          id="previous-response-review-message"
          role="status"
          sx={{ mt: 0.5, fontSize: 12, color: '#8a4b00' }}
        >
          Review the previous response before continuing.
        </Typography>
      )}
    </Box>
  )
}
