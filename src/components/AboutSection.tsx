import { getVersion } from "@tauri-apps/api/app";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { checkForUpdate, type CheckResult } from "../lib/updater";

export default function AboutSection() {
  const [version, setVersion] = useState<string>("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => setVersion("unknown"));
  }, []);

  async function handleCheck() {
    setChecking(true);
    setResult(null);
    const r = await checkForUpdate();
    setResult(r);
    setChecking(false);
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        About
      </h2>
      <div className="rounded-lg border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="font-medium">현재 버전</div>
            <div className="mt-0.5 font-mono text-xs text-gray-500 dark:text-gray-400">
              {version || "확인 중..."}
            </div>
          </div>
          <button
            type="button"
            onClick={handleCheck}
            disabled={checking}
            className="flex items-center gap-1.5 rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <RefreshCw size={14} className={checking ? "animate-spin" : ""} />
            {checking ? "확인 중..." : "업데이트 확인"}
          </button>
        </div>
        {result && (
          <div className="border-t border-gray-200 px-4 py-2 text-xs dark:border-gray-800">
            {result.kind === "available" && (
              <span className="text-blue-600 dark:text-blue-400">
                새 버전 {result.version} 사용 가능
              </span>
            )}
            {result.kind === "up-to-date" && (
              <span className="text-gray-500">최신 버전입니다.</span>
            )}
            {result.kind === "error" && (
              <span className="text-red-600 dark:text-red-400">
                확인 실패: {result.message}
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
