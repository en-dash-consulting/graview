import type { IntelligenceConfig } from "@graview/tools";
import { useGraview } from "@graview/react";
import type { CSSProperties } from "react";

/*
 * THE LADDER, AS ONE ROW IN THE PROFILE. Which rung answers the chat —
 * this graph, a model on this device, Jev (which decides and does not
 * talk), or a frontier model with the person's own key — beside text size
 * and scheme, in the same pills. It used to be a pane of prose the chat's
 * gear opened over the map: four radios with a paragraph each, a key field
 * with a placeholder about the dev server, three more sentences on where a
 * key goes, clipped at the window's edge. That was configuration written
 * as documentation. Here it is a setting: one short label per rung, a key
 * field only when the rung needs one, one sentence on screen and the rest
 * in a tooltip.
 */

const RUNGS: readonly { readonly value: IntelligenceConfig["source"]; readonly label: string; readonly why: string }[] = [
  { value: "graph", label: "this graph", why: "Keyless and instant: the graph answers from its own structure." },
  { value: "local", label: "on this device", why: "A small model runs in this browser. First use downloads about 1–2 GB; then it is free and private." },
  { value: "decision", label: "Jev, which decides", why: "A decision provider answers typed questions exactly — which surface, which zone, does this help — with a confidence. It writes no prose, so the graph still answers the chat." },
  { value: "remote", label: "a model, with my key", why: "A frontier model answers. Calls go straight from this browser to the provider." },
];

const field: CSSProperties = {
  font: "inherit",
  fontSize: "0.78125rem",
  padding: "5px 9px",
  minHeight: 24,
  borderRadius: 8,
  border: "1px solid var(--graview-edge)",
  background: "var(--graview-panel)",
  color: "var(--graview-ink)",
  width: "100%",
  boxSizing: "border-box",
};
const hint: CSSProperties = { fontSize: "0.71875rem", color: "var(--graview-ink-muted)", lineHeight: 1.4 };

export function LadderSetting() {
  const { intelligence, chooseIntelligence } = useGraview();
  const current = RUNGS.find((rung) => rung.value === intelligence.source) ?? RUNGS[0]!;
  const remote = intelligence.remote ?? { preset: "xai" as const, apiKey: "" };
  return (
    <fieldset data-testid="setting-intelligence" style={{ border: 0, margin: 0, padding: 0, display: "grid", gap: 5 }}>
      <legend style={{ fontSize: "0.625rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--graview-ink-faint)", padding: 0 }}>
        Answers come from
      </legend>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {RUNGS.map((rung) => {
          const chosen = rung.value === intelligence.source;
          return (
            <button
              key={rung.value}
              type="button"
              aria-pressed={chosen}
              data-testid={`setting-intelligence-${rung.value}`}
              title={rung.why}
              onClick={() => chooseIntelligence({ ...intelligence, source: rung.value })}
              style={{
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
              {rung.label}
            </button>
          );
        })}
      </div>
      {/* One sentence on screen; the rest rides in each pill's tooltip. */}
      <span style={hint} data-testid="setting-intelligence-why">
        {current.why.split(/(?<=\.)\s/)[0]}
      </span>
      {intelligence.source === "decision" ? (
        <label style={{ display: "grid", gap: 3 }}>
          <span style={hint}>TypeSafe key — kept in this browser, sent only there. Empty uses this app's own door.</span>
          <input
            type="password"
            data-testid="intelligence-decision-key"
            value={intelligence.decision?.apiKey ?? ""}
            onChange={(event) => chooseIntelligence({ ...intelligence, decision: { ...(intelligence.decision ?? {}), apiKey: event.target.value } })}
            autoComplete="off"
            style={field}
          />
        </label>
      ) : null}
      {intelligence.source === "remote" ? (
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <select
              data-testid="intelligence-provider"
              value={remote.preset ?? "xai"}
              onChange={(event) => chooseIntelligence({ ...intelligence, remote: { ...remote, preset: event.target.value as "xai" | "custom" } })}
              style={field}
              aria-label="Provider"
            >
              <option value="xai">xAI (Grok)</option>
              <option value="custom">OpenAI-compatible</option>
            </select>
            <input
              data-testid="intelligence-model"
              value={remote.model ?? ""}
              onChange={(event) => chooseIntelligence({ ...intelligence, remote: { ...remote, model: event.target.value } })}
              placeholder={remote.preset === "custom" ? "model id" : "grok-4-fast"}
              aria-label="Model"
              style={field}
            />
          </div>
          {remote.preset === "custom" ? (
            <input
              data-testid="intelligence-base-url"
              value={remote.baseUrl ?? ""}
              onChange={(event) => chooseIntelligence({ ...intelligence, remote: { ...remote, baseUrl: event.target.value } })}
              placeholder="https://…/v1"
              aria-label="Base URL"
              style={field}
            />
          ) : null}
          <label style={{ display: "grid", gap: 3 }}>
            <span style={hint}>API key — kept in this browser, sent only to the provider above.</span>
            <input
              type="password"
              data-testid="intelligence-key"
              value={remote.apiKey ?? ""}
              onChange={(event) => chooseIntelligence({ ...intelligence, remote: { ...remote, apiKey: event.target.value } })}
              placeholder={remote.preset === "custom" ? "sk-…" : "xai-…"}
              autoComplete="off"
              style={field}
            />
          </label>
        </div>
      ) : null}
    </fieldset>
  );
}
