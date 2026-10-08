import { labelOf, nameOfAuthor, type AnySchema } from "@graview/core";
import { POPOVER_STYLE, useGraview, usePopover } from "@graview/react/provider";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { TOOL, toolStyle } from "./app-bar.js";

/**
 * WHO YOU ARE AT THIS KEYBOARD, AND WHAT YOU SET FOR YOURSELF.
 *
 * Every app needs one place that answers "who am I signed in as" and holds
 * the handful of things that are the READER's rather than the
 * installation's. Text size is the case that forced it: the framework sizes
 * every surface in `rem` precisely so that one number on the root element
 * resizes the whole app — and until now nothing anywhere offered that
 * number, so the property existed and nobody could use it.
 *
 * What the pane holds, in the order a person looks for it:
 *
 *   who you are — the seat's own name and role, and where the installation
 *                 is declared, a way into your own record, which the self
 *                 grant already makes yours to edit and nobody else's;
 *   which seat  — the switcher, where the app offers a choice, because
 *                 "who am I" and "be somebody else" belong together;
 *   your settings — drawn from the DECLARATION. Nothing here knows what
 *                 "text size" means; it renders what the app declared and
 *                 the provider has already carried the answer to the root.
 *   the scheme  — light or dark, which was on the bar alone.
 *   keeping it — and, for the seat that keeps this installation ONLY, the
 *                ways into it: its own districts, and its declaration.
 *
 * That last block was two pills on the bar, beside the places — which put
 * administration in the same row as "the week" and "the month", where every
 * reader saw the app's shape before they saw their own work. They are the
 * keeper's, they are rare, and they belong behind the same door as "who am
 * I". A member never sees the block at all, because both controls draw
 * nothing for a seat that may not administer and the block hides itself
 * when it holds nothing.
 *
 * What is NOT administration stays what it was: a member sees their own
 * name, their own record and their own text size, and never a person who is
 * not them.
 */
