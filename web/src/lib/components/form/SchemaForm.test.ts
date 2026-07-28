import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { expect, it, vi } from "vitest";
import SchemaForm from "./SchemaForm.svelte";

it("renders labels, tooltips, controls, and errors from schema", async () => {
  const setRaw = vi.fn();
  render(SchemaForm, {
    tab: {
      id: "general",
      label: "General",
      groups: [
        {
          id: "workspace",
          title: "Workspace",
          fields: [
            {
              id: "workspace-dir",
              keys: ["workspace_dir"],
              label: "Workspace Directory",
              tooltip: "Server path",
              control: "directory",
              required: true,
              nullable: false,
              visible: true,
              path_mode: "directory",
            },
          ],
        },
      ],
    },
    values: { workspace_dir: "/workspace" },
    issues: [{ path: "workspace_dir", message: "Bad path" }],
    setRaw,
  });
  expect(screen.getByLabelText("Workspace Directory")).toHaveValue("/workspace");
  expect(screen.getByText("Bad path")).toBeVisible();
  await fireEvent.input(screen.getByLabelText("Workspace Directory"), {
    target: { value: "/new" },
  });
  expect(setRaw).toHaveBeenCalledWith("workspace_dir", "/new");
});

it("does not render invisible fields", () => {
  render(SchemaForm, {
    tab: {
      id: "data",
      label: "Data",
      groups: [
        {
          id: "g",
          title: "G",
          fields: [
            {
              id: "hidden",
              keys: ["x"],
              label: "Hidden",
              tooltip: "Hidden",
              control: "text",
              required: false,
              nullable: false,
              visible: false,
            },
          ],
        },
      ],
    },
    values: { x: "x" },
    issues: [],
    setRaw: vi.fn(),
  });
  expect(screen.queryByLabelText("Hidden")).not.toBeInTheDocument();
});

it("renders toggle, text, number, select, and time controls correctly", async () => {
  const setRaw = vi.fn();
  const openDirectory = vi.fn();

  render(SchemaForm, {
    tab: {
      id: "all_controls",
      label: "All Controls",
      groups: [
        {
          id: "g1",
          title: "Group 1",
          fields: [
            {
              id: "f-toggle",
              keys: ["enable_feature"],
              label: "Enable Feature",
              control: "toggle",
            },
            {
              id: "f-text",
              keys: ["username"],
              label: "Username",
              control: "text",
            },
            {
              id: "f-number",
              keys: ["epochs"],
              label: "Epochs",
              control: "number",
            },
            {
              id: "f-select",
              keys: ["optimizer"],
              label: "Optimizer",
              control: "select",
              options: [
                { value: "adamw", label: "AdamW" },
                { value: "sgd", label: "SGD" },
              ],
            },
            {
              id: "f-dir",
              keys: ["model_dir"],
              label: "Model Directory",
              control: "directory",
            },
            {
              id: "f-time",
              keys: ["save_every_value", "save_every_unit"],
              label: "Save Frequency",
              control: "time",
            },
          ],
        },
      ],
    },
    values: {
      enable_feature: true,
      username: "alice",
      epochs: 10,
      optimizer: "adamw",
      model_dir: "/models",
      save_every_value: 5,
      save_every_unit: "minutes",
    },
    issues: [],
    setRaw,
    openDirectory,
  });

  // Toggle
  const toggleInput = screen.getByLabelText("Enable Feature") as HTMLInputElement;
  expect(toggleInput).toBeChecked();
  await fireEvent.click(toggleInput);
  expect(setRaw).toHaveBeenCalledWith("enable_feature", false);

  // Text
  const textInput = screen.getByLabelText("Username");
  expect(textInput).toHaveValue("alice");
  await fireEvent.input(textInput, { target: { value: "bob" } });
  expect(setRaw).toHaveBeenCalledWith("username", "bob");

  // Number
  const numberInput = screen.getByLabelText("Epochs");
  expect(numberInput).toHaveValue("10");
  await fireEvent.input(numberInput, { target: { value: "20" } });
  expect(setRaw).toHaveBeenCalledWith("epochs", "20");

  // Select
  const select = screen.getByLabelText("Optimizer");
  expect(select).toHaveValue("adamw");
  await fireEvent.change(select, { target: { value: "sgd" } });
  expect(setRaw).toHaveBeenCalledWith("optimizer", "sgd");

  // Directory button click
  const browseBtn = screen.getByRole("button", { name: "Browse directory" });
  await fireEvent.click(browseBtn);
  expect(openDirectory).toHaveBeenCalledWith("/models", expect.any(Function));

  // Time control value & unit
  const timeInput = screen.getByLabelText("Save Frequency");
  expect(timeInput).toHaveValue(5);
  await fireEvent.input(timeInput, { target: { value: "10" } });
  expect(setRaw).toHaveBeenCalledWith("save_every_value", "10");

  const unitSelect = screen.getByLabelText("Time unit");
  await fireEvent.change(unitSelect, { target: { value: "HOUR" } });
  expect(setRaw).toHaveBeenCalledWith("save_every_unit", "HOUR");
});

