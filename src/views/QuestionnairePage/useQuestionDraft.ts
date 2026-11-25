import * as React from 'react'
import {
  QuestionDraft,
  saveDraft,
  loadDraft,
  clearDraft,
  hasDeclinedDraft,
} from './draftStore'

export type DraftStatus = 'idle' | 'restored' | 'saved' | 'error'

// The system x data call x question a draft belongs to.
export type DraftContext = {
  system: number | undefined
  questionId: number | null
  datacallID: number
}

type UseQuestionDraftArgs = DraftContext & {
  userid: string
  isReadOnly: boolean
  // While the question loads, the answer fields are being seeded, not edited.
  loadingQuestion: boolean
  selectQuestionOption: number
  notes: string
  // The server-side values the answer was seeded with. A draft is written only
  // when the fields differ from these.
  initQuestionChoice: number
  initNotes: string
}

const hasContext = (
  ctx: DraftContext
): ctx is { system: number; questionId: number; datacallID: number } =>
  !!ctx.system && !!ctx.questionId && ctx.datacallID > 0

/**
 * The localStorage draft for the question on screen: a debounced save while
 * the user edits, a flush on unmount, restore when a question loads, and the
 * clears that keep a saved or abandoned answer from coming back.
 *
 * A generation counter guards every async write. Any explicit clear or
 * navigation bumps it with `invalidatePending()`, so a debounced save or an
 * unmount flush that was scheduled before cannot resurrect a draft.
 */
