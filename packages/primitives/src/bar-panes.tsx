import { humanizeField, type AnySchema, type AnyGraphNode, type Violation } from "@graview/core";
import { useGraview } from "@graview/react/provider";
import { LadderSetting } from "./ladder.js";
import type { HostAction } from "./profile.js";
import { Seats } from "./seats.js";

/*
 * WHAT IS BEHIND THE BAR'S TOOLS (FR-131), fetched when one is first reached
 * for: the bar draws the standing and the person at once, and a page that
 * is never asked what is broken or who is signed in never carries the
 * answers' furniture.
 */

/** The problems Standing opens: each says what is broken and how many ways there are to fix it; a press selects what it names. */
export function ProblemRows({ violations, pick }: { readonly violations: readonly Violation[]; readonly pick: (violation: Violation) => void }) {
  return (
    <>
      {violations.map((violation, index) => (
        <li
          key={`${violation.invariant}:${index}`}
          style={{
            // A hairline between rows, not a card around each. Bordered
            // buttons inside a bordered panel is two boxes doing one job,
            // and it made a two-item list look like a dialog.
            borderTop: index === 0 ? "none" : "1px solid var(--graview-edge)",
          }}
        >
          <button
            type="button"
            onClick={() => pick(violation)}
            style={{
              width: "100%",
              textAlign: "left",
              fontSize: "0.8125rem",
              lineHeight: 1.4,
              padding: "7px 8px",
              border: "1px solid transparent",
              background: "none",
              boxShadow: "none",
              borderRadius: 7,
            }}
          >
            <span style={{ display: "block", color: "var(--graview-ink)" }}>{violation.message}</span>
            <span style={{ color: "var(--graview-ink-faint)", fontSize: "0.75rem" }}>
              {violation.label}
              {violation.repairs.length > 0 ? ` · ${violation.repairs.length} ${violation.repairs.length === 1 ? "way" : "ways"} to fix` : ""}
            </span>
          </button>
        </li>
      ))}
    </>
  );
}

/**
 * WHAT IS BEHIND THE PERSON ON THE BAR (FR-131): who you are, the host's own
 * actions, the ways into the app for whoever keeps it, the seats, which rung
 * answers, your own settings and the scheme. Fetched when the person is
 * first reached for — the bar draws the person at once, and a page that is
 * never asked who is signed in never carries the answer's furniture.
 */
export function ProfilePane<S extends AnySchema>({
  name,
  me,
  scheme,
  onScheme,
  profileHref,
  hostActions,
  close,
  part,
}: {
  readonly name: string;
  readonly me: AnyGraphNode | undefined;
  readonly scheme?: "light" | "dark" | undefined;
  readonly onScheme?: ((scheme: "light" | "dark") => void) | undefined;
  readonly profileHref?: ((userId: string) => string) | undefined;
  readonly hostActions: readonly HostAction[];
  readonly close: () => void;
  /** Which part: who you are and the host's own, above the ways into the app; or the seats and the settings, below them. */
  readonly part: "top" | "rest";
}) {
  const { principal, seats, settings, settingValues, chooseSetting, sharing, hostAnswers } = useGraview<S>();
  const roles = principal.roles ?? [];
  const popover = { setOpen: (_open: false) => close() };
  return (
    <>
      {part === "top" ? (
        <>
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

        </>
      ) : (
        <>
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

        </>
      )}
    </>
  );
}

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
