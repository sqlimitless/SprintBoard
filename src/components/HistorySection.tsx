import { History } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import * as auditRepo from "../lib/db/audit.repo";
import {
  AUDIT_ACTION_LABELS,
  type AuditEntityType,
  type AuditEntry,
} from "../lib/db/types";

type Props = {
  entityType: AuditEntityType;
  entityId: string;
  compact?: boolean;
};

export default function HistorySection({ entityType, entityId, compact }: Props) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  const reload = useCallback(async () => {
    setEntries(await auditRepo.listByEntity(entityType, entityId));
  }, [entityType, entityId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    function onChanged() {
      reload();
    }
    window.addEventListener("issues:changed", onChanged);
    window.addEventListener("projects:changed", onChanged);
    return () => {
      window.removeEventListener("issues:changed", onChanged);
      window.removeEventListener("projects:changed", onChanged);
    };
  }, [reload]);

  return (
    <section className={compact ? "px-4 pb-4" : "px-6 pb-6"}>
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        <History size={14} />
        변경 이력
        <span className="ml-1 font-mono text-xs text-gray-400">
          {entries.length}
        </span>
      </h2>
      {entries.length === 0 ? (
        <div className="text-xs text-gray-400">이력이 없습니다.</div>
      ) : (
        <ul className="divide-y divide-gray-200 rounded border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {entries.map((e) => (
            <li key={e.id} className="sb-fade-in px-3 py-2 text-xs">
              <div className="flex items-center justify-between">
                <span
                  className={
                    "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase " +
                    actionColor(e.action)
                  }
                >
                  {AUDIT_ACTION_LABELS[e.action]}
                </span>
                <span className="text-gray-500">
                  {new Date(e.created_at).toLocaleString()}
                </span>
              </div>
              <ChangeDetails raw={e.changes} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function actionColor(a: string) {
  switch (a) {
    case "create":
      return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
    case "update":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
    case "delete":
      return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
    case "restore":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

function ChangeDetails({ raw }: { raw: string }) {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw || "{}");
  } catch {
    return null;
  }
  const keys = Object.keys(parsed);
  if (keys.length === 0) return null;

  if ("snapshot" in parsed) {
    const snap = parsed.snapshot as Record<string, unknown>;
    return (
      <div className="mt-1 space-y-0.5 text-gray-600 dark:text-gray-400">
        {Object.entries(snap).map(([k, v]) => (
          <div key={k} className="truncate">
            <span className="font-medium">{k}</span>: {formatValue(v)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-1 space-y-0.5 text-gray-600 dark:text-gray-400">
      {keys.map((k) => {
        const val = parsed[k];
        if (Array.isArray(val) && val.length === 2) {
          return (
            <div key={k} className="truncate">
              <span className="font-medium">{k}</span>:{" "}
              <span className="text-gray-500 line-through">
                {formatValue(val[0])}
              </span>{" "}
              → {formatValue(val[1])}
            </div>
          );
        }
        return (
          <div key={k} className="truncate">
            <span className="font-medium">{k}</span>: {formatValue(val)}
          </div>
        );
      })}
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") {
    if (v.length > 80) return v.slice(0, 80) + "…";
    return v;
  }
  return JSON.stringify(v);
}
