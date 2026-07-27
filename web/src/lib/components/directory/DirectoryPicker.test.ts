import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { expect, it, vi } from "vitest";
import DirectoryPicker from "./DirectoryPicker.svelte";

it("navigates server directories and selects the current path", async () => {
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
  const onSelect = vi.fn();
  render(DirectoryPicker, { initialPath: "/", list, onSelect, open: true });

  expect(await screen.findByRole("button", { name: "workspace" })).toBeVisible();
  await fireEvent.click(screen.getByRole("button", { name: "workspace" }));

  expect(await screen.findByRole("button", { name: "Select Folder" })).toBeVisible();
  await fireEvent.click(screen.getByRole("button", { name: "Select Folder" }));

  expect(onSelect).toHaveBeenCalledWith("/workspace");
});

it("keeps the current path when listing fails", async () => {
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
  expect(screen.getByDisplayValue("/custom/path")).toHaveFocus();
  await fireEvent.keyDown(input, { key: "Enter", target: { value: "/custom/path" } });

  expect(await screen.findByRole("button", { name: "sub" })).toBeVisible();
  expect(list).toHaveBeenLastCalledWith("/custom/path");
});

it("shows truncation notice when directory list is truncated", async () => {
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

  render(DirectoryPicker, { initialPath: "/", list, onSelect: vi.fn(), onClose, open: true });

  const cancelButton = await screen.findByRole("button", { name: "Cancel" });
  await fireEvent.click(cancelButton);
  expect(onClose).toHaveBeenCalledTimes(1);

  const dialog = screen.getByRole("dialog");
  await fireEvent.keyDown(dialog, { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(2);
});

it("renders breadcrumbs and navigates when a breadcrumb segment is clicked", async () => {
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

it("manages dialog accessibility, initial focus, focus restoration, and tab trap", async () => {
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

  const dialog = await screen.findByRole("dialog", { name: "Server Directory Picker" });
  expect(dialog).toBeVisible();
  expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(dialog).toHaveClass("picker-modal");

  const pathInput = screen.getByPlaceholderText("Enter path...");
  await vi.waitFor(() => {
    expect(document.activeElement).toBe(pathInput);
  });

  const selectButton = screen.getByRole("button", { name: /^Select/ });
  const closeButton = screen.getByRole("button", { name: "Close" });

  selectButton.focus();
  expect(document.activeElement).toBe(selectButton);
  await fireEvent.keyDown(dialog, { key: "Tab", shiftKey: false });
  expect(document.activeElement).toBe(closeButton);

  closeButton.focus();
  expect(document.activeElement).toBe(closeButton);
  await fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(selectButton);

  rerender({ open: false });
  expect(document.activeElement).toBe(triggerButton);

  document.body.removeChild(triggerButton);
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

it("triggers onClose when clicking the backdrop overlay outside the modal dialog", async () => {
  const list = vi.fn().mockResolvedValue({
    path: "/dir",
    parent: "/",
    directories: [],
    entries: [],
    roots: ["/"],
    truncated: false,
  });

  const onClose = vi.fn();
  const onSelect = vi.fn();
  const { container } = render(DirectoryPicker, { initialPath: "/dir", list, onClose, onSelect, open: true });

  const backdrop = container.querySelector(".picker-backdrop")!;
  expect(backdrop).toBeInTheDocument();

  await fireEvent.click(backdrop);

  expect(onClose).toHaveBeenCalled();
});
