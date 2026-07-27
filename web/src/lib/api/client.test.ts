import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, createApi, galleryImageUrl } from "./client";

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

  it("encodes gallery run keys and filenames", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ active: false, run: null, batches: [], revisions: {} }), { status: 200 })
    );
    const api = createApi("/root");
    await (api as any).getGalleryRun("prefix run");
    expect(fetchSpy).toHaveBeenCalledWith("/root/api/gallery/runs/prefix%20run", expect.anything());
    expect(galleryImageUrl("prefix run", "sample one.png", "/root")).toBe(
      "/root/api/gallery/runs/prefix%20run/images/sample%20one.png"
    );
  });

  it("fetches sample config files list", async () => {
    const mockFiles = { files: ["samples.json", "portrait.json"] };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(mockFiles), { status: 200 }));

    const api = createApi("");
    const result = await api.getSampleFiles();
    expect(result.files).toEqual(["samples.json", "portrait.json"]);
  });

  it("creates new sample config file", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ filename: "new_samples.json" }), { status: 200 })
    );

    const api = createApi("");
    const result = await api.createSampleFile("new_samples");
    expect(result.filename).toBe("new_samples.json");
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/samples/files",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "new_samples" }),
      })
    );
  });
});

