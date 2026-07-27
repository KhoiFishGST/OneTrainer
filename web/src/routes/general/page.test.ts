import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import GeneralPage from "./+page.svelte";

const mockSchema = {
  tabs: [
    {
      id: "general",
      label: "General",
      groups: [
        {
          id: "workspace",
          title: "Workspace",
          fields: [
            {
              id: "workspace_dir",
              keys: ["workspace_dir"],
              label: "Workspace Directory",
              control: "directory",
            },
          ],
        },
        {
          id: "debug",
          title: "Debug",
          fields: [
            {
              id: "debug_mode",
              keys: ["debug_mode"],
              label: "Debug mode",
              control: "toggle",
            },
          ],
        },
        {
          id: "tensorboard",
          title: "TensorBoard",
          fields: [
            {
              id: "tensorboard",
              keys: ["tensorboard"],
              label: "Tensorboard",
              control: "toggle",
            },
          ],
        },
        {
          id: "validation",
          title: "Validation",
          fields: [
            {
              id: "validation",
              keys: ["validation"],
              label: "Validation",
              control: "toggle",
            },
          ],
        },
        {
          id: "execution_hardware",
          title: "Execution & Hardware Devices",
          fields: [
            {
              id: "dataloader_threads",
              keys: ["dataloader_threads"],
              label: "Dataloader Threads",
              control: "number",
            },
          ],
        },
        {
          id: "multi_gpu",
          title: "Multi-GPU Training",
          fields: [
            {
              id: "multi_gpu",
              keys: ["multi_gpu"],
              label: "Multi-GPU",
              control: "toggle",
            },
          ],
        },
      ],
    },
  ],
};

const mockSetRaw = vi.fn();

vi.mock("$lib/config/context", () => ({
  getRouteContext: () => ({
    schema: mockSchema,
    workspace: {
      draft: {
        workspace_dir: "/tmp/ws",
        debug_mode: false,
        tensorboard: false,
        validation: false,
        dataloader_threads: 2,
        multi_gpu: false,
      },
      errors: [],
      setRaw: mockSetRaw,
    },
    openDirectory: vi.fn(),
  }),
}));

describe("General page subnav tabs", () => {
  it("renders 6 text-only tabs and switches between panels", async () => {
    render(GeneralPage);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent?.trim())).toEqual([
      "Workspace",
      "Debug",
      "Tensors",
      "Validation",
      "Execution",
      "Multi-GPU",
    ]);

    // Workspace tab active by default
    expect(screen.getByLabelText("Workspace Directory")).toBeInTheDocument();
    expect(screen.queryByLabelText("Debug mode")).not.toBeInTheDocument();

    // Switch to Debug tab
    await fireEvent.click(screen.getByRole("tab", { name: "Debug" }));
    expect(screen.getByLabelText("Debug mode")).toBeInTheDocument();
    expect(screen.queryByLabelText("Workspace Directory")).not.toBeInTheDocument();

    // Switch to Tensors tab
    await fireEvent.click(screen.getByRole("tab", { name: "Tensors" }));
    expect(screen.getByLabelText("Tensorboard")).toBeInTheDocument();

    // Switch to Validation tab
    await fireEvent.click(screen.getByRole("tab", { name: "Validation" }));
    expect(screen.getByLabelText("Validation")).toBeInTheDocument();

    // Switch to Execution tab
    await fireEvent.click(screen.getByRole("tab", { name: "Execution" }));
    expect(screen.getByLabelText("Dataloader Threads")).toBeInTheDocument();

    // Switch to Multi-GPU tab
    await fireEvent.click(screen.getByRole("tab", { name: "Multi-GPU" }));
    expect(screen.getByLabelText("Multi-GPU")).toBeInTheDocument();
  });
});
