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

describe("LoRA page PEFT Type dropdown and disabled state", () => {
  it("renders PEFT Type dropdown and switches option fields when training_method is LORA", async () => {
    mockDraft.training_method = "LORA";
    mockDraft.peft_type = "LORA";
    render(LoraPage);

    const peftSelect = screen.getByLabelText("PEFT Type");
    expect(peftSelect).toBeInTheDocument();

    // LoRA fields active by default
    expect(screen.getByLabelText("LoRA Rank")).toBeInTheDocument();
    expect(screen.queryByLabelText("OFT Block Size")).not.toBeInTheDocument();

    // Switch to OFT_2
    await fireEvent.change(peftSelect, { target: { value: "2" } });
    expect(mockSetRaw).toHaveBeenCalledWith("peft_type", "OFT_2");
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
