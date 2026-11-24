# ScoreDiffModal — Technical Documentation

**PR:** #416 (in-repo rehome of fork PR #414)  
**Authors:** Calvin Costa (@costacalvin) and Cameron  
**Issue:** #411 · **Branch:** `feat/411-compare-datacalls-modal`

---

## 1. Feature Overview

Adds a **Compare Datacalls** button to the `QuestionnairePage` header. Clicking it opens a full-screen MUI Dialog where users can select any two data calls and view a function-level diff of questionnaire answers between them, including attribution for who made each change and when.

The implementation is entirely frontend-only — no backend changes were required beyond consuming the existing `GET /api/v1/scores/diff` endpoint.

|                        |                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| **Backend dependency** | `GET /api/v1/scores/diff` (see [ztmf#356](https://github.com/CMS-Enterprise/ztmf/pull/356)) |
| **Base branch**        | `main` (CMS-Enterprise/ztmf-ui)                                                             |

---

## 2. Files Changed

| File                                                    | Lines | Description                                      |
| ------------------------------------------------------- | ----- | ------------------------------------------------ |
| `src/components/ScoreDiffModal/ScoreDiffModal.tsx`      | 586   | New component — the full diff modal              |
| `src/components/ScoreDiffModal/ScoreDiffModal.test.tsx` | 287   | 13 unit tests                                    |
| `src/types.ts`                                          | +27   | Two new types: `ScoreDiffSide`, `ScoreDiffEntry` |
| `src/views/QuestionnairePage/QuestionnairePage.tsx`     | +34   | Button added to header; modal rendered at bottom |

---

## 3. TypeScript Types (`src/types.ts`)

### `ScoreDiffSide`

One side (before or after) of a changed answer:

```ts
export type ScoreDiffSide = {
  scoreid: number
  functionoptionid: number
  optionname: string // display label for the selected answer option
  score: number // numeric maturity score (1–5)
  notes: string | null
}
```

### `ScoreDiffEntry`

A single function whose answer changed between two data calls:

```ts
export type ScoreDiffEntry = {
  fismasystemid: number
  functionid: number // the "to" side's when both cycles answered it
  root_functionid: number // the question's identity across versions
  pillarid: number | null
  pillar: string | null
  function: string // e.g. "Authentication-Users"
  question: string // full question text
  from: ScoreDiffSide | null // null = newly answered in "to" cycle
  to: ScoreDiffSide | null // null = answer removed since "from" cycle
  changed_at?: string // ISO timestamp — optional on older records
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

| Prop                 | Type         | Description                                  |
| -------------------- | ------------ | -------------------------------------------- |
| `open`               | `boolean`    | Controls dialog visibility                   |
| `onClose`            | `() => void` | Fired when user closes the dialog            |
| `fismasystemid`      | `number`     | Used as diff query param                     |
| `systemName`         | `string`     | Shown in dialog title                        |
| `systemAcronym`      | `string`     | Shown in dialog title alongside `systemName` |
| `selectedDataCallId` | `number?`    | Pre-seeds the "To" picker default            |

### 4.2 Reads

Both reads are TanStack Query hooks; the modal holds no cache of its own.

| Read               | Hook                                                  | Notes                                                                                                                |
| ------------------ | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `GET /datacalls`   | `useDatacalls({ enabled: open })`                     | Shared with the layout, which observes the same key all session, so opening this is a cache hit                      |
| `GET /scores/diff` | `useScoreDiff(from, to, systemId, { enabled: open })` | Keyed on the pair and the system; sends `skipPermissionNotification` so a 403 does not toast beside the inline alert |

Both are gated on `open`. The dialog stays mounted between openings, so an
ungated query would keep observing: it would refetch in the background on
every answer write, and never read the server again on reopen.

The module-level `datacallsCache` and its ten-minute `CACHE_DURATION` are
gone. A reopen inside the stale window costs no request, and a reopen after
a failure retries, both because the query re-enables rather than because the
component tracks it.

### 4.3 State

| Variable       | Type               | Purpose                                     |
| -------------- | ------------------ | ------------------------------------------- |
| `fromDatacall` | `datacall \| null` | "From" picker selection                     |
| `toDatacall`   | `datacall \| null` | "To" picker selection                       |
| `seeded`       | `boolean`          | Whether the pickers have their defaults yet |

`datacalls`, `diffResults`, `loading` and `error` all come off the queries.
`diffKey`, a counter that forced a refetch on every open, is gone with them.

### 4.4 useEffect Lifecycle

**Effect 1 — Accessibility focus** (`deps: [open]`)  
Focuses the close button 100 ms after open. Cleanup cancels the timer if the modal closes before it fires.

**Effect 2 — Picker defaults** (`deps: [open, datacalls, selectedDataCallId]`)  
Seeds the pickers once per opening, keyed on `selectedDataCallId` so a refetch
of the shared list while the modal is open does not discard the user's
choices. Sets:

- **To** = data call matching `selectedDataCallId`, or newest if not found
- **From** = the next-older call by deadline

The wait covers seeding as well as loading, so the pickers never render empty.

### 4.5 groupedResults (useMemo)

Transforms raw `diffResults` into `{ pillar, entries[] }[]` in the questionnaire's canonical layout:

1. Build a `Map<pillarid, { pillar, entries[] }>` from each row's own `pillarid` / `pillar` (ztmf-misc#395). The two cycles may pin different questionnaire versions, so no single questions list could map both sides' `functionid`s
2. Rows without a pillar go into `uncategorized[]`
3. Groups keep their first-appearance order, which is pillar order because the API sorts by it — see §8
4. Append `uncategorized` as a final "Other" group if any exist

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

| Technique                 | Implementation                                           |
| ------------------------- | -------------------------------------------------------- |
| Dialog labeling           | `aria-labelledby` + `aria-describedby`                   |
| Screen-reader description | Visually hidden paragraph (`left: -10000px`)             |
| Close button              | `aria-label="Close compare datacalls dialog"`            |
| Loading spinners          | `aria-label` on each `CircularProgress`                  |
| Table                     | `aria-label="Questionnaire diff results"`                |
| Table row headers         | `component="th" scope="row"` on Function cells           |
| Picker inputs             | `aria-label` via `inputProps` on each Autocomplete       |
| Status labels             | "Active" / "Closed" text-only — no color-only indicators |
| Focus management          | Focus moved to close button 100 ms after open            |

---

## 5. QuestionnairePage Changes

The breadcrumb bar is wrapped in a flex `Box` with `justifyContent: "space-between"`, placing the button on the right of the same row:

```tsx
<Box
  sx={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }}
>
  <BreadCrumbs segmentLabels={breadcrumbSegmentLabels} />
  <Button
    variant="outlined"
    size="small"
    onClick={() => setDiffModalOpen(true)}
  >
    Compare Datacalls
  </Button>
</Box>
```

`ScoreDiffModal` is rendered at the bottom of the page return block. `system ?? 0` is safe because `undefined` system is caught by the page's early render guard before this JSX is reached.

The "To" picker seed uses `selectedDatacall?.datacallid` (the `datacall` object shape introduced by #408) rather than a bare `selectedDataCallId` number, which was removed from context when #408 merged.

---

## 6. API Contract

### `GET /scores/diff`

| Param           | Type   | Description                            |
| --------------- | ------ | -------------------------------------- |
| `from`          | number | ID of the baseline (earlier) data call |
| `to`            | number | ID of the comparison (later) data call |
| `fismasystemid` | number | Scopes the diff to one system          |

Response: `{ data: ScoreDiffEntry[] }` — only changed functions; unchanged functions are never returned.

### `GET /datacalls`

Full list of all data calls. Frontend sorts by deadline, furthest-out first.  
Response: `{ data: datacall[] }`

---

## 7. Test Coverage

19 tests in `ScoreDiffModal.test.tsx`. Each test gets a fresh query client, so no cached state carries over and the clock does not need mocking.

| #   | Test                            | What it validates                                                  |
| --- | ------------------------------- | ------------------------------------------------------------------ |
| 1   | `open=false` → no dialog        | Modal absent from DOM when closed                                  |
| 2   | System name/acronym in title    | Title string interpolation                                         |
| 3   | Extra-wide dialog               | Dialog uses the comparison-table size                              |
| 4   | Spinner while datacalls loading | Loading indicator visible before fetch resolves                    |
| 5   | To/From defaults                | To = `selectedDataCallId`; From = the next-older call by deadline  |
| 6   | Latest by deadline              | Furthest-out deadline is "latest", not the highest `datacallid`    |
| 7   | Correct diff query params       | URL includes `?from=N&to=M&fismasystemid=K`                        |
| 8   | Empty state message             | "No changes between these two datacalls."                          |
| 9   | Error alert on failure          | Alert renders on network error                                     |
| 10  | Full row render                 | All 6 columns populated                                            |
| 11  | Notes shown/hidden              | Notes rendered when present; absent when null                      |
| 12  | Null side → "No answer"         | One-sided rows render correctly                                    |
| 13  | Pillar grouping                 | Groups by each row's pillar in API order, no `/questions` request  |
| 14  | Row without a pillar            | Lands under "Other"                                                |
| 15  | Both close controls             | X and Close button each fire `onClose`                             |
| 16  | Retry on reopen after failure   | A failed diff refetches when the modal reopens                     |
| 17  | List keeps its observer         | With the modal gone, the layout still observes `/datacalls`        |
| 18  | Answer write while closed       | No `/scores/diff` call while closed; reopening then refetches      |
| 19  | Cached diff on reopen           | Reopening inside the stale window makes no new `/scores/diff` call |

---

## 8. Pillar and Function Ordering

Source: the API. `/scores/diff` sorts by `pillars.ordr, questions.ordr,
functions.ordr, functionid`, so a diff arrives in questionnaire order.

The modal builds groups from a `Map` keyed on `pillarid`, whose iteration order
is insertion order. Since rows arrive in pillar order, first appearance is
pillar order and no re-sort is needed. Entries inside a group keep the order
they arrived in.

Until ztmf-misc#393 this was done with `PILLAR_ORDER` and `PILLAR_FUNCTION_MAP`
in `src/constants.ts`, hardcoded lists keyed on pillar and function _names_.
Anything not in them sorted to the end, so renaming a function or adding a
question silently dropped it to the bottom of its pillar. Both are deleted, and
an ESLint `no-restricted-imports` rule refuses to let them back.

---

## 9. Design Decisions

**Pillar from the diff row** — the diff endpoint carries each row's `pillarid` / `pillar` (ztmf-misc#395). The modal used to map `functionid` to a pillar through `/fismasystems/:id/questions`, but that list is one questionnaire version, and two cycles can pin different ones.

**Queries instead of a module cache** — the module-level cache survived unmount, which React state could not, but it also survived sign-out and was invisible to `queryClient.clear()`. The query cache gives the same survival through the layout's observer on the data-call key, and a write that invalidates the `scores` prefix reaches the diff without the modal knowing.

**Gated on `open` rather than a refetch counter** — the dialog stays mounted between openings, so the queries have to close with it. The old `diffKey` counter existed because cached object references do not change between opens, so the diff effect would not re-run; re-enabling a disabled query replaces it, and also handles the retry-after-failure case the counter did not.

**Same-call prevention** — `getOptionDisabled` disables whichever data call is already selected in the opposite picker, preventing a always-empty self-diff.

**"Other" fallback group** — a row without a pillar (a function with no question) goes into "Other" at the bottom rather than being dropped.

---

## 10. Manual Test Plan

Prerequisites: a FISMA system with ≥2 data calls and ≥1 answer that changed between them. Unit tests must pass (`yarn test --watchAll=false --testPathPattern="ScoreDiffModal"`).

| #   | Action                                | Expected                                                               |
| --- | ------------------------------------- | ---------------------------------------------------------------------- |
| 1   | Open any system's QuestionnairePage   | "Compare Datacalls" button visible in breadcrumb bar                   |
| 2   | Click "Compare Datacalls"             | Modal opens; title shows system name + acronym; focus on close button  |
| 3   | Check picker defaults                 | To = currently viewed data call (Current chip); From = prior data call |
| 4   | Check pillar group order              | Identity → Devices → Networks → Applications → Data → CrossCutting     |
| 5   | Check function order within a pillar  | Matches canonical questionnaire order                                  |
| 6   | Change "From" to an older data call   | Table refreshes with new diff                                          |
| 7   | Try to pick same call in both pickers | Already-selected call is disabled in opposite picker                   |
| 8   | Pick two calls with no changes        | "No changes between these two datacalls." empty state                  |
| 9   | Find a null-from row                  | "No answer" renders italic in From cell                                |
| 10  | Find a row with no attribution        | "Unknown" renders in Changed by cell                                   |
| 11  | Close and reopen within a minute      | Same rows, no new `/scores/diff` request; after a minute it refetches  |
| 12  | Keyboard navigation                   | Tab → button, Enter → modal, Tab through controls, Escape → close      |
| 13  | Screen reader                         | Dialog announced with title + description; table columns as headers    |
