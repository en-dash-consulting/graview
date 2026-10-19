import type { AiCandidate, AiTarget } from "@graview/core/catalog";
import { interactionId, sharedActCandidate, suggestForSeveral, type InlineResult } from "@graview/tools/inline-ai";
import type { SeveralAct } from "@graview/tools/several";
import { useEffect, useMemo, useState } from "react";
import { heldSuggestion, suggestOnce, takeOffer } from "./inline-ai-menu.js";
import { useInlineEnv } from "./inline-ai-env.js";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/*
 * THE AI'S PART OF THE SELECTION BAR (Roadmap f-inline-ai-framework-finish):
 * what the Fast slot suggests doing with the records chosen together — one
 * of the acts they share, which the bar runs over every one as it runs its
 * own, or a panel or a place that shows them. Fetched only where the host
 * gave a Fast slot and AI is on (`several-bar.tsx`); asked ONCE PER CHOICE,
 * kept as the menu keeps its suggestions (`suggestOnce`) until a chosen
 * record changes, and never of the Thinking slot.
 */

export interface SeveralAiProps {
  readonly chosen: readonly string[];
  /** The acts every chosen record shares, as the bar offers them. */
  readonly acts: readonly SeveralAct[];
  /** One of those pressed from here: the bar runs it as if its own button were pressed. */
  readonly onAct: (act: SeveralAct) => void;
}

const BY = "several";

export function SeveralAi({ chosen, acts, onAct }: SeveralAiProps) {
  const env = useInlineEnv();
  const ids = useMemo(() => [...chosen].sort(), [chosen]);
  const key = ids.join("\n");
  const target = useMemo<AiTarget>(() => ({ on: "selection", ids }), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  // Only the everyday acts that ask nothing more: one press runs a suggestion, and nothing set aside or removed is suggested.
  const ready = useMemo(() => acts.filter((act) => act.open.length === 0 && !act.more && !act.destructive), [acts]);
  const byCandidate = useMemo(() => new Map(ready.map((act) => [sharedActCandidate(act.id), act])), [ready]);
  const held = heldSuggestion(env, target, BY);
  const [answered, setAnswered] = useState<{ readonly key: string; readonly result: InlineResult } | null>(null);
  useEffect(() => {
    if (held !== undefined) return;
    let live = true;
    void suggestOnce(env, target, {
      by: BY,
      ask: () => suggestForSeveral(env.ai, { store: env.store, target, principal: env.principal, interaction: interactionId(), places: env.places, selection: env.selection, ...(env.place ? { place: env.place } : {}), shared: ready.map((act) => ({ id: act.id, label: act.label, mutation: act.mutation, args: act.args })) }),
    }).then((result) => {
      if (live) setAnswered({ key, result });
    });
    return () => {
      live = false;
    };
    // Asked once per choice: the bar is drawn again as the graph moves, and the suggestion stands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const result = held ?? (answered?.key === key ? answered.result : undefined);
  if (result === undefined) {
    return (
      <span role="status" className="graview-several-quiet" data-testid="several-ai-thinking" style={{ textDecoration: "none" }}>
        AI: thinking…
      </span>
    );
  }
  const offers = result.offers.filter((offer) => offer.type !== "act" || byCandidate.has(offer.id));
  if (offers.length === 0) return null;
  const take = (offer: AiCandidate) => {
    const act = byCandidate.get(offer.id);
    if (act) {
      env.desk.record({ ...result.interaction, outcome: "accepted", accepted: [offer.id] });
      onAct(act);
      return;
    }
    void takeOffer(env, result, offer);
  };
  return (
    <div role="group" aria-label="Suggested by AI" className="graview-several-acts" data-testid="several-ai">
      {offers.map((offer) => (
        <button key={offer.id} type="button" className="graview-several-act" data-testid="several-ai-offer" data-ai-offer={offer.id} data-ai-offer-type={offer.type} onClick={() => take(offer)}>
          {offer.label}
          <span style={{ color: "var(--graview-ink-faint)", fontWeight: 400 }}> · suggested</span>
        </button>
      ))}
    </div>
  );
}
