import { useCallback, useEffect, useRef, useState } from "react";
import { Editor, EditorContent, Extension, useEditor } from "@tiptap/react";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { Markdown } from "tiptap-markdown";

import { PageBreaks, PAGE_LAYOUT } from "../lib/pageBreaks";

const BlankHighlight = Extension.create({
  name: "blankHighlight",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;
              const re = /\$\$/g;
              let m: RegExpExecArray | null;
              while ((m = re.exec(node.text)) !== null) {
                decorations.push(
                  Decoration.inline(pos + m.index, pos + m.index + 2, {
                    class: "nv-blank",
                  }),
                );
              }
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

function getMarkdown(editor: Editor): string {
  // tiptap-markdown exposes `getMarkdown()` via editor.storage.markdown
  const storage = editor.storage as { markdown?: { getMarkdown: () => string } };
  return storage.markdown?.getMarkdown() ?? "";
}

export function NotesEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
}) {
  // Tracks whether the most recent value change came from us (the editor) or
  // from outside (parent reassigned `value` — e.g. after an AI merge).
  const isLocalChange = useRef(false);

  // Page count reported by the PageBreaks plugin after measurement.
  const [pageCount, setPageCount] = useState(1);
  const handlePageCount = useCallback((n: number) => setPageCount(n), []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // We're not using StarterKit's history shortcuts for anything custom;
        // its defaults are fine. Keep heading levels 1-4 to match Word vibe.
        heading: { levels: [1, 2, 3, 4] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Placeholder.configure({
        placeholder:
          placeholder ??
          "Write your notes here. Use the toolbar for formatting. Type $$ where you want the AI to fill in a definition.",
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      PageBreaks.configure({ onPageCount: handlePageCount }),
      Markdown.configure({
        html: false,
        tightLists: true,
        bulletListMarker: "-",
        linkify: false,
        breaks: false,
        transformPastedText: true,
      }),
      BlankHighlight,
    ],
    content: value,
    onUpdate({ editor }) {
      isLocalChange.current = true;
      onChange(getMarkdown(editor));
    },
    editorProps: {
      attributes: {
        class: "notes-view notes-editor-content",
        spellcheck: "true",
      },
    },
  });

  // Push external value changes into the editor (e.g. AI merge result).
  useEffect(() => {
    if (!editor) return;
    if (isLocalChange.current) {
      isLocalChange.current = false;
      return;
    }
    const current = getMarkdown(editor);
    if (current !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <div className="rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-500">
        Loading editor…
      </div>
    );
  }

  return (
    <div className="notes-editor-shell rounded-md bg-slate-950 border border-slate-700 overflow-hidden">
      <Toolbar editor={editor} />
      <div className="notes-editor-scroller">
        <div
          className="notes-pages-wrapper"
          style={{
            minHeight: `${pageCount * PAGE_LAYOUT.height + (pageCount - 1) * PAGE_LAYOUT.gap}px`,
          }}
        >
          <div className="notes-pages-overlay" aria-hidden>
            {Array.from({ length: pageCount }).map((_, i) => (
              <div
                key={i}
                className="notes-page-rect"
                style={{ top: `${i * PAGE_LAYOUT.stride}px` }}
              >
                <div className="notes-page-footer no-print">
                  Page {i + 1} of {pageCount}
                </div>
              </div>
            ))}
          </div>
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}

// ----- Toolbar -----

const HEADING_LEVELS = [1, 2, 3, 4] as const;
type HeadingLevel = (typeof HEADING_LEVELS)[number];

// Toggle-style buttons: { name } drives both `isActive` and the toggle command
// (via the closure). Order in the array is render order in the toolbar.
type ToggleItem = {
  name: string;
  toggle: (editor: Editor) => void;
  icon: React.ReactNode;
  title: string;
};

const INLINE_MARKS: ToggleItem[] = [
  { name: "bold",      toggle: (e) => e.chain().focus().toggleBold().run(),      icon: <b>B</b>,   title: "Bold (Ctrl+B)" },
  { name: "italic",    toggle: (e) => e.chain().focus().toggleItalic().run(),    icon: <i>I</i>,   title: "Italic (Ctrl+I)" },
  { name: "underline", toggle: (e) => e.chain().focus().toggleUnderline().run(), icon: <u>U</u>,   title: "Underline (Ctrl+U)" },
  { name: "strike",    toggle: (e) => e.chain().focus().toggleStrike().run(),    icon: <s>S</s>,   title: "Strikethrough" },
  { name: "code",      toggle: (e) => e.chain().focus().toggleCode().run(),      icon: "<>",       title: "Inline code" },
];

const BLOCK_TOGGLES: ToggleItem[] = [
  { name: "bulletList",  toggle: (e) => e.chain().focus().toggleBulletList().run(),  icon: "•",  title: "Bullet list" },
  { name: "orderedList", toggle: (e) => e.chain().focus().toggleOrderedList().run(), icon: "1.", title: "Numbered list" },
  { name: "blockquote",  toggle: (e) => e.chain().focus().toggleBlockquote().run(),  icon: "❝",  title: "Quote" },
  { name: "codeBlock",   toggle: (e) => e.chain().focus().toggleCodeBlock().run(),   icon: "{}", title: "Code block" },
];

const TABLE_ACTIONS: { run: (editor: Editor) => void; icon: string; title: string }[] = [
  { run: (e) => e.chain().focus().addColumnAfter().run(),   icon: "+col",   title: "Add column after" },
  { run: (e) => e.chain().focus().addRowAfter().run(),      icon: "+row",   title: "Add row after" },
  { run: (e) => e.chain().focus().deleteColumn().run(),     icon: "-col",   title: "Delete column" },
  { run: (e) => e.chain().focus().deleteRow().run(),        icon: "-row",   title: "Delete row" },
  { run: (e) => e.chain().focus().toggleHeaderRow().run(),  icon: "⥣ hdr", title: "Toggle header row" },
  { run: (e) => e.chain().focus().deleteTable().run(),      icon: "✕ tbl", title: "Delete table" },
];

function Toolbar({ editor }: { editor: Editor }) {
  const activeLevel: HeadingLevel | undefined = HEADING_LEVELS.find((lvl) =>
    editor.isActive("heading", { level: lvl }),
  );
  const blockValue: string = activeLevel ? String(activeLevel) : "p";

  function setBlock(value: string) {
    if (value === "p") {
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().toggleHeading({ level: Number(value) as HeadingLevel }).run();
    }
  }

  function setLink() {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL (leave blank to remove)", prev ?? "");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div className="no-print flex flex-wrap items-center gap-1 border-b border-slate-800 bg-slate-900/80 px-2 py-1.5">
      <select
        value={blockValue}
        onChange={(e) => setBlock(e.target.value)}
        className="rounded bg-slate-950 border border-slate-700 px-2 py-0.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-600"
        title="Heading / paragraph"
      >
        <option value="p">Paragraph</option>
        {HEADING_LEVELS.map((lvl) => (
          <option key={lvl} value={String(lvl)}>Heading {lvl}</option>
        ))}
      </select>

      <Sep />

      {INLINE_MARKS.map((m) => (
        <TBtn key={m.name} active={editor.isActive(m.name)} onClick={() => m.toggle(editor)} title={m.title}>
          {m.icon}
        </TBtn>
      ))}

      <Sep />

      {BLOCK_TOGGLES.map((b) => (
        <TBtn key={b.name} active={editor.isActive(b.name)} onClick={() => b.toggle(editor)} title={b.title}>
          {b.icon}
        </TBtn>
      ))}
      <TBtn
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal rule"
      >
        —
      </TBtn>

      <Sep />

      <TBtn active={editor.isActive("link")} onClick={setLink} title="Link">
        🔗
      </TBtn>
      <TBtn
        onClick={() => editor.chain().focus().insertContent("$$").run()}
        title="Insert $$ blank — AI fills based on preceding term"
      >
        $$
      </TBtn>
      <TBtn
        onClick={() => {
          // Insert "$$  $$" and put the cursor between the fences.
          editor.chain().focus().insertContent("$$$$").run();
          // The 4-char insert above lands cursor at the end. Step back 2 to be
          // between the fences so the user can immediately type the instruction.
          const { from } = editor.state.selection;
          editor.commands.setTextSelection({ from: from - 2, to: from - 2 });
        }}
        title="Insert $$instruction$$ blank — AI follows your instruction"
      >
        $$…$$
      </TBtn>

      <Sep />

      {editor.isActive("table") ? (
        TABLE_ACTIONS.map((a) => (
          <TBtn key={a.title} onClick={() => a.run(editor)} title={a.title}>
            {a.icon}
          </TBtn>
        ))
      ) : (
        <TBtn
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
          title="Insert table (3×3)"
        >
          ⊞
        </TBtn>
      )}

      <Sep />

      <TBtn
        onClick={() => editor.chain().focus().undo().run()}
        title="Undo (Ctrl+Z)"
        disabled={!editor.can().undo()}
      >
        ↶
      </TBtn>
      <TBtn
        onClick={() => editor.chain().focus().redo().run()}
        title="Redo (Ctrl+Y)"
        disabled={!editor.can().redo()}
      >
        ↷
      </TBtn>

      <Sep />

      <TBtn
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        title="Clear formatting"
      >
        ⨯ fmt
      </TBtn>
    </div>
  );
}

function TBtn({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={
        "inline-flex items-center justify-center rounded min-w-[1.9rem] h-7 px-1.5 text-xs transition " +
        (active
          ? "bg-emerald-700 text-white"
          : "bg-slate-950 text-slate-200 hover:bg-slate-800 border border-slate-700") +
        " disabled:opacity-40 disabled:cursor-not-allowed"
      }
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="mx-1 h-5 w-px bg-slate-700" aria-hidden />;
}
