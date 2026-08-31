import { Box, MenuItem, Pagination, Select, Typography } from '@mui/material'
import {
  gridFilteredTopLevelRowCountSelector,
  gridPageCountSelector,
  gridPaginationModelSelector,
  useGridApiContext,
  useGridSelector,
} from '@mui/x-data-grid'
import { colors, radius } from '@/theme/tokens'

// Let a DataGrid pass these through `slotProps={{ footer: { ... } }}` with
// type-checking; without the augmentation MUI types the footer slot as bare
// div props and rejects them.
declare module '@mui/x-data-grid' {
  interface FooterPropsOverrides {
    pageSizes?: number[]
    rowCount?: number
  }
}

const EN_DASH = '–'

/** Props for {@link DataGridPaginationFooter}. */
export type DataGridPaginationFooterProps = {
  /** Page-size options shown in the dropdown. Defaults to [25, 50, 100]. */
  pageSizes?: number[]
  /**
   * Total row count for a server-paginated grid. The grid only holds the
   * current page's rows in server mode, so the client-side filtered selector
   * would report the page length, not the total. Omit for client-paginated
   * grids, where the filtered count is the right "of N".
   */
  rowCount?: number
}

/**
 * Shared pagination footer for every DataGrid in the app. Renders "Showing
 * n-m of N" on the left and a Rows-per-page selector + numbered Pagination
 * buttons on the right, all styled per the redesign (filled active page in
 * primary, outlined siblings, 28x28 with the button radius).
 *
 * Pass it into a DataGrid via `slots={{ footer: DataGridPaginationFooter }}`.
 * @param {DataGridPaginationFooterProps} props - Optional page-size choices.
 * @returns {JSX.Element} The footer row.
 */
export function DataGridPaginationFooter({
  pageSizes = [25, 50, 100],
  rowCount: rowCountProp,
}: DataGridPaginationFooterProps) {
  const apiRef = useGridApiContext()
  const model = useGridSelector(apiRef, gridPaginationModelSelector)
  const pageCount = useGridSelector(apiRef, gridPageCountSelector)
  const filteredCount = useGridSelector(
    apiRef,
    gridFilteredTopLevelRowCountSelector
  )
  // Server-paginated grids pass the true total; client-paginated grids fall
  // back to the filtered count so search narrows the "of N" as expected.
  const rowCount = rowCountProp ?? filteredCount
  const start = rowCount === 0 ? 0 : model.page * model.pageSize + 1
  const end = Math.min((model.page + 1) * model.pageSize, rowCount)

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2.25,
        py: 1.5,
        backgroundColor: colors.neutral50,
        borderTop: `1px solid ${colors.neutral200}`,
      }}
    >
      <Typography sx={{ fontSize: 13, color: colors.neutral500 }}>
        Showing {start}
        {EN_DASH}
        {end} of {rowCount}
      </Typography>
      <Box
        sx={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <Typography sx={{ fontSize: 13, color: colors.neutral700 }}>
          Rows
        </Typography>
        <Select
          size="small"
          value={model.pageSize}
          onChange={(e) =>
            apiRef.current.setPaginationModel({
              page: 0,
              pageSize: Number(e.target.value),
            })
          }
          sx={{ fontSize: 13, '& .MuiSelect-select': { py: 0.75 } }}
        >
          {pageSizes.map((n) => (
            <MenuItem key={n} value={n}>
              {n}
            </MenuItem>
          ))}
        </Select>
        <Pagination
          count={pageCount}
          page={model.page + 1}
          onChange={(_event, value) =>
            apiRef.current.setPaginationModel({ ...model, page: value - 1 })
          }
          siblingCount={1}
          sx={{
            // The global stylesheet stacks ul items; force the pagination's
            // ul into a single nowrap row so the buttons read left to right.
            '& .MuiPagination-ul': {
              flexDirection: 'row',
              flexWrap: 'nowrap',
              alignItems: 'center',
              gap: 0.25,
            },
            '& .MuiPaginationItem-root': {
              minWidth: 28,
              height: 28,
              margin: 0,
              borderRadius: `${radius.button}px`,
              border: `1px solid ${colors.neutral200}`,
              fontSize: 13,
            },
            '& .MuiPaginationItem-root.Mui-selected': {
              backgroundColor: colors.primary,
              borderColor: colors.primary,
              color: colors.white,
              '&:hover': { backgroundColor: colors.primary },
            },
          }}
        />
      </Box>
    </Box>
  )
}

export default DataGridPaginationFooter
