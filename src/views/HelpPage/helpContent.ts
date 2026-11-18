/**
 * Static content for the Help page. Plain strings only; edit here, no API.
 * Content is grouped into topics, each with its guide and the questions that
 * belong to it. External links are a secondary list that can go stale
 * without leaving users stranded.
 * Sourced from the ISPG TIPS training docs, checked against current app
 * behavior where the two disagree. CMS content stays CMS-only.
 * @module views/HelpPage/helpContent
 */
import type { userData } from '@/types'
import { UNKNOWN_EMAIL_MESSAGE } from '@/utils/authCodes'
import { MAX_QUESTIONNAIRE_NOTES_LENGTH } from '@/constants'
import { SCORING_FORMULA } from '@/utils/tierStyles'

/** Row-action icons from the dashboard, drawn live so they never go stale. */
export type HelpIcon = 'systemDetails' | 'pillarScores' | 'questionnaire'

/** An inline link after a step, e.g. to the tool the step names. */
export type HelpInlineLink = { label: string; url: string }

export type HelpListItem =
  | string
  | { icon: HelpIcon; text: string }
  | { text: string; link: HelpInlineLink }

export type HelpBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'text'; text: string; link?: HelpInlineLink }
  | { kind: 'list'; items: HelpListItem[] }
  | { kind: 'table'; head: string[]; rows: string[][] }

export type HelpFaqItem = {
  question: string
  answer: string
}

export type HelpTopic = {
  /** Stable slug, used in the ?topic= URL param. */
  id: string
  title: string
  blocks: HelpBlock[]
  faq: HelpFaqItem[]
  /** Shown only to write admins (Owner, HHS Admin, OpDiv Admin). */
  adminOnly?: boolean
}

export type HelpLink = {
  title: string
  description: string
  url: string
}

export type HelpAudience = 'cms' | 'hhs'

export type HelpContent = {
  topics: HelpTopic[]
  /** Extra line in the Contact card, e.g. another support channel. */
  contactNote: string
  /** Shown in place of the email button when no help address is configured. */
  contactFallback: string
  links: HelpLink[]
}

/**
 * Picks CMS or HHS help content. identity_provider is derived server-side from
 * OpDiv grants (CMS grant => okta), so it is the CMS/HHS split; a missing value
 * is treated as CMS, matching the pre-multi-IdP backfill.
 * @param {Pick<userData, 'identity_provider'>} user - The signed-in user.
 * @returns {HelpAudience} Which content set to show.
 */
export const helpAudience = (
  user: Pick<userData, 'identity_provider'>
): HelpAudience => (user.identity_provider === 'entra' ? 'hhs' : 'cms')

const NOTES_LIMIT = MAX_QUESTIONNAIRE_NOTES_LENGTH.toLocaleString()

const EUA_LINK: HelpInlineLink = {
  label: 'Open EUA',
  url: 'https://eua.cms.gov',
}
const IDM_LINK: HelpInlineLink = {
  label: 'Open CMS IDM',
  url: 'https://idm.cms.gov',
}

const DATA_CALL_INTRO: HelpBlock = {
  kind: 'text',
  text: 'The Zero Trust data call is the annual process in which ISSOs and System Owners report how each FISMA system aligns with the Zero Trust principles in OMB M-22-09 and M-24-14. ZTMF collects the answers, scores them, and keeps them year over year so progress can be compared.',
}

// ------------------------------------------------------- getting started

const CMS_ACCESS: HelpBlock[] = [
  {
    kind: 'list',
    items: [
      {
        text: 'Request the ZTMF_SCORING_USER job code in EUA. In the justification, include your Component and Group and the FISMA systems you need, for example "Requesting access to ZTMF as the ISSO for <system>, in <Component>/<Group>." Leaving out the systems delays your access.',
        link: EUA_LINK,
      },
      'Your account needs a cms.hhs.gov email address. If you do not have one, request the LAN_EMAIL job code in EUA, with your contract number in the justification.',
      'Once approved, enter your cms.hhs.gov email on the ZTMF sign-in page and select Continue. You sign in with CMS IDM (Okta) and MFA; there is no separate ZTMF password.',
      'After signing in, check that your FISMA systems are listed on the dashboard. If one is missing, contact the Zero Trust team.',
    ],
  },
  {
    kind: 'text',
    text: 'Before requesting LAN_EMAIL: if your IDM one-time codes go to your work email, switch IDM to SMS, Google Authenticator or Okta Verify first. IDM moves code delivery to the new CMS address, which you cannot read until Outlook is set up, and you cannot reach VDI or Zscaler to set it up without a code. You can switch back once your email works.',
    link: IDM_LINK,
  },
]

