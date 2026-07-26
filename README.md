# `@lucid-softworks/http-cache`

Clone-safe in-memory response caching middleware.

```ts
import { httpCache, MemoryHttpCache } from "@lucid-softworks/http-cache";

const middleware = httpCache({
  cache: new MemoryHttpCache(),
  ttl: 30_000,
});
```

Only successful GET responses without `no-store` are cached. Every lookup
returns a response clone and reports `x-cache: HIT` or `MISS`.
