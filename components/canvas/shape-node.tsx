"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export interface ShapeNodeData {
  shape: "RECTANGLE" | "DIAMOND" | "CIRCLE";
  label: string | null;
  colorHex: string;
  width: number;
  height: number;
  [key: string]: unknown; // React Flow's NodeProps expects index signature on data
}

// Single node renderer that branches on `shape`. A diamond is a
// 45°-rotated square with counter-rotated label — keeps the bounding box
// the same as a rectangle so edges attach sanely.
export const ShapeNode = memo(function ShapeNode({ data, selected }: NodeProps) {
  const d = data as ShapeNodeData;
  const label = d.label ?? "";
  const borderColor = selected ? "var(--primary)" : "color-mix(in oklch, currentColor 30%, var(--border))";
  const ring = selected ? "0 0 0 2px color-mix(in oklch, var(--primary) 40%, transparent)" : "none";

  const base: React.CSSProperties = {
    width: d.width,
    height: d.height,
    background: d.colorHex,
    border: `1.5px solid ${borderColor}`,
    boxShadow: ring,
    color: textColorFor(d.colorHex),
    borderRadius: d.shape === "CIRCLE" ? "50%" : "10px",
  };

  const content = (
    <span
      className="pointer-events-none select-none px-3 text-center font-display text-[0.92rem] font-semibold tracking-[-0.01em] leading-tight"
      data-label=""
    >
      {label || <span className="opacity-50">dwuklik aby nazwać</span>}
    </span>
  );

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
    </>
  );
});

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
