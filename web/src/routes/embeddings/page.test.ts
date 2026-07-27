import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import EmbeddingsPage from "./+page.svelte";

const mockSchema = {
  tabs: [
    {
      id: "embeddings",
      label: "Embeddings",
      groups: [
        {
          id: "embeddings",
          title: "Textual Inversion Embeddings",
          fields: [
            {
              id: "embedding-lr",
              keys: ["embedding_learning_rate"],
              label: "Embedding Learning Rate",
              control: "number",
            },
          ],
        },
      ],
    },
  ],
};

const mockSetRaw = vi.fn();
let mockDraft: Record<string, any> = {
  model_type: "HUNYUAN_VIDEO",
  training_method: "FINE_TUNE",
  embedding_learning_rate: 0.001,
  additional_embeddings: [
    {
      uuid: "emb-1",
      model_name: "base_emb.pt",
      placeholder: "<my_style>",
      token_count: 2,
      train: true,
      is_output_embedding: false,
      stop_training_after: 0,
      stop_training_after_unit: "NEVER",
      initial_embedding_text: "style",
    },
  ],
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

describe("Embeddings page model capability and embedding card list", () => {
  it("renders enabled Embeddings page for Hunyuan Video with embedding card list", () => {
    mockDraft.model_type = "HUNYUAN_VIDEO";
    render(EmbeddingsPage);

    expect(screen.getByLabelText("Embedding Learning Rate")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("<my_style>")).toBeInTheDocument();
  });

  it("adds a new embedding entry when clicking + Add Embedding button", async () => {
    mockDraft.model_type = "HUNYUAN_VIDEO";
    render(EmbeddingsPage);

    const addBtn = screen.getByRole("button", { name: /Add Embedding/i });
    await fireEvent.click(addBtn);

    expect(mockSetRaw).toHaveBeenCalledWith(
      "additional_embeddings",
      expect.arrayContaining([
        expect.objectContaining({ placeholder: "<my_style>" }),
        expect.objectContaining({ placeholder: "<embedding>", train: true }),
      ])
    );
  });

  it("renders warning banner and disables controls for unsupported Qwen model type", () => {
    mockDraft.model_type = "QWEN";
    render(EmbeddingsPage);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText(/Embeddings options are disabled because the selected Base Model Type/i)
    ).toBeInTheDocument();
  });
});
