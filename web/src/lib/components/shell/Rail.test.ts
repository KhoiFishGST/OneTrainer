import { fireEvent, render, screen } from "@testing-library/svelte";
import { expect, it } from "vitest";
import Rail from "./Rail.svelte";

it("persists pinned expansion and enables configuration routes", async () => {
  render(Rail, { currentPath: "/general", mobile: false });
  await fireEvent.click(screen.getByRole("button", { name: "Expand navigation" }));
  expect(localStorage.getItem("webui.railExpanded")).toBe("true");
  expect(screen.getByText("General")).toBeVisible();
  
  for (const name of ["Model", "Concepts", "Training", "Sampling", "LoRA", "Datasets", "Live"]) {
    const link = screen.getByRole("link", { name });
    expect(link).not.toHaveAttribute("aria-disabled");
  }

  expect(screen.queryByRole("link", { name: "Data" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Cloud" })).not.toBeInTheDocument();
});

it("opens phone navigation as a modal drawer", async () => {
  render(Rail, { currentPath: "/general", mobile: true });
  await fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  expect(screen.getByRole("dialog", { name: "Navigation" })).toBeVisible();
});
