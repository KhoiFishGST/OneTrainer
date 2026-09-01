import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ConsolePage from "./+page.svelte";

describe("Console Route Page", () => {
  it("renders console full-page view container and ConsoleView", () => {
    const { container } = render(ConsolePage);
    expect(container.querySelector(".console-page")).toBeInTheDocument();
    expect(container.querySelector(".console-view")).toBeInTheDocument();
  });
});
