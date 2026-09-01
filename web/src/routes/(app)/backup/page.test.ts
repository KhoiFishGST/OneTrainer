import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi, beforeEach } from "vitest";
import BackupPage from "./+page.svelte";
import { trainingStore } from "$lib/events/training-store";
import { api } from "$lib/api/client";

const mockSchema = {
  tabs: [
    {
      id: "backup",
      label: "Backup",
      groups: [
        {
          id: "backup_settings",
          title: "Backup Settings",
          fields: [
            {
              id: "backup_interval",
              keys: ["backup_interval"],
              label: "Backup Interval",
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
        backup_interval: 100,
      },
      errors: [],
      setRaw: mockSetRaw,
    },
    openDirectory: vi.fn(),
  }),
}));

describe("Backup Route Page", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    trainingStore.reset();
  });

  it("disables Backup and Save buttons when training is not active", () => {
    trainingStore.setStatus({ state: "IDLE" });
    render(BackupPage);

    const backupBtn = screen.getByRole("button", { name: /backup now/i });
    const saveBtn = screen.getByRole("button", { name: /save model now/i });

    expect(backupBtn).toBeDisabled();
    expect(saveBtn).toBeDisabled();
  });

  it("enables Backup and Save buttons when training is active (RUNNING or TRAINING)", () => {
    trainingStore.setStatus({ state: "TRAINING" });
    render(BackupPage);

    const backupBtn = screen.getByRole("button", { name: /backup now/i });
    const saveBtn = screen.getByRole("button", { name: /save model now/i });

    expect(backupBtn).not.toBeDisabled();
    expect(saveBtn).not.toBeDisabled();
  });

  it("triggers backup mutation on click and displays feedback toast", async () => {
    trainingStore.setStatus({ state: "RUNNING" });
    vi.spyOn(api, "requestBackup").mockResolvedValue({ status: "ok" } as any);

    render(BackupPage);

    const backupBtn = screen.getByRole("button", { name: /backup now/i });
    await fireEvent.click(backupBtn);

    expect(api.requestBackup).toHaveBeenCalled();
    expect(await screen.findByText(/model backup requested successfully/i)).toBeInTheDocument();
  });

  it("triggers save mutation on click and displays feedback toast", async () => {
    trainingStore.setStatus({ state: "TRAINING" });
    vi.spyOn(api, "requestSave").mockResolvedValue({ status: "ok" } as any);

    render(BackupPage);

    const saveBtn = screen.getByRole("button", { name: /save model now/i });
    await fireEvent.click(saveBtn);

    expect(api.requestSave).toHaveBeenCalled();
    expect(await screen.findByText(/model save requested successfully/i)).toBeInTheDocument();
  });

  it("handles failed backup operation gracefully while retaining draft", async () => {
    trainingStore.setStatus({ state: "TRAINING" });
    vi.spyOn(api, "requestBackup").mockRejectedValue(new Error("Backup server unavailable"));

    render(BackupPage);

    const backupBtn = screen.getByRole("button", { name: /backup now/i });
    await fireEvent.click(backupBtn);

    expect(await screen.findByText(/backup server unavailable/i)).toBeInTheDocument();
    // Draft value should be retained
    expect(screen.getByLabelText("Backup Interval")).toHaveValue("100");
  });
});
