/**
 * Help page: a topic rail (same pattern as the questionnaire's pillar rail)
 * beside the selected topic's guide and questions, plus contact and
 * secondary reference links.
 * @module views/HelpPage/HelpPage
 */
import { useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import MailOutlineIcon from '@mui/icons-material/MailOutline'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import BreadCrumbs from '@/components/BreadCrumbs/BreadCrumbs'
import Card from '@/components/ui/Card'
import Eyebrow from '@/components/ui/Eyebrow'
import PageHeader from '@/components/ui/PageHeader'
import CONFIG from '@/utils/config'
import { colors, radius } from '@/theme/tokens'
import { isAdmin } from '@/utils/userRoles'
import { useContextProp } from '@/views/Title/Context'
import { HELP_CONTENT, helpAudience } from './helpContent'
import { buildHelpMailto } from './helpMailto'
import { Block, HelpAccordion } from './HelpBlocks'
import { helpHeadingSx } from './helpStyles'

/**
 * Signed-in Help page, reached from the Help link beside the account menu.
 * @returns {JSX.Element} The page.
 */
export default function HelpPage() {
  const { userInfo } = useContextProp()
  const [searchParams, setSearchParams] = useSearchParams()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const {
    topics: allTopics,
    contactNote,
    contactFallback,
    links: allLinks,
  } = HELP_CONTENT[helpAudience(userInfo)]
  const topics = allTopics.filter((t) => !t.adminOnly || isAdmin(userInfo))
  const topic =
    topics.find((t) => t.id === searchParams.get('topic')) ?? topics[0]
  // Only https links render, as defense in depth against a bad entry.
  const links = allLinks.filter((link) => link.url.startsWith('https://'))
  const mailto = buildHelpMailto(CONFIG.HELP_EMAIL, window.location.host)

  const selectTopic = (id: string) => {
    if (id === topic.id) return
    // Pushed, not replaced, so Back returns to the previous topic.
    setSearchParams({ topic: id })
    // Move focus to the new content so keyboard and screen reader users land
    // on what changed.
    requestAnimationFrame(() => titleRef.current?.focus())
  }

  return (
    <Box sx={{ pt: 3, pb: 4, boxSizing: 'border-box' }}>
      <PageHeader
        title="Help"
        subtitle="Guides and common questions, by topic."
        breadcrumbs={<BreadCrumbs />}
      />
      {/* Rail | content | contact on wide screens; contact drops under the
          rail when there is room for only two columns, and everything stacks
          on narrow ones. */}
      <Box
        sx={{
          display: 'grid',
          gap: 2.5,
          alignItems: 'start',
          gridTemplateColumns: {
            xs: '1fr',
            md: '240px minmax(0, 1fr)',
            xl: '240px minmax(0, 1fr) 320px',
          },
          gridTemplateRows: { md: 'auto 1fr', xl: 'auto' },
          gridTemplateAreas: {
            xs: '"rail" "content" "aside"',
            md: '"rail content" "aside content"',
            xl: '"rail content aside"',
          },
        }}
      >
        <Box
          component="nav"
          aria-label="Help topics"
          sx={{ gridArea: 'rail', position: { md: 'sticky' }, top: { md: 16 } }}
        >
          <Card sx={{ p: 1.5 }}>
            <Eyebrow sx={{ px: 1, mb: 0.5 }}>Topics</Eyebrow>
            <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
              {topics.map((t) => {
                const current = t.id === topic.id
                return (
                  <li key={t.id}>
                    <Box
                      component="button"
                      type="button"
                      aria-current={current ? 'page' : undefined}
                      onClick={() => selectTopic(t.id)}
                      sx={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        border: 'none',
                        font: 'inherit',
                        fontSize: 14,
                        px: 1,
                        py: 0.75,
                        borderRadius: `${radius.sm}px`,
                        cursor: 'pointer',
                        backgroundColor: current
                          ? colors.primary50
                          : 'transparent',
                        color: current ? colors.ink900 : colors.ink,
                        fontWeight: current ? 600 : 500,
                        '&:hover': {
                          backgroundColor: current
                            ? colors.primary50
                            : colors.neutral50,
                        },
                        '&:focus-visible': {
                          outline: `2px solid ${colors.primary}`,
                          outlineOffset: 1,
                        },
                      }}
                    >
                      {t.title}
                    </Box>
                  </li>
                )
              })}
            </Box>
          </Card>
        </Box>

        <Card
          id="help-topic"
          role="region"
          aria-labelledby="help-topic-title"
          sx={{ gridArea: 'content', p: { xs: 2.25, md: 3 } }}
        >
          {/* Readable line length on wide screens. */}
          <Box sx={{ maxWidth: 860 }}>
            <Typography
              component="h2"
              id="help-topic-title"
              ref={titleRef}
              tabIndex={-1}
              sx={{
                fontSize: 22,
                fontWeight: 700,
                color: colors.ink,
                mb: 2,
                '&:focus': { outline: 'none' },
              }}
            >
              {topic.title}
            </Typography>
            {topic.blocks.map((block, i) => (
              <Block key={i} block={block} />
            ))}
            {topic.faq.length > 0 && (
              <>
                <Typography component="h3" sx={{ ...helpHeadingSx, mt: 3 }}>
                  Common questions
                </Typography>
                <Box
                  sx={{
                    border: `1px solid ${colors.neutral200}`,
                    borderRadius: `${radius.sm}px`,
                    overflow: 'hidden',
                  }}
                >
                  {topic.faq.map((item, i) => (
                    <HelpAccordion
                      key={`${topic.id}-${i}`}
                      id={`${topic.id}-faq-${i}`}
                      title={item.question}
                    >
                      <Typography>{item.answer}</Typography>
                    </HelpAccordion>
                  ))}
                </Box>
              </>
            )}
          </Box>
        </Card>

        <Box
          component="aside"
          aria-label="Contact and resources"
          sx={{
            gridArea: 'aside',
            display: 'grid',
            gap: 2.5,
            position: { xl: 'sticky' },
            top: { xl: 16 },
          }}
        >
          <Card id="contact" role="region" aria-labelledby="help-contact">
            <Typography component="h2" id="help-contact" sx={helpHeadingSx}>
              Contact us
            </Typography>
            {mailto ? (
              <>
                <Typography sx={{ fontSize: 14, mb: 1.5 }}>
                  Can’t find what you need? Email the Zero Trust team with your
                  browser, operating system, and what you were doing.
                </Typography>
                <Button
                  variant="contained"
                  href={mailto}
                  startIcon={<MailOutlineIcon />}
                  fullWidth
                >
                  Email the Zero Trust team
                </Button>
                <Typography
                  sx={{ fontSize: 13, color: colors.neutral500, mt: 1.5 }}
                >
                  {contactNote}
                </Typography>
              </>
            ) : (
              // The fallback already names the channel, so no extra note.
              <Typography sx={{ fontSize: 14 }}>{contactFallback}</Typography>
            )}
          </Card>

          {links.length > 0 && (
            <Card id="resources" role="region" aria-labelledby="help-resources">
              <Typography component="h2" id="help-resources" sx={helpHeadingSx}>
                More resources
              </Typography>
              <Typography
                sx={{ fontSize: 13, color: colors.neutral500, mb: 1 }}
              >
                External sites, which may move.
              </Typography>
              <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                {links.map((link) => (
                  <Box component="li" key={link.url} sx={{ py: 0.5 }}>
                    <Link
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${link.title} (opens in a new tab)`}
                      sx={{
                        color: colors.primary,
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      {link.title}
                      {/* Inline, not flex, so the icon follows the last word
                          when a long title wraps. */}
                      <OpenInNewIcon
                        sx={{ fontSize: 14, ml: 0.5, verticalAlign: '-2px' }}
                        aria-hidden
                      />
                    </Link>
                    <Typography sx={{ fontSize: 13, color: colors.neutral500 }}>
                      {link.description}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Card>
          )}
        </Box>
      </Box>
    </Box>
  )
}
