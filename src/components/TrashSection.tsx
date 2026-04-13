import { FolderOpen, RotateCcw, Trash, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import * as issueRepo from "../lib/db/issue.repo";
import * as projectRepo from "../lib/db/project.repo";
import type { Issue, Project } from "../lib/db/types";
import { IssueTypeIcon } from "./issueMeta";

type TrashItem =
  | { kind: "project"; project: Project }
  | { kind: "issue"; issue: Issue };

export default function TrashSection() {
  const [items, setItems] = useState<TrashItem[]>([]);

  const reload = useCallback(async () => {
    const [projs, issues] = await Promise.all([
      projectRepo.listDeletedProjects(),
      issueRepo.listDeletedIssues(),
    ]);
    const merged: TrashItem[] = [
      ...projs.map((p) => ({ kind: "project" as const, project: p })),
      ...issues.map((i) => ({ kind: "issue" as const, issue: i })),
    ];
    merged.sort((a, b) => {
      const ad = a.kind === "project" ? a.project.deleted_at : a.issue.deleted_at;
      const bd = b.kind === "project" ? b.project.deleted_at : b.issue.deleted_at;
      return (bd ?? "").localeCompare(ad ?? "");
    });
    setItems(merged);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function restore(item: TrashItem) {
    if (item.kind === "project") {
      await projectRepo.restoreProject(item.project.id);
      window.dispatchEvent(new CustomEvent("projects:changed"));
      window.dispatchEvent(new CustomEvent("issues:changed"));
    } else {
      await issueRepo.restoreIssue(item.issue.id);
      window.dispatchEvent(
        new CustomEvent("issues:changed", {
          detail: {
            parentId: item.issue.parent_id ?? item.issue.project_id,
          },
        }),
      );
    }
    await reload();
  }

  async function purge(item: TrashItem) {
    const label =
      item.kind === "project"
        ? `프로젝트 "${item.project.name}"와 모든 에픽/스토리/태스크`
        : `"${item.issue.title}"와 모든 하위 항목`;
    if (!confirm(`${label}\n를 완전히 삭제합니다. 되돌릴 수 없습니다. 진행할까요?`))
      return;
    try {
      if (item.kind === "project") {
        await projectRepo.purgeProject(item.project.id);
        window.dispatchEvent(new CustomEvent("projects:changed"));
      } else {
        await issueRepo.purgeIssue(item.issue.id);
        window.dispatchEvent(new CustomEvent("issues:changed"));
      }
      await reload();
    } catch (err) {
      console.error(err);
      alert(`완전 삭제 실패\n${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        <Trash2 size={14} /> 휴지통
        <span className="ml-1 font-mono text-xs text-gray-400">{items.length}</span>
      </h2>
      {items.length === 0 ? (
        <div className="rounded border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-700">
          휴지통이 비어 있습니다.
        </div>
      ) : (
        <ul className="divide-y divide-gray-200 rounded border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {items.map((item) => {
            const meta =
              item.kind === "project"
                ? {
                    icon: (
                      <FolderOpen
                        size={14}
                        className="text-amber-600 dark:text-amber-400"
                      />
                    ),
                    label: `[${item.project.key}] ${item.project.name}`,
                    kind: "프로젝트",
                    deletedAt: item.project.deleted_at,
                  }
                : {
                    icon: <IssueTypeIcon type={item.issue.type} />,
                    label: item.issue.title,
                    kind: typeLabel(item.issue.type),
                    deletedAt: item.issue.deleted_at,
                  };
            const id =
              item.kind === "project" ? item.project.id : item.issue.id;
            return (
              <li
                key={id}
                className="sb-fade-in flex items-center gap-3 px-3 py-2 text-sm"
              >
                {meta.icon}
                <div className="min-w-0 flex-1">
                  <div className="truncate">{meta.label}</div>
                  <div className="text-xs text-gray-500">
                    {meta.kind} · 삭제{" "}
                    {meta.deletedAt
                      ? new Date(meta.deletedAt).toLocaleString()
                      : "-"}
                  </div>
                </div>
                <button
                  onClick={() => restore(item)}
                  className="flex items-center gap-1 rounded border border-gray-300 px-2.5 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <RotateCcw size={12} />
                  복구
                </button>
                <button
                  onClick={() => purge(item)}
                  className="flex items-center gap-1 rounded border border-red-300 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
                >
                  <Trash size={12} />
                  완전삭제
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function typeLabel(t: Issue["type"]): string {
  return t === "epic" ? "에픽" : t === "story" ? "스토리" : "태스크";
}
