import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi, beforeEach } from "vitest";
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
let mockWorkspace: any = null;

vi.mock("$lib/config/context", () => ({
  getRouteContext: () => ({
    schema: mockSchema,
    workspace: mockWorkspace,
    openDirectory: vi.fn(),
  }),
}));

describe("Embeddings page model capability and embedding card list", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockWorkspace = {
      draft: {
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
          {
            uuid: "emb-2",
            model_name: "base_emb2.pt",
            placeholder: "<my_style2>",
            token_count: 1,
            train: true,
          },
        ],
      },
      errors: [],
      setRaw: mockSetRaw,
    };
  });

  it("renders loading skeleton when workspace context is null", () => {
    mockWorkspace = null;
    render(EmbeddingsPage);
    expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
  });

  it("renders enabled Embeddings page for Hunyuan Video with embedding card list", () => {
    mockWorkspace.draft.model_type = "HUNYUAN_VIDEO";
    render(EmbeddingsPage);

    expect(screen.getByLabelText("Embedding Learning Rate")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("<my_style>")).toBeInTheDocument();
  });

  it("adds a new embedding entry when clicking + Add Embedding button", async () => {
    mockWorkspace.draft.model_type = "HUNYUAN_VIDEO";
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

  it("clones and removes specific embedding indices", async () => {
    render(EmbeddingsPage);

    const cloneBtns = screen.getAllByRole("button", { name: /Clone/i });
    await fireEvent.click(cloneBtns[0]); // Clone first embedding (index 0)

    expect(mockSetRaw).toHaveBeenCalledWith(
      "additional_embeddings",
      expect.arrayContaining([
        expect.objectContaining({ placeholder: "<my_style>" }),
        expect.objectContaining({ placeholder: "<my_style2>" }),
        expect.objectContaining({ placeholder: "<my_style>" }),
      ])
    );

    const removeBtns = screen.getAllByRole("button", { name: /Remove|Delete/i });
    await fireEvent.click(removeBtns[0]); // Remove first embedding (index 0)

    expect(mockSetRaw).toHaveBeenCalledWith("additional_embeddings", [
      expect.objectContaining({ placeholder: "<my_style2>" }),
    ]);
  });

  it("renders warning banner and disables controls for unsupported Qwen model type", () => {
    mockWorkspace.draft.model_type = "QWEN";
    render(EmbeddingsPage);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText(/Embeddings options are disabled because the selected Base Model Type/i)
    ).toBeInTheDocument();
  });

  it("renders Empty state composition when no additional embeddings exist", () => {
    mockWorkspace.draft.additional_embeddings = [];
    render(EmbeddingsPage);

    expect(screen.getByText("No Additional Embeddings")).toBeInTheDocument();
  });
});
