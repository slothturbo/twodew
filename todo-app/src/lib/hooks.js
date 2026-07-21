import { useState, useEffect } from "react";

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
