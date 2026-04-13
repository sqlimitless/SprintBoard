import { MoreHorizontal, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import HistorySection from "./HistorySection";
import type { AuditEntityType } from "../lib/db/types";

type Props = {
  entityType: AuditEntityType;
  entityId: string;
  createdAt: string;
  onDelete?: () => void;
  /** Tailwind alignment of the popover relative to the trigger. */
  align?: "left" | "right";
};

export default function MetaMenu({
  entityType,
  entityId,
  createdAt,
  onDelete,
  align = "right",
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="더보기"
        className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div
          className={
            "sb-pop-in absolute z-20 mt-1 flex max-h-[70vh] w-80 flex-col rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900 " +
            (align === "right" ? "right-0" : "left-0")
          }
        >
          <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              생성일
            </div>
            <div className="mt-0.5 text-sm">
              {new Date(createdAt).toLocaleString()}
            </div>
          </div>

          {onDelete && (
            <div className="border-b border-gray-200 p-2 dark:border-gray-800">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onDelete();
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
              >
                <Trash2 size={14} />
                삭제 (휴지통으로 이동)
              </button>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            <HistorySection entityType={entityType} entityId={entityId} compact />
          </div>
        </div>
      )}
    </div>
  );
}
