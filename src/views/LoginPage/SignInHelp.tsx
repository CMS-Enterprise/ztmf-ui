import { useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { Modal } from '@/components/ui/Modal'
import { Block } from '@/views/HelpPage/HelpBlocks'
import { helpHeadingSx } from '@/views/HelpPage/helpStyles'
import { PUBLIC_SIGNIN_HELP } from '@/views/HelpPage/helpContent'

/**
 * "Trouble signing in?" link on the login page. Opens the sign-in steps for
 * both audiences, since who the visitor is cannot be known before sign-in.
 * Public, so it carries no ZTMF mailbox.
 * @returns {JSX.Element} The link and its dialog.
 */
export default function SignInHelp() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="text"
        size="small"
        onClick={() => setOpen(true)}
        sx={{ textTransform: 'none', fontWeight: 600 }}
      >
        Trouble signing in?
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Trouble signing in?"
        size="xl"
        footer={
          <Button variant="contained" onClick={() => setOpen(false)}>
            Close
          </Button>
        }
      >
        <Typography sx={{ mb: 3, textAlign: 'left' }}>
          {PUBLIC_SIGNIN_HELP.intro}
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gap: 4,
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            textAlign: 'left',
          }}
        >
          {PUBLIC_SIGNIN_HELP.sections.map((section) => (
            <Box key={section.title}>
              <Typography component="h3" sx={helpHeadingSx}>
                {section.title}
              </Typography>
              {section.blocks.map((block, i) => (
                <Block key={i} block={block} />
              ))}
            </Box>
          ))}
        </Box>
      </Modal>
    </>
  )
}
