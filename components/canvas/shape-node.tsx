"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export interface NodeTaskChip {
  taskId: string;
  title: string;
}

export type ShapeKind = "RECTANGLE" | "DIAMOND" | "CIRCLE" | "STICKY" | "FRAME";

export interface ShapeNodeData {
  shape: ShapeKind;
  label: string | null;
  colorHex: string;
  width: number;
  height: number;
  linkedTasks?: NodeTaskChip[];
  // Injected by the editor so the chip knows where to navigate.
  workspaceId?: string;
  [key: string]: unknown; // React Flow's NodeProps expects index signature on data
}

// Single node renderer that branches on `shape`. A diamond is a
// 45°-rotated square with counter-rotated label — keeps the bounding box
// the same as a rectangle so edges attach sanely. STICKY adds a slight
// tilt + layered shadow for a hand-placed feel. FRAME draws a dashed
// outline rectangle with a small title label that sits behind other
// nodes so it can group them visually.
export const ShapeNode = memo(function ShapeNode({ data, selected }: NodeProps) {
  const d = data as ShapeNodeData;
  const label = d.label ?? "";
  const borderColor = selected ? "var(--primary)" : "color-mix(in oklch, currentColor 30%, var(--border))";
  const ring = selected ? "0 0 0 2px color-mix(in oklch, var(--primary) 40%, transparent)" : "none";

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

  const baseRadius = d.shape === "CIRCLE" ? "50%" : d.shape === "STICKY" ? "4px" : "10px";

  const base: React.CSSProperties = {
    width: d.width,
    height: d.height,
    background: d.colorHex,
    border: `1.5px solid ${borderColor}`,
    boxShadow:
      d.shape === "STICKY"
        ? `0 1px 2px rgba(0,0,0,0.06), 0 12px 20px -12px rgba(120, 80, 0, 0.35)${selected ? ", 0 0 0 2px color-mix(in oklch, var(--primary) 40%, transparent)" : ""}`
        : ring,
    color: textColorFor(d.colorHex),
    borderRadius: baseRadius,
    transform: d.shape === "STICKY" ? "rotate(-1.5deg)" : undefined,
  };

  const content = (
    <span
      className="pointer-events-none select-none px-3 text-center font-display text-[0.92rem] font-semibold tracking-[-0.01em] leading-tight"
      data-label=""
      style={d.shape === "STICKY" ? { fontFamily: "ui-serif, Georgia, 'Times New Roman', serif" } : undefined}
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
        <div style={{ ...base, transform: "rotate(45deg)" }} className="grid place-items-center">
          <div style={{ transform: "rotate(-45deg)" }}>{content}</div>
        </div>
      ) : (
        <div style={base} className="grid place-items-center">
          {content}
        </div>
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
  const accent = selected ? "var(--primary)" : "color-mix(in oklch, currentColor 40%, var(--border))";
  // Dashed outline + translucent fill. Everything else sits on top — this
  // is a group indicator, not a "real" shape.
  return (
    <div
      style={{
        width,
        height,
        background: `color-mix(in oklch, ${colorHex} 30%, transparent)`,
        border: `2px dashed ${accent}`,
        borderRadius: 12,
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

// Pick a readable text color for the node's background — black for light
// fills, white for dark ones. Parses #RRGGBB only; unknowns get black.
function textColorFor(hex: string): string {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return "#0F172A";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Rec. 709 luminance
  const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return y > 0.6 ? "#0F172A" : "#FFFFFF";
}
