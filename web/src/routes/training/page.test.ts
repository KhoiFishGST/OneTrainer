import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import TrainingPage from "./+page.svelte";

const mockSchema = {
  tabs: [
    {
      id: "training",
      label: "Training",
      groups: [
        {
          id: "base_settings",
          title: "Base Settings",
          fields: [
            {
              id: "learning_rate",
              keys: ["learning_rate"],
              label: "Learning Rate",
              control: "number",
            },
          ],
        },
        {
          id: "execution",
          title: "Execution & Environment",
          fields: [
            {
              id: "train_dtype",
              keys: ["train_dtype"],
              label: "Train Dtype",
              control: "select",
            },
          ],
        },
        {
          id: "text_encoders",
          title: "Text Encoder Settings",
          fields: [
            {
              id: "te_lr",
              keys: ["text_encoder", "learning_rate"],
              label: "Text Encoder LR",
              control: "number",
            },
          ],
        },
        {
          id: "denoising_model",
          title: "Denoising Model",
          fields: [
            {
              id: "unet_lr",
              keys: ["unet", "learning_rate"],
              label: "UNet LR",
              control: "number",
            },
          ],
        },
        {
          id: "layer_filtering",
          title: "Layer Filtering",
          fields: [
            {
              id: "layer_filter",
              keys: ["layer_filter"],
              label: "Layer Filter",
              control: "text",
            },
          ],
        },
        {
          id: "noise_and_timesteps",
          title: "Noise & Timesteps",
          fields: [
            {
              id: "offset_noise",
              keys: ["offset_noise_weight"],
              label: "Offset Noise Weight",
              control: "number",
            },
          ],
        },
        {
          id: "masking_and_conditioning",
          title: "Masking & Conditioning",
          fields: [
            {
              id: "masked_training",
              keys: ["masked_training"],
              label: "Masked Training",
              control: "toggle",
            },
          ],
        },
        {
          id: "loss",
          title: "Loss Configuration",
          fields: [
            {
              id: "mse_strength",
              keys: ["mse_strength"],
              label: "MSE Loss Strength",
              control: "number",
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
        learning_rate: 0.0001,
        train_dtype: "fp16",
        text_encoder: { learning_rate: 0.00005 },
        unet: { learning_rate: 0.0001 },
        layer_filter: "",
        offset_noise_weight: 0,
        masked_training: false,
        mse_strength: 1.0,
      },
      errors: [],
      setRaw: mockSetRaw,
    },
    openDirectory: vi.fn(),
  }),
}));

describe("Training page subnav tabs", () => {
  it("renders 8 text-only tabs without icons and switches between panels", async () => {
    render(TrainingPage);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent?.trim())).toEqual([
      "Base",
      "Execution",
      "Text",
      "Denoise",
      "Layer",
      "Noise",
      "Masking",
      "Loss",
    ]);

    // Base tab active by default
    expect(screen.getByLabelText("Learning Rate")).toBeInTheDocument();
    expect(screen.queryByLabelText("Train Dtype")).not.toBeInTheDocument();

    // Switch to Execution tab
    await fireEvent.click(screen.getByRole("tab", { name: "Execution" }));
    expect(screen.getByLabelText("Train Dtype")).toBeInTheDocument();
    expect(screen.queryByLabelText("Learning Rate")).not.toBeInTheDocument();

    // Switch to Text tab
    await fireEvent.click(screen.getByRole("tab", { name: "Text" }));
    expect(screen.getByLabelText("Text Encoder LR")).toBeInTheDocument();

    // Switch to Denoise tab
    await fireEvent.click(screen.getByRole("tab", { name: "Denoise" }));
    expect(screen.getByLabelText("UNet LR")).toBeInTheDocument();

    // Switch to Layer tab
    await fireEvent.click(screen.getByRole("tab", { name: "Layer" }));
    expect(screen.getByLabelText("Layer Filter")).toBeInTheDocument();

    // Switch to Noise tab
    await fireEvent.click(screen.getByRole("tab", { name: "Noise" }));
    expect(screen.getByLabelText("Offset Noise Weight")).toBeInTheDocument();

    // Switch to Masking tab
    await fireEvent.click(screen.getByRole("tab", { name: "Masking" }));
    expect(screen.getByLabelText("Masked Training")).toBeInTheDocument();

    // Switch to Loss tab
    await fireEvent.click(screen.getByRole("tab", { name: "Loss" }));
    expect(screen.getByLabelText("MSE Loss Strength")).toBeInTheDocument();
  });
});
