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

  expect(await screen.findByRole("button", { name: "Select /workspace" })).toBeVisible();
  await fireEvent.click(screen.getByRole("button", { name: "Select /workspace" }));

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
