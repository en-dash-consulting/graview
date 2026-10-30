import { nameOfAuthor, type AnySchema } from "@graview/core";
import type { AiInteraction } from "@graview/core/catalog";
import { useGraview } from "@graview/react/provider";
import { inlineAiOn } from "@graview/tools/frame";
import { useState, type CSSProperties, type ReactNode } from "react";
import type { ActivityShows } from "./ai-feed.js";
import { ACTIVITY_HEAD, ACTIVITY_ROW, ACTIVITY_WORDS } from "./activity-rows.js";
import { useInlineEnv } from "../inline-ai-env.js";
import "../frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/**
 * AI INTERACTIONS IN ACTIVITY (Roadmap f-activity-ai-entries): each one an
 * entry of the same feed as the changes — who asked, when, about what,
 * what was asked, what was offered, what was taken or put away, the
 * batches it made (each with its undo), the models and what they cost —
 * with the way to ask again or to show a panel it drew. Not a thread: one
 * entry per interaction, and the changes it made are drawn in it, not
 * again beside it.
 *
 * Nothing here is drawn when the host says AI is off. Fetched with the
 * first entry Activity draws (`ai-feed.ts`).
 */

const PRESSED: CSSProperties = { display: "inline-flex", alignItems: "center", minHeight: 24, minWidth: 24, padding: "1px 8px", fontSize: "0.75rem" };

/** ALL / CHANGES / AI, and only mine: the feed's filter, drawn where there is an AI entry to tell apart. */
export function ActivityFilter({ shows, onShows, mine, onMine }: { readonly shows: ActivityShows; readonly onShows: (shows: ActivityShows) => void; readonly mine: boolean; readonly onMine: (mine: boolean) => void }) {
  const words: Record<ActivityShows, string> = { all: "All", changes: "Changes", ai: "AI" };
  return (
    <div data-testid="activity-filter" role="group" aria-label="Show" style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
      {(["all", "changes", "ai"] as const).map((one) => (
        <button key={one} type="button" data-shows={one} aria-pressed={shows === one} onClick={() => onShows(one)} style={{ ...PRESSED, ...(shows === one ? { borderColor: "var(--graview-accent)", color: "var(--graview-ink)" } : {}) }}>
          {words[one]}
        </button>
      ))}
      <button type="button" data-testid="activity-mine" aria-pressed={mine} onClick={() => onMine(!mine)} style={{ ...PRESSED, marginLeft: "auto", ...(mine ? { borderColor: "var(--graview-accent)", color: "var(--graview-ink)" } : {}) }}>
        Just mine
      </button>
    </div>
  );
}

/** What was asked, as a clause after "asked AI to". */
const askWords = (entry: AiInteraction): string =>
  entry.ask.kind === "suggest" ? "suggest" : entry.ask.kind === "fill" ? "fill in" : entry.ask.kind === "record" ? "add one" : entry.ask.kind === "panel" ? "draw a panel" : entry.ask.kind === "section" ? entry.ask.said.replace(/^M/, "m") : `answer “${entry.ask.said}”`;

/** What became of it, in a few words. */
function outcomeWords(entry: AiInteraction): string {
  const took = entry.offered.filter((offer) => entry.accepted?.includes(offer.id)).map((offer) => offer.label);
  switch (entry.outcome) {
    case "accepted":
      return took.length > 0 ? `Took ${took.join(", ")}` : "Taken";
    case "partly":
      return `Took ${took.length} of ${entry.offered.length}: ${took.join(", ")}`;
    case "dismissed":
      return "Dismissed";
    case "drawn":
      return entry.panel ? `Drew “${entry.panel.title}”` : "Drew a panel";
    case "failed":
      return entry.failed ?? "Failed";
    default:
      return "Offered, not yet taken";
  }
}

/** The models it used, and what they cost when said: "jev-latest · $0.0001". Summed here, not with `interactionCost`, so Activity carries none of the catalog. */
function modelWords(entry: AiInteraction): string | null {
  const models = [...new Set((entry.usage ?? []).map((usage) => usage.model))];
  if (models.length === 0) return null;
  const costs = (entry.usage ?? []).flatMap((usage) => (usage.costUsd === undefined ? [] : [usage.costUsd]));
  const cost = costs.length > 0 ? costs.reduce((sum, one) => sum + one, 0) : undefined;
  return `${models.join(", ")}${cost !== undefined ? ` · $${cost < 0.01 ? cost.toPrecision(2) : cost.toFixed(2)}` : ""}`;
}

