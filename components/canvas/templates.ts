import type { ShapeKind } from "@/components/canvas/shape-node";
import type { CanvasEdgeEnd } from "@/lib/yjs/canvas-doc";

export type TemplateKey =
  | "mindmap"
  | "flowchart"
  | "userflow"
  | "wireframe"
  | "retro";

// Mutable scratchpad used by the editor to pair up node↔edge indices
// when committing a template. `__assignedId` is set during apply.
export interface TemplateNodeSpec {
  shape: ShapeKind;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  colorHex: string;
  __assignedId?: string;
}

export interface TemplateEdgeSpec {
  fromIdx: number;
  toIdx: number;
  label?: string;
  style: "solid" | "dashed";
  endStyle: CanvasEdgeEnd;
}

export interface TemplateDef {
  key: TemplateKey;
  label: string;
  glyph: string;
  build: () => { nodes: TemplateNodeSpec[]; edges: TemplateEdgeSpec[] };
}

// Small helper — makes the layout tables below readable.
const rect = (label: string, x: number, y: number): TemplateNodeSpec => ({
  shape: "RECTANGLE",
  label,
  x,
  y,
  width: 180,
  height: 72,
  colorHex: "#FFFFFF",
});
const sticky = (label: string, x: number, y: number, color = "#FEF3C7"): TemplateNodeSpec => ({
  shape: "STICKY",
  label,
  x,
  y,
  width: 160,
  height: 160,
  colorHex: color,
});
const diamond = (label: string, x: number, y: number): TemplateNodeSpec => ({
  shape: "DIAMOND",
  label,
  x,
  y,
  width: 160,
  height: 80,
  colorHex: "#DBEAFE",
});
const circle = (label: string, x: number, y: number): TemplateNodeSpec => ({
  shape: "CIRCLE",
  label,
  x,
  y,
  width: 120,
  height: 120,
  colorHex: "#EDE9FE",
});
const frame = (label: string, x: number, y: number, w: number, h: number): TemplateNodeSpec => ({
  shape: "FRAME",
  label,
  x,
  y,
  width: w,
  height: h,
  colorHex: "#F1F5F9",
});

export const TEMPLATES: TemplateDef[] = [
  {
    key: "mindmap",
    label: "Mindmap",
    glyph: "◉",
    build: () => {
      // Root circle + 4 branches.
      const nodes: TemplateNodeSpec[] = [
        circle("Temat", 400, 260),
        rect("Obszar A", 100, 120),
        rect("Obszar B", 700, 120),
        rect("Obszar C", 700, 420),
        rect("Obszar D", 100, 420),
      ];
      const edges: TemplateEdgeSpec[] = [
        { fromIdx: 0, toIdx: 1, style: "solid", endStyle: "none" },
        { fromIdx: 0, toIdx: 2, style: "solid", endStyle: "none" },
        { fromIdx: 0, toIdx: 3, style: "solid", endStyle: "none" },
        { fromIdx: 0, toIdx: 4, style: "solid", endStyle: "none" },
      ];
      return { nodes, edges };
    },
  },
  {
    key: "flowchart",
    label: "Flowchart",
    glyph: "◇",
    build: () => {
      const nodes: TemplateNodeSpec[] = [
        circle("Start", 360, 40),
        rect("Krok 1", 340, 200),
        diamond("Decyzja?", 340, 340),
        rect("Krok 2a", 140, 480),
        rect("Krok 2b", 540, 480),
        circle("Koniec", 360, 640),
      ];
      const edges: TemplateEdgeSpec[] = [
        { fromIdx: 0, toIdx: 1, style: "solid", endStyle: "arrow" },
        { fromIdx: 1, toIdx: 2, style: "solid", endStyle: "arrow" },
        { fromIdx: 2, toIdx: 3, label: "nie", style: "solid", endStyle: "arrow" },
        { fromIdx: 2, toIdx: 4, label: "tak", style: "solid", endStyle: "arrow" },
        { fromIdx: 3, toIdx: 5, style: "solid", endStyle: "arrow" },
        { fromIdx: 4, toIdx: 5, style: "solid", endStyle: "arrow" },
      ];
      return { nodes, edges };
    },
  },
  {
    key: "userflow",
    label: "User flow",
    glyph: "→",
    build: () => {
      const nodes: TemplateNodeSpec[] = [
        rect("Landing", 40, 120),
        rect("Signup", 280, 120),
        rect("Onboarding", 520, 120),
        rect("Dashboard", 760, 120),
        sticky("Tutaj tracimy 40%", 260, 280, "#FEE2E2"),
      ];
      const edges: TemplateEdgeSpec[] = [
        { fromIdx: 0, toIdx: 1, style: "solid", endStyle: "arrow" },
        { fromIdx: 1, toIdx: 2, style: "solid", endStyle: "arrow" },
        { fromIdx: 2, toIdx: 3, style: "solid", endStyle: "arrow" },
        { fromIdx: 1, toIdx: 4, style: "dashed", endStyle: "none" },
      ];
      return { nodes, edges };
    },
  },
  {
    key: "wireframe",
    label: "Wireframe",
    glyph: "▣",
    build: () => {
      // Stacked "page" regions — treat as annotated frames.
      const nodes: TemplateNodeSpec[] = [
        frame("Header", 40, 40, 720, 90),
        frame("Hero", 40, 150, 720, 220),
        frame("Feature grid", 40, 390, 340, 260),
        frame("Sidebar", 420, 390, 340, 260),
        frame("Footer", 40, 670, 720, 90),
      ];
      return { nodes, edges: [] };
    },
  },
  {
    key: "retro",
    label: "Retro",
    glyph: "◈",
    build: () => {
      const nodes: TemplateNodeSpec[] = [
        frame("Co zadziałało", 40, 40, 300, 340),
        frame("Co nie zadziałało", 360, 40, 300, 340),
        frame("Action items", 680, 40, 300, 340),
        sticky("Przykład: ", 80, 110, "#DCFCE7"),
        sticky("Przykład: ", 400, 110, "#FEE2E2"),
        sticky("Przykład: ", 720, 110, "#DBEAFE"),
      ];
      return { nodes, edges: [] };
    },
  },
];

// Apply one of the preset templates by invoking `commit` with the node +
// edge specs. The caller is expected to assign real ids, commit to Y.Doc
// and update React Flow state in a single transaction — keeping that
// logic in the editor rather than here because it owns the Y refs.
export function applyCanvasTemplate(
  key: TemplateKey,
  commit: (nodes: TemplateNodeSpec[], edges: TemplateEdgeSpec[]) => void,
): void {
  const def = TEMPLATES.find((t) => t.key === key);
  if (!def) return;
  const { nodes, edges } = def.build();
  commit(nodes, edges);
}
