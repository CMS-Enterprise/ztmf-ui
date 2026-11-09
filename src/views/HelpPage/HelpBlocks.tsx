/**
 * Renders Help content blocks and question accordions, shared by the
 * signed-in Help page and the login page's sign-in help dialog.
 * @module views/HelpPage/HelpBlocks
 */
import { ReactNode } from 'react'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import BarChartIcon from '@mui/icons-material/BarChart'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import QuestionAnswerOutlinedIcon from '@mui/icons-material/QuestionAnswerOutlined'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { colors } from '@/theme/tokens'
import { helpHeadingSx } from './helpStyles'
import type {
  HelpBlock,
  HelpIcon,
  HelpInlineLink,
  HelpListItem,
} from './helpContent'

// The same icons the dashboard rows use, so the guide matches what users see.
const ICONS: Record<HelpIcon, typeof BarChartIcon> = {
  questionnaire: QuestionAnswerOutlinedIcon,
  pillarScores: BarChartIcon,
  systemDetails: VisibilityIcon,
}

function InlineLink({ link }: { link: HelpInlineLink }) {
  return (
    <>
      {' '}
      <Link
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${link.label} (opens in a new tab)`}
        sx={{
          color: colors.primary,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.25,
        }}
      >
        {link.label}
        <OpenInNewIcon sx={{ fontSize: 14 }} aria-hidden />
      </Link>
    </>
  )
}

function ListItem({ item }: { item: HelpListItem }) {
  if (typeof item === 'string') {
    return (
      <Typography component="li" sx={{ mb: 0.75 }}>
        {item}
      </Typography>
    )
  }
  if ('link' in item) {
    return (
      <Typography component="li" sx={{ mb: 0.75 }}>
        {item.text}
        <InlineLink link={item.link} />
      </Typography>
    )
  }
  const Icon = ICONS[item.icon]
  return (
    <Typography
      component="li"
      sx={{
        mb: 0.75,
        ml: -3,
        listStyle: 'none',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
      }}
    >
      <Icon
        aria-hidden
        sx={{ fontSize: 20, mt: '2px', color: colors.primary, flexShrink: 0 }}
      />
      <span>{item.text}</span>
    </Typography>
  )
}

export function Block({ block }: { block: HelpBlock }) {
  if (block.kind === 'heading') {
    return (
      <Typography component="h3" sx={{ ...helpHeadingSx, mt: 3 }}>
        {block.text}
      </Typography>
    )
  }
  if (block.kind === 'text') {
    return (
      <Typography sx={{ mb: 1.5 }}>
        {block.text}
        {block.link && <InlineLink link={block.link} />}
      </Typography>
    )
  }
  if (block.kind === 'list') {
    return (
      <Box component="ul" sx={{ mt: 0, mb: 1.5, pl: 3 }}>
        {block.items.map((item, i) => (
          <ListItem key={i} item={item} />
        ))}
      </Box>
    )
  }
  return (
    <Table size="small" sx={{ mb: 1.5 }}>
      <TableHead>
        <TableRow>
          {block.head.map((cell, i) => (
            <TableCell key={i} sx={{ fontWeight: 700 }}>
              {cell}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {block.rows.map((row, r) => (
          <TableRow key={r}>
            {row.map((cell, c) => (
              <TableCell key={c}>{cell}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// The heading wraps the summary button rather than sitting inside it: a
// button's children are presentational, so an inner h4 is lost to screen
// readers' heading navigation. Accordion reads id/aria-controls off its first
// child, so this wrapper takes them and passes them to the summary.
function SummaryHeading({
  id,
  'aria-controls': controls,
  title,
}: {
  id: string
  'aria-controls': string
  title: string
}) {
  return (
    <Typography component="h4" sx={{ m: 0, fontSize: 'inherit' }}>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        id={id}
        aria-controls={controls}
        sx={{
          '&.Mui-expanded': {
            backgroundColor: colors.neutral50,
            borderBottom: `1px solid ${colors.neutral200}`,
          },
        }}
      >
        <Box component="span" sx={{ fontWeight: 600 }}>
          {title}
        </Box>
      </AccordionSummary>
    </Typography>
  )
}

export function HelpAccordion({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    // An explicit divider on every panel: MUI's default one disappears around
    // an expanded panel, which ran the open body into the next heading.
    <Accordion
      disableGutters
      elevation={0}
      sx={{
        borderTop: `1px solid ${colors.neutral200}`,
        '&:first-of-type': { borderTop: 'none' },
        '&::before': { display: 'none' },
      }}
    >
      <SummaryHeading
        id={`${id}-header`}
        aria-controls={`${id}-content`}
        title={title}
      />
      <AccordionDetails sx={{ pt: 2, pb: 2.5 }}>{children}</AccordionDetails>
    </Accordion>
  )
}
