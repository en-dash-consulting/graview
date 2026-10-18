import { layer, type AnySchema } from "@graview/core";
import { aiTargetOf, catalogOf, type AiCandidate, type AiInteraction, type AiPanel, type AiTarget } from "@graview/core/catalog";
import { useAiDeskState, useGraview, useLiveStore, type MenuTarget } from "@graview/react/provider";
import { deriveAffordances } from "@graview/tools/derive";
import { acceptedEntry, acceptGhost, dismissedEntry, fillHere, ghostOf, interactionId, panelHere, proposalOf, recordHere, suggestHere, thinkingOf, type InlineAsk, type InlineResult } from "@graview/tools/inline-ai";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useInlineEnv, type InlineEnv } from "./inline-ai-env.js";
import { openQuickAsk } from "./quick-ask-desk.js";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/**
 * THE INLINE AI, AS THE FACES DRAW IT (Roadmap f-ai-candidate-catalog) —
 * fetched with the first menu that shows it (`inline-ai-door.tsx`).
 *
 * In the context menu, on what it was opened on: the Fast model's few
 * suggestions, picked from the catalog (a value to fill, an act that asks
 * nothing, a panel, a place, a record), each taken with one press; "Fill
 * in" for a record whose fields the catalog has values for; "Draw a panel"
 * for whatever has a kind. A proposed change is a ghost, waiting on the
 * tray (`GhostTray`) for Accept, Accept some or Dismiss, and then for its
 * one undo; a panel is drawn where the seat draws a view, where "Keep as a
 * lens" makes it a real one. Every interaction the person takes up is an
 * entry Activity draws (`aiDesk.record`), and its host keeps.
 *
 * The runner (`inlineEnv`, `askInline`, `takeOffer`, `drawPanel`,
 * `askAgain`) takes plain values, not hooks, so Activity's "Ask again" and
 * "Show the panel" and the quick ask's card (`quick-ask.tsx`) reach the
 * same code. "Ask about this…" opens the quick ask's bar on the target.
 */

/** One ask of the inline AI, as the engine takes it: the acts the derivation offers this viewer there, the places, where they are. */
export function askOf(env: InlineEnv, target: AiTarget, said?: string): InlineAsk {
  const about = target.on === "selection" ? target.ids : target.on === "record" || target.on === "field" ? [target.id] : [];
  const acts =
    about.length > 0
      ? deriveAffordances(env.store, about, { principal: env.principal, ...(about.length === 1 ? { focus: about[0]! } : {}) }).affordances.map((affordance) => ({
          mutation: affordance.mutation,
          label: affordance.label,
          args: affordance.args,
          open: affordance.open,
          why: affordance.why,
          ...(affordance.destructive ? { destructive: true } : {}),
        }))
      : undefined;
  return {
    store: env.store,
    target,
    principal: env.principal,
    interaction: interactionId(),
    places: env.places,
    selection: env.selection,
    ...(acts ? { acts } : {}),
    ...(env.place ? { place: env.place } : {}),
    ...(said ? { said } : {}),
  };
}

/**
 * DRAWN WHERE THE SEAT DRAWS A VIEW, from its recipe: "Keep as a lens" there
 * makes it a real lens — on Pages at `/~draft`, the face's own `goTo.draft`,
 * over the scene in place of the picture. Answers a sentence when it cannot
 * be drawn; `landing` is told just before it is, so the menu that asked
 * stays open to say a failure and is put away for a panel.
 */
export async function drawPanel(env: InlineEnv, panel: AiPanel, landing?: () => void): Promise<string | undefined> {
  const engine = await import("@graview/tools/draft");
  const drafted = engine.recipeDraft(panel.recipe as never, { app: env.app, sight: engine.draftSight(env.app, env.principal) });
  if (engine.isDraftFailure(drafted)) return drafted.failed;
  landing?.();
  env.seatTalk.setDraft(drafted, null);
  env.goTo.draft?.();
  keyboardToTheDraft();
  return undefined;
}

/*
 * THE KEYBOARD GOES TO THE PANEL. The menu row that asked for it is gone,
 * and over the scene the panel stands in place of the picture, which is
 * made inert under it: a keyboard left behind would land on <body>. Once
 * the frame is drawn — fetched, the first time, so for up to three seconds
 * of frames — "Keep as a lens" takes it, unless the reader has already put
 * the keyboard somewhere of their own.
 */
