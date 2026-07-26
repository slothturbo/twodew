import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MoveMenu } from "./MoveMenu";

const projects = [
  { id: "p1", name: "Kitchen Remodel" },
  { id: "p2", name: "Website" },
];

describe("MoveMenu", () => {
  it("shows an 'inbox' option and every other project when moving a task that's already in a project", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<MoveMenu x={0} y={0} projects={projects} currentProjectId="p1" onSelect={onSelect} onClose={vi.fn()} />);

    expect(screen.getByRole("menuitem", { name: "inbox" })).toBeInTheDocument();
    // The task's current project shouldn't be offered as a destination.
    expect(screen.queryByRole("menuitem", { name: "Kitchen Remodel" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Website" })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Website" }));
    expect(onSelect).toHaveBeenCalledWith("p2");
  });

  it("omits the 'inbox' option for a task that's already in the inbox", () => {
    render(<MoveMenu x={0} y={0} projects={projects} currentProjectId={null} onSelect={vi.fn()} onClose={vi.fn()} />);

    expect(screen.queryByRole("menuitem", { name: "inbox" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Kitchen Remodel" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Website" })).toBeInTheDocument();
  });

  it("calls onSelect(null) when 'inbox' is chosen", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<MoveMenu x={0} y={0} projects={projects} currentProjectId="p1" onSelect={onSelect} onClose={vi.fn()} />);

    await user.click(screen.getByRole("menuitem", { name: "inbox" }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
