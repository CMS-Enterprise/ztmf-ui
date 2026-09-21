import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '@/axiosConfig'
import { apiPaths, queryKeys } from '@/api/keys'
import { isAuthHandled } from '@/utils/notify'
import { parseApiError } from '@/utils/apiErrors'
import type { ScoreHistory, ScoreUndoResult } from '@/types'

/**
 * The typed error code the undo endpoint returns when the head revision moved
 * underneath the caller. Declared locally rather than in utils/authCodes.ts,
 * which is scoped by contract to the auth middleware's codes — the delegate
 * codes set the same precedent.
 */
export const REVISION_CONFLICT = 'REVISION_CONFLICT'

export const UNDO_CONFLICT_MESSAGE =
  'Someone else changed this answer. The history has been refreshed.'

/**
 * Classifies an undo failure so the caller only has to place the message.
 * Lives here rather than at the call site because which failures mean what is
 * a property of the endpoint's contract, not of the questionnaire.
 *
 * 'handled' means the auth interceptor already surfaced it. 'conflict' means
 * the head moved: refreshing is the recovery and retrying the same token never
 * succeeds, so it must not be reported as a generic failure the user could
 * retry into.
 */
export function classifyUndoError(
  error: unknown
):
  | { kind: 'handled' }
  | { kind: 'conflict' }
  | { kind: 'error'; message: string } {
  if (isAuthHandled(error)) return { kind: 'handled' }
  const parsed = parseApiError(error)
  if (parsed.code === REVISION_CONFLICT) return { kind: 'conflict' }
  return { kind: 'error', message: parsed.message }
}

/**
 * Reads one answer's revision history. Operational data in the strict sense of
 * docs/data-fetching.md: another ISSO on the same system can change this row
 * while the drawer is open, so it carries no stale window.
 */
export async function fetchScoreRevisions(
  scoreId: number,
  signal?: AbortSignal
): Promise<ScoreHistory | null> {
  const res = await axiosInstance.get<{ data: ScoreHistory | null }>(
    apiPaths.scores.revisions(scoreId),
    { signal }
  )
  return res.data.data ?? null
}

/**
 * Undoes the most recent change to an answer. expected_head_revisionid is the
 * optimistic-concurrency token: the server refuses with 409 +
 * REVISION_CONFLICT if that revision is no longer the head, rather than
 * silently reverting a change the caller never saw.
 */
export async function undoScoreRevision(
  scoreId: number,
  expectedHeadRevisionId: number
): Promise<ScoreUndoResult> {
  const res = await axiosInstance.post<{ data: ScoreUndoResult }>(
    apiPaths.scores.undo(scoreId),
    { expected_head_revisionid: expectedHeadRevisionId }
  )
  return res.data.data
}

type Params = {
  scoreid: number
  /**
   * The page's existing imperative refetch. The questionnaire's score state is
   * not in TanStack Query — it is useState fed by fetchQuestionScores — so
   * invalidating a cache key cannot refresh the answer the user is looking at.
   * Undo therefore refreshes the same way its two siblings (saveResponse,
   * confirmScoreById) do, and the cache invalidation below only covers the
   * drawer's own read.
   */
  refetchScores: () => void
  /**
   * A value that changes whenever this answer is written. Used to refresh the
   * history immediately after a save, so the Undo button appears the moment
   * the edit lands rather than on the next navigation.
   *
   * This exists because saveResponse and confirmScoreById must stay
   * byte-identical to main (ztmf-misc#392), so neither can invalidate the
   * history key itself. They already refetch the page's scores, so the row's
   * own edit stamp moving IS the signal that a revision was just created.
   *
   * Without it there is a window where the chip reads "Updated this data call"
   * - so Confirm has correctly gone - while Undo has not yet appeared, and the
   * strip shows neither action.
   */
  writeStamp?: string | null
}

/**
 * Owns every piece of state the undo UI needs, so QuestionnairePage adds none
 * of its own (ztmf-misc#392). Returns the drawer's open/close controls, the
 * history read, and the undo write.
 */
export function useAnswerHistory({
  scoreid,
  refetchScores,
  writeStamp,
}: Params) {
  const [open, setOpen] = React.useState(false)
  const queryClient = useQueryClient()

  // Deliberately NOT gated on `open`. The strip's Undo button renders off the
  // head revision's `undoable` flag, so gating the read on the drawer would
  // mean the button could never appear — the data deciding whether to offer it
  // would only arrive after the user had already opened the thing it is meant
  // to be a shortcut for. Reading per question also makes opening the drawer
  // instant rather than a spinner, and it still runs on a closed call, where
  // the strip is absent but history stays viewable for audit.
  //
  // An unanswered question has no row and therefore no history.
  const history = useQuery({
    queryKey: queryKeys.scores.revisions(scoreid),
    queryFn: ({ signal }) => fetchScoreRevisions(scoreid, signal),
    enabled: scoreid !== 0,
    staleTime: 0,
    // The drawer renders its own inline error, so the global QueryCache toast
    // would be a second announcement of the same failure.
    meta: { suppressErrorNotification: true },
  })

  // Refresh when the row's edit stamp moves, i.e. a save just landed. Skipped
  // on the first render for a given score, where the query is already fetching
  // and an invalidate would only duplicate the request.
  // Tracked per score, not globally: navigating to another question changes
  // both the id and the stamp, and that is a new query already fetching on its
  // own key - invalidating it would just duplicate the request.
  const seen = React.useRef<{
    scoreid: number
    stamp: string | null | undefined
  }>({ scoreid: -1, stamp: undefined })

  React.useEffect(() => {
    if (seen.current.scoreid !== scoreid) {
      seen.current = { scoreid, stamp: writeStamp }
      return
    }
    if (seen.current.stamp === writeStamp) return
    seen.current = { scoreid, stamp: writeStamp }
    void queryClient.invalidateQueries({
      queryKey: queryKeys.scores.revisions(scoreid),
    })
  }, [writeStamp, scoreid, queryClient])

  const undo = useMutation({
    mutationFn: (expectedHeadRevisionId: number) =>
      undoScoreRevision(scoreid, expectedHeadRevisionId),
    onSuccess: () => {
      // Imperative, for the reason on refetchScores above.
      refetchScores()
      // Returned, not voided: the drawer stays open over the result, so its
      // rows must be the post-undo ones before the pending state clears.
      return queryClient.invalidateQueries({
        queryKey: queryKeys.scores.revisions(scoreid),
      })
    },
    // No onError here. docs/data-fetching.md keeps mutation error handling at
    // the call site so a caller can route a conflict to the drawer instead of
    // a toast; a hook-level handler would double-notify.
  })

  return {
    open,
    openHistory: () => setOpen(true),
    closeHistory: () => setOpen(false),
    history,
    undo,
    /** The head drives both the strip's label and its concurrency token. */
    head: history.data?.head ?? null,
  }
}
