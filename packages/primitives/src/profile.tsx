import { labelOf, nameOfAuthor, type AnySchema } from "@graview/core";
import { useGraview } from "@graview/react";
import { LadderSetting } from "./ladder.js";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Seats } from "./seats.js";
import { closeToTrigger, keepInside } from "./popover.js";

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
}) {
  const { store, principal, seats, settings, settingValues, chooseSetting, sharing, hostAnswers } = useGraview<S>();
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (anchor.current?.contains(target)) return;
      /*
       * A CONTROL IN HERE MAY OPEN SOMETHING BIGGER THAN HERE.
       *
       * The studio is a full-screen dialog portalled to the body, and its
       * button lives in this pane. Treating the first press inside the
       * studio as "away" closed the pane, which unmounted the button, which
       * took the portal with it — the studio opened and vanished on the
       * next click. Anything that is itself a dialog or an overlay is not
       * away from the thing that opened it.
       */
      if (target instanceof Element && target.closest('[role="dialog"], [data-graview-overlay]')) return;
      setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeToTrigger(anchor.current, () => setOpen(false));
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  /*
   * The person's own record, WHERE THERE IS ONE.
   *
   * A principal's id is its user node's id — that is what a self grant
   * compares — so "who is signed in" is a graph lookup and not a second
   * identity system. An app with no installation has no such node, and the
   * pane says who you are from the principal alone rather than inventing a
   * name.
   */
  // Inside an embed the pane stays inside the embed's box (see `keepInside`).
  const pane = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open) keepInside(pane.current);
  }, [open]);
  const me = principal.id === undefined ? undefined : store.graph.getNode(principal.id);
  const name =
    me === undefined
      ? principal.id === undefined
        ? "Nobody in particular"
        : nameOfAuthor(principal, { graph: store.graph as never, schema: store.schema, seats })
      : labelOf(store.schema.tryDefinition(me.kind as string), me);
  const roles = principal.roles ?? [];

  return (
    <div ref={anchor} style={{ position: "relative" }}>
      <button
        type="button"
        data-testid="profile-button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
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
        */}
      <aside
          ref={(element) => {
            pane.current = element;
          }}
          aria-label="Profile"
          data-testid="profile"
          data-graview-offstage=""
          data-graview-overlay=""
          hidden={!open}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 20,
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
                ? roles.join(", ")
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

        </aside>
    </div>
  );
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

/** One letter for the mark, from a name rather than from an id. */
function initial(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}
