import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/svelte";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { mockIsMobile } from "$lib/hooks/mock-is-mobile.svelte";
import DirectoryPicker from "./DirectoryPicker.svelte";

vi.mock("$lib/hooks/is-mobile.svelte", () => ({
  get isMobile() {
    return mockIsMobile;
  },
}));

const mediaListeners = new Set<(e: MediaQueryListEvent) => void>();

function mockMatchMedia(matches: boolean) {
  mockIsMobile.current = matches;
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn((cb) => mediaListeners.add(cb)),
      removeListener: vi.fn((cb) => mediaListeners.delete(cb)),
      addEventListener: vi.fn((type, cb) => {
        if (type === "change" || !type) mediaListeners.add(cb);
      }),
      removeEventListener: vi.fn((type, cb) => {
        if (type === "change" || !type) mediaListeners.delete(cb);
      }),
      dispatchEvent: vi.fn(),
    })),
  });
  mediaListeners.forEach((cb) => cb({ matches } as MediaQueryListEvent));
}

describe("DirectoryPicker", () => {
  beforeEach(() => {
    cleanup();
    document.body.innerHTML = "";
    mockMatchMedia(false);
  });

  it("renders Dialog at 1280px (desktop)", async () => {
    const list = vi.fn().mockResolvedValue({
      path: "/",
      parent: null,
      directories: [],
      roots: ["/"],
      truncated: false,
    });

    mockMatchMedia(false);
    render(DirectoryPicker, { initialPath: "/", list, onSelect: vi.fn(), open: true });

    const dialogs = await screen.findAllByRole("dialog");
    expect(dialogs.length).toBe(1);
    expect(document.body.querySelector(".full-screen")).not.toBeInTheDocument();
  });

  it("renders full-screen Sheet at 390px (mobile)", async () => {
    const list = vi.fn().mockResolvedValue({
      path: "/",
      parent: null,
      directories: [],
      roots: ["/"],
      truncated: false,
    });

    mockMatchMedia(true);
    render(DirectoryPicker, { initialPath: "/", list, onSelect: vi.fn(), open: true });

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();

    const targetEl = document.body.querySelector('[data-slot="drawer-content"]');
    expect(targetEl, 'the picker should render as a bottom drawer').not.toBeNull();
    // The old sheet claimed `full-screen` while rendering 293px wide, because
    // sheet-content's `data-[side=right]:w-3/4` outranked its `w-full`.
    expect(document.body.querySelector('.full-screen')).toBeNull();
  });

  it("navigates server directories and selects the current path, calling onSelect before onClose", async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({
        path: "/",
        parent: null,
        directories: [{ name: "workspace", path: "/workspace" }],
        roots: ["/"],
        truncated: false,
      })
      .mockResolvedValueOnce({
        path: "/workspace",
        parent: "/",
        directories: [],
        roots: ["/"],
        truncated: false,
      });

    const callOrder: string[] = [];
    const onSelect = vi.fn(() => callOrder.push("onSelect"));
    const onClose = vi.fn(() => callOrder.push("onClose"));

    render(DirectoryPicker, { initialPath: "/", list, onSelect, onClose, open: true });

    expect(await screen.findByRole("button", { name: "workspace" })).toBeVisible();
    await fireEvent.click(screen.getByRole("button", { name: "workspace" }));

    const selectButton = await screen.findByRole("button", { name: /^Select/ });
    expect(selectButton).toBeVisible();
    await fireEvent.click(selectButton);

    expect(onSelect).toHaveBeenCalledWith("/workspace");
    expect(onClose).toHaveBeenCalled();
    expect(callOrder).toEqual(["onSelect", "onClose"]);
  });

  it("keeps the current path and displays API error Alert when listing fails", async () => {
    render(DirectoryPicker, {
      initialPath: "/denied",
      list: vi
        .fn()
        .mockRejectedValue({ status: 403, detail: "Directory is not readable" }),
      onSelect: vi.fn(),
      open: true,
    });

    expect(await screen.findByText("Directory is not readable")).toBeVisible();
    expect(screen.getByDisplayValue("/denied")).toBeVisible();
  });

  it("supports manual path entry and pressing enter to navigate", async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({
        path: "/",
        parent: null,
        directories: [],
        roots: ["/"],
        truncated: false,
      })
      .mockResolvedValueOnce({
        path: "/custom/path",
        parent: "/custom",
        directories: [{ name: "sub", path: "/custom/path/sub" }],
        roots: ["/"],
        truncated: false,
      });

    render(DirectoryPicker, { initialPath: "/", list, onSelect: vi.fn(), open: true });

    const input = await screen.findByDisplayValue("/");
    await fireEvent.input(input, { target: { value: "/custom/path" } });
    await fireEvent.keyDown(input, { key: "Enter" });

    expect(await screen.findByRole("button", { name: "sub" })).toBeVisible();
    expect(list).toHaveBeenLastCalledWith("/custom/path");
  });

  it("shows truncation Alert notice when directory list is truncated", async () => {
    const list = vi.fn().mockResolvedValue({
      path: "/many",
      parent: "/",
      directories: Array.from({ length: 100 }, (_, i) => ({
        name: `dir_${i}`,
        path: `/many/dir_${i}`,
      })),
      roots: ["/"],
      truncated: true,
    });

    render(DirectoryPicker, { initialPath: "/many", list, onSelect: vi.fn(), open: true });

    expect(await screen.findByText(/results truncated/i)).toBeVisible();
  });

  it("calls onClose when cancel or escape key is pressed", async () => {
    const onClose = vi.fn();
    const list = vi.fn().mockResolvedValue({
      path: "/",
      parent: null,
      directories: [],
      roots: ["/"],
      truncated: false,
    });

    const { rerender } = render(DirectoryPicker, { initialPath: "/", list, onSelect: vi.fn(), onClose, open: true });

    const cancelButton = await screen.findByRole("button", { name: "Cancel" });
    await fireEvent.click(cancelButton);
    expect(onClose).toHaveBeenCalledTimes(1);

    await rerender({ open: true });
    const dialog = await screen.findByRole("dialog");
    await fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("renders POSIX breadcrumbs and navigates when a breadcrumb segment is clicked", async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({
        path: "/home/user/workspace",
        parent: "/home/user",
        directories: [],
        roots: ["/"],
        truncated: false,
      })
      .mockResolvedValueOnce({
        path: "/home",
        parent: "/",
        directories: [{ name: "user", path: "/home/user" }],
        roots: ["/"],
        truncated: false,
      });

    render(DirectoryPicker, { initialPath: "/home/user/workspace", list, onSelect: vi.fn(), open: true });

    const homeSegment = await screen.findByRole("button", { name: "home" });
    expect(homeSegment).toBeVisible();
    await fireEvent.click(homeSegment);

    expect(list).toHaveBeenLastCalledWith("/home");
  });

  it("supports breadcrumb navigation for Windows paths", async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({
        path: "C:\\Users\\Name",
        parent: "C:\\Users",
        directories: [],
        roots: ["C:\\"],
        truncated: false,
      })
      .mockResolvedValueOnce({
        path: "C:\\Users",
        parent: "C:\\",
        directories: [{ name: "Name", path: "C:\\Users\\Name" }],
        roots: ["C:\\"],
        truncated: false,
      });

    render(DirectoryPicker, { initialPath: "C:\\Users\\Name", list, onSelect: vi.fn(), open: true });

    const usersSegment = await screen.findByRole("button", { name: "Users" });
    expect(usersSegment).toBeVisible();
    await fireEvent.click(usersSegment);

    expect(list).toHaveBeenLastCalledWith("C:\\Users");
  });

  it("handles root and parent directory navigation", async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({
        path: "/workspace/project",
        parent: "/workspace",
        directories: [],
        roots: ["/"],
        truncated: false,
      })
      .mockResolvedValueOnce({
        path: "/workspace",
        parent: "/",
        directories: [],
        roots: ["/"],
        truncated: false,
      })
      .mockResolvedValueOnce({
        path: "/",
        parent: null,
        directories: [],
        roots: ["/"],
        truncated: false,
      });

    render(DirectoryPicker, { initialPath: "/workspace/project", list, onSelect: vi.fn(), open: true });

    const parentBtn = await screen.findByRole("button", { name: ".." });
    await fireEvent.click(parentBtn);
    expect(list).toHaveBeenLastCalledWith("/workspace");

    const slashBtns = screen.getAllByRole("button", { name: "/" });
    const rootBtn = slashBtns[slashBtns.length - 1];
    await fireEvent.click(rootBtn);
    expect(list).toHaveBeenLastCalledWith("/");
  });

  it("disables select button in file mode when no file is selected", async () => {
    const list = vi.fn().mockResolvedValue({
      path: "/dir",
      parent: "/",
      directories: [],
      entries: [
        { name: "sub", path: "/dir/sub", is_dir: true },
        { name: "file.txt", path: "/dir/file.txt", is_dir: false },
      ],
      roots: ["/"],
      truncated: false,
    });

    const onSelect = vi.fn();
    render(DirectoryPicker, { initialPath: "/dir", mode: "file", list, onSelect, open: true });

    const selectButton = await screen.findByRole("button", { name: /^Select/ });
    expect(selectButton).toBeDisabled();

    const fileItem = await screen.findByRole("button", { name: "file.txt" });
    await fireEvent.click(fileItem);

    expect(selectButton).not.toBeDisabled();
  });

  it("manages focus restoration on close", async () => {
    const list = vi.fn().mockResolvedValue({
      path: "/",
      parent: null,
      directories: [],
      roots: ["/"],
      truncated: false,
    });

    const triggerButton = document.createElement("button");
    triggerButton.textContent = "Open Picker";
    document.body.appendChild(triggerButton);
    triggerButton.focus();
    expect(document.activeElement).toBe(triggerButton);

    const { rerender } = render(DirectoryPicker, {
      initialPath: "/",
      list,
      onSelect: vi.fn(),
      onClose: vi.fn(),
      open: true,
    });

    await screen.findByRole("dialog");
    await rerender({ open: false });
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(triggerButton);
    });
    await new Promise((r) => setTimeout(r, 60));

    document.body.removeChild(triggerButton);
  });
});
