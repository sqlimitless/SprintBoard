import { ArrowLeft, Check } from "lucide-react";
import { Link } from "react-router-dom";
import AboutSection from "../components/AboutSection";
import TrashSection from "../components/TrashSection";
import { useTheme, type ThemeMode } from "../theme/ThemeProvider";

const OPTIONS: { value: ThemeMode; label: string; hint: string }[] = [
  { value: "light", label: "Light", hint: "항상 라이트 테마" },
  { value: "dark", label: "Dark", hint: "항상 다크 테마" },
  { value: "system", label: "System", hint: "OS 설정을 따름" },
];

export default function Settings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex h-screen w-screen flex-col overflow-auto bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <header className="flex items-center gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-800">
        <Link
          to="/"
          className="flex items-center gap-1 rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <ArrowLeft size={14} />
          <span>Back</span>
        </Link>
        <h1 className="text-lg font-semibold">Settings</h1>
      </header>

      <div className="mx-auto w-full max-w-2xl space-y-8 px-6 py-8">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Appearance
          </h2>
          <div className="rounded-lg border border-gray-200 dark:border-gray-800">
            {OPTIONS.map((opt, idx) => {
              const selected = theme === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTheme(opt.value)}
                  className={
                    "flex w-full items-center justify-between px-4 py-3 text-left " +
                    (idx > 0
                      ? "border-t border-gray-200 dark:border-gray-800 "
                      : "") +
                    "hover:bg-gray-50 dark:hover:bg-gray-900"
                  }
                >
                  <div>
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {opt.hint}
                    </div>
                  </div>
                  {selected && (
                    <Check size={16} className="text-blue-600 dark:text-blue-400" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <AboutSection />

        <TrashSection />
      </div>
    </div>
  );
}
