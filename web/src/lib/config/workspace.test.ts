import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigWorkspace } from "./workspace.svelte";
import { cloneDocument, getPath, setPath } from "./path";
import { validateConfig } from "./validation";

const schema = {
  model_type: "STABLE_DIFFUSION_15",
  training_method: "FINE_TUNE",
  tabs: [
    {
      id: "general",
      label: "General",
      groups: [
        {
          id: "g",
          title: "G",
          fields: [
            {
              id: "port",
              keys: ["tensorboard_port"],
              label: "Port",
              tooltip: "Port",
              control: "number",
              required: true,
              nullable: false,
              visible: true,
            },
            {
              id: "mode",
              keys: ["debug_mode"],
              label: "Debug Mode",
              tooltip: "Debug",
              control: "select",
              required: false,
              nullable: true,
              visible: true,
              options: [
                { value: "off", label: "Off" },
                { value: "on", label: "On" },
              ],
            },
          ],
        },
      ],
    },
  ],
} as const;

beforeEach(() => {
  vi.useFakeTimers();
});

describe("Path helpers", () => {
  it("gets nested and top-level values", () => {
    const obj = { a: { b: 42 }, c: "hello" };
    expect(getPath(obj, "c")).toBe("hello");
    expect(getPath(obj, "a.b")).toBe(42);
    expect(getPath(obj, "a.missing")).toBeUndefined();
  });

  it("sets path immutably", () => {
    const original = { a: { b: 1 }, c: 2 };
    const updated = setPath(original, "a.b", 100);
    expect(updated).toEqual({ a: { b: 100 }, c: 2 });
    expect(original.a.b).toBe(1);
    expect(updated).not.toBe(original);
    expect(updated.a).not.toBe(original.a);
  });

  it("clones document structurally", () => {
    const original = { a: [1, 2], b: { c: true } };
    const clone = cloneDocument(original);
    expect(clone).toEqual(original);
    expect(clone).not.toBe(original);
    expect(clone.b).not.toBe(original.b);
  });
});

describe("Schema validation", () => {
  it("converts number strings to numeric types and validates invalid values", () => {
    const invalidRes = validateConfig({ tensorboard_port: "bad" }, schema as any);
    expect(invalidRes.isValid).toBe(false);
    expect(invalidRes.errors).toEqual([{ path: "tensorboard_port", message: "Expected integer" }]);

    const validRes = validateConfig({ tensorboard_port: "7000" }, schema as any);
    expect(validRes.isValid).toBe(true);
    expect(validRes.errors).toEqual([]);
    expect(validRes.normalized.tensorboard_port).toBe(7000);
  });

  it("handles nullable and enum option validations", () => {
    const nullRes = validateConfig({ tensorboard_port: 6006, debug_mode: null }, schema as any);
    expect(nullRes.isValid).toBe(true);

    const badEnum = validateConfig({ tensorboard_port: 6006, debug_mode: "invalid_option" }, schema as any);
    expect(badEnum.isValid).toBe(false);
    expect(badEnum.errors).toEqual([{ path: "debug_mode", message: "Invalid option" }]);
  });
});

