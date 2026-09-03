/**
 * Fails a production build that bundles the TanStack Query devtools.
 *
 * Two layers already keep the devtools out of production: the
 * `import.meta.env.DEV` gate in main.tsx, and the package's own main entry,
 * which exports `() => null` unless NODE_ENV is "development". Removing our
 * gate alone therefore does NOT ship the devtools (verified by building with
 * the gate deleted: the bundle stays clean).
 *
 * What this script actually catches is the path those layers cannot: an
 * import of `@tanstack/react-query-devtools/production`, the deliberate
 * always-on entry, plus any future packaging change that stops the main
 * entry no-op'ing. Verified in both directions: the current build passes,
 * and a build importing the /production entry exits 1.
 *
 * None of this is assertable from Jest, where `import.meta.env.DEV` and
 * NODE_ENV substitution never happen, which is why it runs as a build step
 * instead of a contract test.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Distinctive to @tanstack/react-query-devtools; not produced by the query
// core. `tsqd-` prefixes every devtools DOM class.
const MARKERS = ['TanstackQueryDevtools', 'tsqd-']

const assetsDir = join(process.cwd(), 'dist', 'assets')
let bundles
try {
  bundles = readdirSync(assetsDir).filter((name) => name.endsWith('.js'))
} catch {
  console.error(
    `assert-prod-excludes-devtools: ${assetsDir} not found — run this after "vite build --mode production".`
  )
  process.exit(1)
}
if (bundles.length === 0) {
  console.error(
    'assert-prod-excludes-devtools: no .js bundles in dist/assets — nothing to check is a failure, not a pass.'
  )
  process.exit(1)
}

const offenders = bundles.filter((name) => {
  const source = readFileSync(join(assetsDir, name), 'utf8')
  return MARKERS.some((marker) => source.includes(marker))
})

if (offenders.length > 0) {
  console.error(
    `assert-prod-excludes-devtools: devtools code found in production bundle(s): ${offenders.join(', ')}.\n` +
      'The import.meta.env.DEV gate in main.tsx has stopped eliminating the devtools branch.'
  )
  process.exit(1)
}

console.log(
  `assert-prod-excludes-devtools: ${bundles.length} bundle(s) clean.`
)
