import { useState, useRef, type FormEvent, type ChangeEvent } from 'react'
import { Box, TextField, Typography } from '@mui/material'
import { Button as CmsButton } from '@cmsgov/design-system'
import { Navigate, useLocation, useRouteLoaderData } from 'react-router-dom'
import CONFIG from '@/utils/config'
import { RouteIds, Routes } from '@/router/constants'
import { lookupIdpForEmail } from '@/utils/authLookup'
import { SignInReasons, type SignInReason } from '@/utils/authCodes'
import type { AuthLoaderData } from '@/router/authLoader'
import ztmfLogo from '@/assets/ztmf-logo-login.png'

const UNKNOWN_EMAIL_MESSAGE =
  "We can't determine an identity provider for that email. Contact your ZTMF administrator."

// Fallback copy when the BE didn't send a message body (or the user
// landed here without one passing through). The BE message is preferred
// because it differentiates "no account" from "account deactivated" -
// this string covers both since the FE UX is identical.
const NO_ACCOUNT_FALLBACK_MESSAGE =
  'Your ZTMF account is not set up. Contact your ZTMF administrator for access.'

/**
 * Basic shape check. The backend is the source of truth for whether the
 * email maps to a real account; the FE just gates the Continue button on
 * "looks roughly like an email" so a stray click does not fire the lookup.
 */
function isValidEmailFormat(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/**
 * Pre-auth landing page. When CONFIG.IDP_ENABLED is on, prompts for an
 * email, calls the backend pre-auth lookup, and redirects to the matching
 * /login/<idp> path. When the flag is off, falls back to the single-button
 * Okta-only behavior so prod-style deployments without the multi-IdP
 * rollout are unchanged.
 *
 * Rendered by Title.tsx when loaderData.status !== 200 (no active session)
 * and as the /signin route's element when the interceptor redirects here.
 */
export default function LoginPage() {
  const location = useLocation()
  const rootLoaderData = useRouteLoaderData(RouteIds.ROOT) as
    | AuthLoaderData
    | undefined

  // Active-session redirect: bounces an already-authenticated user away
  // from /signin so it never appears as a dead-end "log in again" prompt.
  if (rootLoaderData?.status === 200) {
    return <Navigate to={Routes.ROOT} replace />
  }

  // Reason can come from two places: the interceptor's redirect carries
  // it on location.state for subsequent API failures; the authLoader's
  // discriminated return carries it for the initial cold load. Prefer
  // location.state - if the interceptor just fired, that signal is the
  // most recent.
  const locationState = location.state as {
    message?: string
    reason?: SignInReason
  } | null
  const reason: SignInReason | undefined =
    locationState?.reason ?? rootLoaderData?.reason
  const incomingMessage =
    locationState?.message ?? rootLoaderData?.message ?? ''

  if (reason === SignInReasons.NO_ACCOUNT) {
    return <NoAccountTerminal message={incomingMessage} />
  }

  if (!CONFIG.IDP_ENABLED) {
    return <LegacyOktaLogin sessionMessage={incomingMessage} />
  }
  return <IdpLookupLogin sessionMessage={incomingMessage} />
}

/**
 * Terminal state for an authenticated identity with no ZTMF account
 * (or a soft-deleted one). Renders the BE-provided message verbatim
 * and intentionally exposes NO retry affordance - the user has to
 * contact an administrator out-of-band, and a Sign in button here
 * would just loop them back through the IdP -> 403 cycle.
 */
function NoAccountTerminal({ message }: { message: string }) {
  return (
    <LoginShell>
      <Typography
        variant="body1"
        role="alert"
        sx={{ color: 'error.main', fontWeight: 600 }}
      >
        {message || NO_ACCOUNT_FALLBACK_MESSAGE}
      </Typography>
    </LoginShell>
  )
}

/**
 * Existing single-button Okta flow. Kept as a fallback for environments
 * where the multi-IdP rollout has not landed yet (typically prod before
 * cutover). Removed when every environment has VITE_IDP_ENABLED=true.
 */
function LegacyOktaLogin({ sessionMessage }: { sessionMessage: string }) {
  return (
    <LoginShell>
      {sessionMessage && <SessionMessage text={sessionMessage} />}
      <CmsButton href="/login" size="big">
        Sign in
      </CmsButton>
    </LoginShell>
  )
}

/**
 * New email-driven landing page. The backend lookup is the only source of
 * truth for IdP routing; the FE never maps domain to provider locally.
 */
function IdpLookupLogin({ sessionMessage }: { sessionMessage: string }) {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const emailInputRef = useRef<HTMLInputElement>(null)

  const trimmedEmail = email.trim()
  const canSubmit =
    !isSubmitting && trimmedEmail.length > 0 && isValidEmailFormat(trimmedEmail)

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
    // Clear any stale "not configured" copy as soon as the user edits the
    // field. They get a fresh shot at each submit.
    if (lookupError) setLookupError('')
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canSubmit) return

    setIsSubmitting(true)
    setLookupError('')

    const idp = await lookupIdpForEmail(trimmedEmail)

    if (idp === 'okta') {
      // Full-page navigation. /login is an ALB rule, not a router route.
      window.location.href = '/login'
      return
    }
    if (idp === 'entra') {
      window.location.href = '/login/entra'
      return
    }

    // idp === null collapses every failure mode (unknown email, error,
    // timeout) into the same generic message. No enumeration signal.
    setLookupError(UNKNOWN_EMAIL_MESSAGE)
    setIsSubmitting(false)
    // Return focus to the field so keyboard/SR users land on the input the
    // error refers to, not the now-disabled submit button.
    emailInputRef.current?.focus()
  }

  return (
    <LoginShell>
      {sessionMessage && <SessionMessage text={sessionMessage} />}
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          width: '100%',
        }}
      >
        <TextField
          label="Enter your email to get started"
          type="email"
          value={email}
          onChange={handleEmailChange}
          fullWidth
          variant="outlined"
          margin="normal"
          autoComplete="email"
          disabled={isSubmitting}
          error={!!lookupError}
          inputRef={emailInputRef}
          inputProps={{
            'aria-describedby': lookupError ? 'login-lookup-error' : undefined,
          }}
          InputLabelProps={{ sx: { marginTop: 0 } }}
        />
        <CmsButton type="submit" disabled={!canSubmit} aria-busy={isSubmitting}>
          {isSubmitting ? 'Checking...' : 'Continue'}
        </CmsButton>
        {lookupError && (
          <Typography
            id="login-lookup-error"
            variant="body2"
            role="alert"
            sx={{ color: 'error.main', fontWeight: 600, mt: 1 }}
          >
            {lookupError}
          </Typography>
        )}
      </Box>
    </LoginShell>
  )
}

/**
 * Shared outer layout for both the legacy and IdP-lookup variants. Pure
 * presentational shell so the two flows stay visually consistent.
 */
function LoginShell({ children }: { children: React.ReactNode }) {
  return (
    <Box
      flex={1}
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '54vh',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2.5,
          maxWidth: 520,
          width: '100%',
          textAlign: 'center',
          px: 2,
        }}
      >
        <img
          src={ztmfLogo}
          alt="ZTMF - Zero Trust Maturity Framework Scoring Tool"
          style={{ width: 540, maxWidth: '100%', height: 'auto' }}
        />
        {children}
      </Box>
    </Box>
  )
}

/**
 * Pre-existing session-expired / redirect message surface. Kept in both
 * variants so the message still renders if the user is bounced here from
 * the auth interceptor.
 */
function SessionMessage({ text }: { text: string }) {
  return (
    <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 600 }}>
      {text}
    </Typography>
  )
}
