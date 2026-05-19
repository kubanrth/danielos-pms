/* global React */
const { useState: useStateB } = React;

/* Shared workspace topbar — rendered ABOVE content for full-width bottom hairline */
function BoardTopbar({ workspace }) {
  const ws = workspace === "asd"
    ? { name: "asdfdasf", path: "/asdfdasf", role: "Admin" }
    : { name: "SideSideTwo", path: "/sidesidetwo", role: "Member" };
  return (
    <div className="ws-topbar">
      <div>
        <div className="ws-path">Przestrzeń · {ws.path}</div>
        <div className="ws-name">{ws.name}</div>
      </div>
      <div className="end">
        <span className="item">Przegląd</span>
        <span className="item">Członkowie</span>
        <span>Twoja rola: <span className="role">{ws.role}</span></span>
      </div>
    </div>
  );
}
window.BoardTopbar = BoardTopbar;

/* Shared board header */
function BoardHeader({ view, setView }) {
  const tabs = [
    { id: "table",    label: "Tabela",    icon: <IconLayout size={13}/> },
    { id: "kanban",   label: "Kanban",    icon: <IconKanban size={13}/> },
    { id: "roadmap",  label: "Roadmapa",  icon: <IconMap size={13}/> },
    { id: "gantt",    label: "Gantt",     icon: <IconGantt size={13}/> },
    { id: "wb",       label: "Whiteboard",icon: <IconBoard size={13}/> },
  ];
  return (
    <>
      <div className="board-head">
        <div className="titleblock">
          <h2 className="board-name">Pierwsza tablica</h2>
          <div className="board-sub">Domyślna tablica utworzona razem z przestrzenią.</div>
          <div className="view-tabs">
            <div className="lg-seg">
              {tabs.map(t => (
                <button key={t.id} className={view === t.id ? "on" : ""} onClick={() => setView(t.id)}>
                  {t.icon}<span>{t.label}</span>
                </button>
              ))}
            </div>
            <div className="btn sm ghost"><IconPlus size={13}/><span style={{fontFamily:"var(--font-mono)", fontSize:10.5, letterSpacing:"0.1em", textTransform:"uppercase"}}>Widok</span></div>
          </div>
        </div>
        <div style={{display:"flex", gap:8}}>
          <button className="btn sm"><IconPaint size={13}/><span style={{fontFamily:"var(--font-mono)", fontSize:10.5, letterSpacing:"0.1em", textTransform:"uppercase"}}>Tło</span></button>
          <button className="btn sm primary"><IconPlus size={14}/><span>Nowe zadanie</span></button>
        </div>
      </div>

      <div className="linkrow">
        <IconChevron size={13} style={{color:"var(--ink-4)"}}/>
        <IconFolder size={15} style={{color:"#8b5cf6"}}/>
        <span className="name">Infrastrukutra\</span>
        <span className="meta">2 wierszy</span>
        <span className="end">
          <button className="btn icon sm ghost"><IconTrash size={13}/></button>
        </span>
      </div>
      <div className="linkrow ghost" style={{marginTop:8}}>
        <span>Dodaj folder linków…</span>
        <IconPlus size={13}/>
      </div>
    </>
  );
}

