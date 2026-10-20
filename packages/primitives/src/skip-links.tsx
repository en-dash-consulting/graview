import { layer } from "@graview/core";

/*
 * THE WAY PAST WHAT STANDS BEFORE THE WORK (WCAG 2.4.1, Bypass Blocks).
 *
 * From the keyboard the bar is twelve stops — the app, the switch, every
 * place, Find, Activity, the standing, the person — and a list's first box
 * was twenty-five Tabs from the top of its page; the chosen card on the
 * scene was nineteen, and the problems twelve (walks XI and XII, `pnpm
 * verify journeys`). A skip is the first thing Tab reaches where it stands:
 * unseen until the keyboard is on it, then said in words, and Enter takes
 * the keyboard straight to what it names. Unfocused it has no size at all,
 * not a pixel: a pixel beside a pixel is two targets crowding each other (the
 * watch's `target-too-small`). Each says `data-graview-skip`, so
 * a person's way through a page can be read off it.
 */

/** One way past: what it is said as, and where Enter takes the keyboard. */
export interface SkipTo {
  /** The words, "Skip to …". */
  readonly label: string;
  /** Its test id, and the word the journeys read it by. */
  readonly testid: string;
  /** Takes the keyboard there — `focusInto` the place, or a press that opens it. */
  readonly go: () => void;
  /** It opens what it names (a list, a page) rather than only moving the keyboard; said as `data-graview-skip-opens`. */
  readonly opens?: boolean;
}

/** Whether the keyboard can stop on this element as it is. */
const stops = (element: HTMLElement) => element.tabIndex >= 0 && !(element as HTMLButtonElement).disabled && element.getClientRects().length > 0;

/**
 * THE KEYBOARD INTO A PLACE: onto it where it takes the keyboard, else onto
 * the first thing inside it Tab would stop on — a list's one stop among its
 * boxes, not a box Tab passes over — else onto the place itself, held
 * there for the next Tab to start from. False when there is no place.
 */
export function focusInto(place: HTMLElement | null | undefined): boolean {
  if (!place) return false;
  if (stops(place)) {
    place.focus({ preventScroll: false });
    return true;
  }
  const inside = [...place.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [tabindex]")].find(stops);
  if (inside) {
    inside.focus();
    return true;
  }
  if (!place.hasAttribute("tabindex")) place.setAttribute("tabindex", "-1");
  place.focus();
  return true;
}

const SKIP_CSS = `.graview-skips{display:contents}
.graview-skip{position:absolute;width:0;height:0;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
.graview-skip:focus{width:auto;height:auto;overflow:visible;clip-path:none;padding:6px 12px;border-radius:8px;border:1px solid var(--graview-accent);background:var(--graview-float,var(--graview-panel));color:var(--graview-ink);font:inherit;font-size:.875rem;font-weight:600;box-shadow:var(--graview-lift-high);outline:2px solid var(--graview-accent);outline-offset:1px}
.graview-skips[data-place=bar] .graview-skip:focus{position:fixed;left:8px;top:6px;z-index:${layer("toast")}}
.graview-skips[data-place=here] .graview-skip:focus{position:static;justify-self:start}`;

/**
 * The skips where they stand: `bar`, first in the app's bar and drawn over
 * its corner when the keyboard is on one; `here`, in the page's own flow.
 */
export function SkipLinks({ to, place = "bar" }: { readonly to: readonly SkipTo[]; readonly place?: "bar" | "here" }) {
  if (to.length === 0) return null;
  return (
    <span className="graview-skips" data-place={place}>
      <style>{SKIP_CSS}</style>
      {to.map((skip) => (
        <button key={skip.testid} type="button" className="graview-skip" data-graview-skip={skip.testid} data-testid={`skip-${skip.testid}`} {...(skip.opens ? { "data-graview-skip-opens": "" } : {})} onClick={skip.go}>
          {skip.label}
        </button>
      ))}
    </span>
  );
}
