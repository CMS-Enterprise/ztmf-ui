// Source-text guardrail. Asserts that every view touched by the auth
// centralization refactor delegates to the shared interceptor: imports
// isAuthHandled, short-circuits its catch on it, and no longer carries
// the per-view redirect/permission ladders that the centralization
// replaced. This is a long-lived consistency check, not a behavioral
// test. Behavioral coverage lives next to each view (e.g.
// EmailModal.test.tsx, CfactsRecordCard.test.tsx).
import fs from 'node:fs'
import path from 'node:path'

type FileExpectation = {
  filePath: string
  includes?: string[]
  excludes?: string[]
}

const expectations: FileExpectation[] = [
  {
    filePath: 'src/views/AssignSystemModal/AssignSystemModal.tsx',
    includes: ['if (isAuthHandled(error)) return'],
    excludes: ['ERROR_MESSAGES.permission', 'Routes.SIGNIN'],
  },
  {
    filePath: 'src/views/DatacallModal/DataCallModal.tsx',
    includes: ['if (isAuthHandled(error)) return'],
    excludes: ['ERROR_MESSAGES.permission', 'Routes.SIGNIN'],
  },
  {
    filePath: 'src/views/EditSystemModal/EditSystemModal.tsx',
    includes: ['if (isAuthHandled(error)) return'],
    excludes: ['Routes.SIGNIN'],
  },
  {
    filePath: 'src/views/FismaTable/FismaTable.tsx',
    includes: ['if (isAuthHandled(error)) return'],
    excludes: ['ERROR_MESSAGES.permission', 'Routes.SIGNIN'],
  },
  {
    filePath: 'src/views/Home/Home.tsx',
    excludes: ['Routes.SIGNIN', 'ERROR_MESSAGES.expired'],
  },
  {
    filePath: 'src/views/QuestionnairePage/QuestionnairePage.tsx',
    includes: ['if (isAuthHandled(error)) return'],
    excludes: ['Routes.SIGNIN'],
  },
  {
    filePath: 'src/views/QuestionnareModal/QuestionnareModal.tsx',
    includes: ['if (isAuthHandled(error)) return'],
    excludes: ['Routes.SIGNIN'],
  },
  {
    filePath: 'src/views/SystemDetailPage/CfactsRecordCard.tsx',
    includes: ['skipAuthHandling: true'],
  },
  {
    filePath: 'src/views/SystemDetailPage/SystemDetailPage.tsx',
    includes: ['if (isAuthHandled(error)) return'],
    excludes: ['Routes.SIGNIN'],
  },
  {
    // Title legitimately references Routes.SIGNIN to compare the current path
    // and hide the header on the signin route, so the bare name is allowed.
    // Ban the redirect shapes instead (imperative + declarative) plus the hook
    // needed for an imperative redirect, which is what the centralization
    // actually forbids here.
    filePath: 'src/views/Title/Title.tsx',
    excludes: [
      'navigate(Routes.SIGNIN',
      'to={Routes.SIGNIN}',
      'const navigate = useNavigate()',
    ],
  },
  {
    filePath: 'src/views/UserTable/UserTable.tsx',
    includes: ['if (isAuthHandled(error)) return'],
    excludes: ['handleUnautherized', 'checkValidResponse'],
  },
  {
    filePath: 'src/views/OpDivAdmin/OpDivAdmin.tsx',
    includes: ['if (isAuthHandled(error)) return', 'parseApiError(error)'],
    excludes: [
      'Routes.SIGNIN',
      'ERROR_MESSAGES.permission',
      'ERROR_MESSAGES.outOfScope',
    ],
  },
  {
    filePath: 'src/views/OpDivGrantModal/OpDivGrantModal.tsx',
    includes: ['if (isAuthHandled(error)) return', 'parseApiError(error)'],
    excludes: [
      'Routes.SIGNIN',
      'ERROR_MESSAGES.permission',
      'ERROR_MESSAGES.outOfScope',
    ],
  },
]

describe('auth-handling centralization invariants', () => {
  test.each(expectations)(
    '$filePath delegates auth handling to the central interceptor',
    ({ filePath, includes = [], excludes = [] }) => {
      const absolutePath = path.resolve(process.cwd(), filePath)
      const source = fs.readFileSync(absolutePath, 'utf8')

      includes.forEach((needle) => {
        expect(source).toContain(needle)
      })

      excludes.forEach((needle) => {
        expect(source).not.toContain(needle)
      })
    }
  )
})
