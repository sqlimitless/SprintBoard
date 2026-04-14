import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import { subscribeUpdate, type InstallProgress } from "../lib/updater";

type Info = {
  version: string;
  currentVersion: string;
  body: string;
  install: (onProgress?: (p: InstallProgress) => void) => Promise<void>;
};

function formatBytes(n: number) {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function UpdateBanner() {
  const [info, setInfo] = useState<Info | null>(null);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<InstallProgress | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => subscribeUpdate(setInfo), []);

  if (!info || dismissed) return null;

  async function handleInstall() {
    if (!info) return;
    setInstalling(true);
    setProgress({ phase: "started", total: 0 });
    try {
      await info.install(setProgress);
    } catch (err) {
      setInstalling(false);
      setProgress(null);
      alert(`업데이트 실패\n${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const pct =
    progress?.phase === "downloading" && progress.total > 0
      ? Math.min(100, Math.round((progress.downloaded / progress.total) * 100))
      : progress?.phase === "started"
        ? 0
        : progress?.phase === "finished" ||
            progress?.phase === "installing" ||
            progress?.phase === "relaunching"
          ? 100
          : null;

  const phaseLabel =
    progress?.phase === "started"
      ? "다운로드 시작..."
      : progress?.phase === "downloading"
        ? `다운로드 중 ${formatBytes(progress.downloaded)}${progress.total ? ` / ${formatBytes(progress.total)}` : ""}`
        : progress?.phase === "finished"
          ? "다운로드 완료"
          : progress?.phase === "installing"
            ? "설치 중..."
            : progress?.phase === "relaunching"
              ? "재시작 중..."
              : null;

  return (
    <div className="sb-slide-in fixed bottom-4 right-4 z-50 w-96 rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start gap-3 px-4 py-3">
        <Download size={18} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">
            새 버전 {info.version} 사용 가능
          </div>
          <div className="mt-0.5 text-xs text-gray-500">
            현재 {info.currentVersion}
          </div>
          {info.body && !installing && (
            <div className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-gray-50 px-2 py-1.5 text-xs dark:bg-gray-800">
              {info.body}
            </div>
          )}
          {installing && pct !== null && (
            <div className="mt-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                <div
                  className="h-full bg-blue-600 transition-all duration-150 dark:bg-blue-400"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-gray-500">
                <span>{phaseLabel}</span>
                <span>{pct}%</span>
              </div>
            </div>
          )}
          {!installing && (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleInstall}
                className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                지금 설치 후 재시작
              </button>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="rounded border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                나중에
              </button>
            </div>
          )}
        </div>
        {!installing && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            title="닫기"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
