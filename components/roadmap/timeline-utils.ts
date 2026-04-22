// Shared helpers for any horizontal-time-axis visualisation (roadmap,
// gantt, markers). Factored out of roadmap-view.tsx so the gantt view
// doesn't have to re-derive range / color / row-packing from scratch.

export const DAY_MS = 24 * 60 * 60 * 1000;

// Pastel accent palette — each entity gets a stable color derived from
// its id so re-orderings don't reshuffle hues across renders.
export const TIMELINE_PALETTE = [
  "#7B68EE",
  "#FF02F0",
  "#14B8A6",
  "#F59E0B",
  "#3B82F6",
  "#EF4444",
  "#10B981",
  "#8B5CF6",
];

export function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TIMELINE_PALETTE[h % TIMELINE_PALETTE.length];
}

export interface TimelineItem {
  id: string;
  startAt: string;
  stopAt: string;
}

export interface TimelineRange {
  rangeStart: number;
  rangeStop: number;
  ticks: { ts: number; label: string }[];
}

// Compute axis bounds + month ticks. Given `now` so the caller can make
// this render-pure (Date.now() during React render violates purity).
export function computeTimelineRange<T extends TimelineItem>(
  items: T[],
  now: number,
): TimelineRange {
  if (items.length === 0) {
    return {
      rangeStart: now - 7 * DAY_MS,
      rangeStop: now + 90 * DAY_MS,
      ticks: [],
    };
  }
  let min = Infinity;
  let max = -Infinity;
  for (const m of items) {
    min = Math.min(min, new Date(m.startAt).getTime());
    max = Math.max(max, new Date(m.stopAt).getTime());
  }
  const span = max - min || DAY_MS;
  const pad = span * 0.08;
  const rangeStart = min - pad;
  const rangeStop = max + pad;

  const ticks: { ts: number; label: string }[] = [];
  const d = new Date(rangeStart);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  while (d.getTime() <= rangeStop) {
    ticks.push({
      ts: d.getTime(),
      label: d.toLocaleDateString("pl-PL", { month: "short", year: "2-digit" }),
    });
    d.setMonth(d.getMonth() + 1);
  }
  return { rangeStart, rangeStop, ticks };
}

export function pctFor(ts: number, range: TimelineRange): number {
  return ((ts - range.rangeStart) / (range.rangeStop - range.rangeStart)) * 100;
}

// Greedy row packing — sort items by start, slot each into the first
// track that has no overlap. Produces a Gantt-like stacking.
export function assignRows<T extends TimelineItem>(items: T[]): Map<string, number> {
  const sorted = [...items].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );
  const rowEnds: number[] = [];
  const rows = new Map<string, number>();
  for (const m of sorted) {
    const start = new Date(m.startAt).getTime();
    const stop = new Date(m.stopAt).getTime();
    let placed = false;
    for (let i = 0; i < rowEnds.length; i++) {
      if (rowEnds[i] <= start) {
        rowEnds[i] = stop;
        rows.set(m.id, i);
        placed = true;
        break;
      }
    }
    if (!placed) {
      rows.set(m.id, rowEnds.length);
      rowEnds.push(stop);
    }
  }
  return rows;
}

export function formatDateRange(startIso: string, stopIso: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
  return `${fmt(startIso)} → ${fmt(stopIso)}`;
}
