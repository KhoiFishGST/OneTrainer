import { expect, it, vi } from "vitest";
import { ConsoleStore } from "./console-store.svelte";
import { EventClient } from "./client";

class FakeWebSocket {
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: ((ev: any) => void) | null = null;
  onclose: (() => void) | null = null;
  readyState = 1;
  closed = false;

  constructor(public url: string) {}

  close() {
    this.readyState = 3;
    this.closed = true;
    if (this.onclose) this.onclose();
  }

  triggerOpen() {
    if (this.onopen) this.onopen();
  }

  triggerMessage(data: any) {
    if (this.onmessage) this.onmessage({ data: JSON.stringify(data) });
  }

  triggerClose() {
    this.readyState = 3;
    this.closed = true;
    if (this.onclose) this.onclose();
  }
}

const line = (id: number, text: string) => ({ id, spans: [{ text, classes: [] }], overwrite: false });

it("queues live events before REST backlog resolves, discards at/below cursor, applies newer", async () => {
  const store = new ConsoleStore();
  let socketInstance: FakeWebSocket | null = null;

  let resolveBacklog!: (val: any) => void;
  const backlogPromise = new Promise((resolve) => {
    resolveBacklog = resolve;
  });

  const client = new EventClient({
    store,
    getBacklog: () => backlogPromise as any,
    createSocket: (url) => {
      socketInstance = new FakeWebSocket(url);
      return socketInstance as any;
    },
  });

  client.start();
  expect(socketInstance).not.toBeNull();
  socketInstance!.triggerOpen();

  socketInstance!.triggerMessage({ type: "console", stream_id: "s", seq: 1, lines: [line(1, "old")] });
  socketInstance!.triggerMessage({ type: "console", stream_id: "s", seq: 2, lines: [line(2, "cursor_line")] });
  socketInstance!.triggerMessage({ type: "console", stream_id: "s", seq: 3, lines: [line(3, "new_line")] });

  resolveBacklog({
    stream_id: "s",
    cursor: 2,
    revision: "v1",
    lines: [line(100, "backlog_line")],
    transient: null,
  });

  await backlogPromise;
  await new Promise((r) => setTimeout(r, 0));

  expect(store.rows.map((r) => r.id)).toEqual([100, 3]);
});

it("uses capped reconnect delays: 500, 1000, 2000, 4000, 8000, 10000 ms", async () => {
  const store = new ConsoleStore();
  const timeouts: number[] = [];
  const fakeSetTimeout = (fn: Function, delay: number) => {
    timeouts.push(delay);
    return 123 as any;
  };

  let sockets: FakeWebSocket[] = [];
  const client = new EventClient({
    store,
    getBacklog: async () => ({ stream_id: "s", cursor: 0, revision: "v1", lines: [], transient: null }),
    createSocket: (url) => {
      const s = new FakeWebSocket(url);
      sockets.push(s);
      return s as any;
    },
    setTimeout: fakeSetTimeout as any,
    clearTimeout: (() => {}) as any,
  });

  client.start();

  for (let i = 0; i < 6; i++) {
    const currentSocket = sockets[sockets.length - 1];
    currentSocket.triggerClose();
  }

  expect(timeouts).toEqual([500, 1000, 2000, 4000, 8000, 10000]);
});

it("notifies onConfigChanged on config_changed events", async () => {
  const store = new ConsoleStore();
  const onConfigChanged = vi.fn();
  let socketInstance: FakeWebSocket | null = null;

  const client = new EventClient({
    store,
    getBacklog: async () => ({ stream_id: "s", cursor: 1, revision: "v1", lines: [], transient: null }),
    onConfigChanged,
    createSocket: (url) => {
      socketInstance = new FakeWebSocket(url);
      return socketInstance as any;
    },
  });

  client.start();
  socketInstance!.triggerOpen();
  await new Promise((r) => setTimeout(r, 0));

  socketInstance!.triggerMessage({ type: "config_changed", revision: "v2", seq: 2, stream_id: "s" });
  expect(onConfigChanged).toHaveBeenCalledWith("v2");
});

it("notifies training sample and gallery warning callbacks", async () => {
  const onTrainingSample = vi.fn();
  const onGalleryWarning = vi.fn();
  let socketInstance: FakeWebSocket | null = null;
  const store = new ConsoleStore();
  const client = new EventClient({
    store,
    getBacklog: async () => ({ stream_id: "s", cursor: 1, revision: "v1", lines: [], transient: null }),
    onTrainingSample,
    onGalleryWarning,
    createSocket: (url) => {
      socketInstance = new FakeWebSocket(url);
      return socketInstance as any;
    },
  });
  client.start();
  socketInstance!.triggerOpen();
  await new Promise((r) => setTimeout(r, 0));

  socketInstance!.triggerMessage({ type: "training_sample", run_key: "run", batch_id: 1 });
  socketInstance!.triggerMessage({ type: "gallery_warning", message: "thumbnail failed", run_key: "run" });
  expect(onTrainingSample).toHaveBeenCalledWith(expect.objectContaining({ run_key: "run" }));
  expect(onGalleryWarning).toHaveBeenCalledWith(expect.objectContaining({ message: "thumbnail failed" }));
  client.stop();
});

it('dataset.file.added is routed to onDatasetFileAdded', async () => {
  const received: any[] = [];
  let socketInstance: FakeWebSocket | null = null;
  const store = new ConsoleStore();

  const client = new EventClient({
    store,
    getBacklog: async () => ({ stream_id: 's', cursor: 0, revision: 'v1', lines: [], transient: null }),
    onDatasetFileAdded: (event) => received.push(event),
    createSocket: (url) => {
      socketInstance = new FakeWebSocket(url);
      return socketInstance as any;
    },
  });

  client.start();
  socketInstance!.triggerOpen();
  await new Promise((r) => setTimeout(r, 0));

  socketInstance!.triggerMessage({
    type: 'dataset.file.added',
    dataset: 'ds',
    filename: 'a.png',
    item_id: 'a',
    kind: 'image',
    seq: 1,
  });

  expect(received).toEqual([
    { dataset: 'ds', filename: 'a.png', item_id: 'a', kind: 'image' },
  ]);
  client.stop();
});

