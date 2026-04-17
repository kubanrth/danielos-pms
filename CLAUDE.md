@AGENTS.md

# DANIELOS PMS — Projekt-level rules

## Context
ClickUp-like SaaS dla klienta DANIELOS. Pełna funkcjonalna aplikacja (workspaces, Kanban, Tabela, Roadmapa, Whiteboard, panel admina). Plan wykonawczy: [../../../.claude/plans/dostalem-plan-na-strone-reactive-barto.md](../../../.claude/plans/dostalem-plan-na-strone-reactive-barto.md).

## Stack
- Next.js 16 (App Router) + React 19 + TypeScript
- Prisma 7 (client output: `lib/generated/prisma`)
- Postgres (Supabase hosted) — DATABASE_URL pooler, DIRECT_URL dla migracji
- Auth.js v5 (Credentials + Prisma adapter)
- Supabase Realtime + Storage
- Tailwind v4 + shadcn/ui (neutral base, CSS variables)
- TanStack Query, dnd-kit, TanStack Table, Tiptap, React Flow, Yjs (F6)

## Przed kodowaniem
- Następuj `@AGENTS.md` — Next.js w tej wersji ma breaking changes od treningu. Czytaj `node_modules/next/dist/docs/` gdy trafisz na niestandardowy pattern.
- Przed pisaniem komponentów UI w tej sesji: wywołaj skill `frontend-design`.
- Przy pracy nad backendem/API: rozważ skill `senior-backend`. Przy architekturze: `senior-architect`.

## Konwencje
- **Paths:** absolutne `@/*` (nie relatywne `../../..`).
- **Prisma import:** `import { db } from "@/lib/db"`, nie bezpośredni PrismaClient.
- **Permissions:** każda mutacja w Route Handlerze wołuje `assertCan(role, action)` z `@/lib/permissions`.
- **Audit:** każda non-read mutacja wołuje `writeAudit(...)` z `@/lib/audit`.
- **Zod:** wszystkie API inputs walidowane przez schemat z `@/lib/schemas/*`.
- **Server vs Client:** mutacje domyślnie jako Server Actions; fetche pod optymistyczny UI — przez TanStack Query nad REST Route Handler.

## Real-time
- Supabase Realtime kanał per workspace: `workspace:<id>`.
- Po mutacji Task — publikacja zmiany do kanału.
- Client subscribe w useRealtime hooku (Faza 3).

## Ukryty URL logowania
- `/secure-access-portal` — endpoint logowania wg briefa.
- **NIE jest mechanizmem bezpieczeństwa** — realne security: rate limit (Upstash) + 2FA (F8) + email verification.

## Testy manualne (Faza 0)
1. `npm run dev` — aplikacja nasłuchuje na :3100.
2. `npm run db:migrate` — migracja działa (wymaga DATABASE_URL).
3. `npm run db:seed` — seed wrzuca demo workspace + 2 userów + 1 board + 1 task.
4. `npm run lint` — zero błędów.
5. `npm run build` — build przechodzi.

## Deployment
- **Target:** Vercel (frontend + API) + Supabase (DB + Storage + Realtime).
- **Preview:** każdy PR deployuje automatycznie (setup po podłączeniu do Vercela).
- **Prod branch:** `main`.

## Porty
- `next dev` → **3100** (nie 3000 — workspace-owy serve.mjs używa 3000).

## Workspace-level CLAUDE.md (JARVIS-WEB)
Ogólne zasady designu (colors, shadows, typography pair) w `../../CLAUDE.md`. Stosują się do UI tego projektu.
