# Caching layer for the Express app

There is no Express app in this workspace, so this is a design for a new module at `src/cache.ts`. It is an in-process cache the route handlers import. Nothing here is stored as notes.

## Role

`src/cache.ts` holds short-lived read results for one Node process. Handlers use it to avoid repeating the same database or upstream read. Writes stay in the route that performs the mutation, and that route deletes the keys it changed.

The first version is memory only. A second process, or a restart, starts empty. A shared store such as Redis is a later swap behind the same interface if more than one instance must see the same entries.

## Interface

```ts
export type CacheOptions = {
  defaultTtlMs: number;
  maxEntries: number;
};

export type Cache = {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttlMs?: number): void;
  delete(key: string): void;
  deletePrefix(prefix: string): void;
  wrap<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T>;
};

export function createCache(options: CacheOptions): Cache;
```

`get` returns `undefined` for a missing key and for an expired key, and it drops the expired entry. `set` stores the value with an absolute expiry of `Date.now() + ttlMs`, using `defaultTtlMs` when `ttlMs` is omitted. `delete` removes one key. `deletePrefix` removes every key that starts with the prefix, which is how a collection write clears `items:` without listing ids.

`wrap` is the call routes should use. On a fresh hit it returns the stored value. On a miss it runs `loader` once, stores the result, and returns it. Concurrent callers for the same key share that one in-flight promise, so a burst of requests does not stampede the loader. A thrown loader error is not stored, and every waiter receives the same rejection. The in-flight slot is cleared after the promise settles so a later call can try again.

## Storage

One `Map<string, { value: unknown; expiresAt: number }>` plus a second `Map<string, Promise<unknown>>` for in-flight loads. Insertion order is the eviction order. When `set` would exceed `maxEntries`, the oldest key is removed first. A read of a live key reinserts it so frequently used keys stay.

Expiry is checked on `get` and `wrap`. A `setInterval` sweep, unref'd so it does not keep the process alive, deletes expired keys about once a minute. `createCache` returns a `close()` only if tests need to stop that timer; production code can let the process exit.

Keys are strings chosen by the caller. Suggested shape: `item:${id}`, `list:${queryHash}`. Values are whatever the loader returns. They are not cloned, so callers must not mutate a cached object.

## Express use

Create one cache at startup and pass it to the router, or keep it as a module singleton next to `app`.

```ts
const cache = createCache({ defaultTtlMs: 30_000, maxEntries: 1_000 });

app.get("/items/:id", async (req, res, next) => {
  try {
    const item = await cache.wrap(`item:${req.params.id}`, 30_000, () =>
      loadItem(req.params.id),
    );
    if (!item) {
      res.sendStatus(404);
      return;
    }
    res.json(item);
  } catch (err) {
    next(err);
  }
});

app.put("/items/:id", async (req, res, next) => {
  try {
    const item = await updateItem(req.params.id, req.body);
    cache.delete(`item:${req.params.id}`);
    cache.deletePrefix("list:");
    res.json(item);
  } catch (err) {
    next(err);
  }
});
```

Only `GET` (and other safe reads) go through `wrap`. `POST`, `PUT`, `PATCH`, and `DELETE` update the source of truth, then invalidate. Do not cache a response that depends on the caller unless the key includes the user id and the response is safe to reuse for that user.

Response headers stay the route's job. A cached JSON body can still be sent with `Cache-Control: private, max-age=30` when the TTL matches. The module does not set headers itself.

## Bounds

- Default TTL is 30 seconds unless a route passes its own.
- `maxEntries` of 1,000 caps memory. Eviction is oldest-inserted among live entries, refreshed on hit.
- TTL must be a positive finite number. `set` and `wrap` reject `0`, negative, and `NaN`.
- The loader timeout is the route's responsibility. The cache does not add its own deadline.
- `null` is a stored value. A missing or expired key is `undefined`, so a cached "not found" can be stored as `null` when the route wants that.

## Out of scope

No HTTP middleware that caches every `GET` by URL, no cross-process invalidation, and no persistence. Routes opt in by calling `wrap` and `delete`.
