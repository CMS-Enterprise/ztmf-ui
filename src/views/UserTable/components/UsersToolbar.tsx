import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import InputBase from '@mui/material/InputBase'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import SearchIcon from '@mui/icons-material/Search'
import CompactSwitchLabel from '@/components/ui/CompactSwitchLabel'
import { colors, radius } from '@/theme/tokens'
import type { OpDiv } from '@/types'

/** Props for {@link UsersToolbar}. */
export interface UsersToolbarProps {
  /** Controlled search string forwarded to the DataGrid as quickFilterValues. */
  search: string
  /** Search input change handler. */
  setSearch: (value: string) => void
  /** Currently selected role filter, or 'all'. */
  roleFilter: string | 'all'
  /** Role filter change handler. */
  setRoleFilter: (value: string | 'all') => void
  /** Role options present in the loaded row set (value + humanized label). */
  roleOptions: { value: string; label: string }[]
  /** Currently selected OpDiv id filter, or 'all'. */
  opdivFilter: number | 'all'
  /** OpDiv filter change handler. */
  setOpDivFilter: (value: number | 'all') => void
  /** Full OpDiv list available to the actor. */
  opdivOptions: OpDiv[]
  /** Whether the table is showing deactivated users. */
  showDeleted: boolean
  /** "Show deactivated" toggle handler. */
  setShowDeleted: (value: boolean) => void
  /** Whether the grid is filtered to users with no recorded activity. */
  noActivityOnly: boolean
  /** "No activity only" toggle handler (injects an isEmpty last_seen filter). */
  setNoActivityOnly: (value: boolean) => void
}

/**
 * Toolbar inside the Users table card. Mirrors the Dashboard FISMA-systems
 * toolbar: search input, Role and OpDiv filter dropdowns, and a
 * "Show deactivated" toggle, all sharing a uniform 30px row.
 * @param {UsersToolbarProps} props - Controlled state + setters from the
 *   parent UserTable view.
 * @returns {JSX.Element} The toolbar row.
 */
export default function UsersToolbar({
  search,
  setSearch,
  noActivityOnly,
  setNoActivityOnly,
  roleFilter,
  setRoleFilter,
  roleOptions,
  opdivFilter,
  setOpDivFilter,
  opdivOptions,
  showDeleted,
  setShowDeleted,
}: UsersToolbarProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'end',
        gap: 1.5,
        px: 2.25,
        py: 1.5,
        borderBottom: `1px solid ${colors.neutral200}`,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          height: 30,
          border: `1px solid ${colors.border}`,
          borderRadius: `${radius.md}px`,
        }}
      >
        <SearchIcon sx={{ fontSize: 14, color: colors.neutral500 }} />
        <InputBase
          placeholder="Search by name, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ fontSize: 13, width: 220 }}
          inputProps={{ 'aria-label': 'Search users' }}
        />
      </Box>
      <Autocomplete
        size="small"
        options={roleOptions}
        getOptionLabel={(opt) => opt.label}
        isOptionEqualToValue={(option, value) => option.value === value.value}
        value={
          roleFilter === 'all'
            ? null
            : roleOptions.find((opt) => opt.value === roleFilter) ?? null
        }
        onChange={(_event, opt) => setRoleFilter(opt ? opt.value : 'all')}
        sx={{
          width: 200,
          '& .MuiInputBase-root': {
            height: 30,
            fontSize: 13,
            py: '0 !important',
          },
          '& .MuiAutocomplete-input': { py: '0 !important' },
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Role"
            inputProps={{
              ...params.inputProps,
              'aria-label': 'Filter by role',
            }}
          />
        )}
      />
      <Autocomplete
        size="small"
        options={opdivOptions}
        getOptionLabel={(od) => od.code}
        isOptionEqualToValue={(option, value) =>
          option.opdiv_id === value.opdiv_id
        }
        value={
          opdivFilter === 'all'
            ? null
            : opdivOptions.find((od) => od.opdiv_id === opdivFilter) ?? null
        }
        onChange={(_event, od) => setOpDivFilter(od ? od.opdiv_id : 'all')}
        renderOption={(props, option) => {
          const { key, ...rest } = props
          return (
            <li key={key} {...rest}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  width: '100%',
                }}
              >
                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                  {option.code}
                </Typography>
                <Typography sx={{ fontSize: 12, color: colors.neutral500 }}>
                  {option.name}
                </Typography>
              </Box>
            </li>
          )
        }}
        sx={{
          width: 180,
          '& .MuiInputBase-root': {
            height: 30,
            fontSize: 13,
            py: '0 !important',
          },
          '& .MuiAutocomplete-input': { py: '0 !important' },
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="OpDiv"
            inputProps={{
              ...params.inputProps,
              'aria-label': 'Filter by OpDiv',
            }}
          />
        )}
      />
      <CompactSwitchLabel
        checked={noActivityOnly}
        onChange={setNoActivityOnly}
        label="No activity only"
      />
      <CompactSwitchLabel
        checked={showDeleted}
        onChange={setShowDeleted}
        label="Show deactivated"
      />
    </Box>
  )
}
