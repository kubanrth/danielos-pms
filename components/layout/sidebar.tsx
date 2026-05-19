"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Bell,
  BookOpen,
  FileText,
  GripVertical,
  LifeBuoy,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Compass,
  Inbox,
  Layers,
  LogOut,
  Menu,
  Plus,
  Settings,
  ShieldCheck,
  StickyNote,
  X,
} from "lucide-react";
import type { Role } from "@/lib/generated/prisma/enums";
import { signOutAction } from "@/app/(app)/actions";
import { reorderWorkspacesAction } from "@/app/(app)/workspaces/actions";
import { reorderBoardsAction } from "@/app/(app)/w/[workspaceId]/b/actions";
import { CreateBoardDialog } from "@/components/workspaces/create-board-dialog";
import { DeleteBoardDialog } from "@/components/workspaces/delete-board-dialog";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export interface SidebarUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  isSuperAdmin: boolean;
}

export interface SidebarWorkspace {
  id: string;
  name: string;
  slug: string;
  role: Role;
  boards: { id: string; name: string }[];
  enabledViews: Array<"TABLE" | "KANBAN" | "ROADMAP" | "GANTT" | "WHITEBOARD">;
  // F12-K38: licznik aktywnych zgłoszeń supportu (status=OPEN, IN_PROGRESS;
  // bez RESOLVED/CLOSED). Renderowany jako badge przy linku Support.
  openSupportCount?: number;
}

// F12-K41c: bumped key od ".collapsed" → ".collapsed.v2". Klient miał
// stary collapsed=1 z poprzednich sesji w localStorage; nowy key
// = ignoring tego state'u i startujemy expanded jak default. User
// dalej może zwijać przez chevron — nowe ustawienie persistuje pod v2.
const STORAGE_KEY = "danielos.sidebar.collapsed.v2";

