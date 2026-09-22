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
  // The LIVE frame, kept in a ref.
  //
  // The effect below is not re-created on the frames it itself causes, so a
  // cleanup closing over `current` sees the frame from when the effect
  // started — which made an interrupted transition resume from where the
  // previous one began, and made every navigation after the first jump back
  // two states before animating forward.
  const latest = useRef<InterpolatedLayout>(current);
  const frame = useRef<number | null>(null);
  /*
   * WHEN THIS FLIGHT BEGAN, kept across restarts. A new target arriving
   * mid-flight — the camera re-centring a frame after a click, a host
   * reporting a size, a wheel's worth of events — used to start a fresh
   * tween from the live frame with the whole duration and the ease-in from
   * zero, so a stream of them moved the scene a hair a frame and never
   * arrived: a crawl. The clock belongs to the flight, not the target: a
   * restart tweens from the live frame to the new target over what is LEFT,
   * picking the easing up at the velocity it already had.
   */
  const clock = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || typeof requestAnimationFrame === "undefined") {
      from.current = target;
      const settled = interpolate(target, target, 1);
      latest.current = settled;
      setCurrent(settled);
      /*
       * The same settle tick the tween gets, for the cut.
       *
       * With motion off — reduced-motion, a test, a drag that owns the
       * pointer — the render that draws the new layout still measures the
       * PREVIOUS commit's DOM, so every measured line sat one navigation
       * behind the cards until something else happened to re-render. One
       * more render on the next frame reads the settled geometry.
       */
      if (typeof requestAnimationFrame === "undefined") return;
      const tick = requestAnimationFrame(() => {
        const again = interpolate(target, target, 1);
        latest.current = again;
        setCurrent(again);
      });
      return () => cancelAnimationFrame(tick);
    }

    // Tween from wherever the scene actually IS, not from the last target:
    // interrupting a transition half way must not snap back to its start.
    const now = performance.now();
    const inFlight = clock.current !== null && latest.current.t < 1 && now - clock.current < duration;
    const start = inFlight ? clock.current! : now;
    clock.current = start;
    // Where the easing already is, so the rest of the flight continues from
    // that point on the curve rather than easing in again from a standstill.
    const alreadyEased = easeInOut(Math.min(1, (now - start) / duration));
    const origin = from.current;

    const step = (at: number) => {
      const t = Math.min(1, (at - start) / duration);
      const eased = alreadyEased >= 1 ? 1 : (easeInOut(t) - alreadyEased) / (1 - alreadyEased);
      const next = interpolate(origin, target, Math.max(0, eased));
      latest.current = next;
      setCurrent(next);
      if (t < 1) {
        frame.current = requestAnimationFrame(step);
      } else {
        clock.current = null;
        from.current = target;
        /*
         * ONE SETTLE TICK after the last frame has painted.
         *
         * Anything that measures the DOM during render — connectors, ties,
         * captions — reads the PREVIOUS commit's geometry, so the render
         * that draws t = 1 measures wherever the scene was a frame earlier.
         * On a smooth tween that is a fraction of a percent; across a
         * dropped frame it is a visible stray line frozen in mid-air. A
         * final render on the next frame measures the settled DOM, and a
         * fresh object identity is what makes React run it.
         */
        frame.current = requestAnimationFrame(() => {
          const settled = interpolate(target, target, 1);
          latest.current = settled;
          setCurrent(settled);
          frame.current = null;
        });
      }
    };

    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      // Freeze where the interruption caught it, so the next tween starts
      // here — from the live frame, not the one this effect began with.
      const live = latest.current;
      from.current = {
        ...target,
        nodes: live.nodes.map((node) => ({
          ...node,
          plane: Math.round(node.plane) as 0 | 1 | 2,
        })),
        connectors: live.connectors,
      };
    };
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

/** One thing the seat did, and what it touched. */
export interface SeatAct {
  readonly batch: string;
  /** The agent's own name, from the op's author. */
  readonly who: string;
  readonly intent: string;
  readonly at: string;
  readonly wrote: readonly string[];
}

export interface SeatWork {
  /** Node id → the seat that wrote it, while the mark stands. */
  readonly marks: ReadonlyMap<string, string>;
  /** What the seat has done this session, newest first — the companion's log. */
  readonly acts: readonly SeatAct[];
}

const NO_WORK: SeatWork = { marks: new Map(), acts: [] };

/**
 * WHERE THE SEAT WORKED, MARKED ON THE THINGS THEMSELVES.
 *
 * The robot used to walk to what it wrote and stand there, which is the
 * one thing the body was genuinely good for: attribution in space. The
 * walk is gone; the attribution is not. Every op the log attributes to an
 * agent marks what it wrote for a hold, and the acts stay in a list the
 * companion can offer to fly you to.
 *
 * Read from the OP LOG rather than from the seat's own reports, so it is
 * the same on both render paths, inside a lens, and for a turn that
 * arrived from somewhere else entirely. An undo takes its marks with it:
 * an op that undoes another says so, and what it took back stops being
 * something the seat just did.
 */
export function useSeatWork<S extends AnySchema>(holdMs = 4000): SeatWork {
  const { store } = useGraview<S>();
  const [work, setWork] = useState<SeatWork>(NO_WORK);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = store.subscribe((_diff, ops) => {
      setWork((current) => {
        const marks = new Map(current.marks);
        let acts = [...current.acts];
        for (const op of ops) {
          if (op.undoes !== undefined) {
            /*
             * Taken back: the act leaves the log the companion shows, and
             * the marks it put on things leave with it. A mark over a
             * change that no longer exists is the seat claiming credit for
             * nothing.
             */
            const undone = acts.find((act) => act.batch === op.undoes || act.wrote.length > 0);
            const taken = acts.filter((act) => op.writes.some((id) => act.wrote.includes(id)));
            for (const act of taken.length > 0 ? taken : undone ? [undone] : []) {
              for (const id of act.wrote) marks.delete(id);
              acts = acts.filter((one) => one.batch !== act.batch);
            }
            continue;
          }
          if (op.author.kind !== "agent") continue;
          const who = op.author.id ?? "the seat";
          for (const id of op.writes) marks.set(id, who);
          const already = acts.find((act) => act.batch === op.batch);
          if (already) {
            acts = acts.map((act) =>
              act.batch === op.batch
                ? { ...act, wrote: [...new Set([...act.wrote, ...op.writes])] }
                : act,
            );
          } else {
            acts = [{ batch: op.batch, who, intent: op.intent, at: op.at, wrote: [...op.writes] }, ...acts].slice(0, 12);
          }
        }
        return marks.size === current.marks.size && acts === current.acts && marks.size === 0
          ? current
          : { marks, acts };
      });
      if (timer) clearTimeout(timer);
      /* The marks fade; the log stays, because "what did it just do" outlives the flash. */
      timer = setTimeout(() => setWork((current) => (current.marks.size === 0 ? current : { ...current, marks: new Map() })), holdMs);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [store, holdMs]);

  return work;
}
