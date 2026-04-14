import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import UpdateBanner from "./components/UpdateBanner";
import { runAttachmentSweep } from "./lib/db/attachments.sweep";
import { SprintProvider } from "./lib/sprint/SprintContext";
import { checkForUpdate } from "./lib/updater";
import { ThemeProvider } from "./theme/ThemeProvider";
import "./App.css";

setTimeout(() => {
  runAttachmentSweep()
    .then((n) => {
      if (n > 0) console.log(`[attachments] swept ${n} orphan file(s)`);
    })
    .catch((err) => console.warn("[attachments] sweep failed:", err));
}, 3000);

if (typeof requestIdleCallback === "function") {
  requestIdleCallback(() => checkForUpdate());
} else {
  setTimeout(checkForUpdate, 0);
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <HashRouter>
        <SprintProvider>
          <App />
        </SprintProvider>
      </HashRouter>
      <UpdateBanner />
    </ThemeProvider>
  </React.StrictMode>,
);
