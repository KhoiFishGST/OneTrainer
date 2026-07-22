import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, createApi } from "./client";

afterEach(() => vi.restoreAllMocks());

describe("api client", () => {
  it("returns typed JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ config: {}, revision: "i:0" }), { status: 200 }));
    const api = createApi("");
    await expect(api.getConfig()).resolves.toEqual({ config: {}, revision: "i:0" });
  });

  it("normalizes FastAPI field errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ detail: [{ path: "x", message: "bad" }] }), { status: 422 }));
    await expect(createApi("").getConfig()).rejects.toEqual(new ApiError(422, [{ path: "x", message: "bad" }]));
  });
});
