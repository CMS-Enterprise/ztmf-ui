/**
 * The main component that renders all routes in the application.
 * @module Root
 */
import { Outlet } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { AlertProvider } from '@/hooks/useAlert'
import DialogProvider from '@/hooks/useDialog'
import theme from '@/theme/theme'

const Root: React.FC = () => (
  <ThemeProvider theme={theme}>
    <AlertProvider>
      <DialogProvider>
        <Outlet />
      </DialogProvider>
    </AlertProvider>
  </ThemeProvider>
)

export default Root
