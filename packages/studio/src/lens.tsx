import { type AnySchema, type GraphSnapshot, type GraviewApp } from "@graview/core";
import { checkApp } from "@graview/core/check";
import { useGraview, type ViewComponent, type ViewProps } from "@graview/react";
import { useMemo, type ReactElement } from "react";
import { graphToDeclaration } from "./to-declaration.js";
import type { StudioSchema } from "./meta.js";

/*
 * WHAT THE CHECKER SAYS, as a place in the studio. The declaration as it
 * now stands is judged on every render — the same `checkApp` the CLI runs —
 * so a change that would ship a broken app is a finding beside the change,
 * not a surprise at the terminal. Registered over the kinds with a title,
 * it is one press from anywhere in the studio.
 */

export function createStudioLens<S extends AnySchema>(base: GraviewApp<S>): { readonly name: "studio-check"; readonly requiredRoles: readonly []; readonly View: ViewComponent<StudioSchema> } {
  function StudioCheckView({ label, fidelity, mode }: ViewProps<StudioSchema>): ReactElement | null {
    const { store } = useGraview<StudioSchema>();
    const snapshot = store.snapshot() as GraphSnapshot;
    const result = useMemo(() => checkApp(graphToDeclaration(snapshot, { base, name: base.name })), [snapshot]);
    const kinds = snapshot.nodes.filter((node) => node.kind === "kind").length;
    const acts = snapshot.nodes.filter((node) => node.kind === "act" && node["derived"] !== true).length;
    const rules = snapshot.nodes.filter((node) => node.kind === "rule").length;
    const title = label ?? "What the checker says";
    const verdict = result.ok ? "no problems found" : `${result.errors} ${result.errors === 1 ? "error" : "errors"}, ${result.warnings} ${result.warnings === 1 ? "warning" : "warnings"}`;
    if (fidelity === "glyph") {
      return (
        <span data-testid="studio-check" data-graview-check={result.ok ? "ok" : "failed"} style={{ fontSize: "0.8125rem", color: "var(--graview-ink-muted)" }}>
          {title} · {verdict}
        </span>
      );
    }
    const page = mode === "fullscreen";
    return (
      <div
        data-testid="studio-check"
        data-graview-check={result.ok ? "ok" : "failed"}
        style={{
          display: "grid",
          gap: 10,
          padding: page ? 0 : 14,
          borderRadius: "var(--graview-radius, 12px)",
          background: page ? "transparent" : "var(--graview-panel)",
          border: page ? "none" : "1px solid var(--graview-edge)",
          color: "var(--graview-ink)",
          minWidth: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--graview-font-display)", fontSize: "1.125rem", fontWeight: 600 }}>{title}</span>
          <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "var(--graview-ink-faint)" }}>
            {kinds} {kinds === 1 ? "kind" : "kinds"} · {acts} {acts === 1 ? "act" : "acts"} · {rules} {rules === 1 ? "rule" : "rules"}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: "0.875rem", color: result.ok ? "var(--graview-ink-muted)" : "var(--graview-warn)" }}>
          graview check: {result.app} — {verdict}.
        </p>
        {result.findings.length > 0 ? (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
            {result.findings.map((finding, index) => (
              <li key={`${finding.code}:${finding.where}:${index}`} data-graview-finding={finding.code} style={{ fontSize: "0.875rem", lineHeight: 1.5, borderTop: "1px solid var(--graview-edge)", paddingTop: 6 }}>
                <code style={{ fontSize: "0.8125rem", color: finding.severity === "error" ? "var(--graview-warn)" : "var(--graview-ink-muted)" }}>{finding.code}</code>{" "}
                <span style={{ color: "var(--graview-ink-faint)" }}>{finding.where}</span>
                <div>{finding.message}</div>
                <div style={{ color: "var(--graview-ink-muted)" }}>{finding.fix}</div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
  return { name: "studio-check" as const, requiredRoles: [] as const, View: StudioCheckView as ViewComponent<StudioSchema> };
}
