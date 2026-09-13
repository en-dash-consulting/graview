import { INSTALLATION_MODULE, type AnySchema, type CheckResult, type GraviewApp, type Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, Scene, createViews, useGraview } from "@graview/react";
import { ActivityRail, AgentSeat, Inspector, Places, registerDefaultViews } from "@graview/primitives";
import type { ToolCall } from "@graview/tools";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useStoreTick } from "@graview/pages";
import { StudioAgentPanel } from "./agent-panel.js";
import { createStudioLens } from "./lens.js";
import { studioApp, type StudioSchema } from "./meta.js";
import { createStudio, type Studio } from "./studio.js";
import type { WrittenFile } from "./source.js";

/**
 * THE STUDIO IS A PLACE ON THE BAR, not a package you mount by hand.
 *
 * `@graview/studio` shipped as a package and as a chapter of the seedbed,
 * and there was no way into it from the app you were looking at: to open a
 * studio over your own declaration you wrote code. So the thing the whole
 * platform story rests on — that the declaration is a graph you can change
 * with the same gestures you change data with — was true and unreachable.
 *
 * One press, in place. The running app's declaration is read into a studio
 * store; the scene draws its kinds, fields, edges, acts, rules, roles and
 * grants as ordinary districts; the actions strip offers the acts that
 * change them; "What the checker says" is a place beside them; every change
 * has an author and an inverse. Applying runs `graview check` first and
 * refuses on errors, naming them. What comes back is the files
 * `graview create` writes and the migration a stored graph needs — offered
 * as downloads, because a browser cannot write your checkout and pretending
 * otherwise would be the one dishonest thing in the whole flow.
 */
export function StudioPlace<S extends AnySchema>({
  app,
  label = "Studio",
  within = "page",
}: {
  /** The declaration to open. The running app's own, in every case that matters. */
  readonly app: GraviewApp<S>;
  readonly label?: string;
  /**
   * How much of the screen the studio takes.
   *
   * "page" fills the window, which is what a whole app wants. "box" fills
   * the nearest positioned ancestor, which is what an EMBED wants: a studio
   * that escaped its box would cover somebody else's page.
   *
   * Said rather than inferred, because the control lives on a bar whose own
   * `position: relative` would otherwise become the containing block — the
   * first cut drew the whole studio inside a 57-pixel-tall header, where its
   * scene was laid out under the bar it was drawn in.
   */
  readonly within?: "page" | "box";
}) {
  const { store, principal } = useGraview<S>();
  const [open, setOpen] = useState(false);
  if (!maySeeTheStudio(store, principal)) return null;
  return (
    <>
      <button
        type="button"
        data-testid="studio-place"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        title="Open this app's own declaration — its kinds, fields, acts and rules — and change it"
        style={{
          padding: "3px 11px",
          borderRadius: 999,
          fontSize: "0.78125rem",
          whiteSpace: "nowrap",
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: open ? "var(--graview-accent)" : "var(--graview-edge)",
          color: open ? "var(--graview-accent)" : "var(--graview-ink-muted)",
          background: open ? "var(--graview-panel)" : "transparent",
        }}
      >
        {label}
      </button>
      {open ? (
        /*
         * OUT OF THE BAR ENTIRELY, for the page-filling case.
         *
         * The control lives on a bar that carries `backdrop-filter`, and a
         * filtered element is a containing block for its fixed descendants
         * as well as its absolute ones — so neither `absolute` nor `fixed`
         * escaped it, and the whole studio was drawn inside a 57-pixel-tall
         * header with its scene laid out under the bar it was drawn in. A
         * portal is the only thing no ancestor's filter can capture.
         *
         * The boxed case stays where it is on purpose: an embed's studio
         * must not escape the embed.
         */
        within === "page" ? (
          createPortal(<StudioOverlay app={app} within={within} onClose={() => setOpen(false)} />, document.body)
        ) : (
          <StudioOverlay app={app} within={within} onClose={() => setOpen(false)} />
        )
      ) : null}
    </>
  );
}

/**
 * Who is offered it.
 *
 * The same shape as "Show the installation": where the app declares
 * something administered, the studio belongs to the seat that administers
 * it and to nobody else. Where it declares nothing administered — a
 * scaffolded project on its first day, which has no installation yet — it
 * belongs to whoever is here, because there is no one else and a project
 * you cannot open the studio on is a project you cannot grow.
 */
