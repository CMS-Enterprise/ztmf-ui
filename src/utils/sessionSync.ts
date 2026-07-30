// Cross-tab logout (#606). Logging out clears the HTTP-only session cookie
// browser-wide, but other tabs keep rendering off stale root loader data until
// something re-runs the authLoader. The logging-out tab signals here.

// Guarded because this runs at import time via main.tsx: a throw would
// white-screen the app before it renders. Feature detection proves the
// interface exists, not that constructing it succeeds.
let channel: BroadcastChannel | null = null
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    channel = new BroadcastChannel('ztmf-auth')
  }
} catch (error) {
  console.error(
    'BroadcastChannel unavailable; cross-tab logout disabled',
    error
  )
}

const LOGOUT = 'logout'

/**
 * Signal every other tab. No-op without a channel; callers reload themselves
 * regardless.
 *
 * postMessage is spec'd to throw (InvalidStateError, DataCloneError). Neither
 * should be reachable, but handleLogout calls this after the session is already
 * dead and before its own reload, so an escaping throw would strand the user
 * mid-logout.
 */
export function broadcastLogout(): void {
  try {
    channel?.postMessage(LOGOUT)
  } catch (error) {
    console.error('Cross-tab logout signal failed', error)
  }
}

/**
 * Registered once at startup. Reloading is the whole reaction: it re-runs the
 * authLoader, and Title renders LoginPage on any route once that reports no
 * session.
 *
 * Do not add a hash write or an "already on /signin" skip. The questionnaire's
 * beforeunload guard can veto this reload, and a hash write would move the tab
 * anyway when a user cancels it to save their work; the skip would wedge a tab
 * sitting on /signin whose loader data still claims a session. `onmessage`
 * rather than addEventListener keeps repeat registration idempotent.
 */
export function initLogoutListener(): void {
  if (!channel) return
  channel.onmessage = (e: MessageEvent) => {
    if (e.data !== LOGOUT) return
    window.location.reload()
  }
}
