import {
  easeInOut,
  interpolate,
  type InterpolatedLayout,
  type Layout,
} from "@graview/layout";
import { useEffect, useRef, useState } from "react";
import type { AnySchema } from "@graview/core";
import { useGraview } from "./context.js";

export interface TransitionOptions {
  /** Milliseconds. Long enough to follow, short enough not to wait for. */
  readonly duration?: number;
  /** Skip animation entirely — tests, SSR, reduced-motion. */
  readonly enabled?: boolean;
}

const DEFAULT_DURATION = 520;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Tweens between two layouts whenever the view changes.
 *
 * This is the pay-off for layout being a pure function: there is no list of
 * known transitions and no per-navigation animation code. ANY two view states
 * interpolate, so a kind of navigation nobody anticipated animates the same
 * as the ones that were designed — and a node entering the scene grows out of
 * whatever group stood in for it, because the interpolation knows where it
 * came from.
 *
 * Motion is the one thing that makes depth legible. Without it, a plane
 * change is a cut and the viewer has to re-find everything; with it, the eye
 * follows and spatial memory survives the move.
 */
export function useAnimatedLayout(
  target: Layout,
  options: TransitionOptions = {},
): InterpolatedLayout {
  const duration = options.duration ?? DEFAULT_DURATION;
  const enabled = (options.enabled ?? true) && !prefersReducedMotion();

  const from = useRef<Layout>(target);
  const [current, setCurrent] = useState<InterpolatedLayout>(() =>
    interpolate(target, target, 1),
  );
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || typeof requestAnimationFrame === "undefined") {
      from.current = target;
      setCurrent(interpolate(target, target, 1));
      return;
    }

    // Tween from wherever the scene actually IS, not from the last target:
    // interrupting a transition half way must not snap back to its start.
    const start = performance.now();
    const origin = from.current;

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = easeInOut(t);
      setCurrent(interpolate(origin, target, eased));
      if (t < 1) {
        frame.current = requestAnimationFrame(step);
      } else {
        from.current = target;
        frame.current = null;
      }
    };

    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      // Freeze where the interruption caught it, so the next tween starts here.
      from.current = {
        ...target,
        nodes: current.nodes.map((node) => ({
          ...node,
          plane: Math.round(node.plane) as 0 | 1 | 2,
        })),
        connectors: current.connectors,
      };
    };
    // `current` is deliberately not a dependency: reading it in cleanup is the
    // point, and depending on it would restart the tween on every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, enabled]);

  return current;
}

/**
 * The nodes implicated by the most recent change, for about a second.
 *
 * Human and agent edits arrive through the same subscription carrying the
 * same diff, so the interface cannot render one differently from the other
 * even by accident — which is the point. The renderer highlights an agent's
 * work with exactly the code that highlights yours.
 */
export function useTouched<S extends AnySchema>(holdMs = 1100): ReadonlySet<string> {
  const { store } = useGraview<S>();
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = store.subscribe((diff) => {
      setTouched(new Set(diff.touched));
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setTouched(new Set()), holdMs);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [store, holdMs]);

  return touched;
}