/** What a quick ask told its model, said: "Told the model of 2 things it could do and 1 record, as stub-fast picked them". */
function contextWords(entry: AiInteraction): string | null {
  const sent = entry.context;
  if (!sent) return null;
  const count = (n: number, one: string, many: string) => `${n === 0 ? "no" : n} ${n === 1 ? one : many}`;
  const what = `${count(sent.candidates.length, "thing it could do", "things it could do")} and ${count(sent.records.length, "record", "records")}`;
  // Jev by its name, whichever version answered.
  const picker = sent.model === undefined ? "the Fast slot" : /^jev\b|^jev-/i.test(sent.model) ? "Jev" : sent.model;
  return sent.by === "fast" ? `Told the model of ${what}, as ${picker} picked them` : `Told the model of ${what} around it`;
}

/** How long each stage took, said: "Jev 180 ms · grok-4.20 900 ms · composed 12 ms". */
function stageWords(entry: AiInteraction): string | null {
  const stages = entry.stages ?? [];
  if (stages.length === 0) return null;
  const who = (stage: (typeof stages)[number]) => (stage.stage === "compose" ? "composed" : stage.model ? (/^jev\b|^jev-/i.test(stage.model) ? "Jev" : stage.model) : stage.stage);
  return stages.map((stage) => `${who(stage)} ${stage.ms < 1000 ? `${Math.round(stage.ms)} ms` : `${(stage.ms / 1000).toFixed(1)} s`}`).join(" · ");
}

/**
 * ONE INTERACTION, AS ACTIVITY SAYS IT: who asked AI to do what about
 * which target, what it offered and what became of it, the batches it
 * made with their undo (`undo` draws the feed's own control), the models
 * and their cost, and — where AI is on — "Show the panel" and "Ask again".
 */
export function InteractionRow({ entry, undo }: { readonly entry: AiInteraction; readonly undo: (batch: string) => ReactNode }) {
  const { store, principal, seats, people, ai } = useGraview<AnySchema>();
  const env = useInlineEnv();
  const [busy, setBusy] = useState(false);
  const mine = entry.by.kind === "human" && entry.by.onBehalfOf === undefined && (entry.by.id === undefined || principal.id === undefined || entry.by.id === principal.id);
  const who = mine ? "you" : nameOfAuthor(entry.by, { graph: store.graph as never, schema: store.schema, seats, people });
  const models = modelWords(entry);
  const context = contextWords(entry);
  const timing = stageWords(entry);
  const again = inlineAiOn(ai);
  const run = (work: (runner: typeof import("../inline-ai-menu.js")) => Promise<unknown>) => {
    setBusy(true);
    void import("../inline-ai-menu.js").then(work).finally(() => setBusy(false));
  };
  return (
    <li data-testid="activity-interaction" data-interaction={entry.id} data-outcome={entry.outcome} style={ACTIVITY_ROW}>
      <div data-graview-activity-head="" style={ACTIVITY_HEAD}>
        <span data-graview-activity-words="" style={ACTIVITY_WORDS}>
          <strong style={{ fontWeight: 600 }}>{who}</strong> <span style={{ color: "var(--graview-ink-muted)" }}>{entry.ask.kind === "ask" ? `told Graview “${entry.ask.said}”` : `asked AI to ${askWords(entry)}`}</span>
          <span style={{ color: "var(--graview-ink-faint)" }}> · {entry.targetLabel}</span>
        </span>
      </div>
      {entry.offered.length > 0 && entry.outcome !== "accepted" && entry.outcome !== "partly" ? (
        <div data-testid="interaction-offered" style={{ color: "var(--graview-ink-muted)" }}>
          Offered {entry.offered.map((offer) => offer.label).join(", ")}
        </div>
      ) : null}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
        <span data-testid="interaction-outcome" style={{ color: entry.outcome === "failed" ? "var(--graview-warn)" : "var(--graview-ink)" }}>
          {outcomeWords(entry)}
        </span>
        {(entry.batches ?? []).map((batch) => (
          <span key={batch} data-interaction-batch={batch} style={{ marginLeft: "auto" }}>
            {undo(batch)}
          </span>
        ))}
      </div>
      {models ? (
        <div data-testid="interaction-model" style={{ fontSize: "0.75rem", color: "var(--graview-ink-faint)" }}>
          {models}
        </div>
      ) : null}
      {context ? (
        <div data-testid="interaction-context" data-context-by={entry.context?.by} style={{ fontSize: "0.75rem", color: "var(--graview-ink-faint)" }}>
          {context}
        </div>
      ) : null}
      {timing ? (
        <details data-testid="interaction-stages" style={{ fontSize: "0.75rem", color: "var(--graview-ink-faint)" }}>
          <summary>How long it took</summary>
          {timing}
        </details>
      ) : null}
      {again ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {entry.panel ? (
            <button type="button" data-testid="interaction-reopen" disabled={busy} onClick={() => run((runner) => runner.drawPanel(env, entry.panel!))} style={PRESSED}>
              Show the panel
            </button>
          ) : null}
          <button type="button" data-testid="interaction-again" disabled={busy} onClick={() => run((runner) => runner.askAgain(env, entry))} style={PRESSED}>
            Again
          </button>
        </div>
      ) : null}
    </li>
  );
}
