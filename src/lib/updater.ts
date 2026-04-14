import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type InstallProgress =
  | { phase: "started"; total: number }
  | { phase: "downloading"; downloaded: number; total: number }
  | { phase: "finished" }
  | { phase: "installing" }
  | { phase: "relaunching" };

type UpdateInfo = {
  version: string;
  currentVersion: string;
  body: string;
  install: (onProgress?: (p: InstallProgress) => void) => Promise<void>;
};

let listener: ((info: UpdateInfo | null) => void) | null = null;
let pending: UpdateInfo | null = null;

export function subscribeUpdate(cb: (info: UpdateInfo | null) => void) {
  listener = cb;
  cb(pending);
  return () => {
    if (listener === cb) listener = null;
  };
}

function publish(info: UpdateInfo | null) {
  pending = info;
  listener?.(info);
}

export type CheckResult =
  | { kind: "available"; version: string }
  | { kind: "up-to-date" }
  | { kind: "error"; message: string };

export async function checkForUpdate(): Promise<CheckResult> {
  let update: Update | null = null;
  try {
    update = await check();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[updater] check failed:", err);
    return { kind: "error", message };
  }
  if (!update) return { kind: "up-to-date" };

  publish({
    version: update.version,
    currentVersion: update.currentVersion,
    body: update.body ?? "",
    install: async (onProgress) => {
      try {
        let total = 0;
        let downloaded = 0;
        await update!.downloadAndInstall((event) => {
          if (event.event === "Started") {
            total = event.data.contentLength ?? 0;
            onProgress?.({ phase: "started", total });
          } else if (event.event === "Progress") {
            downloaded += event.data.chunkLength;
            onProgress?.({ phase: "downloading", downloaded, total });
          } else if (event.event === "Finished") {
            onProgress?.({ phase: "finished" });
            onProgress?.({ phase: "installing" });
          }
        });
        onProgress?.({ phase: "relaunching" });
        await relaunch();
      } catch (err) {
        console.error("[updater] install failed:", err);
        throw err;
      }
    },
  });
  return { kind: "available", version: update.version };
}

export async function autoUpdate() {
  try {
    const update = await check();
    if (!update) return;
    console.log(
      `[updater] auto-installing ${update.version} (was ${update.currentVersion})`,
    );
    await update.downloadAndInstall();
    await relaunch();
  } catch (err) {
    console.warn("[updater] auto-update failed:", err);
  }
}
