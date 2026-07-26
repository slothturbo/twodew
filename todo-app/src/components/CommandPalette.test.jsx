import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandPalette } from "./CommandPalette";

const projects = [{ id: "p1", name: "Kitchen Remodel", colorIdx: 0, tasks: [] }];
const inbox = [{ id: "t1", title: "Buy milk", priority: "med" }];

function setup(overrides = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    projects,
    inbox,
    onNavigateScreen: vi.fn(),
    onOpenProject: vi.fn(),
    onOpenTask: vi.fn(),
    onAddTask: vi.fn(),
    onNewProject: vi.fn(),
    ...overrides,
  };
  render(<CommandPalette {...props} />);
  return props;
}

describe("CommandPalette", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <CommandPalette open={false} onClose={vi.fn()} projects={[]} inbox={[]}
        onNavigateScreen={vi.fn()} onOpenProject={vi.fn()} onOpenTask={vi.fn()} onAddTask={vi.fn()} onNewProject={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("filters results as the user types and jumps to a matching project on Enter", async () => {
    const user = userEvent.setup();
    const props = setup();

    const input = screen.getByPlaceholderText("Search or jump to…");
    await user.type(input, "kitchen");
    expect(screen.getByText("Kitchen Remodel")).toBeInTheDocument();
    expect(screen.queryByText("Today")).not.toBeInTheDocument(); // screens filtered out too

    await user.keyboard("{Enter}");
    expect(props.onOpenProject).toHaveBeenCalledWith("p1");
    expect(props.onClose).toHaveBeenCalled();
  });

  it("ArrowDown/ArrowUp move the active row before Enter selects it", async () => {
    const user = userEvent.setup();
    const props = setup();

    const input = screen.getByPlaceholderText("Search or jump to…");
    // Blank query: screen results come first (Today, Tasks, Brain, Projects, Calendar, Insights).
    await user.click(input);
    await user.keyboard("{ArrowDown}{ArrowDown}"); // Today -> Tasks -> Brain
    await user.keyboard("{Enter}");
    expect(props.onNavigateScreen).toHaveBeenCalledWith("brain");
  });

  it("selecting a task result opens its project when it belongs to one", async () => {
    const user = userEvent.setup();
    const props = setup();

    const input = screen.getByPlaceholderText("Search or jump to…");
    await user.type(input, "buy milk");
    await user.keyboard("{Enter}");
    // "Buy milk" is an inbox task (no project) in this fixture, so it should open the task, not a project.
    expect(props.onOpenTask).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }));
  });

  it("offers 'add task'/'new project' quick actions for any typed text, and runs them on click", async () => {
    const user = userEvent.setup();
    const props = setup({ projects: [], inbox: [] }); // no project/task name will ever match "zzz_no_match"

    const input = screen.getByPlaceholderText("Search or jump to…");
    await user.type(input, "zzz_no_match call the dentist");
    expect(screen.queryByText("Today")).not.toBeInTheDocument(); // screen results filtered out

    await user.click(screen.getByText('Add task "zzz_no_match call the dentist"'));
    expect(props.onAddTask).toHaveBeenCalledWith("zzz_no_match call the dentist");
    expect(props.onClose).toHaveBeenCalled();
  });
});
