import { LayoutList, Rows3, Settings as SettingsIcon } from "lucide-react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import ExplorerTree from "../components/ExplorerTree";
import RightPane from "../components/RightPane";
import Backlog from "../pages/Backlog";
import SprintBoard from "../pages/SprintBoard";

export default function AppLayout() {
  const loc = useLocation();
  const isBacklog = loc.pathname.startsWith("/backlog");

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <TopTabs active={isBacklog ? "backlog" : "sprint"} />
      <div className="flex min-h-0 flex-1">
        <Routes>
          <Route path="/backlog/*" element={<BacklogShell />} />
          <Route path="/*" element={<SprintBoard />} />
        </Routes>
      </div>
    </div>
  );
}

function TopTabs({ active }: { active: "sprint" | "backlog" }) {
  return (
    <div className="flex shrink-0 items-center border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
      <TabLink to="/" label="스프린트 보드" icon={<Rows3 size={14} />} active={active === "sprint"} />
      <TabLink to="/backlog" label="백로그" icon={<LayoutList size={14} />} active={active === "backlog"} />
      <div className="ml-auto pr-2">
        <Link
          to="/settings"
          title="Settings"
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
        >
          <SettingsIcon size={14} />
        </Link>
      </div>
    </div>
  );
}

function TabLink({
  to,
  label,
  icon,
  active,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={
        "flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm transition-colors " +
        (active
          ? "border-blue-500 text-blue-600 dark:text-blue-400"
          : "border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200")
      }
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function BacklogShell() {
  return (
    <>
      <aside className="flex w-72 shrink-0 flex-col border-r border-gray-200 dark:border-gray-800">
        <ExplorerTree />
      </aside>
      <main className="flex min-w-0 flex-1">
        <Routes>
          <Route path="/" element={<Backlog />} />
          <Route path="/p" element={<RightPane />} />
          <Route path="/p/:projectId" element={<RightPane />} />
          <Route path="/p/:projectId/e/:epicId" element={<RightPane />} />
          <Route
            path="/p/:projectId/e/:epicId/s/:storyId"
            element={<RightPane />}
          />
          <Route path="*" element={<RightPane />} />
        </Routes>
      </main>
    </>
  );
}
