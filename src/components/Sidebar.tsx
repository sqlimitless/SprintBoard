import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { projectRepo, sprintRepo } from "../lib/db";
import type { Project, Sprint } from "../lib/db/types";

type Selection =
  | { kind: "backlog"; projectId: string }
  | { kind: "sprint"; projectId: string; sprintId: string }
  | null;

type Props = {
  selection: Selection;
  onSelect: (sel: Selection) => void;
};

export default function Sidebar({ selection, onSelect }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sprintsByProject, setSprintsByProject] = useState<Record<string, Sprint[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKey, setNewKey] = useState("");

  async function refreshProjects() {
    const list = await projectRepo.listProjects();
    setProjects(list);
  }

  useEffect(() => {
    refreshProjects();
  }, []);

  async function toggleExpand(projectId: string) {
    const next = new Set(expanded);
    if (next.has(projectId)) {
      next.delete(projectId);
    } else {
      next.add(projectId);
      if (!sprintsByProject[projectId]) {
        const sprints = await sprintRepo.listSprints(projectId);
        setSprintsByProject((prev) => ({ ...prev, [projectId]: sprints }));
      }
    }
    setExpanded(next);
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newKey.trim()) return;
    await projectRepo.createProject({
      key: newKey.trim().toUpperCase(),
      name: newName.trim(),
    });
    setNewName("");
    setNewKey("");
    setCreating(false);
    refreshProjects();
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-gray-200 bg-gray-50 text-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100">
      <div className="flex items-center justify-between px-3 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Projects
        </span>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          aria-label="Create project"
        >
          +
        </button>
      </div>

      {creating && (
        <form onSubmit={handleCreateProject} className="flex flex-col gap-2 px-3 pb-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Project name"
            className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800"
            autoFocus
          />
          <input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="Key (e.g. SB)"
            className="rounded border border-gray-300 bg-white px-2 py-1 text-sm uppercase dark:border-gray-700 dark:bg-gray-800"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 rounded bg-blue-600 px-2 py-1 text-sm font-medium text-white hover:bg-blue-700"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <nav className="flex-1 overflow-y-auto px-1 pb-2">
        {projects.length === 0 && !creating && (
          <p className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
            No projects yet. Click + to create one.
          </p>
        )}
        <ul>
          {projects.map((p) => {
            const isOpen = expanded.has(p.id);
            const sprints = sprintsByProject[p.id] ?? [];
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => toggleExpand(p.id)}
                  className="flex w-full items-center gap-1 rounded px-2 py-1 text-left hover:bg-gray-200 dark:hover:bg-gray-800"
                >
                  <span className="w-4 text-gray-400">{isOpen ? "▾" : "▸"}</span>
                  <span className="flex-1 truncate font-medium">{p.name}</span>
                  <span className="text-xs text-gray-400">{p.key}</span>
                </button>
                {isOpen && (
                  <ul className="ml-4 border-l border-gray-200 pl-2 dark:border-gray-800">
                    <li>
                      <button
                        type="button"
                        onClick={() =>
                          onSelect({ kind: "backlog", projectId: p.id })
                        }
                        className={
                          "flex w-full items-center rounded px-2 py-1 text-left hover:bg-gray-200 dark:hover:bg-gray-800 " +
                          (selection?.kind === "backlog" &&
                          selection.projectId === p.id
                            ? "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100"
                            : "")
                        }
                      >
                        <span className="text-gray-400">📥</span>
                        <span className="ml-2">Backlog</span>
                      </button>
                    </li>
                    {sprints.length === 0 && (
                      <li className="px-2 py-1 text-xs text-gray-400">
                        No sprints
                      </li>
                    )}
                    {sprints.map((s) => {
                      const selected =
                        selection?.kind === "sprint" && selection.sprintId === s.id;
                      return (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() =>
                              onSelect({
                                kind: "sprint",
                                projectId: p.id,
                                sprintId: s.id,
                              })
                            }
                            className={
                              "flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-gray-200 dark:hover:bg-gray-800 " +
                              (selected
                                ? "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100"
                                : "")
                            }
                          >
                            <span className="text-gray-400">
                              {s.state === "active"
                                ? "🏃"
                                : s.state === "closed"
                                ? "✅"
                                : "📅"}
                            </span>
                            <span className="flex-1 truncate">{s.name}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-gray-200 p-2 dark:border-gray-800">
        <Link
          to="/settings"
          className="flex items-center gap-2 rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <span>⚙</span>
          <span>Settings</span>
        </Link>
      </div>
    </aside>
  );
}
