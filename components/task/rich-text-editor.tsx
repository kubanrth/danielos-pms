"use client";

import { useEditor, EditorContent, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Link } from "@tiptap/extension-link";
import { Placeholder } from "@tiptap/extension-placeholder";
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Strikethrough,
  List,
  ListOrdered,
  Code2,
  Link as LinkIcon,
  Heading2,
  Quote,
} from "lucide-react";
import { useEffect, useState } from "react";

export type RichTextDoc = { type: "doc"; content?: unknown[] };

export interface RichTextEditorProps {
  // ProseMirror JSON doc. `null` renders an empty editor.
  initial: RichTextDoc | null;
  readOnly: boolean;
  // Hidden-input name — emits the current JSON stringified so a normal
  // <form> submit picks it up.
  name: string;
  placeholder?: string;
}

function isDocEmpty(doc: RichTextDoc | null): boolean {
  if (!doc) return true;
  const content = Array.isArray(doc.content) ? doc.content : [];
  if (content.length === 0) return true;
  if (content.length === 1) {
    const node = content[0] as { type?: string; content?: unknown[] };
    if (node?.type === "paragraph" && (!node.content || node.content.length === 0)) {
      return true;
    }
  }
  return false;
}

export function RichTextEditor({
  initial,
  readOnly,
  name,
  placeholder = "Kontekst, acceptance criteria, linki…",
}: RichTextEditorProps) {
  const [json, setJson] = useState<string>(
    initial && !isDocEmpty(initial) ? JSON.stringify(initial) : "",
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: "text-primary underline underline-offset-2",
        },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: (initial as JSONContent | null) ?? undefined,
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "tiptap-content min-h-[120px] focus:outline-none text-[0.98rem] leading-[1.6]",
      },
    },
    onUpdate: ({ editor }) => {
      const doc = editor.getJSON() as RichTextDoc;
      setJson(isDocEmpty(doc) ? "" : JSON.stringify(doc));
    },
  });

  // Sync editable in case the prop changes (rare, but cheap).
  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  return (
    <div className="flex flex-col gap-2">
      {!readOnly && <Toolbar editor={editor} />}
      <div
        className="rounded-md border border-border bg-transparent px-3 py-2 transition-colors focus-within:border-primary"
        data-readonly={readOnly ? "true" : "false"}
      >
        <EditorContent editor={editor} />
      </div>
      <input type="hidden" name={name} value={json} />
      <style>{`
        .tiptap-content p { margin: 0.25em 0; }
        .tiptap-content p:first-child { margin-top: 0; }
        .tiptap-content p:last-child { margin-bottom: 0; }
        .tiptap-content h2 { font-family: var(--font-display); font-size: 1.3rem; font-weight: 700; letter-spacing: -0.02em; margin: 0.8em 0 0.3em; }
        .tiptap-content h3 { font-family: var(--font-display); font-size: 1.08rem; font-weight: 600; letter-spacing: -0.01em; margin: 0.7em 0 0.25em; }
        .tiptap-content ul, .tiptap-content ol { padding-left: 1.4em; margin: 0.3em 0; }
        .tiptap-content ul { list-style: disc; }
        .tiptap-content ol { list-style: decimal; }
        .tiptap-content li > p { margin: 0.1em 0; }
        .tiptap-content code { background: var(--muted); padding: 0.1em 0.35em; border-radius: 0.25em; font-family: var(--font-mono); font-size: 0.9em; }
        .tiptap-content pre { background: var(--muted); padding: 0.7em 0.9em; border-radius: 0.5em; margin: 0.6em 0; overflow-x: auto; font-family: var(--font-mono); font-size: 0.88em; line-height: 1.5; }
        .tiptap-content pre code { background: transparent; padding: 0; }
        .tiptap-content blockquote { border-left: 2px solid var(--border); padding-left: 0.9em; color: var(--muted-foreground); margin: 0.5em 0; font-style: italic; }
        .tiptap-content p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: var(--muted-foreground);
          opacity: 0.55;
          float: left;
          pointer-events: none;
          height: 0;
        }
      `}</style>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) {
    return <div className="h-8" aria-hidden />;
  }

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL:", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Btn
        label="Nagłówek"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 size={14} />
      </Btn>
      <Btn
        label="Pogrubienie"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <BoldIcon size={14} />
      </Btn>
      <Btn
        label="Kursywa"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <ItalicIcon size={14} />
      </Btn>
      <Btn
        label="Przekreślenie"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough size={14} />
      </Btn>
      <span className="mx-1 h-4 w-px bg-border" aria-hidden />
      <Btn
        label="Lista punktowa"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={14} />
      </Btn>
      <Btn
        label="Lista numerowana"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={14} />
      </Btn>
      <span className="mx-1 h-4 w-px bg-border" aria-hidden />
      <Btn
        label="Cytat"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote size={14} />
      </Btn>
      <Btn
        label="Blok kodu"
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Code2 size={14} />
      </Btn>
      <Btn label="Link" active={editor.isActive("link")} onClick={setLink}>
        <LinkIcon size={14} />
      </Btn>
    </div>
  );
}

function Btn({
  children,
  label,
  active,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      data-active={active ? "true" : "false"}
      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[active=true]:bg-accent data-[active=true]:text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
    >
      {children}
    </button>
  );
}
