import type { CSSProperties } from "react";

/**
 * HOW TALL A FACE CONTROL STANDS IN A DESIGN'S BAR: `"sm"` is the app
 * bar's own tools (30 px), `"md"` a capsule beside them (36 px), and a
 * number (px) or a CSS length is the bar's own height. Left out, each
 * stands as it always has — Find at 30, the way back at 36.
 */
export type ControlSize = "sm" | "md" | number | (string & {});

/** The attributes that say a size: a named one as `data-size`, a height as `--graview-control-height`. */
export function sizedBy(size: ControlSize | undefined): { "data-size"?: string; style?: CSSProperties } {
  if (size === undefined) return {};
  if (size === "sm" || size === "md") return { "data-size": size };
  return { style: { "--graview-control-height": typeof size === "number" ? `${size}px` : size } as CSSProperties };
}

/** A design's class after the control's own. */
export const classes = (own: string, theirs: string | undefined) => (theirs ? `${own} ${theirs}` : own);
