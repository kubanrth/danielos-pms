import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { WikiEditor } from "@/components/wiki/wiki-editor";
import type { RichTextDoc } from "@/components/task/rich-text-editor";

// Auto-creates a default WikiPage for workspaces that predate F8 so every
// user gets a landing doc on first visit instead of a 404.
async function ensureWikiPage(workspaceId: string, workspaceName: string) {
  const existing = await db.wikiPage.findUnique({ where: { workspaceId } });
  if (existing) return existing;

  return db.wikiPage.create({
    data: {
      workspaceId,
      title: "O projekcie",
      contentJson: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: workspaceName }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text:
                  "Opisz tutaj cel projektu, kluczowych ludzi, kamienie milowe i wszystko, co powinno być pod ręką.",
              },
            ],
          },
        ],
      },
    },
  });
}

export default async function WorkspaceWikiPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!workspace) notFound();

  const wiki = await ensureWikiPage(workspaceId, workspace.name);
  const canEdit = can(ctx.role, "wiki.edit");

  return (
    <main className="flex-1 px-8 py-12 md:px-14 md:py-16">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Wiki · {workspace.name}</span>
          <p className="max-w-[56ch] text-[0.9rem] leading-[1.55] text-muted-foreground">
            Jedna strona, w której zapisujecie wszystko, czego nie chcecie
            szukać po komentarzach i Slacku. Niezbędnik projektu.
          </p>
        </div>

        <WikiEditor
          workspaceId={workspaceId}
          initial={{
            title: wiki.title,
            contentJson: (wiki.contentJson ?? null) as RichTextDoc | null,
          }}
          canEdit={canEdit}
        />
      </div>
    </main>
  );
}
