import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import { subscribeUpdate } from "../lib/updater";

type Info = {
  version: string;
  currentVersion: string;
  body: string;
  install: () => Promise<void>;
};

export default function UpdateBanner() {
  const [info, setInfo] = useState<Info | null>(null);
  const [installing, setInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => subscribeUpdate(setInfo), []);

  if (!info || dismissed) return null;

  async function handleInstall() {
    if (!info) return;
    setInstalling(true);
    try {
      await info.install();
    } catch (err) {
      setInstalling(false);
      alert(`업데이트 실패\n${err instanceof Error ? err.message : String(err)}`);
    }
  }

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
          {info.body && (
            <div className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-gray-50 px-2 py-1.5 text-xs dark:bg-gray-800">
              {info.body}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleInstall}
              disabled={installing}
              className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {installing ? "설치 중..." : "지금 설치 후 재시작"}
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              disabled={installing}
              className="rounded border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              나중에
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          disabled={installing}
          className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          title="닫기"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
