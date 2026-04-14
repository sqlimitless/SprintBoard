import {
  Check,
  ChevronRight,
  FolderOpen,
  Plus,
  Settings as SettingsIcon,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import * as issueRepo from "../lib/db/issue.repo";
import * as projectRepo from "../lib/db/project.repo";
import type { Issue, Project } from "../lib/db/types";
import { IssueTypeIcon } from "./issueMeta";

type ChildMap = Record<string, Issue[]>; // parentKey -> issues

export default function ExplorerTree() {
  const navigate = useNavigate();
  const loc = useLocation();
  const params = useParams<{
    projectId?: string;
    epicId?: string;
    storyId?: string;
  }>();

  const [projects, setProjects] = useState<Project[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [children, setChildren] = useState<ChildMap>({});
  const [creatingUnder, setCreatingUnder] = useState<string | null>(null); // projectId | epicId | storyId
  const [createType, setCreateType] = useState<"epic" | "story" | "task">("epic");
  const [newTitle, setNewTitle] = useState("");

  const reloadProjects = useCallback(async () => {
    setProjects(await projectRepo.listProjects());
  }, []);

  const reloadChildren = useCallback(async (parentKey: string, loader: () => Promise<Issue[]>) => {
    const list = await loader();
    setChildren((prev) => ({ ...prev, [parentKey]: list }));
  }, []);

  useEffect(() => {
    reloadProjects();
  }, [reloadProjects, loc.key]);

  // Keep a ref to the current expanded set so the event listener isn't
  // captured with a stale closure (which caused the tree to miss refresh
  // events after auto-expanding on route change).
  const expandedRef = useRef(expanded);
  useEffect(() => {
    expandedRef.current = expanded;
  }, [expanded]);

  useEffect(() => {
    function onProjects() {
      reloadProjects();
    }
    async function onIssues(e: Event) {
      const detail = (e as CustomEvent<{ parentId?: string }>).detail;
      const keysToRefresh = new Set<string>();

      // If the dispatcher tells us which parent changed, refresh that
      // parent's key — and also the project-level key since new epics/stories
      // may affect counts.
      if (detail?.parentId) {
        const parent = await issueRepo.getIssue(detail.parentId);
        if (parent) {
          if (parent.type === "epic") keysToRefresh.add(`e:${parent.id}`);
          keysToRefresh.add(`p:${parent.project_id}`);
        }
      }

      // Also refresh every currently expanded parent — cheap and bullet-proof.
      for (const key of expandedRef.current) keysToRefresh.add(key);

      for (const key of keysToRefresh) {
        if (key.startsWith("p:")) {
          const pid = key.slice(2);
          await reloadChildren(key, () => issueRepo.listEpics(pid));
        } else if (key.startsWith("e:")) {
          const eid = key.slice(2);
          await reloadChildren(key, () => issueRepo.listChildren(eid));
        }
      }
    }
    window.addEventListener("projects:changed", onProjects);
    window.addEventListener("issues:changed", onIssues);
    return () => {
      window.removeEventListener("projects:changed", onProjects);
      window.removeEventListener("issues:changed", onIssues);
    };
  }, [reloadProjects, reloadChildren]);

  // Auto-expand ancestors to reveal current selection
  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (params.projectId) next.add(`p:${params.projectId}`);
      if (params.epicId) next.add(`e:${params.epicId}`);
      return next;
    });
    // Also load children that will be rendered
    if (params.projectId && !children[`p:${params.projectId}`]) {
      reloadChildren(`p:${params.projectId}`, () => issueRepo.listEpics(params.projectId!));
    }
    if (params.epicId && !children[`e:${params.epicId}`]) {
      reloadChildren(`e:${params.epicId}`, () => issueRepo.listChildren(params.epicId!));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.projectId, params.epicId]);

  function toggle(key: string, loader?: () => Promise<Issue[]>) {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key);
    else {
      next.add(key);
      if (loader && !children[key]) reloadChildren(key, loader);
    }
    setExpanded(next);
  }

  function ensureExpanded(key: string, loader?: () => Promise<Issue[]>) {
    if (expanded.has(key)) {
      if (loader && !children[key]) reloadChildren(key, loader);
      return;
    }
    const next = new Set(expanded);
    next.add(key);
    setExpanded(next);
    if (loader && !children[key]) reloadChildren(key, loader);
  }

  async function submitCreate() {
    const title = newTitle.trim();
    if (!title) {
      setCreatingUnder(null);
      return;
    }
    try {
      if (createType === "epic" && creatingUnder) {
        const projectId = creatingUnder;
        await issueRepo.createIssue({
          project_id: projectId,
          type: "epic",
          parent_id: null,
          title,
        });
        await reloadChildren(`p:${projectId}`, () => issueRepo.listEpics(projectId));
      } else if (createType === "story" && creatingUnder) {
        const epicId = creatingUnder;
        const epic = await issueRepo.getIssue(epicId);
        if (epic) {
          await issueRepo.createIssue({
            project_id: epic.project_id,
            type: "story",
            parent_id: epicId,
            title,
          });
          await reloadChildren(`e:${epicId}`, () => issueRepo.listChildren(epicId));
        }
      } else if (createType === "task" && creatingUnder) {
        const storyId = creatingUnder;
        const story = await issueRepo.getIssue(storyId);
        if (story) {
          await issueRepo.createIssue({
            project_id: story.project_id,
            type: "task",
            parent_id: storyId,
            title,
          });
          window.dispatchEvent(
            new CustomEvent("issues:changed", { detail: { parentId: storyId } }),
          );
        }
      }
      setNewTitle("");
      setCreatingUnder(null);
    } catch (err) {
      console.error("생성 실패:", err);
      const msg =
        err instanceof Error
          ? `${err.name}: ${err.message}`
          : JSON.stringify(err);
      alert(`생성 실패\n${msg}`);
    }
  }

  function startCreate(type: typeof createType, under: string) {
    setCreateType(type);
    setCreatingUnder(under);
    setNewTitle("");
    if (type === "epic") ensureExpanded(`p:${under}`, () => issueRepo.listEpics(under));
    if (type === "story")
      ensureExpanded(`e:${under}`, () => issueRepo.listChildren(under));
  }

  async function onDeleteProject(id: string) {
    try {
      await projectRepo.deleteProject(id);
      await reloadProjects();
      window.dispatchEvent(new CustomEvent("projects:changed"));
      if (params.projectId === id) navigate("/backlog/p");
    } catch (err) {
      console.error("프로젝트 삭제 실패:", err);
      alert(`삭제 실패\n${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function onDeleteIssue(iss: Issue) {
    try {
      await issueRepo.deleteIssue(iss.id);
      if (iss.type === "epic" && iss.project_id) {
        await reloadChildren(`p:${iss.project_id}`, () =>
          issueRepo.listEpics(iss.project_id),
        );
      } else if (iss.parent_id) {
        await reloadChildren(`e:${iss.parent_id}`, () =>
          issueRepo.listChildren(iss.parent_id!),
        );
      }
      window.dispatchEvent(
        new CustomEvent("issues:changed", {
          detail: { parentId: iss.parent_id ?? iss.project_id },
        }),
      );
      // If the deleted item was the current route, back off to the parent.
      if (params.epicId === iss.id) {
        navigate(`/backlog/p/${iss.project_id}`);
      } else if (params.storyId === iss.id) {
        navigate(`/backlog/p/${iss.project_id}/e/${iss.parent_id ?? ""}`);
      }
    } catch (err) {
      console.error("이슈 삭제 실패:", err);
      alert(`삭제 실패\n${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-gray-800">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          <FolderOpen size={14} />
          <span>Explorer</span>
        </div>
        <button
          onClick={() => navigate("/backlog/p?new=1")}
          title="새 프로젝트"
          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1 text-sm">
        {projects.length === 0 && (
          <div className="px-4 py-6 text-center text-xs text-gray-400">
            프로젝트가 없습니다.
            <br />
            상단 + 버튼으로 생성하세요.
          </div>
        )}

        {projects.map((p) => {
          const pKey = `p:${p.id}`;
          const open = expanded.has(pKey);
          const selected = params.projectId === p.id && !params.epicId;
          return (
            <div key={p.id}>
              <Row
                indent={0}
                selected={selected}
                onSelect={() => navigate(`/backlog/p/${p.id}`)}
                onToggle={() => toggle(pKey, () => issueRepo.listEpics(p.id))}
                chevron={open ? "down" : "right"}
                icon={<FolderOpen size={14} className="text-amber-600 dark:text-amber-400" />}
                label={p.name}
                actions={[
                  {
                    title: "에픽 추가",
                    icon: <Plus size={12} />,
                    onClick: () => startCreate("epic", p.id),
                  },
                  {
                    title: "프로젝트 삭제",
                    icon: <Trash2 size={12} />,
                    onClick: () => onDeleteProject(p.id),
                  },
                ]}
              />
              <Collapse open={open}>
                {creatingUnder === p.id && createType === "epic" && (
                  <NewRow
                    indent={1}
                    placeholder="새 에픽 이름"
                    value={newTitle}
                    onChange={setNewTitle}
                    onSubmit={submitCreate}
                    onCancel={() => setCreatingUnder(null)}
                  />
                )}
                {(children[pKey] ?? []).map((epic) => {
                    const eKey = `e:${epic.id}`;
                    const eOpen = expanded.has(eKey);
                    const eSelected = params.epicId === epic.id && !params.storyId;
                    return (
                      <div key={epic.id}>
                        <Row
                          indent={1}
                          selected={eSelected}
                          onSelect={() => navigate(`/backlog/p/${p.id}/e/${epic.id}`)}
                          onToggle={() =>
                            toggle(eKey, () => issueRepo.listChildren(epic.id))
                          }
                          chevron={eOpen ? "down" : "right"}
                          icon={<IssueTypeIcon type="epic" />}
                          label={epic.title}
                          actions={[
                            {
                              title: "스토리 추가",
                              icon: <Plus size={12} />,
                              onClick: () => startCreate("story", epic.id),
                            },
                            {
                              title: "삭제",
                              icon: <Trash2 size={12} />,
                              onClick: () => onDeleteIssue(epic),
                            },
                          ]}
                        />
                        <Collapse open={eOpen}>
                          {creatingUnder === epic.id && createType === "story" && (
                            <NewRow
                              indent={2}
                              placeholder="새 스토리 이름"
                              value={newTitle}
                              onChange={setNewTitle}
                              onSubmit={submitCreate}
                              onCancel={() => setCreatingUnder(null)}
                            />
                          )}
                          {(children[eKey] ?? [])
                            .filter((c) => c.type === "story")
                            .map((story) => {
                              const sSelected = params.storyId === story.id;
                              return (
                                <Row
                                  key={story.id}
                                  indent={2}
                                  selected={sSelected}
                                  onSelect={() =>
                                    navigate(`/backlog/p/${p.id}/e/${epic.id}/s/${story.id}`)
                                  }
                                  icon={<IssueTypeIcon type="story" />}
                                  label={story.title}
                                  actions={[
                                    {
                                      title: "삭제",
                                      icon: <Trash2 size={12} />,
                                      onClick: () => onDeleteIssue(story),
                                    },
                                  ]}
                                />
                              );
                            })}
                        </Collapse>
                      </div>
                    );
                  })}
              </Collapse>
            </div>
          );
        })}
      </div>

      <div className="border-t border-gray-200 px-3 py-2 dark:border-gray-800">
        <Link
          to="/settings"
          title="Settings"
          className="flex items-center gap-2 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
        >
          <SettingsIcon size={14} />
          <span>Settings</span>
        </Link>
      </div>
    </div>
  );
}

function Collapse({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="grid transition-[grid-template-rows] duration-200 ease-out"
      style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

type RowAction = { title: string; icon: React.ReactNode; onClick: () => void };

function Row({
  indent,
  selected,
  chevron,
  icon,
  label,
  actions,
  onSelect,
  onToggle,
}: {
  indent: number;
  selected?: boolean;
  chevron?: "right" | "down";
  icon: React.ReactNode;
  label: string;
  actions?: RowAction[];
  onSelect?: () => void;
  onToggle?: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      style={{ paddingLeft: 8 + indent * 12 }}
      className={
        "sb-fade-in group flex cursor-pointer items-center gap-1 pr-2 py-1 transition-colors duration-150 " +
        (selected
          ? "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100"
          : "hover:bg-gray-100 dark:hover:bg-gray-800")
      }
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle?.();
        }}
        className={
          "flex h-4 w-4 items-center justify-center rounded text-gray-500 " +
          (onToggle ? "hover:bg-gray-200 dark:hover:bg-gray-700" : "invisible")
        }
      >
        <span
          className={
            "sb-chevron inline-flex " +
            (chevron === "down" ? "sb-chevron-open" : "")
          }
        >
          <ChevronRight size={12} />
        </span>
      </button>
      <span className="flex h-4 w-4 items-center justify-center">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      <span className="flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        {actions?.map((a) => (
          <button
            key={a.title}
            title={a.title}
            onClick={(e) => {
              e.stopPropagation();
              a.onClick();
            }}
            className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-gray-100"
          >
            {a.icon}
          </button>
        ))}
      </span>
    </div>
  );
}

function NewRow({
  indent,
  placeholder,
  value,
  onChange,
  onSubmit,
  onCancel,
}: {
  indent: number;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{ paddingLeft: 8 + indent * 12 + 20 }}
      className="sb-slide-in flex items-center gap-1 py-1 pr-2"
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        placeholder={placeholder}
        className="flex-1 rounded border border-blue-400 bg-white px-1.5 py-0.5 text-sm outline-none dark:border-blue-500 dark:bg-gray-900"
      />
      <button
        type="button"
        title="확인"
        onMouseDown={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="rounded p-1 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/30"
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        title="취소"
        onMouseDown={(e) => {
          e.preventDefault();
          onCancel();
        }}
        className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        <X size={14} />
      </button>
    </div>
  );
}
