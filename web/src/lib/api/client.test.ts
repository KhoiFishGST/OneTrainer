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

import { xhrUpload } from './client';

class FakeXhr {
  static last: FakeXhr;
  upload = { onprogress: null as ((e: any) => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 0;
  responseText = '';
  aborted = false;
  openArgs: [string, string] | null = null;
  withCredentials = false;

  constructor() {
    FakeXhr.last = this;
  }
  open(method: string, url: string) {
    this.openArgs = [method, url];
  }
  send(_body: any) {}
  abort() {
    this.aborted = true;
    this.onabort?.();
  }
}

function withFakeXhr(fn: () => void | Promise<void>) {
  const original = globalThis.XMLHttpRequest;
  (globalThis as any).XMLHttpRequest = FakeXhr as any;
  return Promise.resolve(fn()).finally(() => {
    (globalThis as any).XMLHttpRequest = original;
  });
}

describe('xhrUpload', () => {
  it('xhrUpload reports progress and resolves with the parsed body', async () =>
    withFakeXhr(async () => {
      const seen: Array<[number, number]> = [];
      const file = new File(['abc'], 'a.png', { type: 'image/png' });
      const handle = xhrUpload('My Set', file, (sent, total) => seen.push([sent, total]));

      const xhr = FakeXhr.last;
      expect(xhr.openArgs).toEqual(['POST', '/api/datasets/My%20Set/upload']);

      xhr.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 3 });
      xhr.upload.onprogress?.({ lengthComputable: true, loaded: 3, total: 3 });
      xhr.status = 200;
      xhr.responseText = JSON.stringify({ saved: ['a.png'] });
      xhr.onload?.();

      await expect(handle.promise).resolves.toEqual({ saved: ['a.png'] });
      expect(seen).toEqual([
        [1, 3],
        [3, 3],
      ]);
    }));

  it('xhrUpload rejects with ApiError on a failure status', async () =>
    withFakeXhr(async () => {
      const file = new File(['abc'], 'evil.exe');
      const handle = xhrUpload('set', file, () => {});

      const xhr = FakeXhr.last;
      xhr.status = 415;
      xhr.responseText = JSON.stringify({ detail: 'Unsupported file type: evil.exe' });
      xhr.onload?.();

      await expect(handle.promise).rejects.toBeInstanceOf(ApiError);
    }));

  it('xhrUpload abort rejects with an AbortError', async () =>
    withFakeXhr(async () => {
      const file = new File(['abc'], 'a.png');
      const handle = xhrUpload('set', file, () => {});

      handle.abort();

      await expect(handle.promise).rejects.toMatchObject({ name: 'AbortError' });
      expect(FakeXhr.last.aborted).toBe(true);
    }));
});