function keyboardToTheDraft(tries = 180): void {
  if (typeof document === "undefined") return;
  const keep = document.querySelector<HTMLElement>('[data-testid="draft-keep"]');
  const active = document.activeElement;
  const nowhere = !active || active === document.body || (active as HTMLElement).closest?.("[inert]") !== null;
  if (keep) {
    if (nowhere) keep.focus();
    return;
  }
  if (tries > 0) requestAnimationFrame(() => keyboardToTheDraft(tries - 1));
}

/**
 * ASK THE INLINE AI: a suggestion (answered, not yet kept — the menu shows
 * it), fills (a ghost on the tray, its entry kept), or a panel (drawn, its
 * entry kept). A failure is kept too, said in its entry — and answered, so
 * the menu that asked says it where it was asked. `landing` is told just
 * before what was asked for lands: the ghost held, the panel drawn.
 */
export async function askInline(env: InlineEnv, kind: "suggest" | "fill" | "record" | "panel", target: AiTarget, said?: string, landing?: () => void): Promise<InlineResult> {
  const ask = askOf(env, target, said);
  const result = kind === "suggest" ? await suggestHere(env.ai, ask) : kind === "fill" ? await fillHere(env.ai, ask) : kind === "record" ? await recordHere(env.ai, ask) : await panelHere(env.ai, ask);
  if (result.interaction.outcome === "failed") {
    if (kind !== "suggest") env.desk.record(result.interaction);
    return result;
  }
  const failing = (failed: string): InlineResult => {
    const interaction: AiInteraction = { ...result.interaction, outcome: "failed", failed };
    env.desk.record(interaction);
    return { ...result, interaction };
  };
  if (kind === "fill" || kind === "record") {
    if (!result.ghost || result.ghost.proposals.length === 0) return failing("Nothing here could be filled in.");
    landing?.();
    env.desk.setGhost({ ghost: result.ghost });
    env.desk.record(result.interaction);
  }
  if (kind === "panel" && result.panel) {
    const failed = await drawPanel(env, result.panel, landing);
    if (failed) return failing(failed);
    env.desk.record(result.interaction);
  }
  return result;
}

/**
 * TAKE ONE OF A SUGGESTION'S OFFERS: a change waits as a ghost; a panel is
 * drawn; a place or a record is gone to — each the way the face it was
 * asked on goes. Its entry is kept; a failure is answered in a sentence,
 * `landing` told before anything lands.
 */
export async function takeOffer(env: InlineEnv, result: InlineResult, offer: AiCandidate, landing?: () => void): Promise<string | undefined> {
  const entry = result.interaction;
  const proposal = proposalOf(offer);
  if (proposal) {
    const model = entry.usage?.at(-1)?.model;
    const confidence = entry.offered.find((one) => one.id === offer.id)?.confidence;
    const ghost = ghostOf(env.store, { interaction: entry.id, target: entry.target, basis: `${entry.ask.said}: ${offer.label}`, ...(model ? { model } : {}), proposals: [{ ...proposal, ...(confidence !== undefined ? { confidence } : {}) }] }, env.principal);
    if (ghost.proposals.length === 0) {
      const failed = "That can't be done now.";
      env.desk.record({ ...entry, outcome: "failed", failed });
      return failed;
    }
    landing?.();
    env.desk.setGhost({ ghost });
    env.desk.record(entry);
    return undefined;
  }
  if (offer.type === "panel") {
    const title = offer.label;
    const panel: AiPanel = { title, recipe: { ...offer.panel, title } };
    const failed = await drawPanel(env, panel, landing);
    env.desk.record(failed ? { ...entry, outcome: "failed", failed } : { ...entry, outcome: "drawn", accepted: [offer.id], panel });
    return failed;
  }
  landing?.();
  if (offer.type === "place") env.goTo.place(offer.place);
  else if (offer.type === "record") env.goTo.record(offer.record);
  env.desk.record({ ...entry, outcome: "accepted", accepted: [offer.id] });
  return undefined;
}