const HHS_ACCESS: HelpBlock[] = [
  {
    kind: 'list',
    items: [
      'Your OpDiv Admin adds you to the HHS Entra group for ZTMF. The Zero Trust team cannot provision or troubleshoot HHS access.',
      'Enter your work email on the ZTMF sign-in page and select Continue. You sign in with HHS Entra; there is no separate ZTMF password.',
      'After signing in, check that your FISMA systems are listed on the dashboard. If one is missing, ask your OpDiv Admin.',
    ],
  },
]

const CMS_START: HelpTopic = {
  id: 'getting-started',
  title: 'Getting started',
  blocks: [
    DATA_CALL_INTRO,
    { kind: 'heading', text: 'Getting access' },
    ...CMS_ACCESS,
  ],
  faq: [
    {
      question: 'Why do I need a cms.hhs.gov email address?',
      answer:
        'ZTMF accounts for CMS users are tied to a cms.hhs.gov address. If you do not have one, request the LAN_EMAIL job code in EUA, and change your IDM MFA method away from email first.',
    },
    {
      question: 'Can a contractor help complete our data call?',
      answer:
        'A contractor who needs to answer for a system requests their own ZTMF access through EUA and is assigned the system. The System Delegate role is not used at CMS.',
    },
  ],
}

const HHS_START: HelpTopic = {
  id: 'getting-started',
  title: 'Getting started',
  blocks: [
    DATA_CALL_INTRO,
    { kind: 'heading', text: 'Getting access' },
    ...HHS_ACCESS,
  ],
  faq: [
    {
      question: 'I can’t sign in.',
      answer: `If you see "${UNKNOWN_EMAIL_MESSAGE}", check the spelling of your email. If it is right, your account has not been set up yet. Contact your OpDiv Admin, or zerotrust@hhs.gov if you do not know who that is.`,
    },
    {
      question: 'Is using ZTMF mandatory?',
      answer:
        'Yes. ZTMF replaces the spreadsheet process for all HHS OpDivs from the FY2026 data call on.',
    },
  ],
}

// ---------------------------------------------------------- your systems

const systemsTopic = (audience: HelpAudience): HelpTopic => ({
  id: 'systems',
  title: 'Your systems',
  blocks: [
    {
      kind: 'text',
      text: 'The dashboard lists the systems you can see: your assigned systems, or every system you oversee if you are an admin. Each row has three actions:',
    },
    {
      kind: 'list',
      items: [
        {
          icon: 'questionnaire',
          text: 'Questionnaire: where you answer the data call questions.',
        },
        {
          icon: 'pillarScores',
          text: 'Pillar scores: the overall score and tier, a score for each pillar, and the change from the previous data call.',
        },
        {
          icon: 'systemDetails',
          text:
            audience === 'hhs'
              ? 'System details: the system’s FISMA record, its target maturity, and (where enabled) its System Delegates.'
              : 'System details: the system’s FISMA record and its target maturity.',
        },
      ],
    },
    {
      kind: 'list',
      items: [
        'Search, Open data call only and Not updated only narrow the list. Show decommissioned switches the list to retired systems only.',
        'Data Call Progress counts the questions answered or confirmed this data call.',
        'Export CSV downloads the systems in the data call, or only the rows you select.',
      ],
    },
  ],
  faq: [
    audience === 'cms'
      ? {
          question: 'I don’t see a system that I oversee.',
          answer:
            'You only see systems assigned to you. Contact the Zero Trust team with the system name and your role, and they will check the assignment.',
        }
      : {
          question: 'I don’t see a system that I oversee.',
          answer:
            'OpDiv system lists are loaded in advance, but you only see systems assigned to you. Ask your OpDiv Admin to assign the system, or to add it if it is missing.',
        },
    {
      question: 'A system’s details are wrong.',
      answer: `Admins can correct it on the System details page with Edit. ISSOs and ISSMs can change only the target maturity there; report anything else to ${audience === 'cms' ? 'the Zero Trust team' : 'your OpDiv Admin'}.`,
    },
  ],
})

