import { retryingImport } from "@graview/core/retry";
import { lazyModule } from "@graview/react/provider";
import { Suspense, useCallback, useRef, useState, type ComponentType } from "react";
import type { FirstLookHintsProps } from "./first-look.js";

/**
 * A FIRST LOOK THAT POINTS AT THE APP'S OWN CONTROLS, ONCE.
 *
 * A brand-new app is a bar of controls nobody has met: the switch between
 * the scene and the pages, the dot that counts what is wrong, Activity, the
 * quick ask. A host could point at them — but their selectors are not a
 * surface a host may hold the framework to (docs/stability.md), so a host's
 * tour broke the first time the bar was redrawn. The framework points at
 * its own controls instead, by name: a short run of hints, one at a time,
 * each beside the control it names and never over it, then out of the way.
 *
 * Shown once per viewer. The host says whether this viewer has seen it
 * (`seen`) and is told when it is over (`onDone`); with neither, the
 * browser remembers it (`localStorage`, where the browser lets it). Off
 * unless the host or the app turns it on, and nothing of it is fetched
 * until it is shown.
 */

/**
 * THE CONTROLS A FIRST LOOK CAN POINT AT, BY NAME: the framework's own,
 * found however the bar draws them. A host's step names one of these; what
 * each one is in the page is the framework's business, not the host's.
 *
 * - `faces` — the switch between the scene and the pages
 * - `problems` — the dot that says whether everything is in order, and counts what is not
 * - `activity` — what has happened, and the way to take it back
 * - `ask` — the quick ask (⌘K), where the app is asked in words; pointed at beside Find, and only where a quick ask is drawn
 * - `find` — Find
 * - `profile` — who you are, and your own settings
 * - `home` — the app's name, the way home
 */
export const FIRST_LOOK_ANCHORS = ["faces", "problems", "activity", "ask", "find", "profile", "home"] as const;
export type FirstLookAnchor = (typeof FIRST_LOOK_ANCHORS)[number];

/** One hint: the control it points at, what it is called, and what it is for. */
export interface FirstLookStep {
  readonly anchor: FirstLookAnchor;
  /** The control's name, said as the hint's heading: "Activity". */
  readonly title: string;
  /** What it is for, in a sentence or two. */
  readonly words: string;
}

/** How a first look ended: its last hint's Done, or Escape or a press elsewhere before it. */
export type FirstLookEnd = "finished" | "dismissed";

export interface FirstLookOptions {
  /**
   * Whether this viewer has seen it already: the host's own record of it
   * (a flag on the account, say), read once as the app draws. Unsaid, the
   * browser remembers it, where the browser lets it.
   */
  readonly seen?: boolean | (() => boolean);
  /** Told once it is over, however it ended — the moment to record that this viewer has seen it. */
  readonly onDone?: (how: FirstLookEnd) => void;
  /** The host's own hints, each naming a framework control, after the framework's. */
  readonly steps?: readonly FirstLookStep[];
}

/** What the Shell, `PagesApp` and `mount` take: `true` for the framework's hints remembered by the browser, or the host's seam. */
export type FirstLook = boolean | FirstLookOptions;

/** Where the browser remembers that this app's first look was seen. */
export const firstLookKey = (app: string): string => `graview:first-look:${app}`;

function seenBefore(options: FirstLookOptions, app: string): boolean {
  if (options.seen !== undefined) {
    try {
      return typeof options.seen === "function" ? options.seen() : options.seen;
    } catch {
      // A host that could not say: not shown, rather than shown every time.
      return true;
    }
  }
  try {
    return window.localStorage.getItem(firstLookKey(app)) !== null;
  } catch {
    // No storage here (a private window, blocked site data): shown, and not remembered.
    return false;
  }
}

function remember(options: FirstLookOptions, app: string): void {
  // The host keeps its own record; the browser only when it keeps none.
  if (options.seen !== undefined) return;
  try {
    window.localStorage.setItem(firstLookKey(app), "seen");
  } catch {
    // Not remembered: the next visit shows it again.
  }
}

const hintsModule = /* @__PURE__ */ lazyModule(retryingImport(() => import("./first-look.js")));
const Hints = /* @__PURE__ */ hintsModule.part(
  (module, props: FirstLookHintsProps) => {
    const Drawn = module.FirstLookHints as ComponentType<FirstLookHintsProps>;
    return <Drawn {...props} />;
  },
  // Nothing in its place when it does not arrive: it was a nicety, not the app.
  { quiet: true },
);

export interface FirstLookDoorProps {
  readonly firstLook: FirstLook | undefined;
  /** What the app's own controls are found in: its frame, or the page. */
  readonly root: () => Element | null;
  /** The app the browser remembers it for (`appKeyOf`). */
  readonly app: string;
}

/**
 * THE DOOR: nothing at all once it has been seen, or when nobody turned it
 * on; else the hints, fetched as they are first shown.
 */
export function FirstLookDoor({ firstLook, root, app }: FirstLookDoorProps) {
  const options = useRef<FirstLookOptions | null>(null);
  options.current = firstLook === true ? {} : firstLook ? firstLook : null;
  const [showing, setShowing] = useState(() => options.current !== null && typeof window !== "undefined" && !seenBefore(options.current, app));
  const end = useCallback(
    (how: FirstLookEnd | null) => {
      setShowing(false);
      // Nothing was drawn to point at: nothing was seen.
      if (how === null) return;
      const given = options.current ?? {};
      remember(given, app);
      given.onDone?.(how);
    },
    [app],
  );
  if (!showing || options.current === null) return null;
  return (
    <Suspense fallback={null}>
      <Hints root={root} steps={options.current.steps ?? []} onEnd={end} />
    </Suspense>
  );
}