/**
 * ASK AGAIN, from an entry in Activity: the same ask, on the same target, as
 * a new interaction. A suggestion asked again is a fill; words asked of the
 * quick ask are asked again on its card, beside the target.
 */
export async function askAgain(env: InlineEnv, entry: AiInteraction): Promise<InlineResult | null> {
  if (entry.ask.kind === "ask") {
    openQuickAsk(env.desk, { target: entry.target, asked: entry.ask.said });
    return null;
  }
  const kind = entry.ask.kind === "panel" || entry.ask.kind === "record" ? entry.ask.kind : "fill";
  return askInline(env, kind, entry.target, entry.ask.said);
}

const ROW: CSSProperties = { padding: "5px 10px", fontSize: "0.875rem", borderRadius: 8, width: "100%", textAlign: "left", borderWidth: 1, borderStyle: "solid", borderColor: "transparent", background: "none", boxShadow: "none" };
const QUIET: CSSProperties = { margin: 0, padding: "4px 10px", fontSize: "0.8125rem", color: "var(--graview-ink-muted)" };

export interface InlineAiMenuProps {
  readonly target: MenuTarget;
  readonly close: () => void;
}

/** The menu's AI section: the suggestions as they arrive, then the asks this target supports. */
export function InlineAiMenu({ target: menu, close }: InlineAiMenuProps) {
  const env = useInlineEnv();
  const target = useMemo(() => aiTargetOf(menu, (id) => env.store.graph.has(id)), [menu, env.store]);
  // What the target supports at all, read once: a fill only where there are values, a panel only where there is a kind.
  const catalog = useMemo(() => {
    const ask = askOf(env, target);
    return catalogOf(env.store, target, { principal: env.principal, places: env.places, ...(ask.acts ? { acts: ask.acts } : {}) });
  }, [env, target]);
  const fills = catalog.candidates.some((candidate) => candidate.type === "fill");
  const panels = catalog.candidates.some((candidate) => candidate.type === "panel");
  // A record made by an act that asks for words, where a thinking model can write them.
  const makes = useMemo(() => new Set(env.store.allMutations().filter((mutation) => (mutation.creates ?? []).length > 0).map((mutation) => mutation.name)), [env.store]);
  const records = thinkingOf(env.ai) !== undefined && catalog.candidates.some((candidate) => candidate.type === "act" && candidate.asks.length > 0 && makes.has(candidate.mutation));
  const [suggested, setSuggested] = useState<InlineResult | null>(null);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setBusy(true);
    void askInline(env, "suggest", target).then((result) => {
      if (!live) return;
      setSuggested(result);
      setBusy(false);
      if (result.interaction.outcome === "failed") setFailed(result.interaction.failed ?? "The AI could not suggest anything here.");
    });
    return () => {
      live = false;
    };
    // Asked once per target: the menu is drawn again as the graph moves, and the suggestion stands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  /*
   * ASKED HERE, ANSWERED HERE (FR-184). The menu stays open while the ask
   * is on its way and is put away just before what was asked for lands —
   * the ghost on the tray, the panel where this face draws one, the page
   * gone to. An ask that fails is said in the menu, where the person who
   * asked is looking, as well as in Activity; the row they pressed keeps
   * the keyboard.
   */
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  const [asking, setAsking] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const run = (work: (landing: () => void) => Promise<string | undefined>) => {
    if (asking) return;
    setAsking(true);
    setRefused(null);
    let landed = false;
    const landing = () => {
      landed = true;
      close();
    };
    void work(landing).then(
      (failure) => {
        if (!mounted.current) return;
        setAsking(false);
        if (failure) setRefused(failure);
        else if (!landed) close();
      },
      (error: unknown) => {
        if (!mounted.current) return;
        setAsking(false);
        setRefused(error instanceof Error ? error.message : String(error));
      },
    );
  };
  const failureOf = (result: InlineResult) => (result.interaction.outcome === "failed" ? (result.interaction.failed ?? "The AI could not do that here.") : undefined);
  return (
    <div data-testid="inline-ai" style={{ display: "grid", gap: 2 }}>
      {busy ? (
        <p role="status" data-testid="inline-ai-thinking" style={QUIET}>
          Thinking…
        </p>
      ) : asking ? (
        <p role="status" data-testid="inline-ai-asking" style={QUIET}>
          Asking…
        </p>
      ) : refused ? (
        <p role="alert" data-testid="inline-ai-failed" style={{ ...QUIET, color: "var(--graview-warn)" }}>
          {refused}
        </p>
      ) : failed ? (
        <p role="status" style={QUIET}>
          {failed}
        </p>
      ) : null}
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 2 }}>
        {(suggested?.offers ?? []).map((offer) => (
          <li key={offer.id}>
            <button type="button" data-menu-item={`ai-offer:${offer.id}`} data-ai-offer={offer.id} data-ai-offer-type={offer.type} onClick={() => run((landing) => takeOffer(env, suggested!, offer, landing))} style={ROW}>
              {offer.label}
              <span style={{ color: "var(--graview-ink-faint)" }}> · {offer.type === "panel" ? "a panel" : offer.type === "place" ? "go there" : offer.type === "record" ? "open it" : "suggested"}</span>
            </button>
          </li>
        ))}
        {fills ? (
          <li>
            <button type="button" data-menu-item="ai-fill" onClick={() => run(async (landing) => failureOf(await askInline(env, "fill", target, "Fill in", landing)))} style={ROW}>
              Fill in with AI
            </button>
          </li>
        ) : null}
        {records ? (
          <li>
            <button type="button" data-menu-item="ai-record" onClick={() => run(async (landing) => failureOf(await askInline(env, "record", target, "Add one", landing)))} style={ROW}>
              Add one with AI
            </button>
          </li>
        ) : null}
        {panels ? (
          <li>
            <button type="button" data-menu-item="ai-panel" onClick={() => run(async (landing) => failureOf(await askInline(env, "panel", target, "Draw a panel", landing)))} style={ROW}>
              Draw a panel
            </button>
          </li>
        ) : null}
        <li>
          {/* The quick ask's bar, opened on what the menu was opened on: words asked there are answered on a card beside it. */}
          <button
            type="button"
            data-menu-item="ai-ask"
            onClick={() => {
              const back = document.activeElement;
              close();
              openQuickAsk(env.desk, { target, returnTo: back instanceof HTMLElement && back !== document.body ? back : null });
            }}
            style={ROW}
          >
            Ask about this…
          </button>
        </li>
      </ul>
    </div>
  );
}

