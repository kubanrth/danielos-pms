// Demo seed — run with: npm run db:seed
// Loads DATABASE_URL from .env.

import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { Role, ViewType } from "../lib/generated/prisma/enums";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("danielos-demo-2026", 12);

  const admin = await db.user.upsert({
    where: { email: "admin@danielos.local" },
    update: {},
    create: {
      email: "admin@danielos.local",
      name: "Daniel Admin",
      passwordHash,
      isSuperAdmin: true,
      emailVerified: new Date(),
    },
  });

  const member = await db.user.upsert({
    where: { email: "member@danielos.local" },
    update: {},
    create: {
      email: "member@danielos.local",
      name: "Anna Member",
      passwordHash,
      emailVerified: new Date(),
    },
  });

  const workspace = await db.workspace.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      name: "Demo Workspace",
      slug: "demo",
      ownerId: admin.id,
      memberships: {
        create: [
          { userId: admin.id, role: Role.ADMIN },
          { userId: member.id, role: Role.MEMBER },
        ],
      },
    },
  });

  const board = await db.board.create({
    data: {
      workspaceId: workspace.id,
      creatorId: admin.id,
      name: "Sprint 1",
      description: "Pierwszy sprint demo",
      statusColumns: {
        create: [
          { name: "Do zrobienia", colorHex: "#64748B", order: 0 },
          { name: "W trakcie", colorHex: "#F59E0B", order: 1 },
          { name: "Testy", colorHex: "#3B82F6", order: 2 },
          { name: "Done", colorHex: "#10B981", order: 3 },
        ],
      },
      views: {
        create: [
          { type: ViewType.TABLE, configJson: {}, background: { kind: "color", value: "#F8FAFC" } },
          { type: ViewType.KANBAN, configJson: {}, background: { kind: "color", value: "#F8FAFC" } },
          { type: ViewType.ROADMAP, configJson: {}, background: { kind: "color", value: "#F8FAFC" } },
        ],
      },
    },
    include: { statusColumns: true },
  });

  const urgent = await db.tag.create({
    data: {
      workspaceId: workspace.id,
      name: "urgent",
      colorHex: "#EF4444",
      creatorId: admin.id,
    },
  });

  await db.task.create({
    data: {
      workspaceId: workspace.id,
      boardId: board.id,
      statusColumnId: board.statusColumns[0].id,
      creatorId: admin.id,
      title: "Zaprojektować logo DANIELOS",
      rowOrder: 1.0,
      assignees: { create: [{ userId: member.id }] },
      tags: { create: [{ tagId: urgent.id }] },
    },
  });

  console.log("Seed complete:", { admin: admin.email, member: member.email, workspace: workspace.slug });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
