import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

type UpdateInfo = {
  version: string;
  currentVersion: string;
  body: string;
  install: () => Promise<void>;
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
  if (!update?.available) return { kind: "up-to-date" };

  publish({
    version: update.version,
    currentVersion: update.currentVersion,
    body: update.body ?? "",
    install: async () => {
      try {
        await update!.downloadAndInstall();
        await relaunch();
      } catch (err) {
        console.error("[updater] install failed:", err);
        throw err;
      }
    },
  });
  return { kind: "available", version: update.version };
}
