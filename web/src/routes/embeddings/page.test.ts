import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/svelte";
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
let mockDraft = {
  model_type: "HUNYUAN_VIDEO",
  training_method: "FINE_TUNE",
  embedding_learning_rate: 0.001,
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

describe("Embeddings page model capability and disabled state", () => {
  it("renders enabled Embeddings page for Hunyuan Video", () => {
    mockDraft.model_type = "HUNYUAN_VIDEO";
    render(EmbeddingsPage);

    expect(screen.getByLabelText("Embedding Learning Rate")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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
