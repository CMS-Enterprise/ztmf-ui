import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Link from '@mui/material/Link'
import CONFIG from '@/utils/config'

/**
 * Fallback copy shown in any non-production environment (dev, impl, local) when
 * no override is supplied. Deliberately mode-neutral: the deployed dev
 * environment layers on testing-specific wording via VITE_DEV_BANNER_MESSAGE,
 * while impl and local fall back to this generic notice.
 */
const DEFAULT_MESSAGE =
  "You're in a ZTMF non-production environment, not the live site. Records here " +
  'are for testing only. We deploy throughout the day, so if something looks ' +
  'off, pause and refresh.'

/**
 * Persistent warning banner that marks non-production environments so testers
 * do not mistake them for production or enter real data. Rendered once in the
 * app shell; hidden entirely in production and after a user dismisses it.
 * @returns {JSX.Element | null}
 */
export default function DevEnvironmentBanner() {
  const [dismissed, setDismissed] = useState(false)

  if (!CONFIG.IS_NONPROD || dismissed) {
    return null
  }

  // Trim guards against a whitespace-only override secret rendering a blank
  // banner or an unusable link.
  const message = CONFIG.DEV_BANNER_MESSAGE.trim() || DEFAULT_MESSAGE
  const feedbackUrl = CONFIG.DEV_FEEDBACK_URL.trim()
  const contactEmail = CONFIG.DEV_CONTACT_EMAIL.trim()
  // Only render an https link. The value comes from a trusted build-time
  // secret, but the allowlist forbids javascript:/data: hrefs as defense in
  // depth against a mis-set secret.
  const showFeedback = feedbackUrl.startsWith('https://')

  return (
    <Alert
      severity="warning"
      onClose={() => setDismissed(true)}
      role="region"
      aria-label="Non-production environment notice"
      sx={{
        borderRadius: 0,
        py: 0.25,
        '& .MuiAlert-message': {
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          columnGap: 1,
          rowGap: 0.25,
        },
      }}
    >
      <span>{message}</span>
      {showFeedback && (
        <Link
          href={feedbackUrl}
          target="_blank"
          rel="noopener noreferrer"
          color="inherit"
          aria-label="Share testing feedback (opens in a new tab)"
          sx={{ fontWeight: 700 }}
        >
          Share testing feedback
        </Link>
      )}
      {contactEmail && (
        <Link
          href={`mailto:${contactEmail}`}
          color="inherit"
          sx={{ fontWeight: 700 }}
        >
          Contact us
        </Link>
      )}
    </Alert>
  )
}
