import { permits, withArticle, type AnySchema, type Policy, type Principal } from "@graview/core";
import { useGraview, type ViewComponent, type ViewProps } from "@graview/react";
import type { ReactElement } from "react";
import { hueFor } from "../default-views.js";
import { Chip } from "../primitives/index.js";

/**
 * WHAT EACH ROLE REACHES, drawn from the policy the store enforces.
 *
 * A policy is grants over roles, acts and kinds, and the honest picture of
 * it is a grid: roles down the side, acts across the top grouped by the
 * kind they act on, a mark where the policy says yes. It is read through
 * `permits` — the same function the store refuses with — so the grid and
 * the refusals can never disagree. Where a mark comes from a self grant it
 * says so: that role may, on its own record only.
 *
 * Registered over the installation's users with a title, it is a place:
 * "Who may do what", one press from anywhere the keeper of an installation
 * stands.
 */

export interface ReachCell {
  readonly role: string;
  readonly act: string;
  readonly kind: string | null;
  readonly may: "yes" | "self" | "no";
}

export interface Reach {
  readonly roles: readonly string[];
  readonly acts: readonly { readonly name: string; readonly title: string; readonly kind: string | null }[];
  readonly cells: readonly ReachCell[];
}

/** The grid, as data. Pure, so a test can assert on the marks. */
export function buildReach(
  policy: Policy | undefined,
  acts: readonly { readonly name: string; readonly title?: string; readonly subject?: { readonly kinds: readonly string[] | "*" } }[],
  roles: readonly string[],
): Reach {
  const columns = acts.flatMap((act) => {
    const kinds = act.subject && act.subject.kinds !== "*" ? act.subject.kinds : [null];
    return kinds.map((kind) => ({ name: act.name, title: act.title ?? act.name, kind }));
  });
  const cells: ReachCell[] = [];
  for (const role of roles) {
    const someone: Principal = { kind: "human", id: "themselves", roles: [role] };
    for (const column of columns) {
      const kind = column.kind ?? undefined;
      const anyone = permits(policy, someone, column.name, kind).ok;
      const self = !anyone && permits(policy, someone, column.name, kind, undefined, "themselves").ok;
      cells.push({ role, act: column.name, kind: column.kind, may: anyone ? "yes" : self ? "self" : "no" });
    }
  }
  return { roles, acts: columns, cells };
}

export function ReachView<S extends AnySchema>({ label, fidelity, mode }: ViewProps<S>): ReactElement | null {
  const { store } = useGraview<S>();
  const policy = store.policy;
  const roles = policy?.roles ?? [];
  const acts = store
    .allMutations()
    .filter((mutation) => !mutation.derived)
    .map((mutation) => ({ name: mutation.name, ...(mutation.title ? { title: mutation.title } : {}), ...(mutation.subject ? { subject: mutation.subject } : {}) }));
  const reach = buildReach(policy, acts, roles);
  const title = label ?? "Who may do what";
  if (!policy || roles.length === 0) {
    return (
      <div data-testid="reach-lens" style={{ padding: 14, color: "var(--graview-ink-muted)", fontSize: "0.8125rem" }}>
        {title}: this installation has no policy, so everyone may do everything.
      </div>
    );
  }
  if (fidelity === "glyph") {
    /*
     * A Chip, like every other lens's glyph — a bare span is not a mark on a
     * map, it is a caption floating in the middle of one.
     */
    return <Chip label={`${title} · ${roles.length} ${roles.length === 1 ? "role" : "roles"}`} hue={hueFor("role")} />;
  }
  const page = mode === "fullscreen";
  const mark = (may: ReachCell["may"]) =>
    may === "yes" ? "●" : may === "self" ? "◐" : "·";
  return (
    <div
      data-testid="reach-lens"
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
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontFamily: "var(--graview-font-display)", fontSize: "1.0625rem", fontWeight: 600 }}>{title}</span>
        <span style={{ marginLeft: "auto", fontSize: "0.6875rem", color: "var(--graview-ink-faint)" }}>
          ● may · ◐ on their own record · read from the policy
        </span>
      </div>
      <div data-scroller style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: "0.78125rem", minWidth: "100%" }}>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", padding: "4px 10px 6px 0", fontWeight: 500, color: "var(--graview-ink-faint)", fontSize: "0.6875rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Role
              </th>
              {reach.acts.map((act) => (
                <th
                  key={`${act.name}|${act.kind ?? ""}`}
                  scope="col"
                  title={act.kind ? `${act.title}, on ${withArticle(act.kind)}` : act.title}
                  style={{ textAlign: "left", padding: "4px 10px 6px", fontWeight: 500, whiteSpace: "nowrap", color: "var(--graview-ink-muted)", fontSize: "0.71875rem" }}
                >
                  {act.title}
                  {act.kind ? <span style={{ color: "var(--graview-ink-faint)" }}> · {act.kind}</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reach.roles.map((role) => (
              <tr key={role}>
                <th scope="row" style={{ textAlign: "left", padding: "6px 10px 6px 0", fontWeight: 600, whiteSpace: "nowrap", borderTop: "1px solid var(--graview-edge)" }}>
                  {role}
                </th>
                {reach.acts.map((act) => {
                  const cell = reach.cells.find((c) => c.role === role && c.act === act.name && c.kind === act.kind)!;
                  return (
                    <td
                      key={`${act.name}|${act.kind ?? ""}`}
                      data-graview-reach={cell.may}
                      title={`${role} ${cell.may === "yes" ? "may" : cell.may === "self" ? "may, on their own record," : "may not"} ${act.title.toLowerCase()}`}
                      style={{
                        padding: "6px 10px",
                        textAlign: "center",
                        borderTop: "1px solid var(--graview-edge)",
                        color: cell.may === "no" ? "var(--graview-ink-faint)" : "var(--graview-accent)",
                        fontSize: cell.may === "no" ? "0.875rem" : "0.8125rem",
                      }}
                    >
                      {mark(cell.may)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const reachLens = { name: "reach" as const, requiredRoles: [] as const, View: ReachView as ViewComponent<AnySchema> };
