"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export interface NodeTaskChip {
  taskId: string;
  title: string;
}

export type ShapeKind =
  | "RECTANGLE"
  | "DIAMOND"
  | "CIRCLE"
  | "STICKY"
  | "FRAME"
  | "TEXT";

export interface ShapeNodeData {
  shape: ShapeKind;
  label: string | null;
  colorHex: string;
  width: number;
  height: number;
  linkedTasks?: NodeTaskChip[];
  workspaceId?: string;
  [key: string]: unknown;
}

// F9-17: shapes bardziej graficzne. Każdy shape dostaje właściwy
// wizualny charakter zamiast być „pustym prostokątem":
//   RECTANGLE → soft gradient background, rounded 12px, double-tone
//               border (brand accent on top edge)
//   DIAMOND  → rotated square z inner gradient, thicker border
//   CIRCLE   → radial gradient + glow shadow → wygląda jak orb
//   STICKY   → jak dotychczas (żółty post-it, tilt, serif)
//   FRAME    → dashed container z subtelnym tekstur background
export const ShapeNode = memo(function ShapeNode({ data, selected }: NodeProps) {
  const d = data as ShapeNodeData;
  const label = d.label ?? "";

  if (d.shape === "FRAME") {
    return (
      <FrameShape
        width={d.width}
        height={d.height}
        colorHex={d.colorHex}
        label={label}
        selected={!!selected}
      />
    );
  }

  // F10-W: TEXT renders as borderless / fill-less prose. The "color"
  // field is the TEXT color (not background) so we map a sensible
  // default if a legacy fill is passed.
  if (d.shape === "TEXT") {
    return (
      <TextShape
        width={d.width}
        height={d.height}
        colorHex={d.colorHex}
        label={label}
        selected={!!selected}
      />
    );
  }

  const textColor = textColorFor(d.colorHex);
  const accent = accentFor(d.colorHex);
  const selectedRing = selected
    ? "0 0 0 2px color-mix(in oklch, var(--primary) 40%, transparent)"
    : "none";

  const content = (
    <span
      className="pointer-events-none select-none px-3 text-center font-display text-[0.94rem] font-semibold tracking-[-0.01em] leading-tight"
      data-label=""
      style={{
        color: textColor,
        fontFamily:
          d.shape === "STICKY"
            ? "ui-serif, Georgia, 'Times New Roman', serif"
            : undefined,
      }}
    >
      {label || <span className="opacity-50">dwuklik aby nazwać</span>}
    </span>
  );

  const chips = d.linkedTasks ?? [];

  return (
    <>
      <Handle type="target" position={Position.Top} />
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Handle type="source" position={Position.Bottom} />

      {d.shape === "DIAMOND" ? (
        <DiamondShape
          width={d.width}
          height={d.height}
          colorHex={d.colorHex}
          accent={accent}
          textColor={textColor}
          ringShadow={selectedRing}
        >
          {content}
        </DiamondShape>
      ) : d.shape === "CIRCLE" ? (
        <CircleShape
          width={d.width}
          height={d.height}
          colorHex={d.colorHex}
          accent={accent}
          textColor={textColor}
          ringShadow={selectedRing}
        >
          {content}
        </CircleShape>
      ) : d.shape === "STICKY" ? (
        <StickyShape
          width={d.width}
          height={d.height}
          colorHex={d.colorHex}
          ringShadow={selectedRing}
          selected={!!selected}
        >
          {content}
        </StickyShape>
      ) : (
        <RectangleShape
          width={d.width}
          height={d.height}
          colorHex={d.colorHex}
          accent={accent}
          ringShadow={selectedRing}
          selected={!!selected}
        >
          {content}
        </RectangleShape>
      )}

      {chips.length > 0 && d.workspaceId && (
        <div
          className="pointer-events-auto absolute -bottom-3 left-1/2 flex max-w-[calc(100%+40px)] -translate-x-1/2 flex-wrap justify-center gap-1"
          data-chips=""
        >
          {chips.slice(0, 3).map((c) => (
            <a
              key={c.taskId}
              href={`/w/${d.workspaceId}/t/${c.taskId}`}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="inline-flex max-w-[160px] items-center gap-1 truncate rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground shadow-sm transition-colors hover:border-primary/60 hover:text-foreground nodrag"
              title={c.title}
            >
              # {c.title}
            </a>
          ))}
          {chips.length > 3 && (
            <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground">
              +{chips.length - 3}
            </span>
          )}
        </div>
      )}
    </>
  );
});

