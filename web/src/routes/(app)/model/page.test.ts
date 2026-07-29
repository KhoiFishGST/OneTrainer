import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ModelPage from "./+page.svelte";

const mockSchema = {
  tabs: [
    {
      id: "model",
      label: "Model",
      groups: [
        {
          id: "base_model",
          title: "Base Model",
          fields: [
            {
              id: "base_model_name",
              keys: ["base_model_name"],
              label: "Base Model Name",
              control: "text",
            },
          ],
        },
        {
          id: "output",
          title: "Output Settings",
          fields: [
            {
              id: "output_model_destination",
              keys: ["output_model_destination"],
              label: "Output Destination",
              control: "text",
            },
          ],
        },
        {
          id: "primary_backbone",
          title: "Primary Backbone Model",
          fields: [
            {
              id: "unet_weight_dtype",
              keys: ["unet", "weight_dtype"],
              label: "UNet Data Type",
              control: "select",
            },
          ],
        },
        {
          id: "quantization",
          title: "Quantization & SVD",
          fields: [
            {
              id: "svd_rank",
              keys: ["quantization", "svd_rank"],
              label: "SVDQuant Rank",
              control: "number",
            },
          ],
        },
        {
          id: "text_encoders",
          title: "Text Encoders",
          fields: [
            {
              id: "te_weight_dtype",
              keys: ["text_encoder", "weight_dtype"],
              label: "Text Encoder Data Type",
              control: "select",
            },
          ],
        },
        {
          id: "vae_autoencoders",
          title: "VAE & Image Autoencoders",
          fields: [
            {
              id: "vae_model_name",
              keys: ["vae", "model_name"],
              label: "VAE Override",
              control: "text",
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
        base_model_name: "sdxl.safetensors",
        output_model_destination: "output/model.safetensors",
        unet: { weight_dtype: "fp16" },
        quantization: { svd_rank: 32 },
        text_encoder: { weight_dtype: "fp16" },
        vae: { model_name: "" },
      },
      errors: [],
      setRaw: mockSetRaw,
    },
    openDirectory: vi.fn(),
  }),
}));

describe("Model page subnav tabs", () => {
  it("renders 5 text-only tabs and switches between panels", async () => {
    render(ModelPage);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent?.trim())).toEqual([
      "Model",
      "Output",
      "Quant",
      "Text",
      "VAE",
    ]);

    // Model tab active by default (combines base_model and primary_backbone)
    expect(screen.getByLabelText("Base Model Name")).toBeInTheDocument();
    expect(screen.getByLabelText("UNet Data Type")).toBeInTheDocument();
    expect(screen.queryByLabelText("Output Destination")).not.toBeInTheDocument();

    // Switch to Output tab
    await fireEvent.click(screen.getByRole("tab", { name: "Output" }));
    expect(screen.getByLabelText("Output Destination")).toBeInTheDocument();
    expect(screen.queryByLabelText("Base Model Name")).not.toBeInTheDocument();

    // Switch to Quant tab
    await fireEvent.click(screen.getByRole("tab", { name: "Quant" }));
    expect(screen.getByLabelText("SVDQuant Rank")).toBeInTheDocument();

    // Switch to Text tab
    await fireEvent.click(screen.getByRole("tab", { name: "Text" }));
    expect(screen.getByLabelText("Text Encoder Data Type")).toBeInTheDocument();

    // Switch to VAE tab
    await fireEvent.click(screen.getByRole("tab", { name: "VAE" }));
    expect(screen.getByLabelText("VAE Override")).toBeInTheDocument();
  });
});
