import React, { useEffect, useState } from "react";

/**
 * Local Development Monitor Component
 * Displays build status, environment info, and performance metrics
 * For local preview monitoring when running localhost:5173 or localhost:3000
 */
export function LocalMonitor() {
  const [buildTime, setBuildTime] = useState(null);
  const [memoryUsage, setMemoryUsage] = useState(null);

  useEffect(() => {
    // Log build info for local monitoring
    if (import.meta.env.DEV) {
      console.log("[Twodew Local Monitor]", {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      });

      // Measure build time if available
      const perfEntries = performance.getEntriesByType('navigation');
      if (perfEntries.length > 0) {
        setBuildTime(perfEntries[0].loadEventEnd - perfEntries[0].loadEventStart);
      }

      // Try to get memory usage info (Chrome/Edge only)
      const mem = performance.memory;
      if (mem) {
        setMemoryUsage({
          used: Math.round(mem.usedJSHeapSize / 1048576),
          total: Math.round(mem.totalJSHeapSize / 1048576),
        });
      }

      // Log localhost monitoring indicator
      console.log("[Twodew] ✅ Localhost monitoring active");
    }

    // Check for Supabase connection status
    const supabase = window.__SUPABUS__;
    if (supabase) {
      console.log("[Twodew] Supabase client connected");
    }
  }, []);

  if (!import.meta.env.DEV) return null;

  return (
    <div 
      style={{
        position: "fixed",
        bottom: "10px",
        right: "10px",
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        color: "#00ff00",
        padding: "6px 10px",
        borderRadius: "4px",
        fontSize: "10px",
        fontFamily: "monospace",
        zIndex: 9999,
        pointerEvents: "none"
      }}
    >
      <div>🟢 Twodew v1.0</div>
      {buildTime && <div>⏱️ {(buildTime / 1000).toFixed(2)}s load</div>}
      {memoryUsage && <div>💾 {memoryUsage.used}MB/{memoryUsage.total}MB</div>}
    </div>
  );
}

export default LocalMonitor;