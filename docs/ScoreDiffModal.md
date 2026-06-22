# ScoreDiffModal — Technical Documentation

**PR:** #416 (in-repo rehome of fork PR #414)  
**Authors:** Calvin Costa (@costacalvin) and Cameron  
**Issue:** #411 · **Branch:** `feat/411-compare-datacalls-modal`

---

## 1. Feature Overview

Adds a **Compare Datacalls** button to the `QuestionnairePage` header. Clicking it opens a full-screen MUI Dialog where users can select any two data calls and view a function-level diff of questionnaire answers between them, including attribution for who made each change and when.

The implementation is entirely frontend-only — no backend changes were required beyond consuming the existing `GET /api/v1/scores/diff` endpoint.

| | |
|---|---|
| **Backend dependency** | `GET /api/v1/scores/diff` (see [ztmf#356](https://github.com/CMS-Enterprise/ztmf/pull/356)) |
| **Base branch** | `main` (CMS-Enterprise/ztmf-ui) |

---

## 2. Files Changed

| File | Lines | Description |
|---|---|---|
| `src/components/ScoreDiffModal/ScoreDiffModal.tsx` | 586 | New component — the full diff modal |
| `src/components/ScoreDiffModal/ScoreDiffModal.test.tsx` | 287 | 13 unit tests |
| `src/types.ts` | +27 | Two new types: `ScoreDiffSide`, `ScoreDiffEntry` |
| `src/views/QuestionnairePage/QuestionnairePage.tsx` | +34 | Button added to header; modal rendered at bottom |

---

## 3. TypeScript Types (`src/types.ts`)

### `ScoreDiffSide`
One side (before or after) of a changed answer:
```ts
export type ScoreDiffSide = {
  scoreid: number
  functionoptionid: number
  optionname: string   // display label for the selected answer option
  score: number        // numeric maturity score (1–5)
  notes: string | null
}
```

### `ScoreDiffEntry`
A single function whose answer changed between two data calls:
```ts
export type ScoreDiffEntry = {
  fismasystemid: number
  functionid: number
  function: string          // e.g. "Authentication-Users"
  question: string          // full question text
  from: ScoreDiffSide | null  // null = newly answered in "to" cycle
  to: ScoreDiffSide | null    // null = answer removed since "from" cycle
  changed_at?: string         // ISO timestamp — optional on older records
  changed_by?: {
    userid: string
    name: string
    email: string
    role: string
  }
}
```

`null` on `from`/`to` enables one-sided rows. `changed_by`/`changed_at` are optional because older records may not carry attribution data.

---

## 4. Component: ScoreDiffModal

### 4.1 Props

| Prop | Type | Description |
|---|---|---|
| `open` | `boolean` | Controls dialog visibility |
| `onClose` | `() => void` | Fired when user closes the dialog |
| `fismasystemid` | `number` | Used as diff query param and questions cache key |
| `systemName` | `string` | Shown in dialog title |
| `systemAcronym` | `string` | Shown in dialog title alongside `systemName` |
| `selectedDataCallId` | `number?` | Pre-seeds the "To" picker default |

### 4.2 Module-Level Caches

Two caches live at module scope (outside the component) so they survive close/open cycles:

```ts
const datacallsCache: { data: datacall[] | null; timestamp: number | null }
const questionsCache: Map<number, { data: FismaQuestion[]; timestamp: number }>
const CACHE_DURATION = 10 * 60 * 1000  // 10 minutes
```

- `datacallsCache` — full sorted list of all data calls; one copy per page load
- `questionsCache` — keyed by `fismasystemid`; each system's questions cached separately
- The **diff response is never cached** — re-fetches on every open and picker change
- Clearing requires a full page refresh

### 4.3 State

| Variable | Type | Purpose |
|---|---|---|
| `datacalls` | `datacall[]` | Sorted list for the two pickers |
| `fromDatacall` | `datacall \| null` | "From" picker selection |
| `toDatacall` | `datacall \| null` | "To" picker selection |
| `diffResults` | `ScoreDiffEntry[]` | Raw entries from the API |
| `functionPillarMap` | `Map<number, pillar>` | Maps `functionid` → pillar for grouping |
| `diffKey` | `number` | Counter incremented on each open to force re-fetch |
| `loading` | `boolean` | True while diff API call is in-flight |
| `error` | `string \| null` | Rendered in an Alert on fetch failure |

### 4.4 useEffect Lifecycle

**Effect 1 — Accessibility focus** (`deps: [open]`)  
Focuses the close button 100 ms after open. Cleanup cancels the timer if the modal closes before it fires.

**Effect 2 — Open/close reset** (`deps: [open]`)  
On open: increments `diffKey`. On close: clears `diffResults`, `functionPillarMap`, and `error`.

`diffKey` is the mechanism for forcing a fresh diff fetch on every reopen. When datacall objects are served from the module cache, the same object references return, so `fromDatacall`/`toDatacall` don't change between opens — React would skip the diff effect without this counter.

**Effect 3 — Datacalls fetch** (`deps: [open, selectedDataCallId]`)  
Fetches `GET /datacalls`, sorts descending by `datacallid`, writes to cache. Sets picker defaults:
- **To** = data call matching `selectedDataCallId`, or newest if not found
- **From** = first data call with an ID numerically less than "To"

**Effect 4 — Questions fetch for pillar mapping** (`deps: [open, fismasystemid]`)  
Fetches `GET /fismasystems/:id/questions`, builds `functionPillarMap`. Used by `groupedResults` to assign each diff row to its pillar. Results cached by `fismasystemid`.

**Effect 5 — Diff fetch** (`deps: [fromDatacall, toDatacall, fismasystemid, diffKey]`)  
Skips if either picker is null or both reference the same data call. Otherwise calls:
```
GET /scores/diff?from={from}&to={to}&fismasystemid={id}
```
Sets `loading = true`, clears previous results and error before the call. On success: populates `diffResults`. On failure: sets error string. Finally: clears `loading`.

An `AbortController` is created per run; `signal` is passed to axios. The `.catch` and `.finally` handlers guard on `controller.signal.aborted` so state is never written after the modal closes or pickers change mid-flight.

### 4.5 groupedResults (useMemo)

Transforms raw `diffResults` into `{ pillar, entries[] }[]` ordered to match the questionnaire's canonical layout:

1. Build a `Map<pillarid, { pillar, entries[] }>` via `functionPillarMap.get(entry.functionid)`
2. Entries with no matching pillar go into `uncategorized[]` (race: questions fetch still in flight)
3. Sort groups by `PILLAR_ORDER.indexOf(pillar.pillar)` — unknown pillars sort to end
4. Within each group, sort entries by `PILLAR_FUNCTION_MAP[pillarName].indexOf(functionName)`
5. Append `uncategorized` as a final "Other" group if any exist

### 4.6 Table Structure

**Header row** — Function | Question | From answer | To answer | Changed by | Changed at  
- Background: CMS blue `#004297`, white bold text

**Pillar group rows** — span all 6 columns  
- Background: `#e8edf7`, uppercase letter-spaced CMS blue text, `2px solid #b3c2e8` top border

**Data rows** — one per changed function  
- Alternating shading: odd-index rows within a group get `#f5f5f5`
- Function cell: `component="th" scope="row"` for 508 compliance
- Changed by: `"Name (Role)"` or `"Unknown"` when `changed_by` absent
- Changed at: `"Mon DD, YYYY, H:MM AM/PM"` or `—` when absent
- Row key: `` `${entry.functionid}-${i}` `` (composite to handle multiple questions per function)

### 4.7 Accessibility (508 / WCAG AA)

| Technique | Implementation |
|---|---|
| Dialog labeling | `aria-labelledby` + `aria-describedby` |
| Screen-reader description | Visually hidden paragraph (`left: -10000px`) |
| Close button | `aria-label="Close compare datacalls dialog"` |
| Loading spinners | `aria-label` on each `CircularProgress` |
| Table | `aria-label="Questionnaire diff results"` |
| Table row headers | `component="th" scope="row"` on Function cells |
| Picker inputs | `aria-label` via `inputProps` on each Autocomplete |
| Status labels | "Active" / "Closed" text-only — no color-only indicators |
| Focus management | Focus moved to close button 100 ms after open |

---

## 5. QuestionnairePage Changes

The breadcrumb bar is wrapped in a flex `Box` with `justifyContent: "space-between"`, placing the button on the right of the same row:

```tsx
<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
  <BreadCrumbs segmentLabels={breadcrumbSegmentLabels} />
  <Button variant="outlined" size="small" onClick={() => setDiffModalOpen(true)}>
    Compare Datacalls
  </Button>
</Box>
```

`ScoreDiffModal` is rendered at the bottom of the page return block. `system ?? 0` is safe because `undefined` system is caught by the page's early render guard before this JSX is reached.

The "To" picker seed uses `selectedDatacall?.datacallid` (the `datacall` object shape introduced by #408) rather than a bare `selectedDataCallId` number, which was removed from context when #408 merged.

---

## 6. API Contract

### `GET /scores/diff`
| Param | Type | Description |
|---|---|---|
| `from` | number | ID of the baseline (earlier) data call |
| `to` | number | ID of the comparison (later) data call |
| `fismasystemid` | number | Scopes the diff to one system |

Response: `{ data: ScoreDiffEntry[] }` — only changed functions; unchanged functions are never returned.

### `GET /datacalls`
Full list of all data calls. Frontend sorts descending by `datacallid`.  
Response: `{ data: datacall[] }`

### `GET /fismasystems/:id/questions`
Questions for the system with pillar and function metadata. Used only to build `functionPillarMap` — question text in the diff table comes from the diff endpoint itself.  
Response: `{ data: FismaQuestion[] }`

---

## 7. Test Coverage

13 tests in `ScoreDiffModal.test.tsx`. Module-level caches are busted before each test by advancing a mocked `Date.now()` past the 10-minute TTL.

| # | Test | What it validates |
|---|---|---|
| 1 | `open=false` → no dialog | Modal absent from DOM when closed |
| 2 | System name/acronym in title | Title string interpolation |
| 3 | Spinner while datacalls loading | Loading indicator visible before fetch resolves |
| 4 | To/From defaults | To = `selectedDataCallId`; From = prior datacall by ID |
| 5 | Correct diff query params | URL includes `?from=N&to=M&fismasystemid=K` |
| 6 | Empty state message | "No changes between these two datacalls." |
| 7 | Error alert on failure | Alert renders on network error |
| 8 | Full row render | All 6 columns populated |
| 9 | Notes shown/hidden | Notes rendered when present; absent when null |
| 10 | Null side → "No answer" | One-sided rows render correctly |
| 11 | Pillar group ordering | Identity before Devices even when Devices arrives first |
| 12 | Both close controls | X and Close button each fire `onClose` |
| 13 | Re-fetch on reopen | New `/scores/diff` call fires after close → reopen |

**Known lint warnings:** Tests 6, 7, and 9 trigger `jest/expect-expect` — they use `screen.findByText` as an implicit assertion without an explicit `expect()`. Warnings only; all 13 pass. Should be refactored to explicit assertions in a follow-up.

---

## 8. Pillar and Function Ordering

Source: `src/constants.ts` — `PILLAR_ORDER` and `PILLAR_FUNCTION_MAP`.

| Pillar | Functions (canonical order) |
|---|---|
| Identity | Authentication-Users, IdentityStores-Users, RiskAssessment, AccessManagement, Identity-VisibilityAnalytics, Identity-AutomationOrchestration, Identity-Governance |
| Devices | PolicyEnforcement, AssetRiskManagement, ResourceAccess, Device-ThreatProtection, Device-VisibilityAnalytics, Device-AutomationOrchestration, Device-Governance |
| Networks | NetworkSegmentation, NetworkTrafficManagement, Network-Encryption, NetworkResilience, Network-VisibilityAnalytics, Network-AutomationOrchestration, Network-Governance |
| Applications | AccessAuthorization-Users, Application-ThreatProtection, AccessibleApplications, SecureDevDeployWorkflow, Application-SecurityTesting, Application-VisibilityAnalytics, Application-AutomationOrchestration, Application-Governance |
| Data | DataInventoryManagement, DataCategorization, DataAvailability, DataAccess, DataEncryption, Data-VisibilityAnalytics, Data-AutomationOrchestration, Data-Governance |

---

## 9. Design Decisions

**Pillar grouping on the frontend** — the diff endpoint returns no pillar metadata to keep the backend join lean. A separate `/questions` call is cached at module level so only the first open per system incurs the extra request.

**Module-level caches vs React state** — module scope survives component unmount/remount across close/open cycles, matching the pattern used by `PillarScoresModal`. Tradeoff: clearing requires a full page refresh.

**`diffKey` counter** — React's `Object.is` dependency comparison means cached object references don't change between opens, so the diff effect wouldn't re-run without a reliably-changing dependency. `diffKey` is that dependency.

**Same-call prevention** — `getOptionDisabled` disables whichever data call is already selected in the opposite picker, preventing a always-empty self-diff.

**"Other" fallback group** — if pillar data hasn't loaded yet when diff results arrive, entries go into "Other" at the bottom rather than being dropped. Prevents a blank table during the brief race window.

---

## 10. Manual Test Plan

Prerequisites: a FISMA system with ≥2 data calls and ≥1 answer that changed between them. Unit tests must pass (`yarn test --watchAll=false --testPathPattern="ScoreDiffModal"`).

| # | Action | Expected |
|---|---|---|
| 1 | Open any system's QuestionnairePage | "Compare Datacalls" button visible in breadcrumb bar |
| 2 | Click "Compare Datacalls" | Modal opens; title shows system name + acronym; focus on close button |
| 3 | Check picker defaults | To = currently viewed data call (Current chip); From = prior data call |
| 4 | Check pillar group order | Identity → Devices → Networks → Applications → Data → CrossCutting |
| 5 | Check function order within a pillar | Matches canonical questionnaire order |
| 6 | Change "From" to an older data call | Table refreshes with new diff |
| 7 | Try to pick same call in both pickers | Already-selected call is disabled in opposite picker |
| 8 | Pick two calls with no changes | "No changes between these two datacalls." empty state |
| 9 | Find a null-from row | "No answer" renders italic in From cell |
| 10 | Find a row with no attribution | "Unknown" renders in Changed by cell |
| 11 | Close and reopen the modal | Fresh diff fetch; no stale data flash |
| 12 | Keyboard navigation | Tab → button, Enter → modal, Tab through controls, Escape → close |
| 13 | Screen reader | Dialog announced with title + description; table columns as headers |
