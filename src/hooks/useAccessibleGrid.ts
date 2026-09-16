import { useEffect, useState } from 'react'

/**
 * MUI's own fix for the v6 grid DOM, and the default from v7 on. It moves the
 * aria attributes - `role="grid"` included - off the DataGrid root, which also
 * holds the toolbar and the pagination footer, onto `.MuiDataGrid-main`, which
 * wraps exactly the column headers and the row groups. Without it a grid owns
 * children a grid may not own and axe reports a critical aria-required-children
 * ("Element has children which are not allowed: ... [role=combobox],
 * input[tabindex]"). It also corrects cells from `role="cell"`, which is only
 * valid inside a table, to `role="gridcell"` (ui#714).
 *
 * Safe to share between grids: MUI reads this object, and only ever mutates the
 * separate `forwardedProps` one.
 */
const EXPERIMENTAL_FEATURES = { ariaV7: true }

// What names a grid: whichever the caller passed to <DataGrid>.
const LABEL_ATTRIBUTES = ['aria-label', 'aria-labelledby']

/**
 * Gives a DataGrid an ARIA structure that passes Section 508 scanning.
 *
 *   const accessibleGrid = useAccessibleGrid()
 *   <DataGrid {...accessibleGrid} aria-label="Users" rows={rows} />
 *
 * Turns on MUI's ariaV7 structure, then carries the grid's accessible name to
 * where that structure puts `role="grid"`. `aria-label` reaches the root, and
 * ariaV7 leaves the root a generic element, which exposes no name at all - so
 * without this the grid ends up anonymous.
 * @returns {object} Props to spread onto `<DataGrid>`.
 */
export default function useAccessibleGrid() {
  // Callback ref, not useRef: GridRoot renders null on its first pass and
  // mounts on the second, so an effect keyed off a ref object would run before
  // the element exists and never re-run.
  const [root, setRoot] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    const main = root?.querySelector<HTMLElement>('.MuiDataGrid-main')
    if (!root || !main) return

    // Read once: every grid here names itself with a literal. A grid that ever
    // renames itself mid-session would need this watched.
    LABEL_ATTRIBUTES.forEach((name) => {
      const value = root.getAttribute(name)
      if (value === null) return
      main.setAttribute(name, value)
      // Left behind it is a prohibited attribute on a generic element, and a
      // second answer to "what is this grid called".
      root.removeAttribute(name)
    })
  }, [root])

  return { ref: setRoot, experimentalFeatures: EXPERIMENTAL_FEATURES }
}