it("throws error for unknown control type", () => {
  expect(() => {
    render(SchemaForm, {
      tab: {
        id: "bad",
        label: "Bad",
        groups: [
          {
            id: "g",
            fields: [
              {
                id: "unknown-control",
                keys: ["x"],
                label: "Unknown",
                control: "invalid_type_xyz",
              },
            ],
          },
        ],
      },
      values: {},
      issues: [],
      setRaw: vi.fn(),
    });
  }).toThrow('Unknown control type: "invalid_type_xyz"');
});

it("keeps incomplete numeric schema edits as raw strings", async () => {
  const setRaw = vi.fn();
  render(SchemaForm, {
    tab: {
      id: "x",
      label: "X",
      groups: [{ id: "g", fields: [{ id: "n", keys: ["n"], label: "N", control: "number" }] }],
    },
    values: { n: 1 },
    issues: [],
    setRaw,
  });
  await fireEvent.input(screen.getByLabelText("N"), { target: { value: "-" } });
  expect(setRaw).toHaveBeenCalledWith("n", "-");
});

it("sets aria-describedby matching description/error id on controls with errors", () => {
  render(SchemaForm, {
    tab: {
      id: "test",
      label: "Test",
      groups: [
        {
          id: "g",
          title: "G",
          fields: [
            {
              id: "username",
              keys: ["username"],
              label: "Username",
              control: "text",
            },
          ],
        },
      ],
    },
    values: { username: "bad" },
    issues: [{ path: "username", message: "Invalid username" }],
    setRaw: vi.fn(),
  });

  const input = screen.getByLabelText("Username");
  const errorEl = screen.getByText("Invalid username");
  expect(errorEl).toHaveAttribute("id", "field-username-error");
  expect(input).toHaveAttribute("aria-describedby", "field-username-error");
});

it("supports plain string options in select controls", async () => {
  const setRaw = vi.fn();
  render(SchemaForm, {
    tab: {
      id: "select_test",
      label: "Select Test",
      groups: [
        {
          id: "g",
          title: "G",
          fields: [
            {
              id: "opt",
              keys: ["opt"],
              label: "Option",
              control: "select",
              options: ["adamw", "sgd"],
            },
          ],
        },
      ],
    },
    values: { opt: "sgd" },
    issues: [],
    setRaw,
  });

  const select = screen.getByLabelText("Option");
  expect(select).toHaveValue("sgd");
  await fireEvent.change(select, { target: { value: "adamw" } });
  expect(setRaw).toHaveBeenCalledWith("opt", "adamw");
});

it("does not render group title when hideGroupTitle is true or title is empty", () => {
  render(SchemaForm, {
    tab: {
      id: "no_title",
      label: "No Title",
      groups: [
        {
          id: "g",
          title: "Group Title",
          fields: [
            {
              id: "f",
              keys: ["f"],
              label: "F",
              control: "text",
            },
          ],
        },
      ],
    },
    values: {},
    issues: [],
    setRaw: vi.fn(),
    hideGroupTitle: true,
  });

  expect(screen.queryByText("Group Title")).not.toBeInTheDocument();
});

it("supports multi-key time values and units", async () => {
  const setRaw = vi.fn();
  render(SchemaForm, {
    tab: {
      id: "time_test",
      label: "Time Test",
      groups: [
        {
          id: "g",
          title: "G",
          fields: [
            {
              id: "save_freq",
              keys: ["save_every_value", "save_every_unit"],
              label: "Save Frequency",
              control: "time",
              options: [
                { value: "EPOCH", label: "Epochs" },
                { value: "STEP", label: "Steps" },
              ],
            },
          ],
        },
      ],
    },
    values: { save_every_value: 10, save_every_unit: "STEP" },
    issues: [],
    setRaw,
  });

  const timeInput = screen.getByLabelText("Save Frequency");
  expect(timeInput).toHaveValue(10);
  await fireEvent.input(timeInput, { target: { value: "20" } });
  expect(setRaw).toHaveBeenCalledWith("save_every_value", "20");

  const unitSelect = screen.getByLabelText("Time unit");
  expect(unitSelect).toHaveValue("STEP");
  await fireEvent.change(unitSelect, { target: { value: "EPOCH" } });
  expect(setRaw).toHaveBeenCalledWith("save_every_unit", "EPOCH");
});

it("renders tooltip trigger as div role=button instead of button and handles keyboard events", async () => {
  render(SchemaForm, {
    tab: {
      id: "tooltip_test",
      label: "Tooltip Test",
      groups: [
        {
          id: "g",
          fields: [
            {
              id: "f-tooltip",
              keys: ["f_tooltip"],
              label: "Field With Tooltip",
              tooltip: "This is a helpful tip",
              control: "text",
            },
          ],
        },
      ],
    },
    values: { f_tooltip: "hello" },
    issues: [],
    setRaw: vi.fn(),
  });

  const label = screen.getByText("Field With Tooltip");
  expect(label.parentElement?.tagName.toLowerCase()).not.toBe("button");
  expect(label.parentElement).toHaveAttribute("role", "button");
  expect(label.parentElement).toHaveAttribute("tabindex", "0");

  const trigger = label.parentElement!;
  expect(screen.queryByText("This is a helpful tip")).not.toBeInTheDocument();

  await fireEvent.keyDown(trigger, { key: "Enter" });
  expect(screen.getByText("This is a helpful tip")).toBeInTheDocument();

  await fireEvent.keyDown(trigger, { key: " " });
  expect(screen.queryByText("This is a helpful tip")).not.toBeInTheDocument();
});