// --------------------------------------------------------- questionnaire

const QUESTIONNAIRE_TOPIC: HelpTopic = {
  id: 'questionnaire',
  title: 'The questionnaire',
  blocks: [
    {
      kind: 'list',
      items: [
        'Pillars are listed on the left and that pillar’s questions on the right. Move one question at a time with Previous and Next question.',
        'Each question has one multiple-choice answer and a notes box. Pick the answer that best describes the system today and use the notes to justify it.',
        `Notes are limited to ${NOTES_LIMIT} characters.`,
        'The strip above the answers shows the system’s baseline, set by its FIPS impact level. You can choose a higher level; use the notes to explain what supports it.',
        'Next question and Complete save your answer. Unsaved edits are kept as a draft in this browser and restored automatically when you return; ZTMF warns you before you leave a question without saving.',
        'View history shows an answer’s earlier versions and lets you undo a change.',
        'SaaS systems answer fewer questions: the Devices and Applications & Workloads pillars do not apply, because the provider owns that infrastructure.',
        'After the data call deadline, the questionnaire is read-only except for admins.',
        'Target maturity is set separately, on the System details page, by ISSOs, ISSMs and admins.',
      ],
    },
    { kind: 'heading', text: 'Comparing data calls' },
    {
      kind: 'text',
      text: 'Use Compare datacalls on the questionnaire or pillar scores page to see how a system’s answers changed between two data calls. Pick them in From and To. Each answer shows its score, who changed it (with their role), and when.',
    },
  ],
  faq: [
    {
      question: 'Do I have to re-answer every question each year?',
      answer:
        'No. Answers from the previous data call carry forward. Review each one and select Confirm this answer is still accurate, or change it if the system has changed. Carried-forward answers do not count as progress until you confirm or change them.',
    },
    {
      question: 'Why is Next question disabled?',
      answer:
        'You changed an answer that was already saved. Update its notes to reflect the new answer, and Next question becomes available again.',
    },
    {
      question: 'Why can’t I edit my answers?',
      answer:
        'The data call deadline has passed, you hold a read-only role, or the system is not assigned to you. After the deadline only admins can change answers.',
    },
    {
      question: 'Who changed this answer?',
      answer:
        'The bottom of the questionnaire shows who last edited the answer, their role, and when. View history lists earlier versions, and Compare datacalls shows changes between two data calls.',
    },
  ],
}

// --------------------------------------------------------------- scoring

const SCORING_TOPIC: HelpTopic = {
  id: 'scoring',
  title: 'Scoring',
  blocks: [
    { kind: 'text', text: SCORING_FORMULA },
    {
      kind: 'text',
      text: 'The system score sets its tier. Cutoffs apply to the score as displayed, rounded to two decimals:',
    },
    {
      kind: 'table',
      head: ['Tier', 'Score range'],
      rows: [
        ['Optimal', '4.10 and above'],
        ['Advanced', '3.10 to 4.09'],
        ['Initial', '2.10 to 3.09'],
        ['Traditional', '1.01 to 2.09'],
      ],
    },
    {
      kind: 'list',
      items: [
        'Scores update automatically as answers are saved.',
        'The formula and tier cutoffs apply to every data call, including past ones.',
        'From the FY26 data call on, SaaS systems are scored on four pillars: Identity, Networks, Data, and Cross-Cutting. Devices and Applications do not affect their score.',
        'Cross-Cutting covers Governance, Automation & Orchestration, and Visibility & Analytics, which apply across all the other pillars.',
      ],
    },
  ],
  faq: [
    {
      question: 'Will my system be penalized for a low tier?',
      answer:
        'No. Scoring is not punitive. The goal is an accurate picture of each system so the agency can improve its security posture. An honest Traditional is more useful than an inflated Advanced.',
    },
    {
      question: 'Why did my tier drop when my answers did not change?',
      answer:
        'The tier cutoffs were raised in 2026 and apply to every data call, including past ones, so some systems now read one tier lower. Your answers were not changed.',
    },
  ],
}

// ----------------------------------------------------------------- roles

const CMS_ROLE_ROWS: string[][] = [
  ['Owner', 'Administers the tool: users, FISMA systems and data calls.'],
  [
    'OpDiv Admin',
    'Manages CMS users and roles, adds and assigns FISMA systems, corrects system data, and views all CMS data.',
  ],
  [
    'OpDiv Read-only Admin',
    'Views CMS dashboards, scores and responses. No changes.',
  ],
  [
    'ISSO / System Owner',
    'Completes the data call for their assigned systems, owns the accuracy of the answers, and sets target maturity.',
  ],
  [
    'ISSM',
    'Oversees ISSO completion for their assigned systems and can set target maturity.',
  ],
]

