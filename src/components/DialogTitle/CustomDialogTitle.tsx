import * as React from 'react'
import DialogTitle from '@mui/material/DialogTitle'
import Typography from '@mui/material/Typography'
/**
 * Component that renders the title of the dialog.
 * @param {string} title - The title to be displayed.
 * @returns {JSX.Element} Component that renders the title of the dialog.
 */
type CustomDialogTitleProps = {
  title: string
}
export default function CustomDialogTitle({ title }: CustomDialogTitleProps) {
  return (
    <DialogTitle align="center">
      <div>
        <Typography variant="h3">{title}</Typography>
      </div>
    </DialogTitle>
  )
}
