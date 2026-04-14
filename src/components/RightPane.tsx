import {
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import * as projectRepo from "../lib/db/project.repo";
import { PROJECT_STATUSES, type Project } from "../lib/db/types";
import ChildIssueSection from "./ChildIssueSection";
import IssueDetailPanel from "./IssueDetailPanel";
import KanbanBoard from "./KanbanBoard";
import MetaMenu from "./MetaMenu";
import ProjectForm from "./ProjectForm";
import { RichTextView } from "./RichTextEditor";

export default function RightPane() {
  const params = useParams<{
    projectId?: string;
    epicId?: string;
    storyId?: string;
  }>();
  const loc = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(loc.search);
  const taskId = query.get("task");
  const newFlag = query.get("new") === "1";
  const editFlag = query.get("edit") === "1";

  const [project, setProject] = useState<Project | null>(null);
  const [detailOpen, setDetailOpen] = useState<boolean>(() => {
    const raw = localStorage.getItem("sprint-board.detailOpen");
    return raw === null ? true : raw === "1";
  });
  const [detailMax, setDetailMax] = useState<boolean>(() => {
    return localStorage.getItem("sprint-board.detailMax") === "1";
  });
  function toggleDetail() {
    setDetailOpen((v) => {
      const next = !v;
      localStorage.setItem("sprint-board.detailOpen", next ? "1" : "0");
      if (!next) {
        // collapsing — drop maximize too
        localStorage.setItem("sprint-board.detailMax", "0");
        setDetailMax(false);
      }
      return next;
    });
  }
  function toggleMax() {
    setDetailMax((v) => {
      const next = !v;
      localStorage.setItem("sprint-board.detailMax", next ? "1" : "0");
      return next;
    });
  }


  useEffect(() => {
    if (params.projectId) projectRepo.getProject(params.projectId).then(setProject);
    else setProject(null);
  }, [params.projectId]);

  // New project form
  if (newFlag && !params.projectId) {
    return (
      <div className="flex min-w-0 flex-1">
        <ProjectForm mode="create" />
      </div>
    );
  }

  // Edit existing project
  if (editFlag && params.projectId && project) {
    return (
      <div className="flex min-w-0 flex-1">
        <ProjectForm
          mode="edit"
          project={project}
          onSaved={(p) => {
            setProject(p);
            navigate(`/backlog/p/${p.id}`);
          }}
        />
      </div>
    );
  }

  let boardNode: React.ReactNode = null;
  let detailId: string | null = null;

  if (params.storyId) {
    boardNode = (
      <KanbanBoard
        key={`s:${params.storyId}`}
        parentId={params.storyId}
        level="task"
        onSelect={(id) =>
          navigate(
            `/backlog/p/${params.projectId}/e/${params.epicId}/s/${params.storyId}?task=${id}`,
          )
        }
        selectedId={taskId ?? undefined}
      />
    );
    detailId = taskId ?? params.storyId;
  } else if (params.epicId) {
    boardNode = (
      <KanbanBoard
        key={`e:${params.epicId}`}
        parentId={params.epicId}
        level="story"
        onSelect={(id) => navigate(`/backlog/p/${params.projectId}/e/${params.epicId}/s/${id}`)}
      />
    );
    detailId = params.epicId;
  } else if (params.projectId) {
    boardNode = <ProjectOverview project={project} />;
    detailId = null;
  } else {
    boardNode = (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        왼쪽 탐색기에서 프로젝트를 선택하거나 새로 만드세요.
      </div>
    );
  }

  const asideWidth = !detailOpen ? "2rem" : "24rem";
  const asideLeft = detailMax ? "0px" : `calc(100% - ${asideWidth})`;
  const asideTransition = detailMax
    ? "left 360ms cubic-bezier(0.4, 0.0, 0.2, 1)"
    : detailOpen
      ? "left 420ms cubic-bezier(0.34, 1.56, 0.64, 1)"
      : "left 320ms cubic-bezier(0.4, 0.0, 0.2, 1)";

  return (
    <div className="relative flex min-w-0 flex-1">
      <div
        key={loc.key}
        style={detailId ? { paddingRight: asideWidth, transition: "padding-right 360ms cubic-bezier(0.4, 0.0, 0.2, 1)" } : undefined}
        className="sb-page-in flex min-w-0 flex-1 flex-col"
      >
        {boardNode}
      </div>
      {detailId && (
        <aside
          style={{
            left: asideLeft,
            right: 0,
            top: 0,
            bottom: 0,
            transition: asideTransition,
          }}
          className={
            "absolute z-10 flex flex-col overflow-hidden border-l border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950"
          }
        >
          <div
            className={
              "flex items-center gap-0.5 border-b border-gray-200 py-1 dark:border-gray-800 " +
              (detailOpen ? "justify-start px-2" : "justify-center px-0")
            }
          >
            <button
              onClick={toggleDetail}
              title={detailOpen ? "상세 접기" : "상세 열기"}
              className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            >
              {detailOpen ? (
                <PanelRightClose size={14} />
              ) : (
                <PanelRightOpen size={14} />
              )}
            </button>
            {detailOpen && (
              <button
                onClick={toggleMax}
                title={detailMax ? "상세 축소" : "상세 확대"}
                className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100"
              >
                {detailMax ? (
                  <Minimize2 size={14} />
                ) : (
                  <Maximize2 size={14} />
                )}
              </button>
            )}
          </div>
          <div
            className={
              "flex-1 overflow-hidden transition-opacity duration-200 " +
              (detailOpen ? "opacity-100" : "pointer-events-none opacity-0")
            }
          >
            <IssueDetailPanel issueId={detailId} />
          </div>
        </aside>
      )}
    </div>
  );
}

function ProjectOverview({ project }: { project: Project | null }) {
  const navigate = useNavigate();
  if (!project)
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        로딩 중...
      </div>
    );
  const statusLabel =
    PROJECT_STATUSES.find((s) => s.value === project.status)?.label ?? project.status;

  async function handleDelete() {
    if (!project) return;
    try {
      await projectRepo.deleteProject(project.id);
      window.dispatchEvent(new CustomEvent("projects:changed"));
      navigate("/backlog/p");
    } catch (err) {
      console.error(err);
      alert(`삭제 실패\n${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
        <div className="min-w-0">
          <div className="font-mono text-xs text-gray-500">{project.key}</div>
          <h1 className="mt-0.5 truncate text-xl font-semibold">{project.name}</h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(`/backlog/p/${project.id}?edit=1`)}
            className="flex items-center gap-1 rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <Pencil size={14} /> 편집
          </button>
          <MetaMenu
            entityType="project"
            entityId={project.id}
            createdAt={project.created_at}
            onDelete={handleDelete}
          />
        </div>
      </div>

      <div className="grid max-w-3xl grid-cols-2 gap-4 px-6 py-4 text-sm">
        <Meta label="상태" value={statusLabel} />
        <Meta label="생성일" value={new Date(project.created_at).toLocaleString()} />
      </div>

      <div className="px-6 pb-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          설명
        </div>
        {project.description?.trim() ? (
          <div className="rounded border border-gray-200 px-4 py-3 dark:border-gray-800">
            <RichTextView value={project.description} />
          </div>
        ) : (
          <div className="text-sm text-gray-400">설명이 없습니다.</div>
        )}
      </div>

      <ChildIssueSection
        projectId={project.id}
        parentId={null}
        childType="epic"
      />
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}
