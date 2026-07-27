import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import OptimizerParamsModal from "./OptimizerParamsModal.svelte";

describe("OptimizerParamsModal", () => {
  it("opens without infinite loop error and initializes state cleanly", async () => {
    let open = true;
    const values = {
      optimizer: { optimizer: "MUON" },
      optimizer_params: { ns_steps: 5 },
    };
    const onSave = vi.fn();

    render(OptimizerParamsModal, {
      props: {
        open,
        values,
        onSave,
      },
    });

    // Check modal title and optimizer select value
    expect(screen.getByText("Configure Optimizer Parameters")).toBeInTheDocument();
    expect(screen.getByLabelText("Optimizer")).toBeInTheDocument();

    // Click Apply Parameters
    const applyBtn = screen.getByRole("button", { name: "Apply Parameters" });
    await fireEvent.click(applyBtn);

    expect(onSave).toHaveBeenCalledWith({
      optimizer: "MUON",
      optimizer_params: expect.objectContaining({ ns_steps: 5 }),
    });
  });

  it("renders dynamic parameters for AdamW including AMSGrad, ForEach, Maximize, and Differentiable", async () => {
    let open = true;
    const values = {
      optimizer: { optimizer: "ADAMW" },
      optimizer_params: { beta1: 0.9, amsgrad: false, foreach: false },
    };
    const onSave = vi.fn();

    render(OptimizerParamsModal, {
      props: {
        open,
        values,
        onSave,
      },
    });

    expect(screen.getByText("AMSGrad")).toBeInTheDocument();
    expect(screen.getByText("ForEach")).toBeInTheDocument();
    expect(screen.getByText("Maximize")).toBeInTheDocument();
    expect(screen.getByText("Differentiable")).toBeInTheDocument();
  });
});
