/**
 * A single shared, frozen empty array for hooks that hand back a list before
 * their data has arrived. Returning a fresh `[]` on every render would give a
 * consumer that lists the rows in a memo or effect dependency a new reference
 * each time, re-running it while the load is pending or has failed.
 *
 * Typed `never[]` so it is assignable to any `T[]`; frozen so an accidental
 * mutation throws instead of leaking into every other consumer.
 */
export const EMPTY_LIST: never[] = Object.freeze([]) as never[]