export function useQuestionDraft({
  userid,
  system,
  questionId,
  datacallID,
  isReadOnly,
  loadingQuestion,
  selectQuestionOption,
  notes,
  initQuestionChoice,
  initNotes,
}: UseQuestionDraftArgs) {
  const [status, setStatus] = React.useState<DraftStatus>('idle')
  // Read inside timers and effects to get the current value without enrolling
  // status as a dependency (prevents extra re-runs).
  const statusRef = React.useRef(status)
  statusRef.current = status
  // Incremented on every explicit draft clear so in-flight debounced saves
  // that fire after a clear don't resurrect the just-removed draft.
  const saveGenRef = React.useRef(0)
  // True while the current question has a stored draft this build declined to
  // read (unrecognised format version). Suppresses the no-edits clearDraft so
  // the app doesn't delete what draftStore deliberately preserved.
  const declinedDraftRef = React.useRef(false)
  // Mirrors the payload the debounced draft save would write, so unmount can
  // flush it. The debounce cleanup cancels its own pending timer, and a route
  // change away from this page (System Info, the Dashboard breadcrumb, browser
  // back) tears the component down without firing beforeunload, so an edit made
  // inside the 1s window was dropped. Carries the generation so a flush cannot
  // resurrect a draft clear() deleted after the timer was scheduled.
  const pendingDraftRef = React.useRef<{
    userid: string
    system: number
    questionId: number
    datacallID: number
    draft: { selectQuestionOption: number; notes: string }
    gen: number
  } | null>(null)

  const invalidatePending = React.useCallback(() => {
    saveGenRef.current++
  }, [])

  // The user changed the answer or notes, so a restored draft is now just the
  // current edit.
  const markEdited = React.useCallback(() => {
    if (statusRef.current === 'restored') setStatus('idle')
  }, [])

  const resetStatus = React.useCallback(() => setStatus('idle'), [])

  const isRestored = React.useCallback(
    () => statusRef.current === 'restored',
    []
  )

  // Remove the current question's draft: the answer is saved server-side now,
  // or the user chose to abandon the edit.
  const clear = React.useCallback(() => {
    saveGenRef.current++
    const ctx = { system, questionId, datacallID }
    if (hasContext(ctx)) {
      void clearDraft(userid, ctx.system, ctx.questionId, ctx.datacallID)
    }
    // An explicit clear is meant to remove the entry, declined or not, so
    // nothing is left to suppress.
    declinedDraftRef.current = false
    setStatus('idle')
  }, [userid, system, questionId, datacallID])

  /**
   * Load the stored draft for a question that just loaded. Returns the draft to
   * apply, null when there is none to apply, or undefined when `signal`
   * aborted (the user moved on) and the caller should drop the result.
   *
   * `validOptions` are the question's current option ids. A draft that names
   * an option no longer offered is evicted. Read-only sessions never restore,
   * and their lingering entry is evicted instead of sitting for the full TTL.
   */
  const restore = React.useCallback(
    async (
      ctx: DraftContext,
      validOptions: number[],
      signal: AbortSignal
    ): Promise<QuestionDraft | null | undefined> => {
      // Reset per question: a declined entry belongs to one question, and a
      // stale true here would suppress a legitimate clear on the next one.
      declinedDraftRef.current = false
      if (!hasContext(ctx)) {
        setStatus('idle')
        return null
      }
      if (isReadOnly) {
        // Bump first: an autosave that fired just before isReadOnly flipped may
        // still be mid-flight, and without the bump its isCurrent() checks would
        // pass and rewrite the draft after this clear.
        saveGenRef.current++
        void clearDraft(userid, ctx.system, ctx.questionId, ctx.datacallID)
        setStatus('idle')
        return null
      }
      const draft = await loadDraft(
        userid,
        ctx.system,
        ctx.questionId,
        ctx.datacallID
      )
      // crypto.subtle.decrypt is genuinely async, so the user may have moved on.
      if (signal.aborted) return undefined
      if (draft) {
        if (
          draft.selectQuestionOption === -1 ||
          validOptions.includes(draft.selectQuestionOption)
        ) {
          setStatus('restored')
          return draft
        }
        // The draft references an option that no longer exists.
        await clearDraft(userid, ctx.system, ctx.questionId, ctx.datacallID)
        if (signal.aborted) return undefined
        setStatus('idle')
        return null
      }
      // Tell "none stored" from "one we declined": the no-edits clear below
      // would delete the latter. A ref, not status: that gets reset to 'idle'
      // and 'error', re-arming the clear.
      declinedDraftRef.current = await hasDeclinedDraft(
        userid,
        ctx.system,
        ctx.questionId,
        ctx.datacallID
      )
      if (signal.aborted) return undefined
      setStatus('idle')
      return null
    },
    [userid, isReadOnly]
  )

  // Debounced draft save: 1 second after the user pauses editing, persist
  // the current answer and notes to localStorage so a reload can recover them.
  // Only fires when the user has actually changed something from the server-side
  // initial values - prevents question-load state transitions from being
  // mistakenly recorded as drafts on questions the user never touched.
  React.useEffect(() => {
    const ctx = { system, questionId, datacallID }
    if (isReadOnly || !hasContext(ctx) || loadingQuestion) {
      pendingDraftRef.current = null
      if (statusRef.current !== 'idle') setStatus('idle')
      return
    }
    if (selectQuestionOption === initQuestionChoice && notes === initNotes) {
      pendingDraftRef.current = null
      saveGenRef.current++
      // Skip clearDraft when a draft was just restored from storage - the draft
      // values matching the server state does not mean the user reverted manually.
      // Clearing it here would delete a valid in-progress draft on every page load
      // when the server happens to be at the same state as the draft.
      // A declined draft is skipped for the same reason: the entry is a real
      // draft this build cannot read, and deleting it loses the user's text.
      if (statusRef.current !== 'restored' && !declinedDraftRef.current)
        void clearDraft(userid, ctx.system, ctx.questionId, ctx.datacallID)
      if (statusRef.current !== 'idle') setStatus('idle')
      return
    }
    const currentGen = saveGenRef.current
    const pending = {
      userid,
      system: ctx.system,
      questionId: ctx.questionId,
      datacallID: ctx.datacallID,
      draft: { selectQuestionOption, notes },
      gen: currentGen,
    }
    pendingDraftRef.current = pending
    const timer = setTimeout(() => {
      if (saveGenRef.current !== currentGen) return
      saveDraft(
        pending.userid,
        pending.system,
        pending.questionId,
        pending.datacallID,
        pending.draft,
        () => saveGenRef.current === currentGen
      ).then((saved) => {
        if (saveGenRef.current !== currentGen) return
        // Clear by identity, not generation: a newer edit re-runs this effect
        // and replaces the ref with a NEW object under the SAME generation
        // (saveGenRef only moves on explicit clears), so a generation check
        // here would let the older save's completion discard the newer edit's
        // payload while its own debounce is still pending - and an unmount in
        // that window would then flush nothing (#640 review). Gated on `saved`
        // so a failed write stays in the ref for the unmount flush to retry.
        if (saved && pendingDraftRef.current === pending)
          pendingDraftRef.current = null
        if (saved) {
          // The stored entry is this build's now, so it is no longer declined.
          declinedDraftRef.current = false
          if (statusRef.current !== 'restored') setStatus('saved')
        } else {
          setStatus('error')
        }
      })
    }, 1000)
    return () => clearTimeout(timer)
  }, [
    selectQuestionOption,
    notes,
    isReadOnly,
    system,
    questionId,
    datacallID,
    initQuestionChoice,
    initNotes,
    loadingQuestion,
    userid,
  ])

  // Flush a pending draft on unmount. beforeunload covers tab close and hard
  // refresh, but it does not fire on in-app navigation, and the debounce
  // cleanup cancels the timer that would have written the draft. Mount-once so
  // the cleanup runs on unmount only, never on a dep change (flushing on every
  // dep change would defeat the debounce and write on each keystroke).
  // saveDraft takes primitives and touches no component state, so the write
  // completes after this component is gone.
  React.useEffect(() => {
    return () => {
      const pending = pendingDraftRef.current
      // Reading the live generation is the point of this guard, not a staleness
      // bug: it must reflect any clear() that ran after the timer was
      // scheduled, so a flush cannot resurrect a just-deleted draft. Copying it
      // into the effect body would freeze it at its mount value.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (!pending || saveGenRef.current !== pending.gen) return
      void saveDraft(
        pending.userid,
        pending.system,
        pending.questionId,
        pending.datacallID,
        pending.draft
      )
    }
  }, [])

  return {
    status,
    isRestored,
    markEdited,
    resetStatus,
    invalidatePending,
    clear,
    restore,
  }
}
