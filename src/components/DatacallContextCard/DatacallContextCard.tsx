import { useContextProp } from '@/views/Title/Context'
import DatacallContextCardView from '@/components/ui/DatacallContextCardView'

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
}: DatacallContextCardProps = {}) {
  const { datacalls, selectedDatacall, setSelectedDatacall, latestDataCallId } =
    useContextProp()

  return (
    <DatacallContextCardView
      datacalls={datacalls}
      selectedDatacall={selectedDatacall}
      onSelect={setSelectedDatacall}
      latestDataCallId={latestDataCallId}
      readOnly={readOnly}
    />
  )
}