export function Sidebar({
  user,
  workspaces,
  unreadNotificationCount,
}: {
  user: SidebarUser;
  workspaces: SidebarWorkspace[];
  unreadNotificationCount: number;
}) {
  const pathname = usePathname();
  const activeWorkspaceId = pathname.match(/^\/w\/([^/]+)/)?.[1] ?? null;
  const [collapsed, setCollapsed] = useState(false);
  // F12-K41: mobile drawer state. Na desktopie sidebar jest zawsze
  // visible (sticky inline w flex'ie); na mobile (md-) sidebar jest
  // domyślnie schowany (translate-x-[-100%]) i otwierany przyciskiem
  // hamburger w prawym górnym rogu.
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(activeWorkspaceId ? [activeWorkspaceId] : []),
  );

  // F12-K58: drag-and-drop reorder dla workspace'ów w sidebarze (klient
  // chciał przesuwać kolejność przez "łapanie i ciągnięcie" — analog do
  // tego co już działa na /workspaces overview). Lokalny state trzyma
  // optimistic kolejność; useEffect re-sync'uje gdy prop się zmieni
  // (po revalidatePath z server action). Boards mają własny nested
  // SortableContext per workspace, patrz SortableBoardsList niżej.
  const [workspaceItems, setWorkspaceItems] = useState(workspaces);
  useEffect(() => {
    setWorkspaceItems(workspaces);
  }, [workspaces]);

  const sensors = useSensors(
    // 5px aktywuje drag — pod tym progiem clicki przechodzą do <Link>
    // (klient może klikać workspace żeby wejść, bez przypadkowego dragu).
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onWorkspaceDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setWorkspaceItems((prev) => {
      const oldIdx = prev.findIndex((w) => w.id === active.id);
      const newIdx = prev.findIndex((w) => w.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return prev;
      const next = arrayMove(prev, oldIdx, newIdx);
      const orderedIds = next.map((w) => w.id);
      startTransition(() => {
        void reorderWorkspacesAction(orderedIds);
      });
      return next;
    });
  };

  // Auto-close drawer przy zmianie route'a — nie chcemy żeby drawer
  // zostawał otwarty po klik'u w link.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Esc zamyka drawer.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  // Block body scroll gdy mobile drawer otwarty (lepszy UX).
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  // Expand active workspace when navigating to it.
  useEffect(() => {
    if (activeWorkspaceId) {
      setExpandedIds((prev) => {
        if (prev.has(activeWorkspaceId)) return prev;
        const next = new Set(prev);
        next.add(activeWorkspaceId);
        return next;
      });
    }
  }, [activeWorkspaceId]);

  // Persist collapse state locally.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "1") setCollapsed(true);
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* noop */
    }
  }, [collapsed]);

  const toggleWorkspace = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const initials = (user.name ?? user.email).slice(0, 2).toUpperCase();

  return (
    <>
      {/* F12-K41: mobile-only hamburger button. Pokazuje się tylko gdy
          sidebar jest schowany (drawer zamknięty). Zawiera Menu icon →
          klik otwiera drawer. Przycisk X w samym drawer (top-right
          obok kolaps button) zamyka. */}
      {!mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Otwórz menu"
          // F12-K41: z-[80] — wyżej niż NotificationToaster (z-70) i
          // ReminderPopups (z-60), żeby toast'y nie zasłaniały hamburger'a
          // gdy lecą w prawym górnym rogu.
          // F12-K57: h-11 w-11 = 44px tap target (Apple HIG min).
          className="fixed right-3 top-3 z-[80] grid h-11 w-11 place-items-center rounded-lg border border-border bg-card/95 text-foreground shadow-lg backdrop-blur transition-colors hover:bg-accent md:hidden"
        >
          <Menu size={20} />
        </button>
      )}

      {/* F12-K57: drawer jest fullscreen na mobile, więc backdrop nie
          jest już potrzebny (klient i tak nic za drawer'em nie widzi).
          Zostawiamy strukturę gotową, ale render'ujemy null na max-md. */}

      <aside
      data-collapsed={collapsed ? "true" : "false"}
      data-mobile-open={mobileOpen ? "true" : "false"}
      // F12-K9: sticky top-0 + self-start trzymają sidebar pinned do
      // góry viewportu kiedy długa strona scrolluje. h-dvh sprawia że
      // sidebar zawsze ma dokładnie wysokość viewportu.
      //
      // F12-K41 + F12-K41b: dual-mode — mobile drawer (max-md) vs
      // desktop sticky (md+). KRYTYCZNE: wszystkie reguły mobile drawer
      // używają `max-md:` prefix'a, żeby NIE leciały na desktop. Inaczej
      // `data-[mobile-open=false]:-translate-x-full` (specyficzność 0,2,0)
      // bije `md:translate-x-0` (0,1,0) i sidebar zostaje schowany na
      // desktop'ie. `max-md:` generuje regułę tylko w `@media (max-width)`
      // więc na md+ rules po prostu nie istnieją.
      //
      // F12-K57: drawer fullscreen (max-md:inset-0 + max-md:w-full).
      //
      // F12-K59: aside teraz jest LAYOUT wrapperem (pozycja, drawer slide,
      // szerokość). Faktyczny glass-card UI to <div className="sidebar-glass">
      // wewnątrz. Na desktopie aside ma padding (md:p-3.5 md:pr-2) żeby
      // glass-card "płynął" jako floating panel z odstępem od krawędzi
      // ekranu, na mobile p-0 + rounded-none żeby drawer pełnoekranowy
      // wypełniał viewport bez gap'ów.
      className="group/sidebar flex h-dvh flex-col text-sidebar-foreground transition-[transform,width] duration-200 max-md:fixed max-md:inset-0 max-md:z-40 max-md:w-full max-md:p-0 max-md:data-[mobile-open=false]:-translate-x-full max-md:data-[mobile-open=true]:translate-x-0 md:sticky md:top-0 md:self-start md:p-3.5 md:pr-2 data-[collapsed=true]:md:w-[80px] data-[collapsed=false]:md:w-[252px]"
    >
      {/* F12-K59: floating glass-card. Wszystkie sekcje sidebar'a siedzą
          w środku. Glass: rgba(28,28,34,0.55) + backdrop-blur(40px) +
          saturate(180%), border white-10, rounded 20px, panel shadow
          + top sheen via ::before. Na mobile fullscreen drawer:
          rounded-none, no margin, glass solid (kept blur). */}
      <div className="relative flex h-full flex-col overflow-hidden border bg-[rgba(28,28,34,0.55)] backdrop-blur-[40px] backdrop-saturate-[1.8] before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-gradient-to-b before:from-white/[0.06] before:to-transparent before:to-30% before:content-[''] md:rounded-[20px] md:border-white/10 md:shadow-[0_0_0_0.5px_rgba(255,255,255,0.05),0_1px_2px_rgba(0,0,0,0.3),0_20px_60px_rgba(0,0,0,0.45)] max-md:rounded-none max-md:border-0">
      {/* Top: profile + collapse toggle */}
      {/* F12-K41d: gdy collapsed, header przełącza się w pion (avatar
          na górze, chevron pod nim). Inaczej w row 68px szerokości
          chevron był 'overflow-clipped' przez parent overflow-hidden i
          klient nie miał jak rozwinąć sidebar'a z powrotem. */}
      <div
        // F12-K57b: większy padding header'a + avatar/name na mobile.
        className={`flex gap-2 border-b border-white/[0.05] px-3 py-3 max-md:gap-3 max-md:px-4 max-md:py-4 ${
          collapsed
            ? "flex-col items-center"
            : "items-center justify-between"
        }`}
      >
        <Link
          href="/profile"
          className="flex min-w-0 items-center gap-2.5 rounded-sm px-1.5 py-1 transition-colors hover:bg-white/[0.05] focus-visible:bg-white/[0.07] focus-visible:outline-none max-md:gap-3.5 max-md:rounded-md max-md:px-2 max-md:py-2"
        >
          {/* F12-K59: avatar gradient purple→pink (Apple-system tone) +
              inset top white-35% highlight + soft drop shadow — match
              z design'em (bg: linear-gradient(135deg, #c084fc, #f472b6)). */}
          <span
            style={{ background: "linear-gradient(135deg, #c084fc, #f472b6)" }}
            className="relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full font-display text-[0.72rem] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_1px_2px_rgba(0,0,0,0.3)] max-md:h-11 max-md:w-11 max-md:text-[0.95rem]"
          >
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </span>
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate font-display text-[0.92rem] font-semibold tracking-[-0.01em] max-md:text-[1.12rem]">
                {user.name ?? user.email.split("@")[0]}
              </div>
              <div className="truncate font-mono text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground max-md:text-[0.72rem]">
                {user.isSuperAdmin ? "super admin" : "member"}
              </div>
            </div>
          )}
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          {/* F12-K41: mobile X (zamyka drawer) — schowany na md+.
              F12-K57: bump tap-target z 28px → 44px (Apple HIG / Material min)
              i powiększony chevron icon. Bez backdrop'a X jest jedyną drogą
              zamknięcia drawer'a na mobile (+ Esc), więc musi być żeby trafić. */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground md:hidden"
            aria-label="Zamknij menu"
          >
            <X size={20} />
          </button>
          {/* Desktop chevron — collapse/expand sidebar, schowany na mobile. */}
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="hidden h-7 w-7 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground md:grid"
            aria-label={collapsed ? "Rozwiń panel" : "Zwiń panel"}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <nav className="flex flex-col gap-0.5 border-b border-white/[0.05] px-2 py-2">
        <NavItem
          href="/inbox"
          icon={<Inbox size={15} />}
          label="Powiadomienia"
          pathname={pathname}
          collapsed={collapsed}
          badge={unreadNotificationCount > 0 ? unreadNotificationCount : undefined}
        />
        <NavItem
          href="/my-tasks"
          icon={<Compass size={15} />}
          label="Zadania dla Ciebie"
          pathname={pathname}
          collapsed={collapsed}
        />
        <NavItem
          href="/my/todo"
          icon={<CheckSquare size={15} />}
          label="TO DO"
          pathname={pathname}
          collapsed={collapsed}
        />
        <NavItem
          href="/my/calendar"
          icon={<CalendarDays size={15} />}
          label="Kalendarz"
          pathname={pathname}
          collapsed={collapsed}
        />
        <NavItem
          href="/my/notes"
          icon={<StickyNote size={15} />}
          label="Notatnik"
          pathname={pathname}
          collapsed={collapsed}
        />
        <NavItem
          href="/my/reminders"
          icon={<Bell size={15} />}
          label="Przypomnienia"
          pathname={pathname}
          collapsed={collapsed}
        />
        <NavItem
          href="/workspaces"
          icon={<Layers size={15} />}
          label="Wszystkie przestrzenie"
          pathname={pathname}
          collapsed={collapsed}
          exact
        />
      </nav>

      {/* Workspaces — accordion */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {!collapsed && (
          // F12-K57b: większy eyebrow + plus tap-target na mobile.
          <div className="mb-2 flex items-center justify-between px-2 max-md:mb-3 max-md:px-3 max-md:pt-2">
            <span className="eyebrow max-md:text-[0.78rem] max-md:tracking-[0.12em]">Przestrzenie</span>
            <Link
              href="/workspaces"
              aria-label="Nowa przestrzeń"
              className="grid h-5 w-5 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground max-md:h-10 max-md:w-10 max-md:rounded-md"
            >
              <Plus size={13} className="max-md:size-[18px]" />
            </Link>
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onWorkspaceDragEnd}
          >
            <SortableContext
              items={workspaceItems.map((w) => w.id)}
              strategy={verticalListSortingStrategy}
            >
              {workspaceItems.map((ws) => (
                <SortableWorkspaceRow
                  key={ws.id}
                  workspace={ws}
                  pathname={pathname}
                  activeWorkspaceId={activeWorkspaceId}
                  expanded={expandedIds.has(ws.id)}
                  onToggle={() => toggleWorkspace(ws.id)}
                  collapsed={collapsed}
                />
              ))}
            </SortableContext>
          </DndContext>
          {workspaceItems.length === 0 && (
            <div className="px-2 py-3 text-[0.82rem] text-muted-foreground">
              {!collapsed && "Brak przestrzeni. Utwórz pierwszą."}
            </div>
          )}
        </div>
      </div>

      {/* Bottom: settings + signout */}
      <div className="flex flex-col gap-0.5 border-t border-white/[0.05] px-2 py-2">
        {user.isSuperAdmin && (
          <NavItem
            href="/admin"
            icon={<ShieldCheck size={15} />}
            label="Panel admina"
            pathname={pathname}
            collapsed={collapsed}
          />
        )}
        <NavItem
          href="/profile"
          icon={<Settings size={15} />}
          label="Ustawienia konta"
          pathname={pathname}
          collapsed={collapsed}
        />
        {/* F12-K15: prominent labeled theme toggle obok 'Wyloguj' — wcześniej
            był w nagłówku sidebar jako mała ikonka, klient nie widział że
            istnieje. */}
        <ThemeToggle variant="labeled" collapsed={collapsed} />
        <form action={signOutAction} className="w-full">
          <button
            type="submit"
            // F12-K57b: dopasowane do nav-row'a (większy padding + text na mobile).
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[0.88rem] text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground max-md:gap-3 max-md:rounded-md max-md:px-3 max-md:py-3 max-md:text-[1rem]"
          >
            <LogOut size={15} className="shrink-0 max-md:size-[18px]" />
            {!collapsed && <span className="truncate">Wyloguj</span>}
          </button>
        </form>
      </div>
      </div>{/* /sidebar-glass */}
    </aside>
    </>
  );
}

// F12-K19: workspace pod-link (Wiki/Support/Creative Board/Kalendarz/
// Ustawienia) — taki sam wygląd co dotąd, ale z active state'em żeby
// klient widział na czym aktualnie jest. Active = żywy text-foreground
// + sidebar-accent tło + lewy primary marker.
function WsSubLink({
  href,
  icon,
  label,
  active,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  // F12-K38: opcjonalny licznik (np. otwarte zgłoszenia supportu).
  badge?: number;
}) {
  return (
    <Link
      href={href}
      data-active={active ? "true" : "false"}
      // F12-K57b: większy padding + text + ikony na mobile.
      className="group relative inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-mono text-[0.78rem] uppercase tracking-[0.12em] text-muted-foreground/80 transition-colors hover:bg-white/[0.05] hover:text-foreground data-[active=true]:bg-white/[0.07] data-[active=true]:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.10),inset_0_1px_0_rgba(255,255,255,0.06)] data-[active=true]:font-semibold data-[active=true]:text-foreground max-md:gap-2.5 max-md:rounded-md max-md:px-3 max-md:py-2.5 max-md:text-[0.86rem] [&>svg]:max-md:size-4"
    >
      {/* F12-K59: usunięty lewy purple marker — active state polega na
          inset white-highlight'cie + font-weight'cie. */}
      {icon} {label}
      {badge !== undefined && badge > 0 && (
        <span className="ml-auto grid h-4 min-w-[16px] place-items-center rounded-full bg-primary px-1 font-mono text-[0.58rem] font-bold tracking-normal text-primary-foreground">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

function NavItem({
  href,
  icon,
  label,
  pathname,
  collapsed,
  disabled,
  hint,
  exact,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  pathname: string;
  collapsed: boolean;
  disabled?: boolean;
  hint?: string;
  exact?: boolean;
  badge?: number;
}) {
  const active = exact ? pathname === href : pathname.startsWith(href);

  const content = (
    <>
      <span className="relative shrink-0 text-muted-foreground group-hover:text-foreground group-data-[active=true]:text-foreground [&>svg]:max-md:size-[18px]">
        {icon}
        {collapsed && badge !== undefined && badge > 0 && (
          // Fixed width: badge never changes size when count jumps
          // 1 → 9 → 9+, so the icon row doesn't reflow.
          <span className="absolute -right-2 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-primary font-mono text-[0.55rem] font-bold text-primary-foreground">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      {!collapsed && (
        <span className="min-w-0 flex-1 truncate tracking-tight">{label}</span>
      )}
      {!collapsed && badge !== undefined && badge > 0 && (
        <span className="grid h-5 w-6 shrink-0 place-items-center rounded-full bg-primary font-mono text-[0.62rem] font-bold text-primary-foreground">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      {!collapsed && hint && badge === undefined && (
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground/60">
          {hint}
        </span>
      )}
    </>
  );

  // F12-K57b: na mobile wszystkie nav-rowy są ~30% większe (padding,
  // gap, font) — klient pisał że layout fullscreen wygląda za luźno
  // z malutkimi rzędami. Desktop bez zmian.
  const cls =
    "group flex items-center gap-2 rounded-sm px-2 py-1.5 text-[0.88rem] data-[active=true]:bg-white/[0.07] data-[active=true]:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.10),inset_0_1px_0_rgba(255,255,255,0.06)] data-[active=true]:text-foreground max-md:gap-3 max-md:rounded-md max-md:px-3 max-md:py-3 max-md:text-[1rem]";

  if (disabled) {
    return (
      <span
        data-active={active ? "true" : "false"}
        className={`${cls} cursor-not-allowed text-muted-foreground/60`}
        title={hint ? `Dostępne w ${hint}` : undefined}
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      href={href}
      data-active={active ? "true" : "false"}
      className={`${cls} text-sidebar-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground`}
    >
      {content}
    </Link>
  );
}

function canManage(role: Role): boolean {
  return role === "ADMIN";
}

// F12-K52: tworzenie tablic dostępne dla ADMIN + MEMBER (zgodnie z lib/permissions
// matrix). Wcześniej canManage blokowało wszystkich poza ADMIN'em — bug.
function canCreateBoard(role: Role): boolean {
  return role === "ADMIN" || role === "MEMBER";
}

// F12-K59: workspace swatch — mała kolorowa kafelka 16×16 (gradient
// from→to) zastępująca generyczny FolderOpen icon. Kolor wybierany
// deterministycznie z hash'a ID workspace'u, żeby ten sam workspace
// zawsze miał ten sam kolor. 6 wariantów (Apple-system-like hues).
// Inline style zamiast Tailwind klas, bo array dynamicznych klas nie
// jest niezawodnie wykrywany przez Tailwind v4 JIT scanner.
const SWATCH_GRADIENTS: ReadonlyArray<readonly [string, string]> = [
  ["#93c5fd", "#a78bfa"], // blue → violet (default)
  ["#fda4af", "#fb923c"], // pink → orange
  ["#6ee7b7", "#34d399"], // mint → emerald
  ["#fde68a", "#f59e0b"], // butter → amber
  ["#a5b4fc", "#6366f1"], // periwinkle → indigo
  ["#f0abfc", "#c084fc"], // pink → purple
];

function swatchIndex(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % SWATCH_GRADIENTS.length;
}

function WorkspaceSwatch({ id }: { id: string }) {
  const [from, to] = SWATCH_GRADIENTS[swatchIndex(id)];
  return (
    <span
      aria-hidden
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
      className="block h-4 w-4 shrink-0 rounded-[5px] shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.3),0_1px_1px_rgba(0,0,0,0.3)] max-md:h-[18px] max-md:w-[18px]"
    />
  );
}

// F12-K58: pojedynczy wiersz workspace'u w sidebarze + jego rozwinięte
// boardy. Drag handle pojawia się on-hover (desktop) / zawsze (mobile),
// {...listeners} są tylko na buttonie, więc click w nazwę nadal działa
// jak link (dnd-kit aktywuje drag dopiero przy ruchu >5px — patrz sensors
// w komponencie Sidebar).
function SortableWorkspaceRow({
  workspace: ws,
  pathname,
  activeWorkspaceId,
  expanded,
  onToggle,
  collapsed,
}: {
  workspace: SidebarWorkspace;
  pathname: string;
  activeWorkspaceId: string | null;
  expanded: boolean;
  onToggle: () => void;
  collapsed: boolean;
}) {
  // F12-K58: gdy collapsed (desktop wąski tryb), nie ma jak wyświetlić
  // grip handle obok wąskich ikon → drag wyłączony. Klient i tak musi
  // rozwinąć żeby zobaczyć listę.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: ws.id, disabled: collapsed });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : "auto",
  } as const;

  const isInWorkspace = ws.id === activeWorkspaceId;
  // F12-K19: workspace row highlighted ONLY gdy jesteś na workspace
  // overview / sub-link (Wiki/Support/itd.). Gdy jesteś na konkretnej
  // tablicy → highlight idzie do tej tablicy, workspace traci accent.
  const onBoardInWs = pathname.startsWith(`/w/${ws.id}/b/`);
  const isActive = isInWorkspace && !onBoardInWs;

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col">
      <div
        data-active={isActive ? "true" : "false"}
        className="group relative flex items-center gap-1 rounded-sm data-[active=true]:bg-white/[0.07] data-[active=true]:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.10),inset_0_1px_0_rgba(255,255,255,0.06)]"
      >
        {/* F12-K59: usunięty lewy purple marker — design używa subtelnego
            inset white-highlight'a na active wiersza zamiast purple bara. */}
        {!collapsed && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="Przeciągnij przestrzeń"
            title="Przeciągnij aby zmienić kolejność"
            // F12-K59: hidden default na desktopie (display:none, nie
            // rezerwuje miejsca w layout'cie — wcześniej opacity-0 +
            // w-7 ucinało nazwę workspace'a). group-hover:grid pokazuje
            // na najechaniu. Na mobile zawsze visible (brak hover state'u).
            className="hidden h-7 w-7 shrink-0 cursor-grab place-items-center rounded-sm text-muted-foreground/60 transition-colors hover:bg-white/[0.05] hover:text-foreground active:cursor-grabbing group-hover:grid max-md:!grid max-md:h-10 max-md:w-10 max-md:rounded-md max-md:text-muted-foreground/50"
          >
            <GripVertical size={13} className="max-md:size-[16px]" />
          </button>
        )}
        <Link
          href={`/w/${ws.id}`}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-[0.88rem] transition-colors hover:bg-white/[0.05] max-md:gap-3 max-md:rounded-md max-md:px-3 max-md:py-3 max-md:text-[1rem]"
        >
          {/* F12-K59: workspace swatch (mała gradient kafelka) zastępuje
              poprzednią ikonkę FolderOpen. Kolor wybierany stabilnie z
              hash'a ID, każda przestrzeń dostaje swój kolor visualny. */}
          <WorkspaceSwatch id={ws.id} />
          {!collapsed && (
            <span className="min-w-0 flex-1 truncate tracking-tight">
              {ws.name}
            </span>
          )}
        </Link>
        {!collapsed && canCreateBoard(ws.role) && (
          // F12-K59: + button do tworzenia tablicy — hover-only na desktopie
          // (display:none default, group-hover:flex), zawsze visible na mobile.
          // Bez tego workspace name byłaby ucinana przez stały + button.
          <span className="hidden group-hover:inline-flex max-md:!inline-flex">
            <CreateBoardDialog
              workspaceId={ws.id}
              workspaceEnabledViews={ws.enabledViews}
            />
          </span>
        )}
        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground max-md:h-11 max-md:w-11 max-md:rounded-md"
            aria-label={expanded ? "Zwiń" : "Rozwiń"}
            aria-expanded={expanded}
          >
            <ChevronDown
              size={13}
              className={`transition-transform max-md:size-[18px] ${expanded ? "rotate-0" : "-rotate-90"}`}
            />
          </button>
        )}
      </div>

      {!collapsed && expanded && (
        <SortableBoardsList
          workspaceId={ws.id}
          boards={ws.boards}
          pathname={pathname}
          role={ws.role}
          openSupportCount={ws.openSupportCount}
        />
      )}
    </div>
  );
}

// F12-K58: nested SortableContext dla boardów w obrębie jednego workspace'u.
// Każdy expanded workspace ma własny lokalny state + DndContext — to upraszcza
// logikę (drop tylko w obrębie tego samego workspace'u, brak cross-workspace
// reorderu) i jest zgodne z server action sygnaturą (workspaceId, orderedIds).
function SortableBoardsList({
  workspaceId,
  boards: boardsProp,
  pathname,
  role,
  openSupportCount,
}: {
  workspaceId: string;
  boards: { id: string; name: string }[];
  pathname: string;
  role: Role;
  openSupportCount?: number;
}) {
  const [boards, setBoards] = useState(boardsProp);
  useEffect(() => {
    setBoards(boardsProp);
  }, [boardsProp]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBoards((prev) => {
      const oldIdx = prev.findIndex((b) => b.id === active.id);
      const newIdx = prev.findIndex((b) => b.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return prev;
      const next = arrayMove(prev, oldIdx, newIdx);
      const orderedIds = next.map((b) => b.id);
      startTransition(() => {
        void reorderBoardsAction(workspaceId, orderedIds);
      });
      return next;
    });
  };

  // Drag boardów: ADMIN + MEMBER (matching reorderBoardsAction's
  // requireWorkspaceAction("task.update")). VIEWER nie może.
  const canDragBoards = canCreateBoard(role);

  return (
    <div className="mt-1 flex flex-col gap-0.5 pl-7">
      {boards.length === 0 && (
        <span className="px-2 py-1 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground/70">
          brak tablic
        </span>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={boards.map((b) => b.id)}
          strategy={verticalListSortingStrategy}
        >
          {boards.map((b) => (
            <SortableBoardRow
              key={b.id}
              workspaceId={workspaceId}
              board={b}
              pathname={pathname}
              role={role}
              canDrag={canDragBoards}
            />
          ))}
        </SortableContext>
      </DndContext>
      <WsSubLink
        href={`/w/${workspaceId}/wiki`}
        icon={<BookOpen size={11} />}
        label="Wiki"
        active={pathname.startsWith(`/w/${workspaceId}/wiki`)}
      />
      <WsSubLink
        href={`/w/${workspaceId}/support`}
        icon={<LifeBuoy size={11} />}
        label="Support"
        active={pathname.startsWith(`/w/${workspaceId}/support`)}
        badge={openSupportCount}
      />
      <WsSubLink
        href={`/w/${workspaceId}/briefs`}
        icon={<FileText size={11} />}
        label="Creative Board"
        active={pathname.startsWith(`/w/${workspaceId}/briefs`)}
      />
      <WsSubLink
        href={`/w/${workspaceId}/calendar`}
        icon={<CalendarDays size={11} />}
        label="Kalendarz"
        active={pathname.startsWith(`/w/${workspaceId}/calendar`)}
      />
      {canManage(role) && (
        <WsSubLink
          href={`/w/${workspaceId}/settings`}
          icon={<Settings size={11} />}
          label="Ustawienia"
          active={pathname.startsWith(`/w/${workspaceId}/settings`)}
        />
      )}
    </div>
  );
}

function SortableBoardRow({
  workspaceId,
  board: b,
  pathname,
  role,
  canDrag,
}: {
  workspaceId: string;
  board: { id: string; name: string };
  pathname: string;
  role: Role;
  canDrag: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: b.id, disabled: !canDrag });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : "auto",
  } as const;

  // F12-K19: aktywna tablica = pathname zaczyna się od /w/<wid>/b/<bid>.
  const boardActive = pathname.startsWith(`/w/${workspaceId}/b/${b.id}`);

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-active={boardActive ? "true" : "false"}
      className="group relative flex items-center gap-1 rounded-sm data-[active=true]:bg-white/[0.07] data-[active=true]:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.10),inset_0_1px_0_rgba(255,255,255,0.06)]"
    >
      {/* F12-K59: usunięty lewy purple marker (analogicznie do workspace
          row) — design polega na inset white-highlight'cie. */}
      {canDrag && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Przeciągnij tablicę"
          title="Przeciągnij aby zmienić kolejność"
          // F12-K59: hidden default na desktopie (nie rezerwuje miejsca),
          // hover-toggle. Mobile always-visible.
          className="hidden h-6 w-6 shrink-0 cursor-grab place-items-center rounded-sm text-muted-foreground/60 transition-colors hover:bg-white/[0.05] hover:text-foreground active:cursor-grabbing group-hover:grid max-md:!grid max-md:h-9 max-md:w-9 max-md:rounded-md max-md:text-muted-foreground/50"
        >
          <GripVertical size={12} className="max-md:size-[14px]" />
        </button>
      )}
      <Link
        href={`/w/${workspaceId}/b/${b.id}/table`}
        className={`min-w-0 flex-1 truncate rounded-sm px-2 py-1 text-[0.82rem] transition-colors hover:bg-white/[0.05] hover:text-foreground max-md:rounded-md max-md:px-3 max-md:py-2.5 max-md:text-[0.95rem] ${
          boardActive
            ? "font-semibold text-foreground"
            : "text-muted-foreground"
        }`}
      >
        {b.name}
      </Link>
      {canManage(role) && (
        // F12-K59: delete board hover-only na desktopie.
        <span className="hidden group-hover:inline-flex max-md:!inline-flex">
          <DeleteBoardDialog
            workspaceId={workspaceId}
            boardId={b.id}
            boardName={b.name}
          />
        </span>
      )}
    </div>
  );
}