describe("ConfigWorkspace", () => {
  it("keeps invalid raw input local and unsaved", async () => {
    const put = vi.fn();
    const workspace = new ConfigWorkspace({ config: { tensorboard_port: 6006 }, revision: "i:0" }, schema as any, put);
    workspace.setRaw("tensorboard_port", "bad");
    await vi.advanceTimersByTimeAsync(600);
    expect(workspace.state).toBe("unsaved");
    expect(workspace.errors).toEqual([{ path: "tensorboard_port", message: "Expected integer" }]);
    expect(put).not.toHaveBeenCalled();
  });

  it("debounces a valid full-document save", async () => {
    const put = vi.fn().mockResolvedValue({ config: { tensorboard_port: 7000 }, revision: "i:1" });
    const workspace = new ConfigWorkspace({ config: { tensorboard_port: 6006 }, revision: "i:0" }, schema as any, put);
    workspace.setRaw("tensorboard_port", "7000");
    await vi.advanceTimersByTimeAsync(499);
    expect(put).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(put).toHaveBeenCalledWith({ config: { tensorboard_port: 7000 }, base_revision: "i:0", overwrite: false });
    expect(workspace.state).toBe("saved");
  });

  it("preserves draft through conflict and explicit overwrite", async () => {
    const put = vi.fn()
      .mockRejectedValueOnce({ status: 409, detail: { current_revision: "i:1" } })
      .mockResolvedValueOnce({ config: { tensorboard_port: 7000 }, revision: "i:2" });
    const workspace = new ConfigWorkspace({ config: { tensorboard_port: 6006 }, revision: "i:0" }, schema as any, put);
    workspace.setRaw("tensorboard_port", "7000");
    await workspace.flush();
    expect(workspace.state).toBe("conflict");
    await workspace.overwriteServer();
    expect(put).toHaveBeenLastCalledWith({ config: { tensorboard_port: 7000 }, base_revision: "i:1", overwrite: true });
    expect(workspace.state).toBe("saved");
  });

  it("handles 422 server validation field errors", async () => {
    const put = vi.fn().mockRejectedValueOnce({
      status: 422,
      detail: [{ path: "tensorboard_port", message: "Port in use" }],
    });
    const workspace = new ConfigWorkspace({ config: { tensorboard_port: 6006 }, revision: "i:0" }, schema as any, put);
    workspace.setRaw("tensorboard_port", "7000");
    await workspace.flush();
    expect(workspace.state).toBe("unsaved");
    expect(workspace.errors).toEqual([{ path: "tensorboard_port", message: "Port in use" }]);
  });

  it("handles network failure and retry", async () => {
    const put = vi.fn()
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({ config: { tensorboard_port: 7000 }, revision: "i:1" });
    const workspace = new ConfigWorkspace({ config: { tensorboard_port: 6006 }, revision: "i:0" }, schema as any, put);
    workspace.setRaw("tensorboard_port", "7000");
    await workspace.flush();
    expect(workspace.state).toBe("failed");

    await workspace.retry();
    expect(workspace.state).toBe("saved");
  });

  it("handles acceptRemote for matching revision, clean workspace, and dirty workspace", () => {
    const put = vi.fn();
    const workspace = new ConfigWorkspace({ config: { tensorboard_port: 6006 }, revision: "i:0" }, schema as any, put);

    // Matching revision -> ignore
    workspace.acceptRemote({ config: { tensorboard_port: 6006 }, revision: "i:0" });
    expect(workspace.state).toBe("saved");

    // Clean workspace -> replace
    workspace.acceptRemote({ config: { tensorboard_port: 8000 }, revision: "i:1" });
    expect(workspace.baseline.revision).toBe("i:1");
    expect(workspace.draft.tensorboard_port).toBe(8000);

    // Dirty workspace -> set conflict
    workspace.setRaw("tensorboard_port", "9000");
    workspace.acceptRemote({ config: { tensorboard_port: 8001 }, revision: "i:2" });
    expect(workspace.state).toBe("conflict");
    expect(workspace.draft.tensorboard_port).toBe("9000");
  });

  it("reloadServer requires confirmation flag to discard local edits", () => {
    const put = vi.fn();
    const workspace = new ConfigWorkspace({ config: { tensorboard_port: 6006 }, revision: "i:0" }, schema as any, put);
    workspace.setRaw("tensorboard_port", "9000");

    workspace.reloadServer(false);
    expect(workspace.draft.tensorboard_port).toBe("9000");

    workspace.reloadServer(true);
    expect(workspace.draft.tensorboard_port).toBe(6006);
    expect(workspace.state).toBe("saved");
  });

  it("beforePresetSave validates state and flushes dirty workspace", async () => {
    const put = vi.fn().mockResolvedValue({ config: { tensorboard_port: 7000 }, revision: "i:1" });
    const workspace = new ConfigWorkspace({ config: { tensorboard_port: 6006 }, revision: "i:0" }, schema as any, put);

    workspace.setRaw("tensorboard_port", "bad");
    await expect(workspace.beforePresetSave()).rejects.toThrow("Cannot save preset with invalid config");

    workspace.setRaw("tensorboard_port", "7000");
    await workspace.beforePresetSave();
    expect(put).toHaveBeenCalledWith({ config: { tensorboard_port: 7000 }, base_revision: "i:0", overwrite: false });
    expect(workspace.state).toBe("saved");
  });
});
