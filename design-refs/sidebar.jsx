/* global React */
const { useState } = React;

/* ─────────────── Sidebar ─────────────── */
function Sidebar({ route, setRoute }) {
  const isActive = (key) => route.key === key || route.workspace && key === "workspaces";
  const top = [
  { key: "notifications", label: "Powiadomienia", icon: <IconBell />, dot: true },
  { key: "tasks", label: "Zadania dla Ciebie", icon: <IconCheck />, count: 1 },
  { key: "todo", label: "TO DO", icon: <IconList /> },
  { key: "calendar", label: "Kalendarz", icon: <IconCalendar /> },
  { key: "notes", label: "Notatnik", icon: <IconNotebook /> },
  { key: "reminders", label: "Przypomnienia", icon: <IconAlarm /> },
  { key: "home", label: "Wszystkie przestrzenie", icon: <IconStack /> }];

  const workspaces = [
  { id: "sst", name: "SideSideTwo", swatch: "" },
  { id: "asd", name: "asdfdasf", swatch: "a" }];

  return (
    <aside className="sidebar">
      <div className="sidebar-inner">
        <div className="profile">
          <div className="avatar">KU</div>
          <div className="who">
            <span className="name">Kuba</span>
            <span className="role">Super Admin</span>
          </div>
          <div className="collapse"><IconChevronL size={14} /></div>
        </div>

        <div className="nav-section" style={{ marginTop: 4 }}>
          {top.map((n) =>
          <div key={n.key} className={"nav-item" + (isActive(n.key) ? " active" : "")} onClick={() => setRoute({ key: n.key })}>
              {React.cloneElement(n.icon, { className: "ico" })}
              <span>{n.label}</span>
              {n.dot && <span className="dot" />}
              {n.count != null && <span className="count">{n.count}</span>}
            </div>
          )}
        </div>

        <div className="nav-section">
          <div className="nav-label">Przestrzenie <span className="add"><IconPlus size={12} /></span></div>
          {workspaces.map((w) =>
          <div key={w.id} className={"nav-item" + (route.workspace === w.id ? " active" : "")}
          onClick={() => setRoute({ key: "board", workspace: w.id })}>
              <span className="ws-row" style={{ display: "contents" }}>
                <span className={"swatch " + w.swatch} />
                <span>{w.name}</span>
                <span className="ops">
                  <button title="Dodaj"><IconPlus size={12} /></button>
                  <button title="Otwórz"><IconChevron size={12} /></button>
                </span>
              </span>
            </div>
          )}
        </div>

        <div className="sidebar-foot">
          <div className="nav-item"><IconShield className="ico" /><span>Panel admina</span></div>
          <div className="nav-item"><IconSettings className="ico" /><span>Ustawienia konta</span></div>
          <div className="nav-item"><IconLogout className="ico" /><span>Wyloguj</span></div>
        </div>
      </div>
    </aside>);

}

window.Sidebar = Sidebar;