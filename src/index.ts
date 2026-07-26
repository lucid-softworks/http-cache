import type { HttpMiddleware } from "@lucid-softworks/http-middleware";

type CacheEntry = Readonly<{ expiresAt: number; response: Response }>;

export class MemoryHttpCache {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(private readonly now: () => number = Date.now) {}

  get(key: string): Response | undefined {
    const entry = this.entries.get(key);
    if (entry === undefined) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.response.clone();
  }

  set(key: string, response: Response, ttl: number): void {
    if (!Number.isFinite(ttl) || ttl < 0)
      throw new RangeError("ttl must be finite and non-negative");
    this.entries.set(key, {
      expiresAt: this.now() + ttl,
      response: response.clone(),
    });
  }

  delete(key: string): boolean {
    return this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}

export type HttpCacheOptions = Readonly<{
  cache?: MemoryHttpCache;
  key?: (request: Request) => string;
  ttl?: number;
}>;

export function httpCache(options: HttpCacheOptions = {}): HttpMiddleware {
  const cache = options.cache ?? new MemoryHttpCache();
  const key = options.key ?? ((request) => request.url);
  const ttl = options.ttl ?? 30_000;
  return async (request, _context, next): Promise<Response> => {
    if (request.method !== "GET") return next();
    const cacheKey = key(request);
    const cached = cache.get(cacheKey);
    if (cached !== undefined) {
      cached.headers.set("x-cache", "HIT");
      return cached;
    }
    const response = await next();
    const cacheControl = response.headers.get("cache-control") ?? "";
    if (
      response.status === 200 &&
      !cacheControl.toLowerCase().includes("no-store")
    ) {
      cache.set(cacheKey, response, ttl);
    }
    response.headers.set("x-cache", "MISS");
    return response;
  };
}
