import { Check, Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as issueRepo from "../lib/db/issue.repo";
import {
  PRIORITIES,
  STATUS_LABELS,
  STATUS_ORDER,
  type Issue,
  type IssueStatus,
  type IssueType,
  type Priority,
} from "../lib/db/types";
import { IssueTypeIcon, PriorityBadge } from "./issueMeta";

type Props = {
  projectId: string;
  parentId: string | null; // null = top-level epics of project
  childType: IssueType;
  onOpenChild?: (id: string) => void;
};

const LABEL_BY_TYPE: Record<IssueType, { title: string; singular: string }> = {
  epic: { title: "에픽", singular: "에픽" },
  story: { title: "스토리", singular: "스토리" },
  task: { title: "태스크", singular: "태스크" },
};

export default function ChildIssueSection({
  projectId,
  parentId,
  childType,
  onOpenChild,
}: Props) {
  const navigate = useNavigate();
  const [items, setItems] = useState<Issue[]>([]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [status, setStatus] = useState<IssueStatus>("backlog");

  const reload = useCallback(async () => {
    const list = parentId
      ? (await issueRepo.listChildren(parentId)).filter((c) => c.type === childType)
      : await issueRepo.listEpics(projectId);
    setItems(list);
  }, [parentId, projectId, childType]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    function onChanged() {
      reload();
    }
    window.addEventListener("issues:changed", onChanged);
    return () => window.removeEventListener("issues:changed", onChanged);
  }, [reload]);

  async function submit() {
    const t = title.trim();
    if (!t) {
      setAdding(false);
      return;
    }
    try {
      await issueRepo.createIssue({
        project_id: projectId,
        type: childType,
        parent_id: parentId,
        title: t,
        status,
        priority,
      });
      window.dispatchEvent(
        new CustomEvent("issues:changed", {
          detail: { parentId: parentId ?? projectId },
        }),
      );
      setTitle("");
      setPriority("medium");
      setStatus("backlog");
      setAdding(false);
    } catch (err) {
      console.error(err);
      alert(`생성 실패\n${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function open(id: string) {
    if (onOpenChild) onOpenChild(id);
    else if (childType === "epic") navigate(`/p/${projectId}/e/${id}`);
  }

  const label = LABEL_BY_TYPE[childType];

  return (
    <section className="px-6 pb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {label.title}
          <span className="ml-2 font-mono text-xs text-gray-400">{items.length}</span>
        </h2>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <Plus size={14} /> {label.singular} 생성
          </button>
        )}
      </div>

      {adding && (
        <div className="sb-pop-in mb-3 rounded border border-blue-400 bg-white p-3 dark:border-blue-500 dark:bg-gray-900">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setAdding(false);
              }
            }}
            placeholder={`${label.singular} 제목`}
            className="w-full bg-transparent text-sm outline-none"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-2 text-xs dark:border-gray-700">
            <label className="flex items-center gap-1 text-gray-500">
              상태
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as IssueStatus)}
                className="rounded border border-gray-300 bg-white px-1.5 py-0.5 dark:border-gray-700 dark:bg-gray-950"
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1 text-gray-500">
              우선순위
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="rounded border border-gray-300 bg-white px-1.5 py-0.5 dark:border-gray-700 dark:bg-gray-950"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="flex items-center gap-1 rounded px-2 py-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X size={12} /> 취소
              </button>
              <button
                type="button"
                onClick={submit}
                className="flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-white hover:bg-blue-500"
              >
                <Check size={12} /> 생성
              </button>
            </div>
          </div>
        </div>
      )}

      {items.length === 0 && !adding ? (
        <div className="rounded border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-700">
          아직 {label.singular}가 없습니다.
        </div>
      ) : (
        <ul className="divide-y divide-gray-200 rounded border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {items.map((i) => (
            <li
              key={i.id}
              onClick={() => open(i.id)}
              className="sb-fade-in flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-900"
            >
              <IssueTypeIcon type={i.type} />
              <span className="flex-1 truncate">{i.title}</span>
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {STATUS_LABELS[i.status]}
              </span>
              <PriorityBadge priority={i.priority} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
