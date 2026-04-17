# DANIELOS PMS

System Zarządzania Projektami (PMS) — ClickUp-like SaaS dla klienta **DANIELOS**.

Moduły: Workspaces · Widok Tabelaryczny · Kanban · Roadmapa · Whiteboard procesów · Panel Super Admina.

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| DB | Postgres (Supabase) + Prisma 7 |
| Auth | Auth.js v5 (Credentials + Prisma adapter) |
| Real-time | Supabase Realtime |
| Storage | Supabase Storage |
| UI | Tailwind v4 + shadcn/ui |
| Data | TanStack Query + TanStack Table |
| DnD | @dnd-kit |
| Rich text | Tiptap |
| Whiteboard | @xyflow/react + Yjs |
| Email | Resend |
| Observability | Sentry |
| Hosting | Vercel + Supabase |

## Setup

### 1. Zmienne środowiskowe

```bash
cp .env.example .env
```

Wypełnij `.env`:
- **Supabase** — załóż projekt na [supabase.com](https://supabase.com). Z Settings → Database skopiuj pooler URL (`DATABASE_URL`) i direct URL (`DIRECT_URL`). Z API keys weź `anon` i `service_role`.
- **Auth.js** — `openssl rand -base64 32` dla `AUTH_SECRET`.
- **Resend** — [resend.com](https://resend.com) → API keys. Wymagane do email verification i notyfikacji (Faza 1+).
- **Upstash Redis** — [upstash.com](https://upstash.com) dla rate limiting (Faza 1+, nieblokujące w F0).
- **Sentry** — [sentry.io](https://sentry.io) → project settings → DSN. Niewymagane w F0.

### 2. Database

```bash
npm run db:migrate          # tworzy tabele + pierwsza migracja
npm run db:seed             # demo: 2 userów, 1 workspace, 1 board, statusy, 1 task
```

### 3. Dev server

```bash
npm run dev                 # :3100 (nie :3000 — workspace JARVIS-WEB rezerwuje 3000)
```

Otwórz [http://localhost:3100](http://localhost:3100).

**Demo login (po seed):** `admin@danielos.local` / `danielos-demo-2026` (super admin) lub `member@danielos.local` / `danielos-demo-2026`.

## Scripts

| Komenda | Opis |
|---|---|
| `npm run dev` | dev server na :3100 |
| `npm run build` | production build |
| `npm run start` | production server |
| `npm run lint` | ESLint |
| `npm run db:generate` | regeneruj Prisma client |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:deploy` | `prisma migrate deploy` (prod) |
| `npm run db:studio` | Prisma Studio (GUI do DB) |
| `npm run db:seed` | uruchom `prisma/seed.ts` |
| `npm run db:reset` | wyczyść DB + zmigruj + seed (DESTROY) |

## Struktura

```
sites/danielos/
├── app/                    # App Router
│   ├── (auth)/             # login (ukryty URL)
│   ├── (app)/              # protected user app
│   ├── (admin)/admin/      # super admin panel
│   └── api/                # Route Handlers = backend
├── components/
│   ├── ui/                 # shadcn/ui
│   ├── layout/ task/ kanban/ table/ roadmap/ whiteboard/ background/ admin/
│   └── providers/          # React context providers
├── lib/
│   ├── db.ts               # Prisma singleton
│   ├── auth.ts             # Auth.js config (F1)
│   ├── supabase.ts         # Supabase clients (browser + admin)
│   ├── permissions.ts      # role × action matrix
│   ├── audit.ts            # writeAudit helpers
│   ├── schemas/            # Zod schemas
│   └── generated/prisma/   # Prisma client (auto-generated)
├── hooks/                  # React hooks
├── prisma/
│   ├── schema.prisma       # pełny model danych
│   ├── migrations/
│   └── seed.ts
└── types/                  # shared TS types
```

## Plan fazowy

Szczegółowy roadmap: [../../../.claude/plans/dostalem-plan-na-strone-reactive-barto.md](../../../.claude/plans/dostalem-plan-na-strone-reactive-barto.md).

| Faza | Zakres | Status |
|---|---|---|
| F0 | Setup (Next.js + Prisma schema + shadcn + tooling) | ✅ |
| F1 | Auth + Workspaces + Task Modal szkielet | pending |
| F2 | Widok Tabeli + Board + Tagi + Assignees | pending |
| F3 | Kanban + Real-time sync | pending |
| F4 | Task Modal pełny (komentarze, załączniki, audit log) | pending |
| F5 | Roadmap + Milestones | pending |
| F6 | Whiteboard Procesów (React Flow + Yjs) | pending |
| F7 | Panel Super Admina | pending |
| F8 | Polish, perf, security, pilot | pending |

## License

Private — property of DANIELOS client. Do not redistribute.
