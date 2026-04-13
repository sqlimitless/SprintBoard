import {
  Bold,
  Code,
  Eraser,
  FileCode,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Type,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Markdown } from "tiptap-markdown";
import { useEffect, useRef, useState } from "react";
import { saveImage } from "../lib/attachments";

type EditorProps = {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  minHeight?: number | string;
  /**
   * Scope for saved image files (e.g. project id). Controls the subdirectory
   * under app-data `attachments/` so purge can clean them up.
   */
  attachmentScope?: string;
};

const BASE_EXTENSIONS = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
  Underline,
  Link.configure({
    openOnClick: false,
    autolink: true,
    HTMLAttributes: { class: "text-blue-600 underline dark:text-blue-400" },
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Highlight.configure({ multicolor: true }),
  Image.configure({
    inline: false,
    allowBase64: false,
    HTMLAttributes: { class: "rounded max-h-96 my-2" },
  }),
  TextStyle,
  Color,
  // html: true — Underline/Highlight 등 비표준 마크다운 노드를 HTML로 round-trip.
  Markdown.configure({ html: true, linkify: true, breaks: false }),
];

function getMarkdown(editor: Editor): string {
  return (
    editor.storage as unknown as { markdown: { getMarkdown(): string } }
  ).markdown.getMarkdown();
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 240,
  attachmentScope,
}: EditorProps) {
  const minH = typeof minHeight === "number" ? `${minHeight}px` : minHeight;
  // Keep the latest scope in a ref so paste/drop handlers (initialized once)
  // always see the current value without re-creating the editor.
  const scopeRef = useRef(attachmentScope);
  useEffect(() => {
    scopeRef.current = attachmentScope;
  }, [attachmentScope]);

  async function insertImageFiles(editorInst: Editor, files: File[]) {
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const { url } = await saveImage(file, {
          projectId: scopeRef.current,
          filename: file.name,
        });
        editorInst.chain().focus().setImage({ src: url, alt: file.name }).run();
      } catch (err) {
        console.error("image save failed:", err);
        alert(
          `이미지 저장 실패\n${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  const editor = useEditor({
    extensions: [
      ...BASE_EXTENSIONS,
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: value,
    onUpdate({ editor }) {
      onChange(getMarkdown(editor));
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none px-3 py-2",
        style: `min-height: ${minH};`,
      },
      handlePaste(_view, event) {
        const items = event.clipboardData?.items;
        if (!items) return false;
        const files: File[] = [];
        for (const it of items) {
          if (it.kind === "file") {
            const f = it.getAsFile();
            if (f && f.type.startsWith("image/")) files.push(f);
          }
        }
        if (files.length === 0) return false;
        event.preventDefault();
        if (editor) insertImageFiles(editor, files);
        return true;
      },
      handleDrop(_view, event) {
        const dt = (event as DragEvent).dataTransfer;
        if (!dt || dt.files.length === 0) return false;
        const files = Array.from(dt.files).filter((f) =>
          f.type.startsWith("image/"),
        );
        if (files.length === 0) return false;
        event.preventDefault();
        if (editor) insertImageFiles(editor, files);
        return true;
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = getMarkdown(editor);
    if (current !== value) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="rounded border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

export function RichTextView({ value }: { value: string }) {
  const editor = useEditor({
    extensions: BASE_EXTENSIONS,
    content: value,
    editable: false,
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(value || "", { emitUpdate: false });
  }, [value, editor]);

  if (!editor) return null;
  return <EditorContent editor={editor} />;
}

// ------------------------------ Toolbar ------------------------------

type BtnProps = {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
};

function Btn({ onClick, active, disabled, title, children }: BtnProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={
        "rounded px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40 " +
        (active
          ? "bg-gray-200 dark:bg-gray-700"
          : "hover:bg-gray-100 dark:hover:bg-gray-800")
      }
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 w-px self-stretch bg-gray-200 dark:bg-gray-700" />;
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 px-2 py-1 dark:border-gray-700">
      <Btn
        title="Undo"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
      >
        <Undo2 size={14} />
      </Btn>
      <Btn
        title="Redo"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
      >
        <Redo2 size={14} />
      </Btn>
      <Divider />
      <Btn
        title="Bold"
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
      >
        <Bold size={14} />
      </Btn>
      <Btn
        title="Italic"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
      >
        <Italic size={14} />
      </Btn>
      <Btn
        title="Underline"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive("underline")}
      >
        <UnderlineIcon size={14} />
      </Btn>
      <Btn
        title="Strikethrough"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive("strike")}
      >
        <Strikethrough size={14} />
      </Btn>
      <ColorDropdown
        title="Text color"
        icon={<Type size={14} />}
        underlineColor={
          (editor.getAttributes("textStyle").color as string | undefined) ?? null
        }
        swatches={TEXT_COLORS}
        onPick={(c) => {
          if (c === null) editor.chain().focus().unsetColor().run();
          else editor.chain().focus().setColor(c).run();
        }}
      />
      <ColorDropdown
        title="Highlight"
        icon={<Highlighter size={14} />}
        highlightColor={
          (editor.getAttributes("highlight").color as string | undefined) ?? null
        }
        swatches={HIGHLIGHT_COLORS}
        onPick={(c) => {
          if (c === null) editor.chain().focus().unsetHighlight().run();
          else editor.chain().focus().toggleHighlight({ color: c }).run();
        }}
      />
      <Divider />
      <Btn
        title="Heading 1"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive("heading", { level: 1 })}
      >
        <Heading1 size={14} />
      </Btn>
      <Btn
        title="Heading 2"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
      >
        <Heading2 size={14} />
      </Btn>
      <Btn
        title="Heading 3"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })}
      >
        <Heading3 size={14} />
      </Btn>
      <Divider />
      <Btn
        title="Bullet list"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
      >
        <List size={14} />
      </Btn>
      <Btn
        title="Ordered list"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
      >
        <ListOrdered size={14} />
      </Btn>
      <Btn
        title="Task list"
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        active={editor.isActive("taskList")}
      >
        <ListChecks size={14} />
      </Btn>
      <Divider />
      <LinkButton editor={editor} />
      <Btn
        title="Inline code"
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive("code")}
      >
        <Code size={14} />
      </Btn>
      <Btn
        title="Code block"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive("codeBlock")}
      >
        <FileCode size={14} />
      </Btn>
      <Btn
        title="Blockquote"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
      >
        <Quote size={14} />
      </Btn>
      <Btn
        title="Horizontal rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus size={14} />
      </Btn>
      <Divider />
      <Btn
        title="Clear formatting"
        onClick={() =>
          editor.chain().focus().unsetAllMarks().clearNodes().run()
        }
      >
        <Eraser size={14} />
      </Btn>
    </div>
  );
}

// ------------------------------ Link popover ------------------------------

function LinkButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const active = editor.isActive("link");

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openPopover() {
    const existing = editor.getAttributes("link").href as string | undefined;
    setUrl(existing ?? "https://");
    setOpen(true);
  }

  function apply() {
    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: trimmed })
        .run();
    }
    setOpen(false);
  }

  function remove() {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title="Link"
        onMouseDown={(e) => {
          // Keep editor selection intact when clicking the button.
          e.preventDefault();
          openPopover();
        }}
        className={
          "rounded px-2 py-1 text-xs " +
          (active
            ? "bg-gray-200 dark:bg-gray-700"
            : "hover:bg-gray-100 dark:hover:bg-gray-800")
        }
      >
        <LinkIcon size={14} />
      </button>
      {open && (
        <div className="sb-pop-in absolute left-0 top-full z-20 mt-1 w-72 rounded-lg border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-700 dark:bg-gray-900">
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                apply();
              }
            }}
            placeholder="https://example.com"
            className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm outline-none focus:border-blue-400 dark:border-gray-700 dark:bg-gray-950"
          />
          <div className="mt-2 flex items-center justify-end gap-1">
            {active && (
              <button
                type="button"
                onClick={remove}
                className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
              >
                제거
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              취소
            </button>
            <button
              type="button"
              onClick={apply}
              className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500"
            >
              적용
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------ Color Dropdown ------------------------------

const TEXT_COLORS = [
  "#111827", // near-black
  "#6b7280", // gray
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
];

const HIGHLIGHT_COLORS = [
  "#fef08a", // yellow-200
  "#fecaca", // red-200
  "#fed7aa", // orange-200
  "#bbf7d0", // green-200
  "#bfdbfe", // blue-200
  "#e9d5ff", // violet-200
  "#fbcfe8", // pink-200
  "#e5e7eb", // gray-200
];

type ColorDropdownProps = {
  title: string;
  icon: React.ReactNode;
  swatches: string[];
  onPick: (color: string | null) => void;
  underlineColor?: string | null;
  highlightColor?: string | null;
};

function ColorDropdown({
  title,
  icon,
  swatches,
  onPick,
  underlineColor,
  highlightColor,
}: ColorDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const indicator = underlineColor ?? highlightColor ?? undefined;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title={title}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center rounded px-2 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <span style={underlineColor ? { color: underlineColor } : undefined}>
          {icon}
        </span>
        <span
          className="ml-1 inline-block h-2 w-3 rounded-sm border border-gray-300 dark:border-gray-600"
          style={{ backgroundColor: indicator ?? "transparent" }}
        />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-10 mt-2 w-32 rounded-lg border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {title}
          </div>
          <div className="grid grid-cols-5 gap-0.5">
            {swatches.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                onClick={() => {
                  onPick(c);
                  setOpen(false);
                }}
                className="h-4 w-4 rounded-md border border-gray-300 transition hover:scale-150 dark:border-gray-600"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              onPick(null);
              setOpen(false);
            }}
            className="mt-3 w-full rounded border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
