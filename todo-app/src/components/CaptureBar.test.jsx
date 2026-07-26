import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CaptureBar } from "./CaptureBar";

// Freezes "now" so date/time parsing in parseCapture (exercised indirectly through the
// live chip preview) has a predictable answer.
beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); vi.setSystemTime(new Date("2024-01-11T10:00:00")); });
afterEach(() => { vi.useRealTimers(); });

// Each chip renders as `{label}<span>×</span>` inside one button, so its full textContent
// is "label×" rather than just "label" — find it by prefix instead of an exact text match.
function findChip(label) {
  return [...document.querySelectorAll(".pd-capture-chip")].find((el) => el.textContent.startsWith(label));
}

describe("CaptureBar", () => {
  it("shows live chips for detected fields as the user types", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CaptureBar projects={[]} onCommitTask={vi.fn()} onCommitNote={vi.fn()} placeholder="Add a task…" />);

    await user.type(screen.getByPlaceholderText("Add a task…"), "call mom tomorrow 5pm !high");

    expect(findChip("tomorrow")).toBeTruthy();
    expect(findChip("5pm")).toBeTruthy();
    expect(findChip("high")).toBeTruthy();
  });

  it("dismissing a chip clears that field from what gets committed", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onCommitTask = vi.fn();
    render(<CaptureBar projects={[]} onCommitTask={onCommitTask} onCommitNote={vi.fn()} placeholder="Add a task…" />);

    const input = screen.getByPlaceholderText("Add a task…");
    await user.type(input, "call mom !high");
    await user.click(findChip("high"));
    await user.type(input, "{Enter}");

    expect(onCommitTask).toHaveBeenCalledTimes(1);
    expect(onCommitTask.mock.calls[0][0]).toMatchObject({ priority: "med" });
  });

  it("commits a task on Enter and resets the input", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onCommitTask = vi.fn();
    render(<CaptureBar projects={[]} onCommitTask={onCommitTask} onCommitNote={vi.fn()} placeholder="Add a task…" />);

    const input = screen.getByPlaceholderText("Add a task…");
    await user.type(input, "buy milk{Enter}");

    expect(onCommitTask).toHaveBeenCalledWith(expect.objectContaining({ title: "buy milk" }));
    expect(input).toHaveValue("");
  });

  it("commits a note (not a task) once toggled to note mode", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onCommitTask = vi.fn();
    const onCommitNote = vi.fn();
    render(<CaptureBar projects={[]} onCommitTask={onCommitTask} onCommitNote={onCommitNote} placeholder="Add a task…" />);

    await user.click(screen.getByRole("button", { name: "task" }));
    const input = screen.getByPlaceholderText("Add a task…");
    await user.type(input, "dark mode toggle{Enter}");

    expect(onCommitNote).toHaveBeenCalledWith("dark mode toggle", null);
    expect(onCommitTask).not.toHaveBeenCalled();
  });

  it("Escape clears the input and any detected chips", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CaptureBar projects={[]} onCommitTask={vi.fn()} onCommitNote={vi.fn()} placeholder="Add a task…" />);

    const input = screen.getByPlaceholderText("Add a task…");
    await user.type(input, "call mom !high{Escape}");

    expect(input).toHaveValue("");
    expect(findChip("high")).toBeFalsy();
  });
});
