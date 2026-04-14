import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as projectRepo from "../db/project.repo";
import * as sprintRepo from "../db/sprint.repo";
import type { Project, Sprint } from "../db/types";

type SprintContextValue = {
  projects: Project[];
  currentProjectId: string | null;
  setCurrentProjectId: (id: string | null) => void;

  sprints: Sprint[];
  currentSprintId: string | null;
  setCurrentSprintId: (id: string | null) => void;

  currentProject: Project | null;
  currentSprint: Sprint | null;

  reloadSprints: () => Promise<void>;
};

const Ctx = createContext<SprintContextValue | null>(null);

const LS_PROJECT = "sb.currentProject";
const LS_SPRINT = "sb.currentSprint";

export function SprintProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [currentProjectId, _setCurrentProjectId] = useState<string | null>(() =>
    localStorage.getItem(LS_PROJECT),
  );
  const [currentSprintId, _setCurrentSprintId] = useState<string | null>(() =>
    localStorage.getItem(LS_SPRINT),
  );

  const setCurrentProjectId = useCallback((id: string | null) => {
    _setCurrentProjectId(id);
    if (id) localStorage.setItem(LS_PROJECT, id);
    else localStorage.removeItem(LS_PROJECT);
    // Reset sprint selection when switching projects
    _setCurrentSprintId(null);
    localStorage.removeItem(LS_SPRINT);
  }, []);

  const setCurrentSprintId = useCallback((id: string | null) => {
    _setCurrentSprintId(id);
    if (id) localStorage.setItem(LS_SPRINT, id);
    else localStorage.removeItem(LS_SPRINT);
  }, []);

  const reloadProjects = useCallback(async () => {
    const list = await projectRepo.listProjects();
    setProjects(list);
    // Auto-select first project if none
    if (!currentProjectId && list.length > 0) {
      _setCurrentProjectId(list[0].id);
      localStorage.setItem(LS_PROJECT, list[0].id);
    }
    // Clear if current doesn't exist anymore
    if (currentProjectId && !list.find((p) => p.id === currentProjectId)) {
      _setCurrentProjectId(list[0]?.id ?? null);
      if (list[0]) localStorage.setItem(LS_PROJECT, list[0].id);
      else localStorage.removeItem(LS_PROJECT);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reloadSprints = useCallback(async () => {
    if (!currentProjectId) {
      setSprints([]);
      return;
    }
    const list = await sprintRepo.listByProject(currentProjectId);
    setSprints(list);

    // Select active sprint by default; fall back to first sprint
    if (!currentSprintId || !list.find((s) => s.id === currentSprintId)) {
      const active = list.find((s) => s.state === "active");
      const target = active ?? list[0] ?? null;
      _setCurrentSprintId(target?.id ?? null);
      if (target) localStorage.setItem(LS_SPRINT, target.id);
      else localStorage.removeItem(LS_SPRINT);
    }
  }, [currentProjectId, currentSprintId]);

  useEffect(() => {
    reloadProjects();
    const onProjects = () => reloadProjects();
    window.addEventListener("projects:changed", onProjects);
    return () => window.removeEventListener("projects:changed", onProjects);
  }, [reloadProjects]);

  useEffect(() => {
    reloadSprints();
    const onSprints = () => reloadSprints();
    window.addEventListener("sprints:changed", onSprints);
    return () => window.removeEventListener("sprints:changed", onSprints);
  }, [reloadSprints]);

  const currentProject = useMemo(
    () => projects.find((p) => p.id === currentProjectId) ?? null,
    [projects, currentProjectId],
  );
  const currentSprint = useMemo(
    () => sprints.find((s) => s.id === currentSprintId) ?? null,
    [sprints, currentSprintId],
  );

  const value = useMemo<SprintContextValue>(
    () => ({
      projects,
      currentProjectId,
      setCurrentProjectId,
      sprints,
      currentSprintId,
      setCurrentSprintId,
      currentProject,
      currentSprint,
      reloadSprints,
    }),
    [
      projects,
      currentProjectId,
      setCurrentProjectId,
      sprints,
      currentSprintId,
      setCurrentSprintId,
      currentProject,
      currentSprint,
      reloadSprints,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSprintContext(): SprintContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("SprintProvider가 필요합니다");
  return v;
}

export function dispatchSprintsChanged() {
  window.dispatchEvent(new CustomEvent("sprints:changed"));
}