const HHS_ROLE_ROWS: string[][] = [
  [
    'Owner / HHS Admin',
    'Administer the tool across HHS: users, OpDivs, FISMA systems and data calls.',
  ],
  [
    'HHS Read-only Admin',
    'View dashboards, scores and responses across HHS. No changes.',
  ],
  [
    'OpDiv Admin',
    'Within their OpDiv: manage users, add and assign FISMA systems, and view all data.',
  ],
  [
    'OpDiv Read-only Admin',
    'View dashboards, scores and responses within their OpDiv. No changes.',
  ],
  [
    'ISSO / ISSM',
    'Complete the data call for their assigned systems and set target maturity. ISSOs also manage System Delegates.',
  ],
  [
    'System Delegate',
    'Answer data call questions for their assigned systems only, for a limited time. Cannot manage users, change system information, or set target maturity.',
  ],
]

const rolesTopic = (audience: HelpAudience): HelpTopic => ({
  id: 'roles',
  title: 'Roles and permissions',
  blocks: [
    {
      kind: 'table',
      head: ['Role', 'What they can do'],
      rows: audience === 'cms' ? CMS_ROLE_ROWS : HHS_ROLE_ROWS,
    },
    {
      kind: 'text',
      text: 'Admins can only assign roles at or below their own level. Read-only roles cannot assign roles or edit responses. Every action is recorded in an audit trail with the user and the role they held.',
    },
  ],
  faq: [],
})

// ------------------------------------------------------------- delegates

const HHS_DELEGATES: HelpTopic = {
  id: 'delegates',
  title: 'System Delegates',
  blocks: [
    {
      kind: 'text',
      text: 'A System Delegate is a contractor or supporting team member who helps answer the data call for specific systems. Each OpDiv decides whether to use the role; an Owner or HHS Admin turns it on for the OpDiv.',
    },
    {
      kind: 'list',
      items: [
        'The system’s ISSO, or an admin, manages delegates in the Delegates section of the System details page. ISSMs can see the list but not change it.',
        'Select Provision new delegate and enter their name, email and an Access expires date (three months by default), or use Attach an existing delegate.',
        'The same section is where delegates are renewed or removed. Renewing keeps the delegate’s account and system assignments, so nothing needs to be re-created.',
        'Delegates can view and answer questions only for the systems they are assigned to. They cannot manage users, change system information, or set target maturity.',
      ],
    },
  ],
  faq: [
    {
      question: 'My System Delegate lost access.',
      answer:
        'Delegate access ends on its expiration date. The ISSO can renew it on the System details page; the delegate’s account and assignments are kept, so nothing needs to be re-created.',
    },
    {
      question: 'I’m an ISSO and don’t see the Delegates section.',
      answer:
        'The System Delegate role may not be enabled for your OpDiv. Your OpDiv Admin can ask the Zero Trust team to turn it on.',
    },
  ],
}

// ----------------------------------------------------------------- admin

const adminTopic = (audience: HelpAudience): HelpTopic => ({
  id: 'admin',
  title: 'For admins',
  adminOnly: true,
  blocks: [
    {
      kind: 'text',
      text: 'The data call is only as good as the system inventory behind it. Before it opens, check that every production FISMA system is listed, nothing is duplicated, and every system has an ISSO or ISSM assigned. Unassigned systems do not get answered.',
    },
    {
      kind: 'list',
      items: [
        'Add a system: open the menu next to your name in the header, choose Add FISMA system, fill in the required fields, and select Create system.',
        'Correct a system: open its System details page and select Edit.',
        'Add or edit a user: on the Users tab, select Add user or edit the user’s row, and set their role. The roles offered depend on your own role.',
        'Assign systems: on the Users tab, open the user’s More actions menu and choose Assign FISMA systems. The user needs access to the system’s OpDiv first (Assign OpDivs, in the same menu).',
        audience === 'cms'
          ? 'Users need an approved ZTMF_SCORING_USER job code and a cms.hhs.gov email before they can sign in, whatever role you give them.'
          : 'Users must be able to sign in through their OpDiv’s sign-in service before a role takes effect.',
      ],
    },
    {
      kind: 'text',
      text:
        audience === 'cms'
          ? 'During the data call, use the dashboard to find systems that have not started, are in progress, or are done, and spot-check completed responses before the deadline. CMS admins also review CMS audit logs.'
          : 'During the data call, use the dashboard to find systems that have not started, are in progress, or are done, and spot-check completed responses before your OpDiv’s internal deadline.',
    },
  ],
  faq: [],
})

