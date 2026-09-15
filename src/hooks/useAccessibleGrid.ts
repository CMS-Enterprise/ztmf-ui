import { useEffect, useState } from 'react'

/**
 * Attributes that belong on whichever element carries role="grid". MUI writes
 * them on the root, so they have to travel with the role when it moves.
 */
const GRID_ATTRIBUTES = [
  'aria-colcount',
  'aria-rowcount',
  'aria-multiselectable',
  'aria-label',
  'aria-labelledby',
  'aria-describedby',
]

// `role` is not among the props DataGrid forwards to its root element (only
// aria-* and data-* are), so it has to ride along in forwardedProps. MUI
// collects the grid's own aria-* props by MUTATING whatever object it is handed
// (see groupForwardedProps), so this has to be built fresh per render - a
// shared one picks up `aria-label: 'Users'` from the users grid and hands it to
// every other grid on the next route.
const forwardedProps = () => ({ role: 'presentation' })

/**
 * Moves the grid semantics off the DataGrid root and onto `.MuiDataGrid-main`.
 *
 * MUI X v6 puts role="grid" on the root element, which also holds the toolbar
 * and the pagination footer. A grid may only own rows and rowgroups, so every
 * grid in the app raised a critical axe `aria-required-children` ("Element has
 * children which are not allowed: ... [role=combobox], input[tabindex]").
 * `.MuiDataGrid-main` wraps exactly the column headers and the row groups,
 * which is where v8 moved the role upstream; this does the same on v6 (ui#714).
 *
 * Spread the result onto the grid:
 *
 *   const accessibleGrid = useAccessibleGrid()
 *   <DataGrid {...accessibleGrid} rows={rows} columns={columns} />
 * @returns {object} `ref` and `forwardedProps` to spread onto `<DataGrid>`.
 */
export default function useAccessibleGrid() {
  // Callback ref, not useRef: GridRoot renders null on its first pass and
  // mounts on the second, so an effect keyed off a ref object would run before
  // the element exists and never re-run.
  const [root, setRoot] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    const main = root?.querySelector<HTMLElement>('.MuiDataGrid-main')
    if (!root || !main) return

    // What has already been moved across. Needed because the move itself is a
    // mutation the observer sees: on that second pass the root no longer has
    // the attribute, which must not read as "the grid dropped it" and strip the
    // value off main. MUI only ever rewrites these, never removes them.
    const moved = new Set<string>()

    const sync = () => {
      main.setAttribute('role', 'grid')
      GRID_ATTRIBUTES.forEach((name) => {
        const value = root.getAttribute(name)
        if (value !== null) {
          main.setAttribute(name, value)
          // A presentational root may not keep them: they are grid attributes,
          // and axe reports aria-allowed-attr if they linger.
          root.removeAttribute(name)
          moved.add(name)
        } else if (!moved.has(name)) {
          main.removeAttribute(name)
        }
      })
      // Written only when it differs, so the observer never re-triggers itself.
      if (root.getAttribute('role') !== 'presentation') {
        root.setAttribute('role', 'presentation')
      }
    }

    sync()
    // The grid rewrites these as the user filters, sorts, and pages, and React
    // repaints the role it declared whenever the root element remounts.
    const observer = new MutationObserver(sync)
    observer.observe(root, {
      attributes: true,
      attributeFilter: [...GRID_ATTRIBUTES, 'role'],
    })
    return () => observer.disconnect()
  }, [root])

  return { ref: setRoot, forwardedProps: forwardedProps() }
}