export function maySeeTheStudio<S extends AnySchema>(
  store: Store<S>,
  principal: Parameters<Store<S>["mayAdminister"]>[1],
): boolean {
  const administered = [...store.modules.administered.keys()];
  if (administered.length === 0) return true;
  return administered.some((name) => store.mayAdminister(name, principal));
}

export { INSTALLATION_MODULE };

/**
 * The studio itself, over the whole picture it was opened from.
 *
 * A face rather than a route: you are still in your app, and closing puts
 * you back exactly where you were rather than at whatever the studio's own
 * address happened to be.
 */
function StudioOverlay<S extends AnySchema>({
  app,
  within,
  onClose,
}: {
  readonly app: GraviewApp<S>;
  readonly within: "page" | "box";
  readonly onClose: () => void;
}) {
  const { principal, brand, scheme } = useGraview<S>();
  const studio = useMemo(() => createStudio(app, { principal }), [app, principal]);
  const views = useMemo(() => studioViews(app as unknown as GraviewApp<AnySchema>), [app]);
  /*
   * Re-read on every change rather than cached: the checker is cheap, the
   * declaration is small, and a verdict that can go stale is a verdict
   * nobody should trust. The store's own subscription is what says a change
   * happened — an act taken from the strip, from the keyboard, from an
   * agent's seat or from an undo all arrive the same way.
   */
  const turn = useStoreTick(studio.store);
  const verdict: CheckResult = useMemo(() => studio.check(), [studio, turn]);
  const [applied, setApplied] = useState<Applied | null>(null);
  const [calls, setCalls] = useState<readonly ToolCall[]>(NO_CALLS);
  const noteCall = useCallback((call: ToolCall) => {
    setCalls((current) => {
      const settling =
        call.phase !== "running" && current[0]?.name === call.name && current[0]?.at === call.at;
      return [call, ...(settling ? current.slice(1) : current)].slice(0, 12);
    });
  }, []);

  return (
    <GraviewProvider<StudioSchema>
      store={studio.store}
      views={views}
      scheme={scheme}
      principal={principal}
      {...(brand ? { brand } : {})}
      initialView={AT_ALTITUDE}
    >
    <div
      data-testid="studio"
      role="dialog"
      aria-modal="true"
      aria-label={`Studio · ${app.name}`}
      /*
       * ESCAPE CLOSES THE INNERMOST THING.
       *
       * The studio's own rail and any other popover in it already close on
       * Escape; this closed the WHOLE STUDIO at the same time, so opening
       * the history and pressing Escape to dismiss it threw away the studio
       * around it. Anything marked as an overlay inside gets the press
       * first, and the studio takes the next one.
       */
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        if (event.currentTarget.querySelector("[data-graview-overlay]")) return;
        onClose();
      }}
      style={{
        position: within === "page" ? "fixed" : "absolute",
        inset: 0,
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
        background: "var(--graview-ground-deep)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          rowGap: 6,
          padding: "6px 18px",
          minHeight: 49,
          boxSizing: "border-box",
          flex: "0 0 auto",
          borderBottom: "1px solid var(--graview-edge)",
          background: "var(--graview-bar)",
        }}
      >
        <strong style={{ fontSize: "0.875rem", fontWeight: 550 }}>Studio</strong>
        <span style={{ fontSize: "0.78125rem", color: "var(--graview-ink-muted)" }}>{app.name}</span>
        <Places<StudioSchema> />
        <span
          data-testid="studio-verdict"
          data-errors={verdict.errors}
          data-warnings={verdict.warnings}
          style={{
            marginLeft: "auto",
            fontSize: "0.78125rem",
            color: verdict.errors > 0 ? "var(--graview-warn)" : "var(--graview-ink-muted)",
          }}
        >
          {said(verdict)}
        </span>
        {/*
          * THE STUDIO'S OWN HISTORY, and its own undo.
          *
          * Every change here is an op on the declaration with an author and
          * an inverse — including an agent's proposal, which is exactly how
          * a person keeps or declines one. The app's rail is behind the
          * studio and is about the app's data; reaching for it from in here
          * would be reaching past the thing you are editing.
          */}
        {/*
          * AND A SEAT YOU CAN TALK TO, beside the declaration it is about.
          *
          * The rail's seat runs one derived turn when pressed; this one
          * takes words. Both propose rather than write, both are attributed,
          * both are undone from the same rail — the difference is only that
          * one of them had to be asked.
          */}
        <StudioAgentPanel studio={studio as unknown as Studio<AnySchema>} />
        <ActivityRail calls={calls} seat={<StudioSeat studio={studio as unknown as Studio<AnySchema>} onCall={noteCall} />} />
        <button
          type="button"
          data-testid="studio-apply"
          onClick={() => {
            const result = studio.apply();
            setApplied(
              result.ok
                ? { ok: true, files: studio.files(), migration: result.migration?.title ?? null }
                : { ok: false, check: result.check },
            );
          }}
          style={{ padding: "3px 11px", fontSize: "0.78125rem" }}
        >
          Apply
        </button>
        <button
          type="button"
          data-testid="studio-close"
          onClick={onClose}
          aria-label="Close the studio"
          style={{ padding: "3px 11px", fontSize: "0.78125rem" }}
        >
          Close
        </button>
      </header>

      {applied ? <Written applied={applied} onDismiss={() => setApplied(null)} /> : null}

      <main style={{ position: "relative", flex: "1 1 auto", minHeight: 0, containerType: "size" }}>
        <Scene renderer="dom" />
        <Inspector />
      </main>
    </div>
    </GraviewProvider>
  );
}

