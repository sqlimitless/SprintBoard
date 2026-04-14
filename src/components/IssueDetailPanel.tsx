import { useEffect, useRef, useState } from "react";
import * as issueRepo from "../lib/db/issue.repo";
import * as sprintRepo from "../lib/db/sprint.repo";
import {
  PRIORITIES,
  STATUS_LABELS,
  STATUS_ORDER,
  SPRINT_STATE_LABELS,
  type Issue,
  type IssueStatus,
  type Priority,
  type Sprint,
} from "../lib/db/types";
import { dispatchSprintsChanged } from "../lib/sprint/SprintContext";
import ChildIssueSection from "./ChildIssueSection";
import { IssueTypeIcon } from "./issueMeta";
import MetaMenu from "./MetaMenu";
import { RichTextEditor } from "./RichTextEditor";

export default function IssueDetailPanel({ issueId }: { issueId: string }) {
  const [issue, setIssue] = useState<Issue | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dirty, setDirty] = useState(false);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    issueRepo.getIssue(issueId).then(async (i) => {
      if (cancelled) return;
      setIssue(i);
      setTitle(i?.title ?? "");
      setDescription(i?.description ?? "");
      setDirty(false);
      if (i && i.type === "story") {
        const list = await sprintRepo.listByProject(i.project_id);
        if (!cancelled) setSprints(list);
      } else if (!cancelled) {
        setSprints([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [issueId]);

  useEffect(() => {
    if (!dirty || !issue) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await issueRepo.updateIssue(issue.id, { title, description });
      setDirty(false);
      window.dispatchEvent(new CustomEvent("issues:changed"));
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [title, description, dirty, issue]);

  async function updateStatus(status: IssueStatus) {
    if (!issue) return;
    await issueRepo.updateIssue(issue.id, { status });
    setIssue({ ...issue, status });
    window.dispatchEvent(new CustomEvent("issues:changed"));
  }

  async function updatePriority(priority: Priority) {
    if (!issue) return;
    await issueRepo.updateIssue(issue.id, { priority });
    setIssue({ ...issue, priority });
    window.dispatchEvent(new CustomEvent("issues:changed"));
  }

  async function updateDates(patch: { start_date?: string | null; due_date?: string | null }) {
    if (!issue) return;
    await issueRepo.updateIssue(issue.id, patch);
    setIssue({ ...issue, ...patch });
    window.dispatchEvent(new CustomEvent("issues:changed"));
  }

  async function updateSprint(sprintId: string | null) {
    if (!issue) return;
    await issueRepo.assignSprint(issue.id, sprintId);
    setIssue({ ...issue, sprint_id: sprintId });
    dispatchSprintsChanged();
    window.dispatchEvent(new CustomEvent("issues:changed"));
  }

  if (!issue) {
    return <div className="p-6 text-sm text-gray-500">로딩 중...</div>;
  }

  async function handleDelete() {
    try {
      await issueRepo.deleteIssue(issue!.id);
      window.dispatchEvent(
        new CustomEvent("issues:changed", {
          detail: { parentId: issue!.parent_id ?? issue!.project_id },
        }),
      );
    } catch (err) {
      console.error(err);
      alert(`삭제 실패\n${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <IssueTypeIcon type={issue.type} />
            <span>{issue.type}</span>
          </div>
          <MetaMenu
            entityType="issue"
            entityId={issue.id}
            createdAt={issue.created_at}
            onDelete={handleDelete}
          />
        </div>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setDirty(true);
          }}
          className="mt-1 w-full bg-transparent text-lg font-semibold outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 border-b border-gray-200 px-4 py-3 text-xs dark:border-gray-800">
        <label className="flex flex-col gap-1">
          <span className="text-gray-500">Status</span>
          <select
            value={issue.status}
            onChange={(e) => updateStatus(e.target.value as IssueStatus)}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-gray-500">Priority</span>
          <select
            value={issue.priority}
            onChange={(e) => updatePriority(e.target.value as Priority)}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {(issue.type === "story" || issue.type === "task") && (
        <div className="grid grid-cols-2 gap-3 border-b border-gray-200 px-4 py-3 text-xs dark:border-gray-800">
          <label className="flex flex-col gap-1">
            <span className="text-gray-500">시작일</span>
            <input
              type="date"
              value={issue.start_date?.slice(0, 10) ?? ""}
              onChange={(e) => updateDates({ start_date: e.target.value || null })}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-gray-500">종료일</span>
            <input
              type="date"
              value={issue.due_date?.slice(0, 10) ?? ""}
              onChange={(e) => updateDates({ due_date: e.target.value || null })}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </label>
          {issue.type === "story" && (
            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-gray-500">스프린트</span>
              <select
                value={issue.sprint_id ?? ""}
                onChange={(e) => updateSprint(e.target.value || null)}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <option value="">(백로그)</option>
                {sprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    [{SPRINT_STATE_LABELS[s.state]}] {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      <div className="flex-1 p-4">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Description
        </div>
        <RichTextEditor
          value={description}
          onChange={(v) => {
            setDescription(v);
            setDirty(true);
          }}
          placeholder="설명을 입력하세요..."
          attachmentScope={issue.project_id}
        />
      </div>

      {(issue.type === "epic" || issue.type === "story") && (
        <div className="border-t border-gray-200 dark:border-gray-800">
          <ChildIssueSection
            projectId={issue.project_id}
            parentId={issue.id}
            childType={issue.type === "epic" ? "story" : "task"}
          />
        </div>
      )}

      <div className="border-t border-gray-200 px-4 py-2 text-[11px] text-gray-500 dark:border-gray-800">
        {dirty ? "저장 중..." : "저장됨"} · 업데이트{" "}
        {new Date(issue.updated_at).toLocaleString()}
      </div>
    </div>
  );
}
