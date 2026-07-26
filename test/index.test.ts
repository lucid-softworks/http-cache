import { createHttpContext } from "@lucid-softworks/http-core";
import { describe, expect, it, vi } from "vitest";

import { httpCache, MemoryHttpCache } from "../src/index.js";

describe("HTTP cache", () => {
  it("stores clones, expires entries, and validates TTL", async () => {
    let now = 0;
    const cache = new MemoryHttpCache(() => now);
    expect(cache.get("missing")).toBeUndefined();
    expect(() => cache.set("x", new Response(), -1)).toThrow(RangeError);
    expect(() => cache.set("x", new Response(), Number.NaN)).toThrow(
      RangeError,
    );
    cache.set("x", new Response("value"), 10);
    expect(await cache.get("x")?.text()).toBe("value");
    now = 10;
    expect(cache.get("x")).toBeUndefined();
    cache.set("x", new Response(), 10);
    expect(cache.delete("x")).toBe(true);
    cache.set("y", new Response(), 10);
    cache.clear();
    expect(cache.get("y")).toBeUndefined();
  });

  it("caches successful GET responses", async () => {
    const next = vi.fn<() => Promise<Response>>(
      async () => new Response("value"),
    );
    const middleware = httpCache({ ttl: 100 });
    const request = new Request("https://example.com/data");
    const first = await middleware(request.clone(), createHttpContext(), next);
    const second = await middleware(request.clone(), createHttpContext(), next);
    expect(first.headers.get("x-cache")).toBe("MISS");
    expect(second.headers.get("x-cache")).toBe("HIT");
    expect(await second.text()).toBe("value");
    expect(next).toHaveBeenCalledOnce();
  });

  it("skips non-GET, error, and no-store responses and supports custom keys", async () => {
    const context = createHttpContext();
    const postNext = vi.fn<() => Promise<Response>>(async () => new Response());
    await httpCache()(
      new Request("https://example.com", { method: "POST" }),
      context,
      postNext,
    );
    expect(postNext).toHaveBeenCalledOnce();

    const callCounts = await Promise.all(
      [
        new Response("error", { status: 500 }),
        new Response("private", {
          headers: { "cache-control": "private, NO-STORE" },
        }),
      ].map(async (response) => {
        const next = vi.fn<() => Promise<Response>>(async () => response);
        const middleware = httpCache({ key: () => "same" });
        await middleware(new Request("https://example.com"), context, next);
        await middleware(new Request("https://example.com"), context, next);
        return next.mock.calls.length;
      }),
    );
    expect(callCounts).toEqual([2, 2]);
  });
});
