import { Route, Routes } from "react-router-dom";
import ExplorerTree from "../components/ExplorerTree";
import RightPane from "../components/RightPane";

export default function AppLayout() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-72 shrink-0 flex-col border-r border-gray-200 dark:border-gray-800">
          <ExplorerTree />
        </aside>
        <main className="flex min-w-0 flex-1">
          <Routes>
            <Route path="p" element={<RightPane />} />
            <Route path="p/:projectId" element={<RightPane />} />
            <Route path="p/:projectId/e/:epicId" element={<RightPane />} />
            <Route
              path="p/:projectId/e/:epicId/s/:storyId"
              element={<RightPane />}
            />
            <Route path="*" element={<RightPane />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
