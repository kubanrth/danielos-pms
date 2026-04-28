// F12-K36: centralna paleta używana w pickerach kolorów (tagi, statusy,
// kolumny single/multi-select, kolor wydarzenia w kalendarzu workspace'u,
// kolor headera briefu, roadmap colorFor, status manager kanban).
//
// Klient: 'mozemy zmienic palete kolorów uzywana w whiteboard, tagach,
// stastusach itp. teraz są takie pastelowe a bym chcial jakies takie żywsze'.
//
// Dobór: 8 kolorów nasyconych, pełen hue range, żadnych szarawych tonów.
// Brand color (#7B68EE) zostawiony — harmonizuje z resztą.
// `string[]` typowanie zamiast `as const` — picker'y trzymają state
// jako `string` (np. useState<string>(PALETTE[0])), więc literal-tuple
// powodowałby type error przy zapisie innego koloru.
export const BRAND_PALETTE: string[] = [
  "#FF3B30", // red — żywszy niż Tailwind red-500
  "#FF9500", // orange
  "#FFCC00", // yellow / amber — saturated, nie muddy
  "#34C759", // green — iOS-style, jaskrawszy niż emerald-500
  "#00CDD8", // teal / cyan
  "#0A84FF", // blue — soczysty
  "#7B68EE", // brand purple
  "#FF2D9C", // magenta — bliżej brand secondary
];

// Status'y mają swój preferowany default order (legacy: szary 'Todo', amber
// 'In progress', niebieski 'Review', zielony 'Done'). Trzymamy 8 kolorów
// w tej samej kolejności co BRAND_PALETTE — pierwsza pozycja domyślnym
// 'shade' dla nowego statusu.
export const STATUS_PALETTE = BRAND_PALETTE;

// Tagi — używamy tej samej palety; tag picker wybiera pierwszy nieużyty.
export const TAG_PALETTE = BRAND_PALETTE;

// SELECT field options (single/multi select w tabeli) — alokujemy
// kolejnymi indeksami z palety przy każdym dodawaniu opcji.
export const SELECT_PALETTE = BRAND_PALETTE;

// Kalendarz workspace'u — kolor wydarzenia. Klient wybiera ręcznie.
export const EVENT_PALETTE = BRAND_PALETTE;

// Roadmap timeline — colorFor(milestoneId) hashuje id na index palety.
export const TIMELINE_PALETTE = BRAND_PALETTE;

// Brief header color — gradient w nagłówku briefu.
export const HEADER_PALETTE = BRAND_PALETTE;
