import { expect, it } from "vitest";
import { ConsoleStore } from "./console-store.svelte";

const line = (id: number, text: string, overwrite = false) => ({
  id,
  spans: [{ text, classes: [] }],
  overwrite,
});

it("replaces transient lines and deduplicates sequences", () => {
  const store = new ConsoleStore(10000, 4 * 1024 * 1024);
  store.installBacklog({ stream_id: "s", cursor: 1, revision: "i:0", lines: [line(1, "start")], transient: null });
  store.apply({ type: "console", stream_id: "s", seq: 2, t: 1, lines: [line(2, "10%", true)] });
  store.apply({ type: "console", stream_id: "s", seq: 3, t: 2, lines: [line(3, "20%", true)] });
  store.apply({ type: "console", stream_id: "s", seq: 3, t: 2, lines: [line(3, "20%", true)] });
  expect(store.rows.map((row) => row.id)).toEqual([1, 3]);
});

it("requests resync on sequence gap or stream change", () => {
  const store = new ConsoleStore();
  store.installBacklog({ stream_id: "s", cursor: 4, revision: "i:0", lines: [], transient: null });
  expect(store.apply({ type: "console", stream_id: "s", seq: 6, t: 1, lines: [] })).toBe("resync");
  expect(store.apply({ type: "console", stream_id: "new", seq: 1, t: 1, lines: [] })).toBe("restart");
});

it("enforces max lines retention limit", () => {
  const store = new ConsoleStore(3, 10000);
  store.installBacklog({ stream_id: "s", cursor: 0, revision: "i:0", lines: [], transient: null });
  for (let i = 1; i <= 5; i++) {
    store.apply({ type: "console", stream_id: "s", seq: i, lines: [line(i, `line ${i}`)] });
  }
  expect(store.rows.map((r) => r.id)).toEqual([3, 4, 5]);
});

it("enforces max bytes retention limit", () => {
  const store = new ConsoleStore(10, 20); // 20 bytes max
  store.installBacklog({ stream_id: "s", cursor: 0, revision: "i:0", lines: [], transient: null });
  // Each line is 10 bytes ("1234567890")
  store.apply({ type: "console", stream_id: "s", seq: 1, lines: [line(1, "1234567890")] });
  store.apply({ type: "console", stream_id: "s", seq: 2, lines: [line(2, "1234567890")] });
  store.apply({ type: "console", stream_id: "s", seq: 3, lines: [line(3, "1234567890")] });
  expect(store.rows.map((r) => r.id)).toEqual([2, 3]);
});

it("does not double count transient row bytes in recalculateBytesAndPrune", () => {
  const store = new ConsoleStore(10, 20); // 20 bytes max
  // 10 bytes line + 10 bytes transient line = 20 bytes total (should fit!)
  store.installBacklog({
    stream_id: "s",
    cursor: 1,
    revision: "i:0",
    lines: [line(1, "1234567890")],
    transient: line(2, "1234567890", true),
  });
  expect(store.committedRows.map((r) => r.id)).toEqual([1]);
  expect(store.rows.map((r) => r.id)).toEqual([1, 2]);
});
