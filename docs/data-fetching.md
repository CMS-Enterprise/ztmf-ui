# Data fetching

ZTMF uses TanStack Query for server state rendered by React and the shared
Axios instance in `src/axiosConfig.ts` for transport. TanStack Query owns query
caching, request deduplication, cancellation, freshness, and invalidation.
Axios continues to own the API base URL, credentials, and centralized
authentication interceptor.

## Client defaults

`src/queryClient.ts` creates the application `QueryClient` with:

- a 60-second `staleTime`, which deduplicates nearby reads while keeping admin
  data reasonably current;
- one retry for network errors, non-Axios errors, and 5xx responses;
- no retries for 4xx responses, because they are definitive server answers;
- `refetchOnWindowFocus: false`, so switching between the app and reference
  material does not trigger unrelated requests or loading changes.

Writes should invalidate affected query keys explicitly. The application does
not use Suspense queries or optimistic updates by default.

## Endpoint paths and query keys

Import API paths and query keys from `src/api/keys.ts`. Do not repeat endpoint
strings in components or hooks.

```ts
axiosInstance.get(apiPaths.fismaSystems.detail(systemId))

const { data } = useQuery({
  queryKey: queryKeys.fismaSystems.detail(systemId),
  queryFn: async ({ signal }) => {
    const response = await axiosInstance.get(
      apiPaths.fismaSystems.detail(systemId),
      { signal }
    )
    return response.data.data
  },
})
```

Query keys are hierarchical:

- the first segment names the resource;
- `list` and `detail` separate collection and record caches;
- identifiers are separate array elements, not interpolated strings;
- filters and pagination that change the response belong in a final object.

This lets callers invalidate at the appropriate scope:

```ts
queryClient.invalidateQueries({
  queryKey: queryKeys.fismaSystems.detail(systemId),
})
```

Keep transport-only values such as `AbortSignal` out of query keys. Prefer
Axios `params` for free-text filters and pagination. Path factories may own
serialized query strings when the endpoint contract requires a precise shape,
such as repeated `fsids` export parameters.

## Choosing the request mechanism

### `useQuery`

Use `useQuery` when server data is rendered by a React component. The query
function must return the data shape the component consumes and must forward
TanStack Query's cancellation signal to Axios.

```ts
const { data, error, isPending } = useQuery({
  queryKey: queryKeys.systemEnrichment(fismaUid),
  queryFn: async ({ signal }) => {
    const response = await axiosInstance.get(
      apiPaths.systemEnrichment(fismaUid),
      { signal }
    )
    return response.data.data
  },
})
```

TanStack Query retains the last successful `data` when a background refetch
fails, while also setting `error`. A component that replaces its content with
an error state must therefore check that no usable data exists:

```ts
if (error && !data) {
  return <ErrorState />
}
```

Use `isRefetchError` when the UI needs to distinguish a failed background
refresh from an initial-load failure explicitly. Do not discard successfully
rendered data solely because `error` is set.

Do not create a component-local `AbortController`; TanStack Query cancels the
request when the query becomes unused or is superseded.

### Reference vocabularies

System attributes, datacenter environments, and OpDivs change a few times a
year. Their hooks spread `vocabularyQueryOptions` from `src/queryClient.ts`,
which caches for the session (`staleTime` and `gcTime` both `Infinity`) and
keeps a failed load silent, since every consumer already renders around an
empty list. Read those lists through the existing hooks or Outlet context
rather than calling `useQuery` with the same key elsewhere. A write that
changes one must invalidate its key explicitly, as the OpDiv mutations do;
nothing under this policy refreshes on its own.

### `useMutation`

Use `useMutation` for server writes initiated by React. On success, invalidate
the smallest key prefix that covers the changed server state instead of
pushing replacement server data through Outlet context.

```ts
const queryClient = useQueryClient()
const mutation = useMutation({
  mutationFn: updateSystem,
  onSuccess: (_data, systemId) =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.fismaSystems.detail(systemId),
    }),
  onError: (error) => {
    if (isAuthHandled(error)) return
    notify(parseApiError(error).message, 'error')
  },
})
```

Return the invalidation promise from `onSuccess` only when the caller acts
on the refreshed data, such as closing a dialog over the updated list;
`mutateAsync` then resolves after the refetch. Otherwise fire it with `void`
so the write resolves on its own and the list catches up behind it. Both
styles are in use, and the reason for the choice belongs in a comment next to
it.

Mutations retain local error handling because forms may need field-level
errors from `parseApiError`. Do not add a global `MutationCache.onError` while
mutation callers also notify locally; doing both would produce duplicate
snackbars.

### Neither

Keep direct Axios calls for operations that are not rendered server state:

- `authLoader` and `authLookup`, which decide whether the authenticated app
  tree can render;
- logout, which tears down the session;
- imperative blob downloads;
- purely local state and synchronous transformations.

`authLoader` must not use `queryClient.ensureQueryData`. It converts every
session-bootstrap outcome into a discriminated loader result, must not retry an
unauthenticated first paint, and must not serve session state from the
60-second cache after cross-tab logout.

## Errors and authentication

The Axios interceptor runs before TanStack Query sees a rejected request.
`parseApiError`, `notify`, and the `isAuthHandled` marker remain the error
handling contract.

The application `QueryCache` handles unhandled query failures:

1. Errors marked by the auth interceptor are not notified again.
2. Cancelled or unobserved queries remain silent.
3. Other failures are normalized with `parseApiError` and shown once through
   `notify`.

Queries that render their own failure state must opt out of the global
snackbar:

```ts
useQuery({
  queryKey,
  queryFn,
  meta: { suppressErrorNotification: true },
})
```

`SystemEnrichmentCard` uses both `skipAuthHandling: true` and
`suppressErrorNotification: true`. They solve different problems:

- `skipAuthHandling` lets the card interpret its expected 403 as “no data”
  instead of allowing the Axios interceptor to show a permission snackbar.
- `suppressErrorNotification` prevents the Query cache from adding a snackbar
  beside the card's own 403/404 empty state or failed-load message.

Use `skipAuthHandling` only when the caller intentionally owns authentication
failures. The sanctioned call sites are:

| Call site                                             | Reason                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| `src/router/authLoader.ts`                            | Session bootstrap returns loader state instead of redirecting recursively.     |
| `src/utils/authLookup.ts`                             | Pre-session identity-provider lookup owns its unavailable result.              |
| `src/utils/delegates.ts`                              | A capability-off 403 drives an inline guard.                                   |
| `src/views/SystemDetailPage/SystemEnrichmentCard.tsx` | A 403 means no enrichment row for the caller's OpDiv.                          |
| `src/views/Title/Title.tsx`                           | Logout is best-effort and must finish local teardown after an expired session. |

All other 401/403 responses should flow through the shared interceptor. Callers
must check `isAuthHandled(error)` before showing fallback errors so a redirect
or permission snackbar is never duplicated.
