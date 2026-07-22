import { fireEvent, render, screen } from "@testing-library/svelte";
import { expect, it } from "vitest";
import Rail from "./Rail.svelte";

it("persists pinned expansion and keeps future routes disabled", async () => {
  render(Rail, { currentPath: "/general", mobile: false });
  await fireEvent.click(screen.getByRole("button", { name: "Expand navigation" }));
  expect(localStorage.getItem("webui.railExpanded")).toBe("true");
  expect(screen.getByText("General")).toBeVisible();
  expect(screen.getByRole("link", { name: "Model" })).toHaveAttribute("aria-disabled", "true");
});

it("opens phone navigation as a modal drawer", async () => {
  render(Rail, { currentPath: "/general", mobile: true });
  await fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  expect(screen.getByRole("dialog", { name: "Navigation" })).toBeVisible();
});
