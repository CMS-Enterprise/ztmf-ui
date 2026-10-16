import { Box, Button, Typography } from '@mui/material'
import BreadCrumbs from '@/components/BreadCrumbs/BreadCrumbs'

type SystemLookupFailureProps = {
  /** The raw :fismasystemid segment from the URL. */
  systemIdParam: string | undefined
} & ({ status: 'not-found' } | { status: 'error'; onRetry: () => void })

/**
 * What a page addressed by system id shows when useResolvedSystem cannot give
 * it a system. Not-found covers a missing system and one outside the caller's
 * scope alike, so it never reveals which. Error is a failed request: the
 * system may exist and be the caller's, so the copy points at retrying rather
 * than at access.
 * @param {SystemLookupFailureProps} props - The id segment and lookup outcome.
 * @returns {JSX.Element} The not-found or error state with its breadcrumb.
 */
export default function SystemLookupFailure(props: SystemLookupFailureProps) {
  const id = props.systemIdParam ?? ''
  const notFound = props.status === 'not-found'
  return (
    <Box sx={{ mt: 4 }}>
      <BreadCrumbs
        segmentLabels={{ [id]: notFound ? 'Not found' : 'Unavailable' }}
      />
      <Typography variant="h5" color="error" sx={{ mt: 2 }}>
        {notFound ? 'System not found' : 'Could not load this system'}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>
        {notFound ? (
          <>
            Could not find a system with ID &ldquo;{id}&rdquo;. It may not
            exist, or you may not have access to it.
          </>
        ) : (
          'Something went wrong reaching the server. Try again in a moment.'
        )}
      </Typography>
      {props.status === 'error' && (
        <Button variant="outlined" sx={{ mt: 2 }} onClick={props.onRetry}>
          Try again
        </Button>
      )}
    </Box>
  )
}
