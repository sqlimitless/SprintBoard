import { Archive, CircleDot, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as projectRepo from "../lib/db/project.repo";
import {
  PROJECT_STATUSES,
  type Project,
  type ProjectStatus,
} from "../lib/db/types";
import { RichTextEditor } from "./RichTextEditor";

type Props = { mode: "create" } | { mode: "edit"; project: Project; onSaved: (p: Project) => void };

export default function ProjectForm(props: Props) {
  const navigate = useNavigate();
  const initial =
    props.mode === "edit"
      ? props.project
      : {
          name: "",
          key: "",
          description: "",
          status: "active" as ProjectStatus,
        };

  const [name, setName] = useState(initial.name);
  const [keyVal, setKeyVal] = useState(initial.key);
  const [keyTouched, setKeyTouched] = useState(props.mode === "edit");
  const [description, setDescription] = useState(initial.description);
  const [status, setStatus] = useState<ProjectStatus>(initial.status);
  const [saving, setSaving] = useState(false);

  // Auto-derive key from name on create, until user edits key manually
  useEffect(() => {
    if (props.mode !== "create" || keyTouched) return;
    const derived = name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 4);
    setKeyVal(derived);
  }, [name, keyTouched, props.mode]);

  async function resolveUniqueKey(base: string, ignoreKey?: string): Promise<string> {
    const existingKeys = await projectRepo.listAllKeys();
    const used = new Set(existingKeys.filter((k) => k !== ignoreKey));
    if (!used.has(base)) return base;
    for (let i = 2; i < 1000; i++) {
      const candidate = `${base}${i}`;
      if (!used.has(candidate)) return candidate;
    }
    return `${base}${Date.now().toString(36).toUpperCase()}`;
  }

  async function submit() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      alert("프로젝트명을 입력하세요");
      return;
    }
    const rawKey = (keyVal || trimmedName).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    const baseKey = rawKey || "PRJ";
    setSaving(true);
    try {
      if (props.mode === "create") {
        const uniqueKey = await resolveUniqueKey(baseKey);
        const p = await projectRepo.createProject({
          key: uniqueKey,
          name: trimmedName,
          description,
          status,
        });
        window.dispatchEvent(new CustomEvent("projects:changed"));
        navigate(`/p/${p.id}`);
      } else {
        const uniqueKey = await resolveUniqueKey(baseKey, props.project.key);
        await projectRepo.updateProject(props.project.id, {
          name: trimmedName,
          key: uniqueKey,
          description,
          status,
        });
        window.dispatchEvent(new CustomEvent("projects:changed"));
        props.onSaved({
          ...props.project,
          name: trimmedName,
          key: uniqueKey,
          description,
          status,
        });
      }
    } catch (err) {
      console.error(err);
      alert(`저장 실패\n${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
        <h1 className="text-lg font-semibold">
          {props.mode === "create" ? "새 프로젝트" : "프로젝트 편집"}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <X size={14} /> 취소
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl space-y-5 px-6 py-6">
        <Field label="프로젝트명">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: Sprint Board"
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </Field>

        <Field label="프로젝트 키" hint="영문/숫자 2~8자. 이슈 식별자 접두로 쓰입니다 (예: SB).">
          <input
            value={keyVal}
            onChange={(e) => {
              setKeyTouched(true);
              setKeyVal(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8));
            }}
            placeholder="SB"
            className="w-40 rounded border border-gray-300 bg-white px-3 py-2 font-mono text-sm uppercase dark:border-gray-700 dark:bg-gray-900"
          />
        </Field>

        <Field label="설명">
          <RichTextEditor
            value={description}
            onChange={setDescription}
            placeholder="프로젝트 목표, 범위 등을 적어보세요"
            minHeight={320}
            attachmentScope={props.mode === "edit" ? props.project.id : undefined}
          />
        </Field>

        <Field label="상태">
          <div className="flex gap-2">
            {PROJECT_STATUSES.map((s) => {
              const selected = status === s.value;
              const Icon = s.value === "active" ? CircleDot : Archive;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatus(s.value)}
                  className={
                    "flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm " +
                    (selected
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-200"
                      : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800")
                  }
                >
                  <Icon size={14} />
                  {s.label}
                </button>
              );
            })}
          </div>
        </Field>

        {props.mode === "edit" && (
          <Field label="생성일">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {new Date(props.project.created_at).toLocaleString()}
            </div>
          </Field>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </div>
      {children}
      {hint && (
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-500">{hint}</div>
      )}
    </div>
  );
}
