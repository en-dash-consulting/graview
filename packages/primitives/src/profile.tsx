import { humanizeField, labelOf, nameOfAuthor, type AnySchema } from "@graview/core";
import { POPOVER_STYLE, useGraview, usePopover } from "@graview/react/provider";
import { LadderSetting } from "./ladder.js";
import type { ReactNode } from "react";
import { Seats } from "./seats.js";

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
  compact = false,
}: {
  /** Just the mark: the name is the title. For a bar without the room. */
  readonly compact?: boolean;
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
  const { store, principal, seats, people, settings, settingValues, chooseSetting, sharing, hostAnswers } = useGraview<S>();
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
  const roles = principal.roles ?? [];

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        data-testid="profile-button"
        {...popover.trigger}
        onClick={popover.toggle}
        title="Who you are signed in as, and your own settings"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "4px 11px",
          borderRadius: 999,
          fontSize: "0.875rem",
          whiteSpace: "nowrap",
          /* In em, so the room for a name grows with the name. At 220px a
             reader on Largest got "Nobody in p…" — the setting made the
             words bigger and the box they live in stayed exactly where it
             was, which is the clipping the setting exists to prevent. */
          maxWidth: "14em",
        }}
      >
        <span
          aria-hidden="true"
          data-testid="profile-mark"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            /* The mark is a letter in a circle: sized in em it stays a
               circle around the letter at every text size, where 18px at
               2rem was a letter standing outside its own badge. */
            width: "1.35em",
            height: "1.35em",
            borderRadius: 999,
            fontSize: "0.75rem",
            background: "var(--graview-panel-muted)",
            color: "var(--graview-ink-muted)",
          }}
        >
          {initial(name)}
        </span>
        <span style={compact ? { position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" } : { overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
        {/*
          * A GEAR, because this is where the settings are.
          *
          * A name alone reads as an account menu, and the things a person
          * actually comes here for — how big the words are, whether things
          * move, which scheme — are settings. The mark says so before it is
          * opened, which is the difference between finding them and being
          * told where they were.
          */}
        <span aria-hidden="true" data-testid="profile-gear" style={{ fontSize: "0.75rem", color: "var(--graview-ink-faint)" }}>
          ⚙
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
          <div style={{ display: "grid", gap: 3 }}>
            <span style={eyebrow}>Signed in as</span>
            <strong style={{ fontSize: "1rem", fontWeight: 550 }}>{name}</strong>
            <span style={{ fontSize: "0.8125rem", color: "var(--graview-ink-muted)" }}>
              {/* An app with no policy has no roles to name, and saying
                  "no roles" would read as a deprivation rather than as the
                  absence of a permission system. */}
              {roles.length > 0
                ? // A role in words — "Sales manager", never "sales-manager".
                  roles.map((role) => humanizeField(role)).join(", ")
                : me === undefined
                  ? "This app has no sign-in; everything here is yours."
                  : "No role in particular"}
            </span>
            {me !== undefined && profileHref !== undefined ? (
              <a
                href={profileHref(me.id)}
                data-testid="profile-record"
                style={{
                  /*
                   * A full fingertip, like every other control the audit
                   * counts. It was nineteen pixels tall — and nothing had
                   * ever measured it, because until the keeper's own ways
                   * in moved here no audited screen opened this pane.
                   */
                  display: "inline-flex",
                  alignItems: "center",
                  minHeight: 24,
                  justifySelf: "start",
                  fontSize: "0.875rem",
                  color: "var(--graview-accent)",
                }}
              >
                Your record ↗
              </a>
            ) : null}
            {sharing ? (
              /* How the others here see you — the name on the figure that stands where you are. */
              <span data-testid="profile-seen-as" style={{ fontSize: "0.8125rem", color: "var(--graview-ink-muted)" }}>
                Seen by others as {sharing.name}
              </span>
            ) : null}
          </div>

          {/*
            * THE HOST'S OWN ACTIONS (FR-72), under who you are: "Your apps",
            * "Change the app", "Report this app" — the host's, about the app
            * and the person, where a person looks for exactly that. Graview
            * Cloud kept them in a menu of its own fixed over the scene's
            * corner, because the embed had nowhere to put them. A link is a
            * link (opened where the host says), and a press closes the menu.
            */}
          {hostActions.length > 0 ? (
            <ul role="list" aria-label="From the host" data-testid="host-actions" style={{ ...ruled, margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 2 }}>
              {hostActions.map((action) => (
                <li key={action.label}>
                  {action.href !== undefined ? (
                    <a
                      href={action.href}
                      data-testid="host-action"
                      className="graview-host-action"
                      {...(action.target ? { target: action.target, rel: "noopener" } : {})}
                      onClick={() => {
                        action.onSelect?.();
                        popover.setOpen(false);
                      }}
                      style={hostRow}
                    >
                      {action.label}
                    </a>
                  ) : (
                    <button
                      type="button"
                      data-testid="host-action"
                      className="graview-host-action"
                      onClick={() => {
                        popover.setOpen(false);
                        action.onSelect?.();
                      }}
                      style={{ ...hostRow, width: "100%", textAlign: "left", border: "none", background: "none", boxShadow: "none", font: "inherit", cursor: "pointer" }}
                    >
                      {action.label}
                    </button>
                  )}
                </li>
              ))}
            </ul>
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

          {seats.length > 1 ? (
            <div style={{ display: "grid", gap: 6, ...ruled }}>
              <span style={eyebrow}>Sit as somebody else</span>
              <Seats<S> />
            </div>
          ) : null}

          {/* Which rung answers the chat: a setting like the others, not a pane over the map. */}
          {hostAnswers ? null : (
            <div style={{ display: "grid", gap: 6, ...ruled }}>
              <LadderSetting />
            </div>
          )}

          {settings.length > 0 ? (
            <div style={{ display: "grid", gap: 10, ...ruled }}>
              {settings.map((setting) => (
                <fieldset
                  key={setting.name}
                  data-testid={`setting-${setting.name}`}
                  style={{ border: 0, margin: 0, padding: 0, display: "grid", gap: 5 }}
                >
                  <legend style={{ ...eyebrow, padding: 0 }}>{setting.title}</legend>
                  {setting.description ? (
                    <span style={{ fontSize: "0.8125rem", color: "var(--graview-ink-muted)" }}>
                      {setting.description}
                    </span>
                  ) : null}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {setting.options.map((option) => {
                      const chosen = (settingValues[setting.name] ?? setting.initial) === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={chosen}
                          data-testid={`setting-${setting.name}-${option.value}`}
                          onClick={() => chooseSetting(setting.name, option.value)}
                          style={{
                            /*
                             * 24px tall, like every other control the audit
                             * counts — a setting for people who find the
                             * text small must not itself be a small target.
                             */
                            minHeight: 24,
                            padding: "3px 10px",
                            borderRadius: 999,
                            fontSize: "0.875rem",
                            borderWidth: 1,
                            borderStyle: "solid",
                            borderColor: chosen ? "var(--graview-accent)" : "var(--graview-edge)",
                            color: chosen ? "var(--graview-accent)" : "var(--graview-ink-muted)",
                            background: chosen ? "var(--graview-panel)" : "transparent",
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          ) : null}

          {scheme !== undefined && onScheme !== undefined ? (
          <div style={{ display: "grid", gap: 5, ...ruled }}>
            <span style={eyebrow}>Scheme</span>
            <div style={{ display: "flex", gap: 4 }}>
              {(["light", "dark"] as const).map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  aria-pressed={scheme === candidate}
                  data-testid={`profile-scheme-${candidate}`}
                  onClick={() => onScheme(candidate)}
                  style={{
                    minHeight: 24,
                    padding: "3px 10px",
                    borderRadius: 999,
                    fontSize: "0.875rem",
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: scheme === candidate ? "var(--graview-accent)" : "var(--graview-edge)",
                    color: scheme === candidate ? "var(--graview-accent)" : "var(--graview-ink-muted)",
                    background: scheme === candidate ? "var(--graview-panel)" : "transparent",
                  }}
                >
                  {candidate === "light" ? "☀ Light" : "☾ Dark"}
                </button>
              ))}
            </div>
          </div>
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

/** A row of the host's: a full fingertip, the ink of the pane, the accent when the keyboard is on it. */
const hostRow = {
  display: "flex",
  alignItems: "center",
  minHeight: 28,
  padding: "2px 8px",
  borderRadius: 7,
  fontSize: "0.875rem",
  color: "var(--graview-ink)",
  textDecoration: "none",
};

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

/** One letter for the mark, from a name rather than from an id. */
function initial(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}
