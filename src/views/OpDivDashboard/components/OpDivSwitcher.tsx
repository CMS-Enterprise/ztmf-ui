/**
 * OpDiv identity (the page title) and the switcher (a header action).
 *
 * The switcher is omitted when there is only one option: a dropdown that can
 * only reselect what is already shown reads as a broken control.
 *
 * @module views/OpDivDashboard/components/OpDivSwitcher
 */
import { useNavigate } from 'react-router-dom'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { CodeBadge } from '@/components/ui/StatusChip'
import { opdivDashboardPath } from '@/router/constants'
import { colors } from '@/theme/tokens'
import type { OpDiv } from '@/types'
import { ALL_OPDIVS, canAggregate } from '../useOpDivScope'

/** Label shown for the aggregate option and title. */
export const ALL_OPDIVS_LABEL = 'All OpDivs'

/** One entry in the switcher: a real OpDiv, or the aggregate. */
type SwitcherOption = {
  /** Route segment - an OpDiv id, or the aggregate sentinel. */
  value: string
  /** Short label, shown in the closed input. */
  code: string
  /** Secondary line in the dropdown. */
  name: string
}

/** Props for {@link OpDivSwitcher}. */
export type OpDivSwitcherProps = {
  /** The OpDiv currently being viewed, or null in the aggregate view. */
  opdiv: OpDiv | null
  /** The OpDivs this user may switch between. */
  visible: OpDiv[]
  /** Whether the page currently covers every visible OpDiv. */
  isAggregate: boolean
}

/**
 * The page title: the OpDiv's code badge and name, or the aggregate label.
 * Plain text only - it renders inside PageHeader's h1.
 * @param {object} props - The current scope.
 * @returns {JSX.Element} The title content.
 */
export function OpDivTitle({
  opdiv,
  isAggregate,
}: Pick<OpDivSwitcherProps, 'opdiv' | 'isAggregate'>) {
  if (isAggregate || !opdiv) return <>{ALL_OPDIVS_LABEL}</>
  return (
    <Box
      component="span"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.5 }}
    >
      <CodeBadge code={opdiv.code} muted={!opdiv.active} />
      {opdiv.name}
    </Box>
  )
}

/**
 * A searchable switcher that routes to the selection, or nothing when there
 * is only one place to go.
 * @param {OpDivSwitcherProps} props - Current scope and the switchable set.
 * @returns {JSX.Element | null} The switcher.
 */
export default function OpDivSwitcher({
  opdiv,
  visible,
  isAggregate,
}: OpDivSwitcherProps) {
  const navigate = useNavigate()
  const aggregateAvailable = canAggregate(visible)
  // An OpDiv opened by URL that is not switchable (inactive) still has to read
  // as the current selection rather than falling back to another option.
  const current =
    !isAggregate &&
    opdiv &&
    !visible.some((od) => od.opdiv_id === opdiv.opdiv_id)
      ? opdiv
      : null

  const options: SwitcherOption[] = [
    ...(aggregateAvailable
      ? [
          {
            value: ALL_OPDIVS,
            code: ALL_OPDIVS_LABEL,
            name: `Every OpDiv you can see (${visible.length})`,
          },
        ]
      : []),
    ...(current
      ? [
          {
            value: String(current.opdiv_id),
            code: current.code,
            name: `${current.name}${current.active ? '' : ' (inactive)'}`,
          },
        ]
      : []),
    ...visible.map((od) => ({
      value: String(od.opdiv_id),
      code: od.code,
      name: od.name,
    })),
  ]

  // A lone option can only reselect what is already shown.
  if (options.length < 2) return null

  const selected =
    options.find(
      (o) => o.value === (isAggregate ? ALL_OPDIVS : String(opdiv?.opdiv_id))
    ) ?? options[0]

  return (
    <Autocomplete
      size="small"
      options={options}
      disableClearable
      getOptionLabel={(o) => o.code}
      isOptionEqualToValue={(option, value) => option.value === value.value}
      value={selected}
      onChange={(_event, next) => {
        if (!next) return
        navigate(opdivDashboardPath(next.value))
      }}
      renderOption={(props, option) => {
        const { key, ...rest } = props
        return (
          <li key={key} {...rest}>
            <Box
              sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}
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
      sx={{ width: 165, flexShrink: 0 }}
      renderInput={(params) => (
        <TextField
          {...params}
          inputProps={{
            ...params.inputProps,
            'aria-label': 'Switch OpDiv',
          }}
        />
      )}
    />
  )
}
