import { FRAME_BUDGET_MS, framesHeld, planeBlurOn } from "@graview/render";
import { useEffect, useState } from "react";

/** Whether a media query matches, kept current. False where there is no window. */
function usePrefers(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const list = window.matchMedia(query);
    const changed = () => setMatches(list.matches);
    changed();
    list.addEventListener("change", changed);
    return () => list.removeEventListener("change", changed);
  }, [query]);
  return matches;
}

/**
 * The reader's own Motion setting, which outranks the system's: "reduce" or
 * "full" on the root's `data-graview-motion`, null when it is the system's.
 */
function useMotionSetting(): string | null {
  const read = () => (typeof document === "undefined" ? null : document.documentElement.getAttribute("data-graview-motion"));
  const [setting, setSetting] = useState(read);
  useEffect(() => {
    if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;
    const watch = new MutationObserver(() => setSetting(read()));
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-graview-motion"] });
    setSetting(read());
    return () => watch.disconnect();
  }, []);
  return setting;
}

/**
 * Whether receded planes are blurred on this page: the host's switch, then
 * the reader's — less motion (the Motion setting first, the system's
 * preference otherwise) or less transparency turns it off.
 */
export function usePlaneBlur(on: boolean): boolean {
  const systemStill = usePrefers("(prefers-reduced-motion: reduce)");
  const reducedTransparency = usePrefers("(prefers-reduced-transparency: reduce)");
  const setting = useMotionSetting();
  const reducedMotion = setting === "reduce" || (setting !== "full" && systemStill);
  return planeBlurOn({ off: !on, reducedMotion, reducedTransparency });
}

/**
 * How long a frame may take, between two, while blurred hosts move, before
 * the blur is dropped. A frame and a half: a display's own frame is the
 * budget, and missing one in twenty is what a blur may not cost.
 */
export const DOM_BLUR_FRAME_MS = FRAME_BUDGET_MS * 1.5;

/** Frames timed in motion before the DOM path's blur is judged. */
const FRAMES_JUDGED = 30;

/**
 * THE DOM PATH BLURS WITHIN BUDGET OR NOT AT ALL. While the picture moves
 * with its receded planes blurred, the frames are timed; if a twentieth of
 * them run past `DOM_BLUR_FRAME_MS`, the blur is dropped for the rest of the
 * page — once, silently, since a sharper picture is nothing to announce.
 *
 * Once, not back and forth: a blur switched on and off as the picture
 * changed is every host repainted at each switch, a slow frame of its own.
 * And not by counting hosts: the snapped radius repaints a host only when
 * its plane changes, so a crowd costs what its frames say it costs.
 */
export function useDomBlurWithinBudget(wanted: boolean, moving: boolean): boolean {
  const [over, setOver] = useState(false);
  const within = wanted && !over;
  useEffect(() => {
    if (!within || !moving || typeof requestAnimationFrame === "undefined") return;
    const frames: number[] = [];
    let last = 0;
    let handle = 0;
    const tick = (now: number) => {
      if (last > 0) frames.push(now - last);
      last = now;
      if (frames.length >= FRAMES_JUDGED) {
        if (!framesHeld(frames, DOM_BLUR_FRAME_MS)) {
          setOver(true);
          return;
        }
        frames.length = 0;
      }
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [within, moving]);
  return within;
}