/* ─────────────── Board: Table view ─────────────── */
function ViewTable() {
  const rows = [
    { st:"todo",     stL:"Do zrobienia", title:"gfdggfd",     people:[], tags:[],                       start:"—", end:"—" },
    { st:"todo",     stL:"Do zrobienia", title:"cos nowego",  people:[], tags:[],                       start:"—", end:"—" },
    { st:"todo",     stL:"Do zrobienia", title:"adsfasdfg",   people:[], tags:[],                       start:"—", end:"—" },
    { st:"progress", stL:"W trakcie",    title:"Logo",        people:["ku"], tags:[],                  start:"—", end:"—" },
    { st:"progress", stL:"W trakcie",    title:"dsjkfhasdkjfaskjhfdakjshgfkjadfhkgjahdfkghfdskjghskadghksdfg",
        people:["dn"], tags:[{c:"#8b5cf6", l:"potrzebuje"},{c:"#f59e0b", l:"ważne"}], start:"16 kwi 2026", end:"30 kwi 2026" },
    { st:"urgent",   stL:"Urgent",       title:"Kupić towar", people:[], tags:[],                       start:"13 maj 2026", end:"28 maj 2026" },
  ];
  return (
    <>
      <div className="tbl-controls" style={{marginTop:18}}>
        <button className="btn sm"><IconFilter size={13}/><span>+ Filtr</span></button>
        <button className="btn sm"><IconSort size={13}/><span>Sortuj</span></button>
        <button className="btn sm"><IconGroup size={13}/><span>Grupuj</span></button>
        <div className="right">
          <button className="btn sm"><IconColumns size={13}/><span>Kolumny</span></button>
        </div>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{width:36}}/>
              <th style={{width:130}}><IconCheck size={11} style={{verticalAlign:"-1px",marginRight:5}}/>Status</th>
              <th>Tytuł</th>
              <th style={{width:140}}><IconUser size={11} style={{verticalAlign:"-1px",marginRight:5}}/>Osoby</th>
              <th style={{width:180}}><IconHash size={11} style={{verticalAlign:"-1px",marginRight:5}}/>Tagi</th>
              <th style={{width:170}}><IconClock size={11} style={{verticalAlign:"-1px",marginRight:5}}/>Start</th>
              <th style={{width:170}}><IconClock size={11} style={{verticalAlign:"-1px",marginRight:5}}/>Koniec</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td><span className="check"/></td>
                <td><span className={"status " + r.st}>{r.stL}</span></td>
                <td className="title-cell">{r.title}</td>
                <td>
                  {r.people.length ? (
                    <div className="av-stack">{r.people.map((p,j)=><div key={j} className={"av "+p}>{p.toUpperCase()}</div>)}</div>
                  ) : <span className="ph">Przypisz</span>}
                </td>
                <td>
                  {r.tags.length ? r.tags.map((t,j)=>(
                    <span key={j} className="tag" style={{marginRight:4}}><span className="dot" style={{background:t.c}}/>{t.l}</span>
                  )) : <span className="ph">Dodaj tag</span>}
                </td>
                <td><span className={r.start==="—" ? "ph" : ""} style={r.start==="—"?null:{fontFamily:"var(--font-mono)", fontSize:12}}>{r.start}</span></td>
                <td><span className={r.end==="—" ? "ph" : ""} style={r.end==="—"?null:{fontFamily:"var(--font-mono)", fontSize:12}}>{r.end}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="tbl-newrow"><IconPlus size={12} style={{verticalAlign:"-1px",marginRight:6}}/>Nowy wiersz</div>
        <div className="tbl-foot">
          <span>6 zadań</span>
          <span className="hint">Hint · Najedź na zadanie i wciśnij <span className="kbd">M</span> aby przypisać osobę</span>
        </div>
      </div>
    </>
  );
}

