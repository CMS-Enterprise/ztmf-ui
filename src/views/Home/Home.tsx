import { Typography } from '@mui/material'
import FismaTable from '../FismaTable/FismaTable'
/**
 * Component that renders the contents of the Home view.
 * @returns {JSX.Element} Component that renders the home contents.
 */

export default function HomePageContainer() {
  return (
    <>
      <div>
        <Typography variant="h6" sx={{ my: 2 }} align="left">
          Welcome to the Zero Trust Maturity score dashboard!
          <br />
          This dashboard attempts to breakdown data silos and...
        </Typography>
        <FismaTable />
      </div>
    </>
  )
}
