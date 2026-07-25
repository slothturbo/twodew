import { useState, useEffect, useRef } from "react";

/* ------------------------------------------------------------------ */
/*  Hooks: mobile detection + on-screen keyboard inset                 */
/* ------------------------------------------------------------------ */
export function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 860px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 860px)");
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener ? mq.addEventListener("change", onChange) : mq.addListener(onChange);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", onChange) : mq.removeListener(onChange); };
  }, []);
  return mobile;
}

// Distance the on-screen keyboard covers, so composers/toasts sit above it
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      setInset(Math.max(0, Math.round(covered)));
    };
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => { vv.removeEventListener("resize", onResize); vv.removeEventListener("scroll", onResize); };
  }, []);
  return inset;
}

/* ------------------------------------------------------------------ */
/*  Greeting hook — time-of-day vibe lines for the Today screen        */
/*  Picks one of a few sets per calendar day (stable across reloads    */
/*  within a day, rotates on a new day) so it stays varied without     */
/*  flip-flopping mid-session.                                         */
/* ------------------------------------------------------------------ */
const GREETING_SETS = [
  { morning: "look alive, sunshine.", afternoon: "survive the midday sun.", night: "here comes the night owl." },
  { morning: "drop the needle, radioactive.", afternoon: "burn through the wasteland.", night: "prowl the neon, night owl." },
  { morning: "wake up, killjoys.", afternoon: "choke on the exhaust.", night: "flutter your wings, night owl." },
];

function pickSetForDate(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) hash = (hash * 31 + dateStr.charCodeAt(i)) >>> 0;
  return GREETING_SETS[hash % GREETING_SETS.length];
}
function periodForHour(hour) {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "night";
}
function greetingFor(date) {
  const dateStr = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  return pickSetForDate(dateStr)[periodForHour(date.getHours())];
}

export function useGreeting() {
  const [greeting, setGreeting] = useState(() => greetingFor(new Date()));

  useEffect(() => {
    const updateGreeting = () => setGreeting(greetingFor(new Date()));
    // Check every minute for time-of-day/date changes
    const interval = setInterval(updateGreeting, 60000);
    updateGreeting(); // Run immediately on mount/change
    return () => clearInterval(interval);
  }, []);

  return greeting;
}

const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

// Shared focus-trap for real dialogs (role="dialog" overlays, not lightweight anchored
// popovers): moves focus in on open, cycles Tab/Shift+Tab at the boundary instead of
// letting it escape to the page behind, closes on Escape, and returns focus to whatever
// was focused before the dialog opened. `ref` should point at the dialog's outermost
// element; `onEscape` is optional (omit for a dialog that shouldn't close on Escape).
// Pass `{ skipInitialFocus: true }` when the dialog already does its own bespoke
// initial-focus (e.g. Bubble's desktop-only cursor-placement into its editor) — the
// trap/Escape/return-focus behavior still applies, just not the generic "focus the
// first focusable element" step, which would otherwise fight a deliberate custom one.
export function useFocusTrap(ref, isOpen, onEscape, { skipInitialFocus = false } = {}) {
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    triggerRef.current = document.activeElement;
    // Reads ref.current fresh on every call (not captured once) so this stays correct
    // if the dialog's own content swaps out while it stays open — e.g. FocusScreen's
    // live view being replaced by its end-of-session choice screen without isOpen
    // itself ever going false.
    const focusables = () => Array.from(ref.current?.querySelectorAll(FOCUSABLE_SELECTOR) || [])
      .filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!skipInitialFocus) {
      const first = focusables()[0];
      (first || ref.current)?.focus();
    }

    const onKeyDown = (e) => {
      // A component-level handler (e.g. Bubble's Tab-hijack for indentation, or an
      // input's own Enter-submit) already claimed this key — don't also act on it.
      if (e.defaultPrevented) return;
      if (e.key === "Escape" && onEscape) { e.preventDefault(); onEscape(); return; }
      if (e.key !== "Tab") return;
      const els = focusables();
      if (!els.length) return;
      const firstEl = els[0], lastEl = els[els.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (triggerRef.current && document.contains(triggerRef.current)) triggerRef.current.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
}

// Local development monitor hook - monitors localhost build performance
export function useLocalMonitor() {
  const [buildTime, setBuildTime] = useState(null);
  const [memoryUsage, setMemoryUsage] = useState(null);

  useEffect(() => {
    if (import.meta.env.DEV) {
      // Log startup info for localhost monitoring
      console.log("[Twodew Local Monitor]", new Date().toISOString());
      console.log("Local URL:", window.location.href);

      // Measure build/performance time
      const perfEntries = performance.getEntriesByType('navigation');
      if (perfEntries.length > 0 && perfEntries[0].loadEventEnd) {
        setBuildTime(perfEntries[0].loadEventEnd - perfEntries[0].loadEventStart);
      }

      // Try to get memory usage (Chrome/Edge only)
      if (performance.memory) {
        const mem = performance.memory;
        setMemoryUsage({
          used: Math.round(mem.usedJSHeapSize / 1048576),
          total: Math.round(mem.totalJSHeapSize / 1048576),
        });
      }
    }
  }, []);

  return { buildTime, memoryUsage };
}
