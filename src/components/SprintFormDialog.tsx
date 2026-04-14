import { useEffect, useState } from "react";
import * as sprintRepo from "../lib/db/sprint.repo";
import type { Sprint } from "../lib/db/types";
import { dispatchSprintsChanged } from "../lib/sprint/SprintContext";

type Props = {
  projectId: string;
  sprint?: Sprint | null;
  onClose: () => void;
  onSaved?: (sprint: Sprint) => void;
};

export default function SprintFormDialog({
  projectId,
  sprint,
  onClose,
  onSaved,
}: Props) {
  const [name, setName] = useState(sprint?.name ?? "");
  const [goal, setGoal] = useState(sprint?.goal ?? "");
  const [start, setStart] = useState(sprint?.start_date?.slice(0, 10) ?? "");
  const [end, setEnd] = useState(sprint?.end_date?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(sprint?.name ?? "");
    setGoal(sprint?.goal ?? "");
    setStart(sprint?.start_date?.slice(0, 10) ?? "");
    setEnd(sprint?.end_date?.slice(0, 10) ?? "");
  }, [sprint]);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      alert("스프린트 이름을 입력하세요");
      return;
    }
    if (start && end && start > end) {
      alert("시작일이 종료일보다 늦을 수 없습니다");
      return;
    }
    setSaving(true);
    try {
      let saved: Sprint;
      if (sprint) {
        await sprintRepo.updateSprint(sprint.id, {
          name: trimmed,
          goal,
          start_date: start || null,
          end_date: end || null,
        });
        saved = { ...sprint, name: trimmed, goal, start_date: start || null, end_date: end || null };
      } else {
        saved = await sprintRepo.createSprint({
          project_id: projectId,
          name: trimmed,
          goal,
          start_date: start || null,
          end_date: end || null,
        });
      }
      dispatchSprintsChanged();
      onSaved?.(saved);
      onClose();
    } catch (err) {
      console.error(err);
      alert(`저장 실패\n${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-[420px] rounded-lg border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-800 dark:bg-gray-950"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">
          {sprint ? "스프린트 편집" : "새 스프린트"}
        </h2>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-gray-600 dark:text-gray-400">이름</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sprint 1"
              className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-gray-600 dark:text-gray-400">목표 (선택)</span>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={2}
              className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-gray-600 dark:text-gray-400">시작일</span>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-gray-600 dark:text-gray-400">종료일</span>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900"
              />
            </label>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            취소
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
