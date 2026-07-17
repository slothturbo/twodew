import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { supabaseConfigured } from "./supabaseClient";

// Development console setup for localhost monitoring
if (import.meta.env.DEV) {
  console.log("[Twodew] Starting development server");
  console.log("Environment:", import.meta.env.MODE);
}

function ConfigError() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#050505", color: "#F5F6F1", fontFamily: "system-ui,sans-serif", padding: 24, textAlign: "center",
    }}>
      <div style={{ maxWidth: 340 }}>
        <h1 style={{ fontSize: 18, marginBottom: 8 }}>Missing Supabase config</h1>
        <p style={{ color: "#8B8E93", fontSize: 14, lineHeight: 1.5 }}>
          This deployment is missing VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY.
          Set them as environment variables (see README.md), then redeploy.
        </p>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {supabaseConfigured ? <App /> : <ConfigError />}
  </React.StrictMode>
);

// App-shell caching for instant cold starts on the installed app
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}