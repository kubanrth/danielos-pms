/* global React */
const { useState: useStateV } = React;

/* ─────────────── Home / All workspaces ─────────────── */
function ViewHome({ setRoute }) {
  return (
    <>
      <div className="page-eyebrow">Twoje przestrzenie</div>
      <h1 className="page-title">Cześć, <em>Daniel.</em></h1>
      <p className="page-sub">
        Masz 2 przestrzenie robocze. Wybierz jedną, żeby kontynuować, albo utwórz nową.
        Złap za uchwyt po lewej i przeciągnij, żeby zmienić kolejność.
      </p>

      <div style={{ display:"flex", alignItems:"center", marginTop:24, marginBottom:6 }}>
        <div className="page-eyebrow" style={{margin:0}}>Widok</div>
        <div style={{ marginLeft:"auto" }}>
          <div className="flat-seg">
            <button className="on"><IconColumns size={13}/><span>Kafelki</span></button>
            <button><IconList size={13}/><span>Lista</span></button>
          </div>
        </div>
      </div>

      <div className="ws-grid">
        <div className="ws-card" onClick={() => setRoute({ key: "board", workspace: "sst" })}>
          <div className="head">
            <span>Member</span>
            <span className="path">/sidesidetwo</span>
          </div>
          <div className="ws-name">SideSideTwo</div>
          <div className="ws-blurb">Główna przestrzeń produktowa — roadmapa, tablice, milestone'y.</div>
          <div className="grip"><IconGrip size={14}/></div>
          <div className="foot">
            <span>5 tablic</span>
            <span className="go">Wejdź <IconArrowR size={13}/></span>
          </div>
        </div>

        <div className="ws-card alt" onClick={() => setRoute({ key: "board", workspace: "asd" })}>
          <div className="head">
            <span>Admin</span>
            <span className="path">/asdfdasf</span>
          </div>
          <div className="ws-name">asdfdasf</div>
          <div className="ws-blurb">Scratchpad — eksperymenty, robocze tablice, testy.</div>
          <div className="grip"><IconGrip size={14}/></div>
          <div className="foot">
            <span>1 tablica</span>
            <span className="go">Wejdź <IconArrowR size={13}/></span>
          </div>
        </div>

        <div className="ws-new">
          <div>
            <div style={{fontWeight:700, fontSize:18, color:"var(--ink-2)", letterSpacing:"-0.01em"}}>+ Utwórz workspace</div>
            <div style={{fontFamily:"var(--font-mono)", fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", marginTop:6}}>Kliknij aby rozpocząć</div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─────────────── Your tasks ─────────────── */
function ViewTasks({ setRoute }) {
  return (
    <>
      <div className="page-eyebrow">Zadania dla Ciebie</div>
      <h1 className="page-title">Twoja lista. <em>1</em> zadanie.</h1>
      <p className="page-sub">
        Wszystko, gdzie Ty jesteś assignee. Najedź na zadanie i wciśnij
        <span className="kbd">M</span> aby przypisać osobę.
      </p>

      <div className="tasks-toolbar" style={{marginTop:22}}>
        <div className="input">
          <IconSearch size={14} style={{color:"var(--ink-4)"}}/>
          <input placeholder="Szukaj po tytule…"/>
        </div>
        <div className="filter-pill">
          <span className="label">Tablica:</span>
          <span style={{fontWeight:600}}>Pierwsza tablica</span>
          <span style={{color:"var(--ink-4)"}}>· SideSideTwo</span>
        </div>
        <div className="btn sm" style={{marginLeft:"auto"}}>
          <IconSort size={13}/>
          <span style={{fontFamily:"var(--font-mono)", fontSize:10.5, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--ink-3)"}}>Sortuj</span>
          <span style={{fontWeight:600}}>Ostatnio zmienione</span>
          <IconChevronD size={12} style={{color:"var(--ink-4)"}}/>
        </div>
      </div>

      <div className="group-label">Bez terminu <span className="count">1</span></div>

      <div className="task-card" onClick={() => setRoute({ key: "board", workspace: "sst" })}>
        <div>
          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <span className="status progress">W trakcie</span>
          </div>
          <div className="title" style={{marginTop:10}}>Logo</div>
          <div className="ctx">SideSideTwo · /Pierwsza tablica</div>
        </div>
        <div className="right">
          <div className="av-stack">
            <div className="av ku">KU</div>
          </div>
          <IconChevron size={14} style={{color:"var(--ink-4)"}}/>
        </div>
      </div>
    </>
  );
}

/* ─────────────── Calendar ─────────────── */
function ViewCalendar() {
  // May 2026 — starts on a Friday. PON-NIEDZ.
  const dowLabels = ["PON","WT","ŚR","CZ","PT","SOB","NIEDZ"];
  // Build 6 weeks
  // May 1 2026 = Friday. Prev Monday = Apr 27.
  const start = new Date(2026, 3, 27); // April 27
  const cells = Array.from({length:42}, (_,i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const today = new Date(2026,4,18); // May 18
  const events = {
    "2026-5-12": [{ kind:"accent", label:"Logo review" }],
    "2026-5-13": [{ kind:"amber",  label:"Kupić towar" }],
    "2026-5-18": [{ kind:"accent", label:"Standup 10:00" }, { kind:"green", label:"Sprint close" }],
    "2026-5-20": [{ kind:"amber",  label:"Vendor call" }],
    "2026-5-27": [{ kind:"green",  label:"Release v2" }],
  };
  const key = (d) => `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;

  return (
    <>
      <div className="page-eyebrow">Twój kalendarz</div>
      <h1 className="page-title">Co masz <em>na osi.</em></h1>
      <p className="page-sub">
        Wszystkie zadania, w których jesteś assignee, na siatce miesiąca. Klik = otwarcie karty zadania.
      </p>

      <div className="cal-controls">
        <div className="btn sm">
          <IconStack size={13}/>
          <span style={{fontFamily:"var(--font-mono)", fontSize:10.5, letterSpacing:"0.1em", textTransform:"uppercase"}}>Wszystkie przestrzenie</span>
          <IconChevronD size={12} style={{color:"var(--ink-4)"}}/>
        </div>
        <div className="right">
          <div className="flat-seg">
            <button>Dzień</button>
            <button>Tydzień</button>
            <button className="on">Miesiąc</button>
          </div>
        </div>
      </div>

      <div className="cal-wrap">
        <div className="cal-head">
          <div className="cal-title">Maj <span className="year">2026</span></div>
          <div className="right">
            <button className="btn icon sm"><IconChevronL size={14}/></button>
            <button className="btn sm" style={{fontFamily:"var(--font-mono)", fontSize:10.5, letterSpacing:"0.1em", textTransform:"uppercase"}}>Dziś</button>
            <button className="btn icon sm"><IconChevron size={14}/></button>
          </div>
        </div>
        <div className="cal-grid">
          {dowLabels.map((d, i) => (
            <div key={d} className={"dow" + (i >= 5 ? " weekend" : "")}>{d}</div>
          ))}
          {cells.map((d, i) => {
            const out = d.getMonth() !== 4;
            const isToday = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
            const ev = events[key(d)] || [];
            return (
              <div key={i} className={"cal-cell" + (out ? " out" : "") + (isToday ? " today" : "")}>
                <div className="num">{d.getDate()}</div>
                {ev.map((e, j) => (
                  <div key={j} className={"ev " + (e.kind === "amber" ? "amber" : e.kind === "green" ? "green" : "")}>
                    <span className="dot"/>{e.label}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

window.ViewHome = ViewHome;
window.ViewTasks = ViewTasks;
window.ViewCalendar = ViewCalendar;
