// Cross-tab logout synchronization (#606).
//
// Auth is server-controlled via HTTP-only cookies, so logging out in one tab
// clears the cookie browser-wide - but other open tabs still hold root loader
// data claiming an active session and keep rendering the dashboard until
// something re-runs the authLoader. This module lets the logging-out tab
// notify every other tab immediately so they tear down cleanly.
//
// Mechanism: BroadcastChannel. It delivers only to OTHER tabs (never the
// sender), needs no persisted key to clean up, and is the purpose-built API
// for this. It is feature-guarded so browsers without it (Safari < 15.4,
// some locked-down enterprise builds) simply don't get the proactive teardown
// and fall back to the interceptor's 401 handling on their next request.
//
// The reaction is a plain reload, nothing more:
// - Reloading re-runs the root authLoader against the now-cleared cookie, and
//   Title renders LoginPage whenever the loader reports no session - on any
//   route. So there is no need to move the tab to /signin first, and no
//   "already on /signin" suppression that could race a tab whose loader data
//   is still stale.
// - The hash is deliberately NOT touched. The reload can be vetoed: the
//   questionnaire registers a beforeunload guard for uncommitted edits, and a
//   hash write before reload() would client-side-navigate the tab even when
//   the user cancels that dialog to rescue their work. Leaving the hash alone
//   means Cancel truly cancels; the axios interceptor then signs the tab out
//   cleanly on its next request instead.
const channel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('ztmf-auth')
    : null

const LOGOUT = 'logout'

/**
 * Called by handleLogout so every other tab tears down too. Best-effort - if
 * BroadcastChannel is unavailable this is a no-op and the logging-out tab still
 * reloads itself as before.
 */
export function broadcastLogout(): void {
  channel?.postMessage(LOGOUT)
}

/**
 * Registered once at app startup (main.tsx). Reacts to a logout from another
 * tab by reloading, which re-runs the root authLoader against the cleared
 * cookie and lands the tab on LoginPage.
 */
export function initLogoutListener(): void {
  if (!channel) return
  channel.onmessage = (e: MessageEvent) => {
    if (e.data !== LOGOUT) return
    window.location.reload()
  }
}
