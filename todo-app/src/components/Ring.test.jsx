import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Ring, ProgressFill } from "./Ring";

describe("Ring", () => {
  it("renders an accessible label and text for a real percentage", () => {
    render(<Ring pct={42} color="red" />);
    expect(screen.getByRole("img", { name: "42 percent complete" })).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
  });

  it("renders a 'not started' state for pct === null", () => {
    render(<Ring pct={null} color="red" />);
    expect(screen.getByRole("img", { name: "Not started" })).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows a custom label override instead of the computed percentage text", () => {
    render(<Ring pct={80} color="red" label="0d" />);
    expect(screen.getByText("0d")).toBeInTheDocument();
    expect(screen.queryByText("80%")).not.toBeInTheDocument();
  });

  it("clamps out-of-range percentages into 0-100 for the accessible label", () => {
    render(<Ring pct={150} color="red" />);
    expect(screen.getByRole("img", { name: "100 percent complete" })).toBeInTheDocument();
  });
});

describe("ProgressFill", () => {
  // The fill animates from 0 -> pct on first mount via requestAnimationFrame, so the
  // clamped width only shows up once that frame has run — waitFor accommodates the tick.
  it("clamps an over-100 pct to 100% width once the mount animation settles", async () => {
    const { container } = render(<ProgressFill className="bar" pct={150} />);
    await waitFor(() => expect(container.querySelector(".bar")).toHaveStyle({ width: "100%" }));
  });

  it("clamps a negative pct to 0% width once the mount animation settles", async () => {
    const { container } = render(<ProgressFill className="bar" pct={-20} />);
    await waitFor(() => expect(container.querySelector(".bar")).toHaveStyle({ width: "0%" }));
  });
});
