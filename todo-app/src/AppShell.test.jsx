import { describe, it, expect, vi } from "vitest";
import { render, screen, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mocked at the module boundary so the real production UI/business-logic code (capture,
// inbox review, scheduling, focus tracking, completion, insights) all run for real in
// jsdom — only the network edge (Supabase auth/kv_store + realtime channel) is stubbed.
// storage.get() resolving null is the app's own real "fresh workspace, nothing saved
// yet" path (see App.jsx's load effect), so no fixture-building is needed beyond that.
// Deliberately runs on real system time, not a frozen one — nothing here asserts against
// a hardcoded date string, and mixing fake timers with user-event's own internal
// scheduling is a well-documented source of deadlocks.
vi.mock("./lib/storage", () => ({
  storage: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue({ key: "k", value: "v", updatedAt: new Date().toISOString() }),
  },
}));
vi.mock("./supabaseClient", () => ({
  supabase: {
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
  },
  supabaseConfigured: true,
}));

const { AppShell } = await import("./App");

async function waitForLoad() {
  // storage.get()'s mocked promise still needs microtask ticks to resolve and flow
  // through the load effect's setLoaded(true) before the real UI is queryable.
  for (let i = 0; i < 20 && !screen.queryByPlaceholderText(/Add a task/); i++) {
    await act(async () => { await Promise.resolve(); });
  }
  expect(screen.getByPlaceholderText(/Add a task/)).toBeInTheDocument();
}

describe("AppShell journey: capture -> clarify -> schedule -> focus -> complete -> Insights", () => {
  it("carries one task through the full journey using real production UI", async () => {
    const user = userEvent.setup();
    render(<AppShell userId="test-user" />);
    await waitForLoad();

    // ---- Set up a destination project up front, so Inbox review has somewhere to file the task ----
    await user.click(screen.getByRole("button", { name: "Projects" }));
    await user.click(screen.getByText("+ New project"));
    await user.type(screen.getByPlaceholderText("Project name"), "Errands");
    await user.click(screen.getByRole("button", { name: "Create" }));
    // Confirms creation without asserting on the ambiguous plain-text "Errands" (it now
    // also appears in the sidebar's project quick-jump list).
    expect(within(document.querySelector(".pd-sidebar-projects")).getByText("Errands")).toBeInTheDocument();

    // ---- CAPTURE: type a task into the topbar quick-capture bar ----
    await user.click(screen.getByRole("button", { name: "Today" }));
    const captureInput = screen.getByPlaceholderText(/Add a task/);
    await user.type(captureInput, "buy stamps{Enter}");
    expect(screen.getByText("buy stamps")).toBeInTheDocument();

    // ---- Unschedule the captured task first (every capture/add path defaults a deadline
    // of "today" — routing it to the inbox via the defer menu is the one reachable way to
    // clear it, so it's genuinely unscheduled once the Calendar step goes to arm it) ----
    captureInput.blur(); // Today's roving-selection shortcuts are suppressed while typing in an input
    await user.keyboard("{ArrowDown}"); // selects the only task row
    await user.keyboard("d"); // opens the defer menu for the selected row
    await user.click(screen.getByRole("menuitem", { name: "remove date / inbox" }));

    // ---- CLARIFY: Inbox review — set priority, then assign the project ----
    await user.click(screen.getByRole("button", { name: "Tasks" }));
    await user.click(screen.getByText(/review inbox/));
    const reviewDialog = screen.getByRole("dialog", { name: "Inbox review" });
    expect(within(reviewDialog).getByText("buy stamps")).toBeInTheDocument();
    await user.click(within(reviewDialog).getByTitle("Priority: med (click to cycle)"));
    await user.click(within(reviewDialog).getByRole("button", { name: "Errands" })); // assigns + advances/closes (only task queued)
    expect(screen.queryByRole("dialog", { name: "Inbox review" })).not.toBeInTheDocument();

    // ---- SCHEDULE: Calendar — arm the now-unscheduled task, then tap today's cell ----
    await user.click(screen.getByRole("button", { name: "Calendar" }));
    await user.click(screen.getByText("buy stamps")); // arms it from the Unscheduled panel
    const todayCell = document.querySelector(".pd-cal-cell.today");
    expect(todayCell).toBeTruthy();
    await user.click(todayCell);
    expect(screen.queryByText(/tap a day to schedule/)).not.toBeInTheDocument(); // arming hint cleared, so the tap landed

    // ---- FOCUS: Today — start tracking, open the focus screen, stop it ----
    await user.click(screen.getByRole("button", { name: "Today" }));
    const row = screen.getByText("buy stamps").closest("li.pd-today-row");
    await user.click(within(row).getByRole("button", { name: "Start tracking time" }));
    await user.click(document.querySelector(".pd-focus-banner")); // opens the distraction-free FocusScreen
    await user.click(screen.getByRole("button", { name: "Stop" }));
    expect(screen.getByRole("button", { name: "Mark done" })).toBeInTheDocument();

    // ---- COMPLETE ----
    await user.click(screen.getByRole("button", { name: "Mark done" }));
    expect(screen.queryByText("buy stamps")).not.toBeInTheDocument(); // done tasks drop out of Today's open list (Done-today stays collapsed)

    // ---- INSIGHTS: completed-today reflects the just-completed task ----
    await user.click(screen.getByRole("button", { name: "Insights" }));
    const completedToday = document.querySelector(".pd-stat-tile.orange .pd-stat-value");
    expect(completedToday).toHaveTextContent("1");
  }, 15000);
});
