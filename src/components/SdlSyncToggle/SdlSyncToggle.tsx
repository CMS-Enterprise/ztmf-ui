import { Box, FormControlLabel, Switch, Typography } from '@mui/material'
import {
  SDL_SYNC_DESCRIPTION_ON,
  SDL_SYNC_DESCRIPTION_OFF,
  SDL_SYNC_SWITCH_SX,
} from '@/constants'

interface SdlSyncToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
}

export default function SdlSyncToggle({
  checked,
  onChange,
}: SdlSyncToggleProps) {
  return (
    <Box>
      <FormControlLabel
        control={
          <Switch
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            sx={SDL_SYNC_SWITCH_SX}
          />
        }
        label={
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Sync to SDL (Snowflake)
          </Typography>
        }
      />
      <Typography
        variant="caption"
        sx={{ display: 'block', ml: 4, color: 'text.secondary' }}
      >
        {checked ? SDL_SYNC_DESCRIPTION_ON : SDL_SYNC_DESCRIPTION_OFF}
      </Typography>
    </Box>
  )
}
