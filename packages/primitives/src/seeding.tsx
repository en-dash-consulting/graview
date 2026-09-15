import { beginning, type AnySchema, type Beginning } from "@graview/core";
import { kindCardId } from "@graview/layout";
import { useAffordances, useApplyAffordance, useGraview, useLocalIntelligence } from "@graview/react";
import {
  applyPlan,
  firstJsonObject,
  validateProposals,
  type Affordance,
  type Plan,
  type PlannedCall,
} from "@graview/tools";
import { useMemo, useState, type ReactNode } from "react";
import { AnswerArgs } from "./workbench/index.js";
import { MUTED_TEXT, Panel, VISUALLY_HIDDEN } from "./primitives/index.js";

/**
 * THE SURFACES A BLANK GRAPH NEEDS, derived like every other surface.
 *
 * The framework derives a home, a list per kind, a record per node, a form
 * per act and a problems page. It did not derive THE WAY IN — the one state
 * every product ships in and the one its author never sees, because their own
 * graph has had data in it since the first afternoon.
 *
 * Three surfaces, and all three read the same thing: `beginning()`, the chain
 * the declaration already states.
 */

/** The kinds, in the order a blank installation can fill them. */
function chainOf<S extends AnySchema>(store: { schema: S; allMutations: () => readonly unknown[] }): Beginning {
  return beginning({
    name: "",
    schema: store.schema,
    mutations: store.allMutations() as never,
  });
}

export interface BeginProps {
  /** What to say once every kind has something in it. Absent, it says nothing. */
  readonly whenFull?: ReactNode;
  readonly title?: string;
}

/**
 * THE WAY IN, derived.
 *
 * A ten-kind app on an empty graph has one door and nine silent districts.
 * This is the door, the order behind it, and — for the kinds that are not
 * ready yet — what they are waiting for, in the declaration's own words.
 *
 * Nothing here is configured. The chain comes from `creates` and the acts'
 * own node references; the acts come from the same derivation the actions
 * strip reads, so an act offered here is an act that can actually run, with
 * its open questions asked by the same walk that asks them anywhere else.
 */
