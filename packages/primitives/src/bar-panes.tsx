import { humanizeField, type AnySchema, type AnyGraphNode, type Violation } from "@graview/core";
import { useGraview } from "@graview/react/provider";
import { choiceStyle } from "./choice.js";
import type { HostAction } from "./profile.js";
import { Seats } from "./seats.js";
import { problemLine, problemTitle, RuleLineView, useLined } from "./rule-line.js";

/*
 * WHAT IS BEHIND THE BAR'S TOOLS (FR-131), fetched when one is first reached
 * for: the bar draws the standing and the person at once, and a page that
 * is never asked what is broken or who is signed in never carries the
 * answers' furniture.
 */

/** The problems Standing opens: each says what is broken and how many ways there are to fix it; a press selects what it names. */
export function ProblemRows({ violations, pick }: { readonly violations: readonly Violation[]; readonly pick: (violation: Violation) => void }) {
  const { store, brand } = useGraview<AnySchema>();
  // Each with its rule's line, once the words are here: the rows say the rule's sentence until then.
  const lined = useLined(store, violations);
  return (
    <>
      {lined.map((violation, index) => {
        const title = problemTitle(violation);
        const ways = violation.repairs.length > 0 ? `${violation.repairs.length} ${violation.repairs.length === 1 ? "way" : "ways"} to fix` : "";
        return (
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
            // The rule's own sentence, where it wrote one the line does not show.
            {...(violation.line && violation.message !== problemLine(violation) ? { title: violation.message } : {})}
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
            {/*
              * THE RULE'S SHAPE, with the record's own values (`RuleLineView`):
              * "◆ A club on Team — margin 44% < target margin 50%". A rule that
              * is a function has only its sentence, said as before.
              */}
            {violation.line ? (
              <RuleLineView line={violation.line} schema={store.schema} {...(brand ? { brand } : {})} stacked style={{ display: "block", color: "var(--graview-ink)" }} />
            ) : (
              <span style={{ display: "block", color: "var(--graview-ink)" }}>{violation.message}</span>
            )}
            {title || ways ? (
              <span style={{ color: "var(--graview-ink-faint)", fontSize: "0.75rem" }}>
                {[title, ways].filter(Boolean).join(" · ")}
              </span>
            ) : null}
          </button>
        </li>
        );
      })}
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
  signature = false,
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
  /** A quiet "Built with Graview" at the menu's foot, when the host asks for one. */
  readonly signature?: boolean | undefined;
}) {
  const { principal, seats, settings, settingValues, chooseSetting, sharing } = useGraview<S>();
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
                          style={choiceStyle(chosen)}
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
                  style={choiceStyle(scheme === candidate)}
                >
                  {candidate === "light" ? "☀ Light" : "☾ Dark"}
                </button>
              ))}
            </div>
          </div>
          ) : null}

          {/*
            * A GRAVIEW SIGNATURE, WHEN THE HOST ASKS FOR ONE: last, small and
            * in the faint ink, because the app leads with its own name and
            * mark and this is secondary. The link is named "Graview" — the
            * mark beside the word is decorative — and goes to graview.dev.
            */}
          {signature ? (
            <p data-testid="graview-signature" style={{ ...ruled, margin: 0, display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: "var(--graview-ink-faint)" }}>
              Built with
              <a href="https://graview.dev" target="_blank" rel="noopener" style={{ display: "inline-flex", alignItems: "center", gap: 4, minHeight: 24, color: "var(--graview-ink-muted)", fontWeight: 600, textDecoration: "none" }}>
                <span data-testid="graview-mark" style={{ display: "inline-flex", lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: MICRO_MARK }} />
                Graview
              </a>
            </p>
          ) : null}
        </>
      )}
    </>
  );
}

/*
 * The kit's micro cut at 14 px, decorative beside the word — exactly what
 * `graviewSymbol({ size: 14 })` draws (a test holds them equal). Written
 * out rather than imported: the symbol's outlines sit beside the identity
 * a page loads up front, and importing them here took their whole kilobyte
 * there for a line most pages never open.
 */
const MICRO_MARK =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="14" height="14" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M13 11 L3 8 L14 3 H29 L21 9"/><path d="M10 18 L3 23 L16.5 28 L29 21 L22 19"/><path d="M16.5 18.5 V23.5" stroke-linecap="round"/></g><circle cx="16.5" cy="13.5" r="2" fill="var(--graview-mark-point, currentColor)"/></svg>';

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
