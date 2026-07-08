import { useState, useRef, type FormEvent, type ChangeEvent } from 'react'
import { Box, TextField, Typography, Button } from '@mui/material'
import { Navigate, useLocation, useRouteLoaderData } from 'react-router-dom'
import { colors } from '@/theme/tokens'
import CONFIG from '@/utils/config'
import { RouteIds, Routes } from '@/router/constants'
import { lookupIdpForEmail } from '@/utils/authLookup'
import { SignInReasons, type SignInReason } from '@/utils/authCodes'
import type { AuthLoaderData } from '@/router/authLoader'
import ztmfLogo from '@/assets/ztmf-logo-login.png'

const UNKNOWN_EMAIL_MESSAGE =
  "We can't determine an identity provider for that email. Contact your ZTMF administrator."

// Shown only when the lookup fails at the transport/server level (timeout,
// network, 4xx/5xx, malformed response) - never for a genuine "no IdP"
// result. Keeping this distinct from UNKNOWN_EMAIL_MESSAGE lets a user
// retry through a transient outage; because it fires independently of
// whether the email exists, it leaks no enumeration signal.
const LOOKUP_UNAVAILABLE_MESSAGE =
  'The sign-in service is temporarily unavailable. Please try again in a moment.'

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
      <Button
        component="a"
        href="/login"
        variant="contained"
        color="primary"
        size="large"
        fullWidth
      >
        Sign in
      </Button>
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

    try {
      const result = await lookupIdpForEmail(trimmedEmail)

      if ('idp' in result) {
        if (result.idp === 'okta') {
          // Full-page navigation. /login is an ALB rule, not a router route.
          window.location.href = '/login'
          return
        }
        if (result.idp === 'entra') {
          window.location.href = '/login/entra'
          return
        }
        // result.idp === null: the deliberate non-enumeration response.
        // Unknown, unprovisioned, and soft-deleted emails all land here with
        // the same generic message, so none can be told apart.
        setLookupError(UNKNOWN_EMAIL_MESSAGE)
      } else {
        // result.unavailable: a transport/server failure. Distinct retryable
        // copy - the only branch that differs from the generic message, and
        // it does not depend on whether the email exists.
        setLookupError(LOOKUP_UNAVAILABLE_MESSAGE)
      }
    } catch {
      // lookupIdpForEmail resolves rather than throws, so this is not
      // reachable today. It guards a future change that throws before the
      // lookup's own catch, which would otherwise leave the form stuck in
      // the submitting state with no error shown.
      setLookupError(LOOKUP_UNAVAILABLE_MESSAGE)
    }

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
        <Button
          type="submit"
          variant="contained"
          color="primary"
          size="large"
          fullWidth
          disabled={!canSubmit}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? 'Checking...' : 'Continue'}
        </Button>
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
 * Shared outer layout for both the legacy and IdP-lookup variants. A two-panel
 * card: a gradient brand panel on the left (decorative, hidden on small
 * screens) and the sign-in content on the right. Pure presentational shell so
 * the flows stay visually consistent.
 */
function LoginShell({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '70vh',
        py: 6,
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 440px' },
          width: '100%',
          maxWidth: 960,
          minHeight: 540,
          borderRadius: 2,
          overflow: 'hidden',
          border: `1px solid ${colors.neutral200}`,
          boxShadow:
            '0 1px 3px rgba(14,18,24,0.08), 0 8px 24px rgba(14,18,24,0.04)',
          backgroundColor: colors.white,
        }}
      >
        {/* left: brand panel */}
        <Box
          sx={{
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 3,
            p: 10,
            color: colors.white,
            background: `linear-gradient(135deg, ${colors.ink900} 0%, ${colors.primary} 100%)`,
          }}
        >
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#B9C7E6',
            }}
          >
            Zero Trust Maturity Framework
          </Typography>
          <Typography
            sx={{
              fontSize: 32,
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
            }}
          >
            Track your agency&apos;s zero-trust posture with confidence.
          </Typography>
          <Typography
            sx={{
              fontSize: 14,
              lineHeight: 1.55,
              color: '#B9C7E6',
              maxWidth: 380,
            }}
          >
            A scoring tool used by CMS OpDivs to measure, compare, and report on
            the seven pillars of the federal zero-trust architecture.
          </Typography>
        </Box>

        {/* right: sign-in content */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            gap: 2.5,
            p: { xs: 6, md: 10 },
          }}
        >
          <img
            src={ztmfLogo}
            alt="ZTMF - Zero Trust Maturity Framework Scoring Tool"
            style={{ width: 240, maxWidth: '100%', height: 'auto' }}
          />
          {children}
        </Box>
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