// --- Per-shape renderers ---

function RectangleShape({
  width,
  height,
  colorHex,
  accent,
  ringShadow,
  selected,
  children,
}: {
  width: number;
  height: number;
  colorHex: string;
  accent: string;
  ringShadow: string;
  selected: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width,
        height,
        // Soft gradient from the user-picked color to a 10%-lighter mix,
        // gives visual depth without washing out the label.
        background: `linear-gradient(180deg, color-mix(in oklch, ${colorHex} 94%, white) 0%, ${colorHex} 100%)`,
        borderRadius: 12,
        border: `1px solid ${selected ? "var(--primary)" : "color-mix(in oklch, " + colorHex + " 60%, var(--border))"}`,
        boxShadow: `${ringShadow === "none" ? "" : ringShadow + ", "}0 1px 2px rgba(10,10,40,0.04), 0 8px 20px -10px rgba(10,10,40,0.15)`,
        position: "relative",
      }}
      className="grid place-items-center overflow-hidden"
    >
      {/* Thin brand-accent stripe on top edge — ties each node to the
           workspace's visual language without overwhelming the label. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
        style={{ background: accent }}
      />
      {children}
    </div>
  );
}

function DiamondShape({
  width,
  height,
  colorHex,
  accent,
  textColor,
  ringShadow,
  children,
}: {
  width: number;
  height: number;
  colorHex: string;
  accent: string;
  textColor: string;
  ringShadow: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width,
        height,
        transform: "rotate(45deg)",
        background: `linear-gradient(135deg, color-mix(in oklch, ${colorHex} 90%, white) 0%, ${colorHex} 100%)`,
        border: `2px solid ${accent}`,
        borderRadius: 10,
        boxShadow: `${ringShadow === "none" ? "" : ringShadow + ", "}0 8px 20px -10px rgba(10,10,40,0.2)`,
        color: textColor,
      }}
      className="grid place-items-center"
    >
      <div style={{ transform: "rotate(-45deg)" }}>{children}</div>
    </div>
  );
}

function CircleShape({
  width,
  height,
  colorHex,
  accent,
  textColor,
  ringShadow,
  children,
}: {
  width: number;
  height: number;
  colorHex: string;
  accent: string;
  textColor: string;
  ringShadow: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width,
        height,
        // Radial gradient → orb look. Edge uses the accent, center the
        // base color (lightened) so text stays readable.
        background: `radial-gradient(circle at 32% 30%, color-mix(in oklch, ${colorHex} 85%, white) 0%, ${colorHex} 60%, color-mix(in oklch, ${colorHex} 80%, black) 100%)`,
        borderRadius: "50%",
        border: `2px solid ${accent}`,
        boxShadow: `${ringShadow === "none" ? "" : ringShadow + ", "}0 10px 24px -12px ${accent}40, 0 2px 4px rgba(10,10,40,0.08)`,
        color: textColor,
      }}
      className="grid place-items-center"
    >
      {children}
    </div>
  );
}

function StickyShape({
  width,
  height,
  colorHex,
  ringShadow,
  selected: _selected,
  children,
}: {
  width: number;
  height: number;
  colorHex: string;
  ringShadow: string;
  selected: boolean;
  children: React.ReactNode;
}) {
  // Mural-style sticky: paper feel via subtle paper gradient, sharper
  // top edge (folded corner micro-detail), heavier drop shadow that
  // reads as "lifted off the canvas". Slight tilt for charm.
  const tilt = ((Math.abs(hashFromString(colorHex)) % 5) - 2) * 0.6; // -1.2..1.2°
  const text = textColorFor(colorHex);
  return (
    <div
      style={{
        width,
        height,
        background: `linear-gradient(180deg, color-mix(in oklch, ${colorHex} 96%, white) 0%, ${colorHex} 100%)`,
        borderRadius: 6,
        transform: `rotate(${tilt}deg)`,
        boxShadow: `${ringShadow === "none" ? "" : ringShadow + ", "}
          0 1px 2px rgba(0,0,0,0.06),
          0 6px 14px -8px rgba(0,0,0,0.18),
          0 20px 30px -18px rgba(0,0,0,0.22),
          inset 0 -2px 4px rgba(0,0,0,0.04)`,
        color: text,
        position: "relative",
      }}
      className="grid place-items-center"
    >
      {/* folded-corner highlight — adds the "real paper" touch */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-3 w-3"
        style={{
          background: `linear-gradient(225deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 60%)`,
          borderTopRightRadius: 6,
        }}
      />
      {children}
    </div>
  );
}

