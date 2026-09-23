import type { Matrix4 } from "@graview/render";
import { useEffect, useState } from "react";
import type { SceneNode } from "./scene-root.js";

/**
 * What a click on a view selects.
 *
 * Selecting a GROUP selects its members, because a group is a view of a set
 * of nodes rather than a node itself — "select the People block" means the
 * people. Everything downstream then works unchanged: the affordance layer
 * sees a selection of real nodes and can say what is true about them.
 */
export function selectionFor(
  node: SceneNode,
  current: readonly string[],
  additive: boolean,
): string[] {
  const ids = node.aggregate ? [...node.aggregate.memberIds] : [node.id];
  if (!additive) return ids;
  const alreadyIn = ids.every((id) => current.includes(id));
  return alreadyIn
    ? current.filter((id) => !ids.includes(id))
    : [...current, ...ids.filter((id) => !current.includes(id))];
}

/**
 * WHAT ONE `rem` IS WORTH RIGHT NOW — the reader's own text size, watched.
 *
 * The scene's cards hold text sized in `rem` and were laid out in pixels,
 * so a reader who asked for bigger words got them inside a city that had
 * not moved: a headline in a glyph. The layout takes this as its unit, so
 * the picture grows with the words.
 *
 * Read from the root rather than from a setting's name, because the scene
 * has no business knowing what an app called its text-size control — the
 * root font size is where every such control lands, including the browser's
 * own, which no app declares at all.
 */
export function useRootUnit(): number {
  const [unit, setUnit] = useState(16);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const read = () => {
      const now = parseFloat(getComputedStyle(root).fontSize);
      if (Number.isFinite(now)) setUnit((held) => (Math.abs(held - now) < 0.5 ? held : now));
    };
    read();
    /*
     * The setting writes the root's own `style`, and a reader changing the
     * browser's default changes the computed size without touching it — so
     * both are watched: the attribute for the app's control, and a resize
     * for the browser's.
     */
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["style"] });
    window.addEventListener("resize", read);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", read);
    };
  }, []);
  return unit;
}

/**
 * The element's size, tracked. Returns null until it has been measured, so a
 * first render never lays out against a guess.
 */
export function useElementSize(
  ref: { current: HTMLElement | null },
): { width: number; height: number } | null {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box || box.width === 0 || box.height === 0) return;
      // Round to whole pixels: a fractional width would recompute the layout
      // on every sub-pixel wobble and never settle.
      setSize((current) => {
        const next = { width: Math.round(box.width), height: Math.round(box.height) };
        return current && current.width === next.width && current.height === next.height
          ? current
          : next;
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

/**
 * A plane's elevation, in the idiom of its scheme.
 *
 * Dark separates by luminance, so one soft dark pool is right. Light
 * separates the way objects on a desk do — a tight contact shadow plus a
 * long diffuse one — so it gets both, and the further plane casts the
 * longer, weaker one.
 */
export function planeShadow(shadow: number, scheme: "light" | "dark"): string {
  if (scheme === "dark") {
    return `0 ${(10 * shadow).toFixed(1)}px ${(34 * shadow).toFixed(1)}px rgba(0,0,0,${(shadow + 0.12).toFixed(2)})`;
  }
  const contact = `0 ${(1 + 2 * shadow).toFixed(1)}px ${(2 + 5 * shadow).toFixed(1)}px rgba(20,30,32,${(0.03 + 0.06 * shadow).toFixed(3)})`;
  const cast = `0 ${(6 + 26 * shadow).toFixed(1)}px ${(18 + 60 * shadow).toFixed(1)}px -${(10 + 10 * shadow).toFixed(1)}px rgba(20,30,32,${(0.1 + 0.3 * shadow).toFixed(3)})`;
  return `${contact}, ${cast}`;
}

export function cssTransform(transform: Matrix4): string {
  // Column-major 4x4 into CSS matrix3d, which is also column-major.
  return `matrix3d(${transform.join(",")})`;
}
