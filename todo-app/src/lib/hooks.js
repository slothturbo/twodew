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
/*  Greeting hook — timezone-aware greetings for Today screen         */
/*  Returns: greeting string - based on user's local time              */
/* ------------------------------------------------------------------ */
export function useGreeting() {
  const [greeting, setGreeting] = useState(() => {
    const h = new Date().getHours();
    return getGreetingForHour(h);
  });

  useEffect(() => {
    const updateGreeting = () => {
      const h = new Date().getHours();
      setGreeting(getGreetingForHour(h));
    };
    // Check every minute for time changes (handles timezone shifts, day changes)
    const interval = setInterval(updateGreeting, 60000);
    updateGreeting(); // Run immediately on mount/change
    return () => clearInterval(interval);
  }, []);

  return greeting;
}

// Helper: returns the appropriate greeting string based on hour (local time, timezone-aware)
// Time periods match user preference: morning 6-14, afternoon 13-18, evening 19-22, night otherwise
function getGreetingForHour(hour) {
  if (hour >= 6 && hour < 14) return "Good morning";
  if (hour >= 13 && hour < 18) return "Good afternoon";
  if (hour >= 19 && hour < 22) return "Welcome back";
  return "Hello, night owl";
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
