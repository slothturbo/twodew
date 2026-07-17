import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// Development console setup for localhost monitoring
if (import.meta.env.DEV) {
  console.log("[Twodew] Starting development server");
  console.log("Environment:", import.meta.env.MODE);
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// App-shell caching for instant cold starts on the installed app
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}