const LINK: CSSProperties = { display: "inline-flex", alignItems: "center", minHeight: 28, padding: "2px 10px", fontSize: "0.8125rem", borderRadius: 8 };

/**
 * THE GHOST: changes the AI proposed and has not made, each in the act's
 * own sentence and how sure the model was, with a box to keep it or leave
 * it out. Accept takes the ones ticked as one batch; Dismiss puts it away;
 * once taken, Undo takes the batch back.
 */
export function GhostTray({ placement = "picture" }: { readonly placement?: "picture" | "page" | "card" }) {
  const { store: shown, principal, aiDesk } = useGraview<AnySchema>();
  const store = useLiveStore(shown, principal);
  const { ghost: held, entries } = useAiDeskState(aiDesk);
  const [off, setOff] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => setOff(new Set()), [held?.ghost.interaction]);
  const tray = useRef<HTMLElement | null>(null);
  const undoing = useRef<HTMLButtonElement | null>(null);
  /* Accepted, the keyboard goes to the way back: the buttons it pressed are gone. */
  const batch = held?.batch;
  useEffect(() => {
    if (batch !== undefined) undoing.current?.focus();
  }, [batch]);
  if (!held) return null;
  const { ghost } = held;
  const entry = entries.find((one) => one.id === ghost.interaction);
  /*
   * PUT AWAY, THE KEYBOARD GOES BACK TO WHAT IT WAS ABOUT: the record's card
   * or its page's heading, else the picture or the page — never <body>.
   */
  const putAway = () => {
    const id = ghost.target.on === "record" || ghost.target.on === "field" ? ghost.target.id : undefined;
    const root = tray.current?.closest("[data-graview-face], main")?.parentElement ?? document;
    const home =
      (id ? root.querySelector<HTMLElement>(`[data-graview-view="${CSS.escape(id)}"][tabindex]`) : null) ??
      document.querySelector<HTMLElement>("[data-graview-page-title]") ??
      (tray.current?.closest("main") as HTMLElement | null) ??
      document.querySelector<HTMLElement>("main");
    if (home && !home.hasAttribute("tabindex")) home.setAttribute("tabindex", "-1");
    home?.focus({ preventScroll: true });
    aiDesk.setGhost(null);
  };
  const chosen = ghost.proposals.filter((proposal) => !off.has(proposal.id)).map((proposal) => proposal.id);
  const accept = () => {
    const kept = acceptGhost(store, ghost, { author: principal, ids: chosen });
    if (!kept.ok) {
      aiDesk.setGhost({ ...held, refused: kept.refused });
      return;
    }
    if (entry) aiDesk.record(acceptedEntry(entry, kept.accepted, kept.batch));
    aiDesk.setGhost({ ghost, batch: kept.batch, took: kept.accepted.length, ...(held.onCard ? { onCard: true } : {}) });
  };
  const dismiss = () => {
    if (entry && held.batch === undefined) aiDesk.record(dismissedEntry(entry));
    putAway();
  };
  const undo = () => {
    if (held.batch === undefined) return;
    try {
      store.undo(held.batch, { author: principal });
      putAway();
    } catch (error) {
      aiDesk.setGhost({ ...held, refused: error instanceof Error ? error.message : String(error) });
    }
  };
  return (
    <section
      ref={tray}
      data-testid="ai-ghost"
      data-interaction={ghost.interaction}
      aria-label="Proposed by AI"
      style={{
        // Over the picture it stands in; on a page, over the window; on the quick ask's card, in its flow.
        ...(placement === "card"
          ? { position: "static" as const }
          : { position: placement === "page" ? ("fixed" as const) : ("absolute" as const), insetInline: "max(12px, calc(50% - 220px))", bottom: "calc(var(--graview-foot-room, 0px) + 72px)", zIndex: layer("toast"), boxShadow: "var(--graview-lift-high)" }),
        display: "grid",
        gap: 8,
        padding: 12,
        borderRadius: 12,
        border: "1px dashed var(--graview-accent)",
        background: "var(--graview-float)",
        fontSize: "0.875rem",
      }}
    >
      <p style={{ margin: 0, color: "var(--graview-ink-muted)" }}>
        {held.batch !== undefined ? `Done: ${held.took === 1 ? "one change" : `${held.took} changes`}, as one.` : `Proposed by AI · ${ghost.basis}`}
      </p>
      {held.batch === undefined ? (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
          {ghost.proposals.map((proposal) => (
            <li key={proposal.id} data-ghost-proposal={proposal.id}>
              <label style={{ display: "flex", alignItems: "baseline", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={!off.has(proposal.id)}
                  onChange={(event) => {
                    const next = new Set(off);
                    if (event.target.checked) next.delete(proposal.id);
                    else next.add(proposal.id);
                    setOff(next);
                  }}
                />
                <span style={{ fontStyle: "italic", color: "var(--graview-ink)" }}>{proposal.said}</span>
                {proposal.confidence !== undefined ? <span style={{ color: "var(--graview-ink-faint)" }}>{Math.round(proposal.confidence * 100)}% sure</span> : null}
              </label>
            </li>
          ))}
        </ul>
      ) : null}
      {held.refused ? (
        <p role="alert" style={{ margin: 0, color: "var(--graview-warn)" }}>
          {held.refused}
        </p>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {held.batch === undefined ? (
          <>
            <button type="button" data-testid="ghost-accept" disabled={chosen.length === 0} onClick={accept} style={LINK}>
              {chosen.length === ghost.proposals.length ? "Accept" : `Accept ${chosen.length} of ${ghost.proposals.length}`}
            </button>
            <button type="button" data-testid="ghost-dismiss" onClick={dismiss} style={LINK}>
              Dismiss
            </button>
          </>
        ) : (
          <>
            <button type="button" ref={undoing} data-testid="ghost-undo" onClick={undo} style={LINK}>
              Undo
            </button>
            <button type="button" data-testid="ghost-close" onClick={putAway} style={LINK}>
              Close
            </button>
          </>
        )}
      </div>
    </section>
  );
}