/* ─────────────── Board: Kanban ─────────────── */
function ViewKanban() {
  const cols = [
    { id:"todo",     label:"Do zrobienia", st:"todo",     count:3, cards:[
      { title:"gfdggfd" },
      { title:"cos nowego" },
      { title:"adsfasdfg" },
    ]},
    { id:"prog",     label:"W trakcie",    st:"progress", count:2, cards:[
      { title:"Logo", people:["ku"] },
      { title:"dsjkfhasdkjfaskjhfdakjshgfkjadfhk gjahdfkghfdskjghskadghksdfg",
        tags:[{c:"#8b5cf6", l:"potrzebuje"},{c:"#f59e0b", l:"ważne"}], people:["dn"], date:"30 kwi" },
    ]},
    { id:"test",     label:"Testy",        st:"test",     count:0, empty:true },
    { id:"done",     label:"Done",         st:"done",     count:0, empty:true },
    { id:"urg",      label:"Urgent",       st:"urgent",   count:1, cards:[
      { title:"Kupić towar" },
    ]},
  ];

  return (
    <>
      <div className="col-manage">
        <IconChevron size={12}/>
        <IconColumns size={12}/>
        <span>Zarządzaj kolumnami</span>
        <span style={{color:"var(--ink-4)"}}>(5)</span>
        <span style={{marginLeft:"auto"}}>5 kolumn · 6 kart</span>
      </div>

      <div className="kanban" style={{marginTop:14}}>
        {cols.map(c => (
          <div key={c.id} className={"kcol" + (c.empty ? " dropzone" : "")}>
            <div className="khead">
              <div className="arrows">
                <button><IconChevronL size={11}/></button>
                <button><IconChevron size={11}/></button>
              </div>
              <span className={"status " + c.st}>{c.label}</span>
              <span className="count">{c.count}</span>
            </div>
            {c.empty ? (
              <div className="kbody">Upuść tu</div>
            ) : (
              <div className="kbody">
                {c.cards.map((card, i) => (
                  <div key={i} className="kcard">
                    {card.tags && <div className="tags">{card.tags.map((t,j)=>(
                      <span key={j} className="tag"><span className="dot" style={{background:t.c}}/>{t.l}</span>
                    ))}</div>}
                    <div className="title">{card.title}</div>
                    <div className="meta">
                      {card.people && <div className="av-stack">{card.people.map((p,j)=><div key={j} className={"av "+p} style={{width:18, height:18, fontSize:9}}>{p.toUpperCase()}</div>)}</div>}
                      {card.date && <span className="when">{card.date}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="kfoot"><IconPlus size={11} style={{verticalAlign:"-1px",marginRight:6}}/>Nowe zadanie</div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ─────────────── Board: Roadmap ─────────────── */
function ViewRoadmap() {
  const ms = [
    { name:"d`sf",   count:1, color:"g1", count_label:"1 zadanie" },
    { name:"adfss",  count:2, color:"g2", count_label:"2 zadania" },
    { name:"sadf",   count:0, color:"g3", count_label:"0 zadań" },
    { name:"adsf",   count:0, color:"g4", count_label:"0 zadań" },
    { name:"sdfsafd",count:0, color:"g5", count_label:"0 zadań" },
    { name:"bxc",    count:0, color:"g6", count_label:"0 zadań" },
  ];
  return (
    <>
      <div style={{display:"flex", alignItems:"center", marginTop:18, marginBottom:12}}>
        <div style={{fontFamily:"var(--font-mono)", fontSize:11, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--ink-3)"}}>7 milestone'ów</div>
        <div style={{marginLeft:"auto"}}>
          <button className="btn sm primary"><IconPlus size={14}/><span>Nowy milestone</span></button>
        </div>
      </div>

      <div className="roadmap-panel">
        <div className="roadmap-month">Maj 26</div>
        <div className="roadmap-row">
          {ms.map((m, i) => (
            <React.Fragment key={m.name}>
              <div className="milestone">
                <div className="name">{m.name}</div>
                <div className="sub">{m.count_label}</div>
                <div className={"bubble " + m.color}>{m.count}</div>
                <button className="btn sm ghost" style={{fontFamily:"var(--font-mono)", fontSize:10.5, letterSpacing:"0.1em", textTransform:"uppercase", marginTop:2}}>Sprawdź zadania</button>
              </div>
              {i < ms.length - 1 && <div className="arrow-link"/>}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div style={{marginTop:18}}>
        <div className="milestone-row">
          <div className="stripe" style={{background:"#10b981"}}/>
          <IconChevron size={13} style={{color:"var(--ink-4)"}}/>
          <div>
            <div className="name">d`sf</div>
            <div className="when">25 kwi → 9 maj · 1 zadanie</div>
          </div>
          <div className="end">
            <button className="btn icon sm ghost"><IconEdit size={13}/></button>
            <button className="btn icon sm ghost"><IconTrash size={13}/></button>
          </div>
        </div>
        <div className="milestone-row">
          <div className="stripe" style={{background:"#eab308"}}/>
          <IconChevron size={13} style={{color:"var(--ink-4)"}}/>
          <div>
            <div className="name">adfss</div>
            <div className="when">25 kwi → 9 maj · 2 zadania</div>
          </div>
          <div className="end">
            <button className="btn icon sm ghost"><IconEdit size={13}/></button>
            <button className="btn icon sm ghost"><IconTrash size={13}/></button>
          </div>
        </div>
        <div className="milestone-row">
          <div className="stripe" style={{background:"#f97316"}}/>
          <IconChevron size={13} style={{color:"var(--ink-4)"}}/>
          <div>
            <div className="name">sadf</div>
            <div className="when">25 kwi → 9 maj · 0 zadań</div>
          </div>
          <div className="end">
            <button className="btn icon sm ghost"><IconEdit size={13}/></button>
            <button className="btn icon sm ghost"><IconTrash size={13}/></button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─────────────── Board page (composes all) ─────────────── */
function ViewBoard({ workspace }) {
  const [view, setView] = useStateB("table");
  return (
    <>
      <BoardHeader view={view} setView={setView}/>
      {view === "table"   && <ViewTable/>}
      {view === "kanban"  && <ViewKanban/>}
      {view === "roadmap" && <ViewRoadmap/>}
      {view === "gantt"   && <div className="empty-panel">Gantt — coming soon</div>}
      {view === "wb"      && <div className="empty-panel">Whiteboard — coming soon</div>}
    </>
  );
}

window.ViewBoard = ViewBoard;
