/**
 * OpDiv identity + switcher, rendered as the dashboard's page title.
 *
 * With exactly one switchable OpDiv it degrades to a static badge + name:
 * offering a dropdown that can only reselect what is already shown reads as a
 * broken control. With more than one it also offers the aggregate.
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
 * Renders the current scope and, when there is more than one to choose from,
 * a searchable switcher that routes to the selection.
 * @param {OpDivSwitcherProps} props - Current scope and the switchable set.
 * @returns {JSX.Element} The switcher.
 */
export default function OpDivSwitcher({
  opdiv,
  visible,
  isAggregate,
}: OpDivSwitcherProps) {
  const navigate = useNavigate()
  const aggregateAvailable = canAggregate(visible)
  // More than one OpDiv, or one OpDiv plus the aggregate, is something to
  // choose between; a lone OpDiv is not.
  const canSwitch = visible.length > 1

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
    ...visible.map((od) => ({
      value: String(od.opdiv_id),
      code: od.code,
      name: od.name,
    })),
  ]

  const identity = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
      {!isAggregate && opdiv && (
        <CodeBadge code={opdiv.code} muted={!opdiv.active} />
      )}
      <Typography
        component="span"
        sx={{
          fontSize: 28,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: colors.ink,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {isAggregate ? ALL_OPDIVS_LABEL : opdiv?.name ?? ''}
      </Typography>
    </Box>
  )

  if (!canSwitch) return identity

  const selected =
    options.find(
      (o) => o.value === (isAggregate ? ALL_OPDIVS : String(opdiv?.opdiv_id))
    ) ?? options[0]

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
      {identity}
      <Autocomplete
        size="small"
        options={options}
        disableClearable
        getOptionLabel={(o) => o.code}
        isOptionEqualToValue={(option, value) => option.value === value.value}
        value={selected}
        onChange={(_event, next) => {
          if (!next) return
          navigate(
            next.value === ALL_OPDIVS
              ? opdivDashboardPath(ALL_OPDIVS)
              : opdivDashboardPath(next.value)
          )
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
    </Box>
  )
}
