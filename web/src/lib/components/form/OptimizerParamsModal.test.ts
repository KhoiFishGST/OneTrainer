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

  it("does not reset draft when values prop changes while modal stays open", async () => {
    const { rerender } = render(OptimizerParamsModal, {
      props: {
        open: true,
        values: { optimizer: { optimizer: "MUON" }, optimizer_params: { ns_steps: 5 } },
        onSave: vi.fn(),
      },
    });

    const input = screen.getByLabelText("Newton-Schulz Iterations");
    await fireEvent.input(input, { target: { value: "10" } });
    expect(input).toHaveValue(10);

    await rerender({
      open: true,
      values: { optimizer: { optimizer: "MUON" }, optimizer_params: { ns_steps: 99 } },
      onSave: vi.fn(),
    });

    expect(input).toHaveValue(10);
  });

  it("retains open state and draft when async apply fails", async () => {
    let open = true;
    const onSave = vi.fn().mockRejectedValue(new Error("Async save error"));

    render(OptimizerParamsModal, {
      props: {
        open,
        values: { optimizer: { optimizer: "ADAMW" }, optimizer_params: { beta1: 0.9 } },
        onSave,
      },
    });

    const betaInput = screen.getByLabelText("Beta 1");
    await fireEvent.input(betaInput, { target: { value: "0.8" } });

    const applyBtn = screen.getByRole("button", { name: "Apply Parameters" });
    await fireEvent.click(applyBtn);

    expect(onSave).toHaveBeenCalled();
    expect(screen.getByText("Configure Optimizer Parameters")).toBeInTheDocument();
    expect(betaInput).toHaveValue(0.8);
  });

  it("disables submit button and shows pending state during async save operation", async () => {
    let resolveSave: (val?: any) => void = () => {};
    const pendingSave = new Promise((resolve) => {
      resolveSave = resolve;
    });
    const onSave = vi.fn().mockReturnValue(pendingSave);

    render(OptimizerParamsModal, {
      props: {
        open: true,
        values: { optimizer: { optimizer: "ADAMW" }, optimizer_params: { beta1: 0.9 } },
        onSave,
      },
    });

    const applyBtn = screen.getByRole("button", { name: "Apply Parameters" });
    await fireEvent.click(applyBtn);

    expect(applyBtn).toBeDisabled();
    expect(screen.getByText("Apply Parameters...")).toBeInTheDocument();

    resolveSave();
    await pendingSave;
  });
});

