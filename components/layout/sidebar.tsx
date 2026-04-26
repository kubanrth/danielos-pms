"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  BookOpen,
  FileText,
  LifeBuoy,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Compass,
  FolderOpen,
  Inbox,
  Layers,
  LogOut,
  Plus,
  Settings,
  ShieldCheck,
  StickyNote,
} from "lucide-react";
import type { Role } from "@/lib/generated/prisma/enums";
import { signOutAction } from "@/app/(app)/actions";
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
}

const STORAGE_KEY = "danielos.sidebar.collapsed";

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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(activeWorkspaceId ? [activeWorkspaceId] : []),
  );

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
    <aside
      data-collapsed={collapsed ? "true" : "false"}
      className="group/sidebar flex h-dvh flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground data-[collapsed=true]:w-[68px] data-[collapsed=false]:w-[248px] transition-[width] duration-200"
    >
      {/* Top: profile + collapse toggle */}
      <div className="flex items-center justify-between gap-2 border-b border-sidebar-border px-3 py-3">
        <Link
          href="/profile"
          className="flex min-w-0 items-center gap-2.5 rounded-sm px-1.5 py-1 transition-colors hover:bg-sidebar-accent focus-visible:bg-sidebar-accent focus-visible:outline-none"
        >
          <span className="relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient font-display text-[0.72rem] font-bold text-white">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </span>
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate font-display text-[0.92rem] font-semibold tracking-[-0.01em]">
                {user.name ?? user.email.split("@")[0]}
              </div>
              <div className="truncate font-mono text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground">
                {user.isSuperAdmin ? "super admin" : "member"}
              </div>
            </div>
          )}
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle variant="compact" />
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            aria-label={collapsed ? "Rozwiń panel" : "Zwiń panel"}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <nav className="flex flex-col gap-0.5 border-b border-sidebar-border px-2 py-2">
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
          <div className="mb-2 flex items-center justify-between px-2">
            <span className="eyebrow">Przestrzenie</span>
            <Link
              href="/workspaces"
              aria-label="Nowa przestrzeń"
              className="grid h-5 w-5 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <Plus size={13} />
            </Link>
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          {workspaces.map((ws) => {
            const expanded = expandedIds.has(ws.id);
            const isActive = ws.id === activeWorkspaceId;
            return (
              <div key={ws.id} className="flex flex-col">
                <div
                  data-active={isActive ? "true" : "false"}
                  className="group relative flex items-center gap-1 rounded-sm data-[active=true]:bg-sidebar-accent"
                >
                  {isActive && (
                    <span
                      aria-hidden
                      className="absolute -left-2 top-1 bottom-1 w-[2px] bg-primary"
                    />
                  )}
                  <Link
                    href={`/w/${ws.id}`}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-[0.88rem] transition-colors hover:bg-sidebar-accent"
                  >
                    <FolderOpen size={15} className="shrink-0 text-muted-foreground" />
                    {!collapsed && (
                      <span className="min-w-0 flex-1 truncate tracking-tight">
                        {ws.name}
                      </span>
                    )}
                  </Link>
                  {!collapsed && canManage(ws.role) && (
                    <CreateBoardDialog
                      workspaceId={ws.id}
                      workspaceEnabledViews={ws.enabledViews}
                    />
                  )}
                  {!collapsed && (
                    <button
                      type="button"
                      onClick={() => toggleWorkspace(ws.id)}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
                      aria-label={expanded ? "Zwiń" : "Rozwiń"}
                      aria-expanded={expanded}
                    >
                      <ChevronDown
                        size={13}
                        className={`transition-transform ${expanded ? "rotate-0" : "-rotate-90"}`}
                      />
                    </button>
                  )}
                </div>

                {!collapsed && expanded && (
                  <div className="mt-1 flex flex-col gap-0.5 pl-7">
                    {ws.boards.length === 0 && (
                      <span className="px-2 py-1 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground/70">
                        brak tablic
                      </span>
                    )}
                    {ws.boards.map((b) => (
                      <div
                        key={b.id}
                        className="group flex items-center gap-1 rounded-sm"
                      >
                        <Link
                          href={`/w/${ws.id}/b/${b.id}/table`}
                          className="min-w-0 flex-1 truncate rounded-sm px-2 py-1 text-[0.82rem] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
                        >
                          {b.name}
                        </Link>
                        {canManage(ws.role) && (
                          <DeleteBoardDialog
                            workspaceId={ws.id}
                            boardId={b.id}
                            boardName={b.name}
                          />
                        )}
                      </div>
                    ))}
                    <Link
                      href={`/w/${ws.id}/wiki`}
                      className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[0.78rem] font-mono uppercase tracking-[0.12em] text-muted-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-foreground"
                    >
                      <BookOpen size={11} /> Wiki
                    </Link>
                    <Link
                      href={`/w/${ws.id}/support`}
                      className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[0.78rem] font-mono uppercase tracking-[0.12em] text-muted-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-foreground"
                    >
                      <LifeBuoy size={11} /> Support
                    </Link>
                    <Link
                      href={`/w/${ws.id}/briefs`}
                      className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[0.78rem] font-mono uppercase tracking-[0.12em] text-muted-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-foreground"
                    >
                      <FileText size={11} /> Briefy
                    </Link>
                    {canManage(ws.role) && (
                      <Link
                        href={`/w/${ws.id}/settings`}
                        className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[0.78rem] font-mono uppercase tracking-[0.12em] text-muted-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-foreground"
                      >
                        <Settings size={11} /> Ustawienia
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {workspaces.length === 0 && (
            <div className="px-2 py-3 text-[0.82rem] text-muted-foreground">
              {!collapsed && "Brak przestrzeni. Utwórz pierwszą."}
            </div>
          )}
        </div>
      </div>

      {/* Bottom: settings + signout */}
      <div className="flex flex-col gap-0.5 border-t border-sidebar-border px-2 py-2">
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
        <form action={signOutAction} className="w-full">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[0.88rem] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            <LogOut size={15} className="shrink-0" />
            {!collapsed && <span className="truncate">Wyloguj</span>}
          </button>
        </form>
      </div>
    </aside>
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
      <span className="relative shrink-0 text-muted-foreground group-hover:text-foreground group-data-[active=true]:text-foreground">
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

  const cls =
    "group flex items-center gap-2 rounded-sm px-2 py-1.5 text-[0.88rem] data-[active=true]:bg-sidebar-accent data-[active=true]:text-foreground";

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
      className={`${cls} text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground`}
    >
      {content}
    </Link>
  );
}

function canManage(role: Role): boolean {
  return role === "ADMIN";
}
