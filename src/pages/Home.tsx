import { useState } from "react";
import Sidebar from "../components/Sidebar";

type Selection =
  | { kind: "backlog"; projectId: string }
  | { kind: "sprint"; projectId: string; sprintId: string }
  | null;

export default function Home() {
  const [selection, setSelection] = useState<Selection>(null);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <Sidebar selection={selection} onSelect={setSelection} />
      <main className="flex-1 overflow-auto">
        <RightPanel selection={selection} />
      </main>
    </div>
  );
}

function RightPanel({ selection }: { selection: Selection }) {
  if (!selection) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400 dark:text-gray-500">
        <p className="text-sm">Select a project to get started.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center text-gray-400 dark:text-gray-500">
      <p className="text-sm">
        {selection.kind === "backlog"
          ? "Backlog view — coming soon"
          : "Sprint board — coming soon"}
      </p>
    </div>
  );
}
