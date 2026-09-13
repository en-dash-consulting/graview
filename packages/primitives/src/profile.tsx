import { labelOf, type AnySchema } from "@graview/core";
import { useGraview } from "@graview/react";
import { useEffect, useRef, useState } from "react";
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
 *
 * Nothing about this is administration: a member sees their own name, their
 * own record and their own text size, and never a person who is not them.
 */
export function Profile<S extends AnySchema>({
  scheme,
  onScheme,
  /** Where a person's own record lives on the routed face, if there is one. */
  profileHref,
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
}) {
  const { store, principal, seats, settings, settingValues, chooseSetting } = useGraview<S>();
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (!anchor.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
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
  const me = principal.id === undefined ? undefined : store.graph.getNode(principal.id);
  const name =
    me === undefined
      ? (principal.id ?? "Nobody in particular")
      : labelOf(store.schema.tryDefinition(me.kind as string), me as never);
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
          fontSize: "0.78125rem",
          whiteSpace: "nowrap",
          maxWidth: 220,
        }}
      >
        <span
          aria-hidden="true"
          data-testid="profile-mark"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 18,
            height: 18,
            borderRadius: 999,
            fontSize: "0.625rem",
            background: "var(--graview-panel-muted)",
            color: "var(--graview-ink-muted)",
          }}
        >
          {initial(name)}
        </span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
      </button>

      {open ? (
        <aside
          aria-label="Profile"
          data-testid="profile"
          data-graview-offstage=""
          data-graview-overlay=""
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 20,
            width: 280,
            maxWidth: "calc(100vw - 32px)",
            maxHeight: "min(62cqh, 520px)",
            overflow: "auto",
            display: "grid",
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
            <strong style={{ fontSize: "0.9375rem", fontWeight: 550 }}>{name}</strong>
            <span style={{ fontSize: "0.75rem", color: "var(--graview-ink-muted)" }}>
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
                style={{ fontSize: "0.78125rem", color: "var(--graview-accent)" }}
              >
                Your record ↗
              </a>
            ) : null}
          </div>

          {seats.length > 1 ? (
            <div style={{ display: "grid", gap: 6, ...ruled }}>
              <span style={eyebrow}>Sit as somebody else</span>
              <Seats<S> />
            </div>
          ) : null}

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
                    <span style={{ fontSize: "0.75rem", color: "var(--graview-ink-muted)" }}>
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
                            fontSize: "0.78125rem",
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
                    fontSize: "0.78125rem",
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
      ) : null}
    </div>
  );
}

const eyebrow = {
  fontSize: "0.625rem",
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