export function Profile<S extends AnySchema>({
  scheme,
  onScheme,
  /** Where a person's own record lives on the routed face, if there is one. */
  profileHref,
  /**
   * The ways into the app itself, for the seat that keeps it: showing the
   * installation's own districts, and opening its declaration in the studio.
   *
   * A slot rather than a fixed pair, because the studio lives in a package
   * this one must not depend on — the same reason the shell takes it as a
   * node. Both of them render nothing for a seat that may not administer,
   * and the block they sit in hides itself when they do.
   */
  keeping,
  hostActions = NO_HOST_ACTIONS,
}: {
  /**
   * The scheme, where this surface owns it. An embed wears the scheme its
   * host chose and has no business offering to change it, so both are
   * optional and the block is simply absent — a control that cannot act is
   * worse than no control.
   */
  readonly scheme?: "light" | "dark";
  readonly onScheme?: (scheme: "light" | "dark") => void;
  readonly profileHref?: (userId: string) => string;
  readonly keeping?: ReactNode;
  /** The host's own ways out and about: its links, drawn under who you are (FR-72). */
  readonly hostActions?: readonly HostAction[];
}) {
  const { store, principal, seats, people } = useGraview<S>();
  /*
   * ONE OF THE FAMILY (FR-77): opening it closes any other popover, the
   * keyboard goes in, Escape or a press outside closes it and gives the
   * keyboard back to the button, and it hangs from the button in the top
   * layer, turned over or scrolling so no row is under the viewport's edge.
   * A press inside a dialog it opened (the studio, from "keeping") is not a
   * press away from it.
   */
  const popover = usePopover("profile");
  const open = popover.open;
  /*
   * WHAT IS BEHIND IT, FETCHED WHEN IT IS FIRST REACHED FOR (FR-131): on a
   * pointer over it, the keyboard on it, or a press — and kept once drawn,
   * so a studio it opened outlives the menu (below).
   */
  const [everOpened, setEverOpened] = useState(false);
  // Fetched once the page has drawn, so the first press opens a full menu.
  useEffect(() => {
    const later = setTimeout(fetchPane, 2500);
    return () => clearTimeout(later);
  }, []);
  if (open && !everOpened) setEverOpened(true);

  /*
   * The person's own record, WHERE THERE IS ONE.
   *
   * A principal's id is its user node's id — that is what a self grant
   * compares — so "who is signed in" is a graph lookup and not a second
   * identity system. An app with no installation has no such node, and the
   * pane says who you are from the principal alone rather than inventing a
   * name.
   */
  const me = principal.id === undefined ? undefined : store.graph.getNode(principal.id);
  const name =
    me === undefined
      ? principal.id === undefined
        ? "Nobody in particular"
        : nameOfAuthor(principal, { graph: store.graph as never, schema: store.schema, seats, people })
      : labelOf(store.schema.tryDefinition(me.kind as string), me);

  return (
    <div style={{ position: "relative" }}>
      {/*
        * THE PERSON, AS ONE OF THE BAR'S TOOLS (FR-131): a letter in a
        * circle, the bar's one size, named in words — who is signed in, and
        * that their own settings, the seats and the host's own actions are
        * behind it. The name was on the bar beside a gear; it is said in the
        * menu it opens, where there is room for it whole.
        */}
      <button
        type="button"
        data-testid="profile-button"
        {...popover.trigger}
        onClick={popover.toggle}
        onPointerEnter={fetchPane}
        onFocus={fetchPane}
        aria-label={`${name} — you, your seat and your settings`}
        title={`${name} — you, your seat and your settings`}
        style={{ ...toolStyle, borderRadius: 999 }}
      >
        <span
          aria-hidden="true"
          data-testid="profile-mark"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: TOOL - 4,
            height: TOOL - 4,
            borderRadius: 999,
            fontSize: "0.8125rem",
            fontWeight: 600,
            background: "var(--graview-panel-muted)",
            color: "var(--graview-ink)",
            border: "1px solid var(--graview-edge)",
          }}
        >
          {initial(name)}
        </span>
      </button>

      {/*
        * MOUNTED WHETHER OR NOT IT IS OPEN, and hidden when it is not.
        *
        * A control in here may own something that outlives the pane: the
        * studio is a full-screen face whose portal belongs to the button
        * that opened it, so unmounting the pane on the first press inside
        * the studio took the studio with it. Hidden rather than absent, the
        * pane keeps its children alive, and `hidden` keeps them out of the
        * picture and out of the accessibility tree both.
        *
        * A labeled region, not an aside: it opens from the bar or inside an
        * embed's own region, and a complementary landmark inside another is
        * what axe's `landmark-complementary-is-top-level` refuses (FR-40).
        */}
      <section
          {...popover.pane}
          aria-label="Profile"
          data-testid="profile"
          data-graview-offstage=""
          hidden={!open}
          style={{
            ...POPOVER_STYLE,
            width: 280,
            maxWidth: "calc(100vw - 32px)",
            maxHeight: "min(62cqh, 520px)",
            overflowY: "auto",
            // Not `overflow: auto`: nothing in here may run off the side.
            // A setting's own sentence was clipped mid-word against the
            // pane's edge, which is the one thing a text-size control must
            // not do.
            overflowX: "hidden",
            /*
             * `hidden` alone is not enough when the element sets its own
             * display: an inline `display: grid` beats the browser's
             * `[hidden] { display: none }`, so the closed pane stayed on
             * top of the bar and swallowed every press aimed at it.
             */
            display: open ? "grid" : "none",
            gap: 12,
            padding: 12,
            borderRadius: 10,
            border: "1px solid var(--graview-edge)",
            background: "var(--graview-float)",
            boxShadow: "var(--graview-lift-high)",
          }}
        >
          {everOpened ? (
            <Suspense fallback={null}>
              <ProfilePane<S> part="top" name={name} me={me} profileHref={profileHref} hostActions={hostActions} close={() => popover.setOpen(false)} />
            </Suspense>
          ) : null}
          {/*
            * THE WAYS INTO THE APP ITSELF — under who you are, because that
            * is what decides whether they are there at all, and above the
            * reader's own settings, because a pane that put them last put
            * them below the fold on a laptop.
            *
            * Only for whoever keeps it: the block hides itself when both
            * controls draw nothing (see `.graview-profile-keeping` in the
            * theme), so a member never meets an empty heading where an
            * administrator's tools would be.
            *
            * No inline `display`: an inline style beats the stylesheet, and
            * the stylesheet is what does the hiding.
            */}
          <div className="graview-profile-keeping" data-testid="profile-keeping" style={ruled}>
            <span style={eyebrow}>Keeping this app</span>
            {keeping}
          </div>

          {everOpened ? (
            <Suspense fallback={null}>
              <ProfilePane<S> part="rest" name={name} me={me} scheme={scheme} onScheme={onScheme} hostActions={hostActions} close={() => popover.setOpen(false)} />
            </Suspense>
          ) : null}
        </section>
    </div>
  );
}

/**
 * ONE OF A HOST'S OWN ACTIONS, in the profile menu (FR-72): a link
 * (`href`, and `target` if it opens elsewhere) or a press (`onSelect`).
 * Given both, the link is followed and `onSelect` is told.
 */
export interface HostAction {
  readonly label: string;
  readonly href?: string;
  readonly target?: string;
  readonly onSelect?: () => void;
}

const NO_HOST_ACTIONS: readonly HostAction[] = [];




const fetchPane = () => void import("./bar-panes.js");
const ProfilePane = lazy(() => import("./bar-panes.js").then((pane) => ({ default: pane.ProfilePane }))) as typeof import("./bar-panes.js").ProfilePane;

/** One letter for the mark, from a name rather than from an id. */
function initial(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}

const eyebrow = {
  fontSize: "0.75rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase" as const,
  color: "var(--graview-ink-faint)",
};

const ruled = {
  paddingTop: 10,
  borderTop: "1px solid var(--graview-edge)",
};
