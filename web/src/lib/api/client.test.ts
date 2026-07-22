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

  it("preserves custom headers without being overridden by options spread", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "ok" }), { status: 200 }));
    const api = createApi("");
    await api.putConfig({ config: {}, base_revision: "i:1" });
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/config"),
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
        },
        method: "PUT",
      })
    );
  });
});
