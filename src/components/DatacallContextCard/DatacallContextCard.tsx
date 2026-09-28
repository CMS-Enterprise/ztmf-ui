import { useContextProp } from '@/views/Title/Context'
import DatacallContextCardView from '@/components/ui/DatacallContextCardView'
import type { datacall } from '@/types'

/** Props for {@link DatacallContextCard}. */
export type DatacallContextCardProps = {
  /**
   * When true, the datacall picker becomes a non-interactive pill that
   * statically displays the current datacall name. Use on routes where
   * switching the datacall would have no effect (e.g. the System Detail
   * edit-mode view, where system metadata is not datacall-scoped). Defaults
   * to false, which gives users the full searchable picker.
   */
  readOnly?: boolean
  /**
   * The call the page is actually viewing, when it resolves its own call
   * independently of the global selection (the questionnaire resolves from
   * its URL/route state). Without this override, a questionnaire opened on
   * a historical call would show the dashboard's aggregate in the card while
   * the page content - and its closed-call banner - referred to a different
   * call entirely.
   */
  viewedDatacall?: datacall | null
  /**
   * Pick handler paired with viewedDatacall: the page owns what "switch
   * call" means (e.g. re-open the questionnaire on the picked call), so
   * picks route here instead of the global selection. Null picks (clear)
   * are not forwarded - a page viewing a specific call has no aggregate
   * state to return to.
   */
  onPick?: (dc: datacall) => void
}

/**
 * Container that wires the Title-context datacall state into the pure
 * {@link DatacallContextCardView} presentational shell. Lives outside ds/
 * because it reads useContextProp (a domain dependency) and writes back to
 * setSelectedDatacall - it isn't a primitive.
 *
 * Drop this at the top of any datacall-scoped page (Dashboard, System
 * Detail, Pillar Scores, Questionnaire) so the user can see and change the
 * active datacall in one consistent place. The View it renders is reusable
 * if any future surface ever needs the card with a non-Title data source.
 * @param {DatacallContextCardProps} props - Component props.
 * @returns {JSX.Element | null} The persistent datacall context card.
 */
export default function DatacallContextCard({
  readOnly = false,
  viewedDatacall,
  onPick,
}: DatacallContextCardProps = {}) {
  const {
    datacalls,
    selectedDatacall,
    setSelectedDatacall,
    toggleActiveDatacall,
    latestDataCallId,
    activeDatacallIds,
  } = useContextProp()

  const overridden = viewedDatacall != null
  return (
    <DatacallContextCardView
      datacalls={datacalls}
      selectedDatacall={overridden ? viewedDatacall : selectedDatacall}
      onSelect={(dc) => {
        if (overridden) {
          if (dc && onPick) onPick(dc)
          return
        }
        setSelectedDatacall(dc)
      }}
      // Multi-select toggles only apply to the global selection (#467): an
      // overridden page (the questionnaire) views one call at a time, so its
      // picker stays single-pick.
      onToggle={overridden ? undefined : toggleActiveDatacall}
      latestDataCallId={latestDataCallId}
      // With an override the card describes exactly one call; the global
      // aggregate set would leak "In view" chips for calls this page is
      // not showing.
      activeDatacallIds={
        overridden ? [viewedDatacall.datacallid] : activeDatacallIds
      }
      // Only the global-selection card has an aggregated year to clear back
      // to; an overridden page views exactly one call.
      clearable={!overridden}
      readOnly={readOnly}
    />
  )
}
