/**
 * Shown when data the dashboard depends on failed to load, so a failed fetch
 * never renders as a zero or an empty roster.
 *
 * @module views/OpDivDashboard/components/LoadErrorState
 */
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import { EmptyState } from '@/components/ui/EmptyState'

/**
 * Explains which load failed and offers a reload.
 * @param {object} props - What failed to load.
 * @param {string} props.what - Plain-language name of the failed data.
 * @returns {JSX.Element} The error state.
 */
export default function LoadErrorState({ what }: { what: string }) {
  return (
    <Box sx={{ pt: 6, pb: 4 }}>
      <EmptyState
        icon={<ErrorOutlineIcon />}
        title={`Could not load ${what}`}
        description="The request failed, so nothing here can be shown accurately. Reload to try again."
        tone="warning"
        action={
          <Button
            variant="contained"
            color="primary"
            onClick={() => window.location.reload()}
          >
            Reload
          </Button>
        }
      />
    </Box>
  )
}
