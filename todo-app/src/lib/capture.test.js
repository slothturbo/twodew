import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { parseCapture } from "./capture";

// Thursday, so weekday/relative-date parsing has a predictable answer.
const NOW = new Date("2024-01-11T10:00:00");

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

describe("parseCapture", () => {
  it("defaults to task mode with med priority and a plain title when nothing else is detected", () => {
    expect(parseCapture("buy milk")).toEqual({
      title: "buy milk", mode: "task", deadline: null, startTime: null, timeLabel: null,
      priority: "med", estimateMinutes: null, projectId: null, projectName: null, contexts: [],
    });
  });

  it("recognizes an explicit note:/idea: prefix", () => {
    expect(parseCapture("note: rewrite the intro").mode).toBe("note");
    expect(parseCapture("idea: dark mode toggle").mode).toBe("note");
    expect(parseCapture("idea: dark mode toggle").title).toBe("dark mode toggle");
  });

  it("parses relative date words: today/tomorrow/this weekend/next week", () => {
    expect(parseCapture("call mom today").deadline).toBe("2024-01-11");
    expect(parseCapture("call mom tomorrow").deadline).toBe("2024-01-12");
    expect(parseCapture("call mom this weekend").deadline).toBe("2024-01-13");
    expect(parseCapture("call mom next week").deadline).toBe("2024-01-15"); // next Monday
  });

  it("parses a bare weekday name as the next occurrence of that day", () => {
    // "now" is Thursday 2024-01-11 — the next Tuesday is 2024-01-16.
    expect(parseCapture("call mom tuesday").deadline).toBe("2024-01-16");
  });

  it("parses an explicit m/d date, rolling to next year if it's already passed", () => {
    expect(parseCapture("renew passport 3/15").deadline).toBe("2024-03-15");
    expect(parseCapture("renew passport 1/1").deadline).toBe("2025-01-01"); // Jan 1 already passed this year
  });

  it("parses a time and derives a 24h startTime alongside the display label", () => {
    const p = parseCapture("call mom 5pm");
    expect(p.timeLabel).toBe("5PM");
    expect(p.startTime).toBe("17:00");
    expect(p.title).toBe("call mom");
  });

  it("parses !high/!low priority shorthand, stripping the token from the title", () => {
    expect(parseCapture("finish deck !high")).toMatchObject({ priority: "high", title: "finish deck" });
    expect(parseCapture("water plants !low")).toMatchObject({ priority: "low", title: "water plants" });
    expect(parseCapture("no priority word here").priority).toBe("med");
  });

  it("parses a duration estimate in minutes or hours", () => {
    expect(parseCapture("write report 45m").estimateMinutes).toBe(45);
    expect(parseCapture("write report 2h").estimateMinutes).toBe(120);
  });

  it("fuzzy-matches a #project tag against the given project list", () => {
    const projects = [{ id: "p1", name: "Kitchen Remodel" }, { id: "p2", name: "Website" }];
    const p = parseCapture("order tiles #kitchen", projects);
    expect(p.projectId).toBe("p1");
    expect(p.projectName).toBe("Kitchen Remodel");
    expect(p.title).toBe("order tiles");
  });

  it("leaves an unmatched #tag alone when no project list is given", () => {
    const p = parseCapture("order tiles #kitchen");
    expect(p.projectId).toBeNull();
    expect(p.title).toContain("#kitchen");
  });

  it("extracts one or more @context tags", () => {
    const p = parseCapture("call plumber @home @phone");
    expect(p.contexts).toEqual(["home", "phone"]);
    expect(p.title).toBe("call plumber");
  });

  it("combines multiple detected fields in one line without cross-contamination", () => {
    const projects = [{ id: "p1", name: "Kitchen" }];
    const p = parseCapture("call mom tomorrow 5pm !high #kitchen @phone 30m", projects);
    expect(p).toMatchObject({
      title: "call mom",
      deadline: "2024-01-12",
      timeLabel: "5PM",
      startTime: "17:00",
      priority: "high",
      estimateMinutes: 30,
      projectId: "p1",
      projectName: "Kitchen",
      contexts: ["phone"],
    });
  });
});
