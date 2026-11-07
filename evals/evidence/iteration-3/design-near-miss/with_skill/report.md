# Caching layer for the Express app

This is a local design for `src/cache.ts`. It is not a Tuskway epic, and nothing was written to Tuskway notes.

This workspace has no `src/cache.ts` and no Express app, so the notes below describe a new module. They do not describe existing file contents.

## Behavior

Route handlers can store a computed value under a string key and read it back until a time-to-live elapses. A later write or an explicit delete replaces or removes that entry. A missing or expired key is a cache miss, and the caller computes the value again. The cache is process-local: a restart drops every entry.

## Approaches

- In-process `Map` inside `src/cache.ts`, with an expiry time on each entry. No extra service. Entries disappear on restart and are invisible to other processes. Memory is bounded only if a max size is set.
- A Redis (or similar) client wrapped by the same `src/cache.ts` functions. Entries can be shared across processes and can survive a restart. The app then depends on another service being up, and a connection failure must behave as a miss.

Recommendation: the in-process `Map`. Nothing in this workspace states that more than one process must see the same entries, and there is no existing cache client to extend. Move to a shared store when that requirement shows up.

## Affected code

- `src/cache.ts` — not in this workspace. Intended home of `createCache`.
- Express route handlers that call `get` / `set` — no Express app is present here, so which routes would use the cache is unknown.

```ts
export type CacheOptions = { ttlMs: number; maxEntries?: number };

export function createCache<T>(options: CacheOptions): {
  get(key: string): T | undefined;
  set(key: string, value: T, ttlMs?: number): void;
  delete(key: string): void;
  clear(): void;
};
```

`get` drops an entry whose expiry is in the past and returns `undefined`. `set` stores the value and expiry, and if `maxEntries` is set, drops the soonest-expiring other entry when the cap is exceeded. Keys for HTTP responses should include the method and URL, and should include the caller identity whenever the body depends on who is logged in. Skip caching for non-GET requests.

## Risks

A key that omits the user will serve one person's response to another. Writers that forget `delete` will keep stale values until the TTL. With no `maxEntries`, distinct keys can grow the process without a limit.

## Verification

No test command or test name exists for this module in the repo. Add a unit test that covers a miss, a hit before the TTL, a miss after the TTL, `delete`, and two keys that do not collide. That test would not show memory use under load or behavior across multiple processes.

## Still open

Which routes are cached, the TTL, and whether a later deployment has more than one Node process. Those facts would change the key shape and could overturn the in-process recommendation.