// ----------------------------------------------------------------- links

// Secondary references. This repo is public, so add only URLs that may be
// public, and expect any of them to move.
const SHARED_LINKS: HelpLink[] = [
  {
    title: 'CISA Zero Trust Maturity Model',
    description:
      'The pillars and maturity stages the ZTMF questionnaire is built on.',
    url: 'https://www.cisa.gov/zero-trust-maturity-model',
  },
  {
    title: 'OMB M-22-09',
    description:
      'The federal Zero Trust strategy the data call reports against.',
    url: 'https://www.whitehouse.gov/wp-content/uploads/2022/01/M-22-09.pdf',
  },
  {
    title: 'NIST SP 800-207',
    description:
      'Zero Trust Architecture: the standard the federal strategy builds on.',
    url: 'https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-207.pdf',
  },
  {
    title: 'Executive Order 14028',
    description:
      'Improving the Nation’s Cybersecurity: the order that set the federal move to zero trust.',
    url: 'https://www.cisa.gov/topics/cybersecurity-best-practices/executive-order-improving-nations-cybersecurity',
  },
  {
    title: 'CISA Cloud Security Technical Reference Architecture',
    description: 'Guidance for applying zero trust in cloud environments.',
    url: 'https://www.cisa.gov/sites/default/files/publications/Cloud%20Security%20Technical%20Reference%20Architecture.pdf',
  },
]

export const HELP_CONTENT: Record<HelpAudience, HelpContent> = {
  cms: {
    topics: [
      CMS_START,
      systemsTopic('cms'),
      QUESTIONNAIRE_TOPIC,
      SCORING_TOPIC,
      rolesTopic('cms'),
      adminTopic('cms'),
    ],
    contactNote: 'You can also post in #zt-maturity-data-call on CMS Slack.',
    contactFallback: 'Post in #zt-maturity-data-call on CMS Slack for help.',
    links: [...SHARED_LINKS],
  },
  hhs: {
    topics: [
      HHS_START,
      systemsTopic('hhs'),
      QUESTIONNAIRE_TOPIC,
      SCORING_TOPIC,
      rolesTopic('hhs'),
      HHS_DELEGATES,
      adminTopic('hhs'),
    ],
    contactNote: 'For sign-in problems, contact your OpDiv Admin instead.',
    contactFallback: 'Contact your OpDiv Admin for help.',
    links: [...SHARED_LINKS],
  },
}

/**
 * Short sign-in help for the login page's "Trouble signing in?" dialog. The
 * audience is unknown before sign-in, so both sets show. No ZTMF mailbox here:
 * it is for people who cannot sign in.
 */
export const PUBLIC_SIGNIN_HELP: {
  intro: string
  sections: { title: string; blocks: HelpBlock[] }[]
} = {
  intro: `Seeing "${UNKNOWN_EMAIL_MESSAGE}"? Check the spelling of your email. If it is right, your access has not been set up yet; follow the steps for your agency below.`,
  sections: [
    {
      title: 'CMS staff and contractors',
      blocks: [
        {
          kind: 'list',
          items: [
            {
              text: 'Request the ZTMF_SCORING_USER job code in EUA and list the FISMA systems you need.',
              link: EUA_LINK,
            },
            {
              text: 'Sign in with a cms.hhs.gov email through CMS IDM (Okta). No CMS email? Request LAN_EMAIL in EUA, but first switch your IDM MFA away from email codes.',
              link: IDM_LINK,
            },
            'Still stuck? Post in #zt-maturity-data-call on CMS Slack.',
          ],
        },
      ],
    },
    {
      title: 'HHS OpDivs',
      blocks: [
        {
          kind: 'list',
          items: [
            'Your OpDiv Admin adds you to the HHS Entra group for ZTMF.',
            'Still stuck? Contact your OpDiv Admin.',
          ],
        },
      ],
    },
  ],
}
