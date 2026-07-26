import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeferMenu } from "./DeferMenu";

describe("DeferMenu", () => {
  it("calls onSelect with the right destination token for each option", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<DeferMenu x={0} y={0} onSelect={onSelect} onPickDate={vi.fn()} onClose={vi.fn()} />);

    await user.click(screen.getByRole("menuitem", { name: "later today" }));
    expect(onSelect).toHaveBeenLastCalledWith("later");
    await user.click(screen.getByRole("menuitem", { name: "tomorrow" }));
    expect(onSelect).toHaveBeenLastCalledWith("tomorrow");
    await user.click(screen.getByRole("menuitem", { name: "this weekend" }));
    expect(onSelect).toHaveBeenLastCalledWith("weekend");
    await user.click(screen.getByRole("menuitem", { name: "next week" }));
    expect(onSelect).toHaveBeenLastCalledWith("nextweek");
    await user.click(screen.getByRole("menuitem", { name: "remove date / inbox" }));
    expect(onSelect).toHaveBeenLastCalledWith("inbox");
  });

  it("calls onPickDate (not onSelect) for the 'pick a date' option", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onPickDate = vi.fn();
    render(<DeferMenu x={0} y={0} onSelect={onSelect} onPickDate={onPickDate} onClose={vi.fn()} />);

    await user.click(screen.getByRole("menuitem", { name: "pick a date…" }));
    expect(onPickDate).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("closes on a scrim click (the portaled overlay behind the menu)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DeferMenu x={0} y={0} onSelect={vi.fn()} onPickDate={vi.fn()} onClose={onClose} />);
    const scrim = document.querySelector(".pd-task-menu-scrim");

    await user.click(scrim);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
