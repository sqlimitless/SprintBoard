import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { runAttachmentSweep } from "./lib/db/attachments.sweep";
import { ThemeProvider } from "./theme/ThemeProvider";
import "./App.css";

// Best-effort: clean orphaned image files a few seconds after boot so aborted
// creates (image pasted but form never saved) don't accumulate on disk.
setTimeout(() => {
  runAttachmentSweep()
    .then((n) => {
      if (n > 0) console.log(`[attachments] swept ${n} orphan file(s)`);
    })
    .catch((err) => console.warn("[attachments] sweep failed:", err));
}, 3000);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </ThemeProvider>
  </React.StrictMode>,
);
