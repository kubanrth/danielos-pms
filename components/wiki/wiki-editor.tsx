"use client";

import { startTransition, useState } from "react";
import { BookOpen, Check } from "lucide-react";
import { RichTextEditor, type RichTextDoc } from "@/components/task/rich-text-editor";
import { updateWikiPageAction } from "@/app/(app)/w/[workspaceId]/wiki/actions";

export function WikiEditor({
  workspaceId,
  initial,
  canEdit,
}: {
  workspaceId: string;
  initial: { title: string; contentJson: RichTextDoc | null };
  canEdit: boolean;
}) {
  const [saved, setSaved] = useState(false);

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await updateWikiPageAction(fd);
          setSaved(true);
          setTimeout(() => setSaved(false), 1400);
        })
      }
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="workspaceId" value={workspaceId} />

      <div className="flex items-start gap-3">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"
          aria-hidden
        >
          <BookOpen size={16} />
        </span>
        <input
          name="title"
          required
          defaultValue={initial.title}
          readOnly={!canEdit}
          maxLength={120}
          className="flex-1 border-b border-border bg-transparent pb-2 font-display text-[2.2rem] font-bold leading-[1.1] tracking-[-0.03em] outline-none focus:border-primary"
        />
      </div>

      <RichTextEditor
        name="contentJson"
        initial={initial.contentJson}
        readOnly={!canEdit}
        placeholder="Opisz projekt: cel, kluczowe osoby, decyzje, linki, cokolwiek."
      />

      {canEdit && (
        <div className="flex items-center gap-4">
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-gradient px-5 font-sans text-[0.9rem] font-semibold text-white shadow-brand transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Zapisz wiki
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1.5 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-primary">
              <Check size={12} /> zapisano
            </span>
          )}
        </div>
      )}
    </form>
  );
}