// F10-W: text-only object. No fill, no border. The colorHex is the
// text color, not the background. Selection ring still renders so the
// user knows which one is picked.
function TextShape({
  width,
  height,
  colorHex,
  label,
  selected,
}: {
  width: number;
  height: number;
  colorHex: string;
  label: string;
  selected: boolean;
}) {
  // If the user picked a near-white "fill" color (legacy palette), fall
  // back to ink-dark so the text stays visible on the canvas background.
  const ink = isPaleHex(colorHex) ? "#1F2937" : colorHex;
  return (
    <div
      style={{
        width,
        height,
        boxShadow: selected
          ? "0 0 0 2px color-mix(in oklch, var(--primary) 40%, transparent)"
          : "none",
        borderRadius: 6,
      }}
      className="grid place-items-center px-2"
    >
      <span
        className="pointer-events-none select-none text-center font-display tracking-[-0.01em]"
        style={{
          color: ink,
          fontSize: Math.max(14, Math.min(48, height * 0.36)),
          fontWeight: 700,
          lineHeight: 1.1,
        }}
      >
        {label || (
          <span style={{ color: ink, opacity: 0.4, fontWeight: 500 }}>
            dwuklik aby pisać
          </span>
        )}
      </span>
    </div>
  );
}

// Stable per-string hash → tiny float, used for deterministic sticky tilt.
function hashFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

function isPaleHex(hex: string): boolean {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return true;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.85;
}

function FrameShape({
  width,
  height,
  colorHex,
  label,
  selected,
}: {
  width: number;
  height: number;
  colorHex: string;
  label: string;
  selected: boolean;
}) {
  const accent = selected
    ? "var(--primary)"
    : "color-mix(in oklch, currentColor 40%, var(--border))";
  return (
    <div
      style={{
        width,
        height,
        // Subtle checker-like gradient gives the frame a "paper" feel
        // without overlap noise when children land on it.
        background: `
          linear-gradient(135deg, color-mix(in oklch, ${colorHex} 60%, transparent) 0%, color-mix(in oklch, ${colorHex} 20%, transparent) 100%)
        `,
        border: `2px dashed ${accent}`,
        borderRadius: 14,
        position: "relative",
        boxShadow: selected
          ? "0 0 0 2px color-mix(in oklch, var(--primary) 40%, transparent)"
          : "none",
      }}
    >
      <div
        className="absolute -top-3 left-3 rounded-md bg-card px-2 py-0.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em]"
        style={{
          color: accent,
          border: `1px solid ${accent}`,
        }}
      >
        {label || "frame"}
      </div>
      <Handle type="target" position={Position.Top} />
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

// --- Color helpers ---

// Derive a brand-accent color from the node fill — used for borders,
// top stripes, circle rims. We darken the base by ~25% so it's visible
// on light-tinted fills but still harmonises with the picker palette.
function accentFor(hex: string): string {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return "var(--primary)";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  // For very light fills (almost white) fall back to the brand primary
  // so the stripe/border isn't invisible.
  if (y > 0.92) return "#7B68EE";
  const darken = (n: number) => Math.max(0, Math.round(n * 0.75));
  const hx = (n: number) => darken(n).toString(16).padStart(2, "0");
  return `#${hx(r)}${hx(g)}${hx(b)}`;
}

function textColorFor(hex: string): string {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return "#0F172A";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return y > 0.6 ? "#0F172A" : "#FFFFFF";
}
