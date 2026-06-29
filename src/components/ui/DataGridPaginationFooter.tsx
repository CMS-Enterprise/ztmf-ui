import { Box, MenuItem, Pagination, Select, Typography } from '@mui/material'
import {
  gridFilteredTopLevelRowCountSelector,
  gridPageCountSelector,
  gridPaginationModelSelector,
  useGridApiContext,
  useGridSelector,
} from '@mui/x-data-grid'
import { colors, radius } from '@/theme/tokens'

const EN_DASH = '–'

/** Props for {@link DataGridPaginationFooter}. */
export type DataGridPaginationFooterProps = {
  /** Page-size options shown in the dropdown. Defaults to [25, 50, 100]. */
  pageSizes?: number[]
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
}: DataGridPaginationFooterProps) {
  const apiRef = useGridApiContext()
  const model = useGridSelector(apiRef, gridPaginationModelSelector)
  const pageCount = useGridSelector(apiRef, gridPageCountSelector)
  const rowCount = useGridSelector(apiRef, gridFilteredTopLevelRowCountSelector)
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
