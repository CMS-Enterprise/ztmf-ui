import { FismaSystemType } from '@/types'

/**
 * Reshape a FismaSystemType[] into the map the Assign Systems picker
 * consumes. Each entry carries a `decommissioned` flag so the modal can
 * render a "(Decommissioned)" suffix and greyed styling for assignments
 * to systems that were later retired. Callers pass the union of active
 * and decommissioned systems.
 *
 * Exported so the map-build logic can be unit tested against the same
 * fixtures the parent fetch test uses, without having to drive the
 * DataGrid + modal chain end to end.
 *
 * @param systems - Union of active and decommissioned FISMA systems.
 * @returns A map keyed by fismasystemid with a display-ready label pair
 *   and the decommissioned flag.
 */
export function buildFismaSystemsMap(
  systems: FismaSystemType[] | null | undefined
): Record<number, { name: string; acronym: string; decommissioned: boolean }> {
  const map: Record<
    number,
    { name: string; acronym: string; decommissioned: boolean }
  > = {}
  for (const obj of systems ?? []) {
    map[obj.fismasystemid] = {
      name: obj.fismasubsystem
        ? obj.fismaname + ' - ' + obj.fismasubsystem
        : obj.fismaname,
      acronym: obj.fismaacronym,
      decommissioned: !!obj.decommissioned,
    }
  }
  return map
}