export function Begin<S extends AnySchema>({ whenFull, title = "Begin" }: BeginProps = {}) {
  const { store } = useGraview<S>();
  const chain = useMemo(() => chainOf(store as never), [store]);
  const counts = useMemo(() => {
    const found: Record<string, number> = {};
    for (const entry of chain.order) found[entry.kind] = store.graph.nodesOfKind(entry.kind as never).length;
    return found;
  }, [chain, store]);

  const empty = chain.order.filter((entry) => (counts[entry.kind] ?? 0) === 0);
  if (empty.length === 0) return whenFull === undefined ? null : <>{whenFull}</>;

  return (
    <Panel title={title} subtitle="What has to exist before the rest of it can." fit>
      <ol data-testid="begin" style={{ margin: 0, paddingLeft: "1.25rem", display: "grid", gap: 10 }}>
        {chain.order.map((entry) => {
          const has = counts[entry.kind] ?? 0;
          const plural = store.schema.tryDefinition(entry.kind)?.plural ?? entry.kind;
          const ready = entry.needs.every((needed) => (counts[needed] ?? 0) > 0);
          return (
            <li key={entry.kind} data-begin-kind={entry.kind} data-begin-ready={ready || undefined}>
              <strong>{plural}</strong>{" "}
              <span style={{ fontVariantNumeric: "tabular-nums", ...MUTED_TEXT }}>
                {has === 0 ? "none yet" : has}
              </span>
              {entry.depth === null ? (
                <div style={{ fontSize: "0.8125rem", ...MUTED_TEXT }}>
                  Nothing here makes {plural.toLowerCase()} — they arrive with the data.
                </div>
              ) : has > 0 ? null : ready ? (
                <BeginHere kind={entry.kind} />
              ) : (
                <div style={{ fontSize: "0.8125rem", ...MUTED_TEXT }}>
                  Waiting for {entry.needs.map((kind) => store.schema.tryDefinition(kind)?.plural ?? kind).join(" and ")}.
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

/** The acts that can begin one kind, asked the way they are asked anywhere. */
function BeginHere({ kind }: { readonly kind: string }) {
  const { affordances } = useAffordances({
    selection: [kindCardId(kind)],
    kindSelection: [kind],
  } as never);
  const { apply } = useApplyAffordance();
  const [asking, setAsking] = useState<Affordance | null>(null);

  if (affordances.length === 0) return null;
  if (asking) {
    return (
      <AnswerArgs
        affordance={asking}
        onApply={(args) => {
          apply(asking, args);
          setAsking(null);
        }}
        onCancel={() => setAsking(null)}
      />
    );
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
      {affordances.map((affordance) => (
        <button
          key={affordance.id}
          type="button"
          data-testid={`begin-${affordance.mutation}`}
          onClick={() => (affordance.open.length === 0 ? apply(affordance, {}) : setAsking(affordance))}
          style={{ minHeight: "max(1.5rem, 24px)", padding: "2px 10px", fontSize: "0.8125rem" }}
        >
          {affordance.label}
        </button>
      ))}
    </div>
  );
}

export interface PlanReviewProps<S extends AnySchema> {
  readonly plan: Plan;
  /** Applied under one batch; the handle comes back for the undo. */
  readonly onApplied?: (batch: string, applied: number) => void;
  readonly onDiscard?: () => void;
  readonly title?: string;
}

/**
 * WHAT A MODEL WANTS TO DO, BEFORE IT DOES IT.
 *
 * In the order it will run, with what it makes counted, and the refusals
 * struck through with their reason rather than dropped — the same honesty
 * the actions strip gives a seat that may not act. Applying is one press and
 * one turn, so taking it back is one press too.
 */
export function PlanReview<S extends AnySchema>({
  plan,
  onApplied,
  onDiscard,
  title = "What this would do",
}: PlanReviewProps<S>) {
  const { store, principal } = useGraview<S>();
  const [done, setDone] = useState<{ batch: string; applied: number; why?: string } | null>(null);
  /* "1 zone, 2 features" — the kind's own word when there is one of it. */
  const makes = Object.entries(plan.makes)
    .map(
      ([kind, count]) =>
        `${count} ${count === 1 ? kind : (store.schema.tryDefinition(kind)?.plural ?? `${kind}s`).toLowerCase()}`,
    )
    .join(", ");

  return (
    <Panel
      title={title}
      subtitle={`${plan.ready.length} of ${plan.entries.length} to run${makes ? `, making ${makes}` : ""}.`}
      fit
    >
      <ol data-testid="plan" style={{ margin: 0, paddingLeft: "1.25rem", display: "grid", gap: 4 }}>
        {plan.entries.map((entry, index) => (
          <li
            key={`${entry.call.mutation}:${index}`}
            data-plan-refused={entry.refusal ? "" : undefined}
            style={entry.refusal ? { textDecoration: "line-through", opacity: 0.6 } : undefined}
          >
            <span>{store.allMutations().find((m) => m.name === entry.call.mutation)?.title ?? entry.call.mutation}</span>
            {entry.call.why ? <span style={{ ...MUTED_TEXT }}> — {entry.call.why}</span> : null}
            {entry.refusal ? (
              <div data-testid="plan-refusal" style={{ fontSize: "0.75rem", color: "var(--graview-warn)", textDecoration: "none" }}>
                {entry.refusal.message}
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      {done ? (
        <p data-testid="plan-done" style={{ margin: 0, fontSize: "0.8125rem", ...MUTED_TEXT }}>
          {done.why
            ? `Stopped after ${done.applied}: ${done.why}`
            : `Done — ${done.applied} applied as one turn.`}
        </p>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            data-testid="plan-apply"
            disabled={plan.ready.length === 0}
            onClick={() => {
              const result = applyPlan(store as never, plan, principal ? { author: principal } : {});
              setDone({
                batch: result.batch,
                applied: result.applied,
                ...(result.stoppedAt ? { why: result.stoppedAt.why } : {}),
              });
              onApplied?.(result.batch, result.applied);
            }}
            style={{ minHeight: "max(1.5rem, 24px)", padding: "2px 12px" }}
          >
            Apply {plan.ready.length === 1 ? "it" : "all"}
          </button>
          {onDiscard ? (
            <button type="button" data-testid="plan-discard" onClick={onDiscard} style={{ minHeight: "max(1.5rem, 24px)", padding: "2px 12px" }}>
              Discard
            </button>
          ) : null}
        </div>
      )}
    </Panel>
  );
}

export interface IntakeProps {
  /** Data URLs, in the order they were given. */
  readonly onPhotos: (photos: readonly string[]) => void;
  readonly accept?: string;
  readonly label?: string;
}

/**
 * PHOTOGRAPHS IN. A drop zone and a file input over one handler, because a
 * product that lets a model look at something has to get the something in,
 * and every one of them wrote this.
 */
export function Intake({ onPhotos, accept = "image/*", label = "Photographs" }: IntakeProps) {
  const [over, setOver] = useState(false);
  const take = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const read = await Promise.all(
      [...files].map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error ?? new Error("That file could not be read."));
            reader.readAsDataURL(file);
          }),
      ),
    );
    onPhotos(read);
  };
  return (
    <label
      data-testid="intake"
      data-intake-over={over || undefined}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        void take(event.dataTransfer?.files ?? null);
      }}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "4rem",
        padding: "var(--graview-pad-sm, 8px)",
        border: `1px dashed ${over ? "var(--graview-accent)" : "var(--graview-edge)"}`,
        borderRadius: "var(--graview-radius-sm, 8px)",
        color: "var(--graview-ink-muted)",
        fontSize: "0.8125rem",
        cursor: "pointer",
      }}
    >
      {label} — drop them here, or choose
      <input
        type="file"
        multiple
        accept={accept}
        onChange={(event) => void take(event.target.files)}
        style={VISUALLY_HIDDEN as never}
      />
    </label>
  );
}

export interface DoorProps<S extends AnySchema> {
  /** The declared provider this door is for. */
  readonly provider: string;
  /** What to ask it, built by the app from its own graph. */
  readonly prompt: string;
  readonly photos?: readonly string[];
  /** Proposals read out of whatever came back. */
  readonly onProposals: (proposals: readonly PlannedCall[]) => void;
}

/**
 * THE DOORS A PROVIDER DECLARED, drawn.
 *
 * `reach: ["paste", "local"]` is the declaration; this is what it looks like.
 * Paste is the floor and works everywhere — a prompt to copy out, an answer
 * to paste back — and needs no key, no network and no permission. `local` is
 * the machine under the dev server, offered only when something is actually
 * answering there. A door the provider did not declare is not drawn.
 */
export function Door<S extends AnySchema>({ provider, prompt, photos = [], onProposals }: DoorProps<S>) {
  const { store } = useGraview<S>();
  const declared = store.intelligence.find((candidate) => candidate.name === provider);
  const reach = declared?.reach ?? [];
  const local = useLocalIntelligence(declared?.bridge);
  const [pasted, setPasted] = useState("");
  const [said, setSaid] = useState<string | null>(null);

  const read = (text: string) => {
    const answer = firstJsonObject(text) as { proposals?: readonly PlannedCall[] } | null;
    const proposals = Array.isArray(answer?.proposals) ? answer!.proposals : [];
    const kept = validateProposals(store as never, proposals as never, declared?.may) as readonly PlannedCall[];
    if (kept.length === 0) {
      setSaid("Nothing in that answer was a call this app knows, so nothing was taken from it.");
      return;
    }
    setSaid(null);
    onProposals(
      /* `as` and `why` are the model's own and survive validation. */
      kept.map((call, index) => ({ ...call, ...(proposals[index]?.as ? { as: proposals[index]!.as } : {}) })),
    );
  };

  if (!declared) return null;
  return (
    <div data-testid="door" data-door-reach={reach.join(",")} style={{ display: "grid", gap: 8 }}>
      {reach.includes("local") ? (
        <div>
          <button
            type="button"
            data-testid="door-local"
            disabled={local.state !== "open"}
            onClick={() => {
              if (local.state !== "open") return;
              void local
                .ask(prompt, photos)
                .then(read)
                .catch((error: unknown) => setSaid(error instanceof Error ? error.message : String(error)));
            }}
            style={{ minHeight: "max(1.5rem, 24px)", padding: "2px 12px" }}
          >
            {local.state === "open" ? `Ask ${provider} on this machine` : "Nothing running on this machine"}
          </button>
          {local.state === "closed" ? (
            <div style={{ fontSize: "0.75rem", ...MUTED_TEXT }}>{local.reason}</div>
          ) : null}
        </div>
      ) : null}

      {reach.includes("paste") ? (
        <div style={{ display: "grid", gap: 6 }}>
          <button
            type="button"
            data-testid="door-copy"
            onClick={() => void navigator.clipboard?.writeText?.(prompt)}
            style={{ minHeight: "max(1.5rem, 24px)", padding: "2px 12px" }}
          >
            Copy the prompt
          </button>
          <label style={{ display: "grid", gap: 4, fontSize: "0.8125rem", ...MUTED_TEXT }}>
            Paste the answer
            <textarea
              data-testid="door-paste"
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
              rows={4}
              style={{ font: "var(--graview-font-mono, 12px ui-monospace)", padding: 6 }}
            />
          </label>
          <button
            type="button"
            data-testid="door-read"
            disabled={pasted.trim().length === 0}
            onClick={() => read(pasted)}
            style={{ minHeight: "max(1.5rem, 24px)", padding: "2px 12px" }}
          >
            Read it
          </button>
        </div>
      ) : null}

      {said ? (
        <p data-testid="door-said" style={{ margin: 0, fontSize: "0.75rem", color: "var(--graview-warn)" }}>
          {said}
        </p>
      ) : null}
    </div>
  );
}