/**
 * The studio OPENS FROM ALTITUDE: a declaration's first honest picture is
 * the map of what it declares — kinds, acts, rules, roles — as districts,
 * rather than one of them chosen arbitrarily.
 */
const AT_ALTITUDE = { ...EMPTY_VIEW, overview: true };

/** The studio has no agent turns of its own yet; the rail is here for the history. */
const NO_CALLS: readonly never[] = [];

type Applied =
  | { readonly ok: true; readonly files: readonly WrittenFile[]; readonly migration: string | null }
  | { readonly ok: false; readonly check: CheckResult };

/**
 * WHAT APPLYING ACTUALLY GIVES YOU.
 *
 * On errors, the findings — each naming the thing to change, because the
 * checker's messages are written for somebody editing the declaration. On
 * success, the files `graview create` would write and the migration a
 * stored graph needs, as downloads: a browser cannot write your checkout,
 * and a button that claimed to would be the one lie in a flow whose whole
 * point is that nothing is hidden.
 */
function Written({ applied, onDismiss }: { readonly applied: Applied; readonly onDismiss: () => void }): ReactNode {
  return (
    <section
      data-testid="studio-applied"
      aria-label={applied.ok ? "What the studio wrote" : "What the checker refused"}
      style={{
        flex: "0 0 auto",
        display: "grid",
        gap: 8,
        padding: "10px 18px",
        borderBottom: "1px solid var(--graview-edge)",
        background: applied.ok ? "var(--graview-panel)" : "var(--graview-panel-warning)",
      }}
    >
      {applied.ok ? (
        <>
          <strong style={{ fontSize: "0.8125rem", fontWeight: 550 }}>
            The checker is happy. {applied.files.length} file
            {applied.files.length === 1 ? "" : "s"} to write
            {applied.migration ? `, and a migration: ${applied.migration}` : ", and no migration needed"}.
          </strong>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {applied.files.map((file) => (
              <a
                key={file.path}
                data-testid={`studio-file-${file.path}`}
                download={file.path.split("/").pop()}
                href={`data:text/plain;charset=utf-8,${encodeURIComponent(file.contents)}`}
                style={{
                  minHeight: 24,
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "3px 10px",
                  borderRadius: 999,
                  border: "1px solid var(--graview-edge)",
                  fontSize: "0.78125rem",
                  color: "var(--graview-accent)",
                  textDecoration: "none",
                }}
              >
                {file.path} ↓
              </a>
            ))}
          </div>
        </>
      ) : (
        <>
          <strong style={{ fontSize: "0.8125rem", fontWeight: 550, color: "var(--graview-warn)" }}>
            Not applied — {applied.check.errors} error
            {applied.check.errors === 1 ? "" : "s"} in the declaration as it stands.
          </strong>
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
            {applied.check.findings
              .filter((finding) => finding.severity === "error")
              .slice(0, 6)
              .map((finding) => (
                <li key={`${finding.code}:${finding.where}`} style={{ fontSize: "0.78125rem" }}>
                  <code>{finding.where}</code> — {finding.message} <em>{finding.fix}</em>
                </li>
              ))}
          </ul>
        </>
      )}
      <button
        type="button"
        onClick={onDismiss}
        style={{ justifySelf: "start", padding: "3px 10px", fontSize: "0.75rem" }}
      >
        Dismiss
      </button>
    </section>
  );
}

