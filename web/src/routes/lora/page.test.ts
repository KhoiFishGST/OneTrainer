import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import LoraPage from "./+page.svelte";

const mockSchema = {
  tabs: [
    {
      id: "lora_embedding",
      label: "LoRA",
      groups: [
        {
          id: "lora",
          title: "LoRA",
          fields: [
            {
              id: "lora-rank",
              keys: ["lora_rank"],
              label: "LoRA Rank",
              control: "number",
            },
          ],
        },
        {
          id: "loha",
          title: "LoHa",
          fields: [
            {
              id: "loha-rank",
              keys: ["lora_rank"],
              label: "LoHa Rank",
              control: "number",
            },
          ],
        },
        {
          id: "oft",
          title: "OFT v2",
          fields: [
            {
              id: "oft-block-size",
              keys: ["oft_block_size"],
              label: "OFT Block Size",
              control: "number",
            },
          ],
        },
        {
          id: "lokr",
          title: "LoKr",
          fields: [
            {
              id: "lokr-dim",
              keys: ["lokr_dim"],
              label: "LoKr Dimension",
              control: "number",
            },
          ],
        },
      ],
    },
  ],
};

const mockSetRaw = vi.fn();
let mockDraft = {
  training_method: "LORA",
  peft_type: "LORA",
  lora_rank: 16,
  oft_block_size: 4,
  lokr_dim: 8,
};

vi.mock("$lib/config/context", () => ({
  getRouteContext: () => ({
    schema: mockSchema,
    workspace: {
      draft: mockDraft,
      errors: [],
      setRaw: mockSetRaw,
    },
    openDirectory: vi.fn(),
  }),
}));

describe("LoRA page subnav tabs and disabled state", () => {
  it("renders 4 PEFT tabs and switches panels when training_method is LORA", async () => {
    mockDraft.training_method = "LORA";
    render(LoraPage);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent?.trim())).toEqual([
      "LoRA",
      "LoHa",
      "OFT v2",
      "LoKr",
    ]);

    // LoRA tab active by default
    expect(screen.getByLabelText("LoRA Rank")).toBeInTheDocument();
    expect(screen.queryByLabelText("OFT Block Size")).not.toBeInTheDocument();

    // Switch to OFT v2 tab
    await fireEvent.click(screen.getByRole("tab", { name: "OFT v2" }));
    expect(screen.getByLabelText("OFT Block Size")).toBeInTheDocument();
    expect(mockSetRaw).toHaveBeenCalledWith("peft_type", "OFT_2");

    // Switch to LoKr tab
    await fireEvent.click(screen.getByRole("tab", { name: "LoKr" }));
    expect(screen.getByLabelText("LoKr Dimension")).toBeInTheDocument();
    expect(mockSetRaw).toHaveBeenCalledWith("peft_type", "LOKR");
  });

  it("renders warning banner and disables controls when training_method is FINE_TUNE", () => {
    mockDraft.training_method = "FINE_TUNE";
    render(LoraPage);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText(/LoRA \/ PEFT options are disabled because the current training method is/i)
    ).toBeInTheDocument();
  });
});
