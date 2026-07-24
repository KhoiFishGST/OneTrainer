import { fireEvent, render, screen } from "@testing-library/svelte";
import { expect, it } from "vitest";
import Rail from "./Rail.svelte";

it("persists pinned expansion and enables Phase B configuration routes", async () => {
  render(Rail, { currentPath: "/general", mobile: false });
  await fireEvent.click(screen.getByRole("button", { name: "Expand navigation" }));
  expect(localStorage.getItem("webui.railExpanded")).toBe("true");
  expect(screen.getByText("General")).toBeVisible();
  
  // Enabled tabs
  for (const name of ["Model", "Concepts", "Training", "Sampling", "LoRA/Embedding", "Live", "Datasets"]) {
    const link = screen.getByRole("link", { name });
    expect(link).not.toHaveAttribute("aria-disabled");
  }

  // Future tabs remain disabled
  expect(screen.getByRole("link", { name: "Cloud" })).toHaveAttribute("aria-disabled", "true");
  expect(screen.getByRole("link", { name: "Tools" })).toHaveAttribute("aria-disabled", "true");
});

it("opens phone navigation as a modal drawer", async () => {
  render(Rail, { currentPath: "/general", mobile: true });
  await fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  expect(screen.getByRole("dialog", { name: "Navigation" })).toBeVisible();
});
