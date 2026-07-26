import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement matchMedia — useIsMobile() (src/lib/hooks.js) calls it
// unconditionally, so anything rendering AppShell/Sidebar needs this stubbed.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// RTL's auto-cleanup normally hooks the test runner's global afterEach automatically,
// but that detection relies on `globals: true` — this project keeps explicit imports
// instead, so it's wired here once instead of repeating it in every component test file.
// Without it, components that createPortal(...) straight to document.body (DeferMenu,
// MoveMenu, CommandPalette, etc.) would leak into the next test instead of unmounting.
afterEach(() => { cleanup(); });