/**
 * AN AGENT SEAT IN THE STUDIO — and the thing it is actually good for.
 *
 * A rule that says what is wrong without naming what puts it right is a
 * rule the interface can only complain about: no repair in the strip, no
 * repair in the menu, nothing an agent may lawfully do about it. That is
 * the framework's own central seam, left unconnected. Finding the rules in
 * this state, and the act that plausibly repairs each, is a derivation over
 * the declaration graph — no model, no prompt.
 *
 * Every proposal is an ordinary act under the AGENT's own name, in a batch
 * of its own, so the trail beside it says who did it and one press takes it
 * back. Keeping is doing nothing; declining is undo. That is the whole
 * review mechanism, and it is the same one a person's own changes get.
 */
function StudioSeat({
  studio,
  onCall,
}: {
  readonly studio: Studio<AnySchema>;
  readonly onCall: (call: ToolCall) => void;
}) {
  const { principal } = useGraview<StudioSchema>();
  const unrepaired = useMemo(() => unnamedRepairs(studio), [studio, studio.store.batches().length]);
  return (
    <AgentSeat<StudioSchema>
      who="studio"
      testId="studio-seat"
      count={unrepaired.length}
      gate="name-repair"
      label={(n) => `Name a repair for ${n} rule${n === 1 ? "" : "s"}`}
      busyLabel="Reading the declaration…"
      idle="Every rule names what puts it right"
      onCall={onCall}
      run={async () => {
        for (const { rule, act, why } of unnamedRepairs(studio)) {
          studio.propose(
            { name: "name-repair", args: { rule, act } },
            { kind: "agent", id: "studio", session: "ui", ...(principal.roles ? { roles: principal.roles } : {}) },
            why,
          );
        }
      }}
    />
  );
}

/**
 * The rules that name no repair, each with the act that plausibly puts it
 * right: an act whose subject is the kind the rule judges. Read off the
 * declaration graph, so the seat proposes something the checker and the
 * store would both accept rather than something a model imagined.
 */
function unnamedRepairs(
  studio: Studio<AnySchema>,
): readonly { rule: string; act: string; why: string }[] {
  const graph = studio.store.graph;
  const named = new Set(graph.allEdges().filter((edge) => edge.kind === "repairs").map((edge) => edge.from));
  const found: { rule: string; act: string; why: string }[] = [];
  for (const rule of graph.allNodes().filter((node) => node.kind === "rule")) {
    if (named.has(rule.id)) continue;
    const judged = graph.out(rule.id, "judges").map((kind) => kind.id);
    if (judged.length === 0) continue;
    const act = graph
      .allNodes()
      .filter((node) => node.kind === "act")
      .find((candidate) => graph.out(candidate.id, "on").some((kind) => judged.includes(kind.id)));
    if (!act) continue;
    const say = (node: { id: string } & Record<string, unknown>) => String(node["label"] ?? node.id);
    found.push({
      rule: rule.id,
      act: act.id,
      why: `"${say(rule)}" names no repair; "${say(act)}" acts on what it judges`,
    });
  }
  return found;
}

/** The default views over the meta-schema, plus the checker's own place. */
function studioViews(app: GraviewApp<AnySchema>) {
  const meta = studioApp();
  const check = createStudioLens(app);
  return registerDefaultViews(meta.schema, createViews(meta.schema))
    .register("kind" as never, { cardinality: "many", fidelity: "full" }, check.View as never, {
      title: "What the checker says",
    })
    .register("kind" as never, { cardinality: "many", fidelity: "summary" }, check.View as never, {
      title: "What the checker says",
    });
}

function said(verdict: CheckResult): string {
  if (verdict.errors === 0 && verdict.warnings === 0) return "The checker finds nothing wrong";
  const parts: string[] = [];
  if (verdict.errors > 0) parts.push(`${verdict.errors} error${verdict.errors === 1 ? "" : "s"}`);
  if (verdict.warnings > 0) parts.push(`${verdict.warnings} warning${verdict.warnings === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

export type { Studio };
