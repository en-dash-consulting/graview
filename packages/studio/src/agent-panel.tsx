import { figureSvg, type AnySchema, type Finding, type MutationCall } from "@graview/core";
import { useGraview } from "@graview/react";
import { IntelligenceSettings } from "@graview/primitives";
import {
  completionFor,
  configuredResponder,
  describeIntelligence,
  describeProposal,
  loadIntelligenceConfig,
  saveIntelligenceConfig,
  toCall,
  type ChatReply,
  type IntelligenceConfig,
  type LocalStatus,
  type ProposedCall,
  type Responder,
} from "@graview/tools";
import { useEffect, useMemo, useRef, useState } from "react";
import { studioResponder } from "./agent.js";
import type { StudioSchema } from "./meta.js";
import type { Studio } from "./studio.js";

/**
 * ASK FOR A DECLARATION CHANGE IN WORDS, SEE IT CHECKED, KEEP OR DISCARD IT.
 *
 * The studio could already take a proposal from an agent — `propose`,
 * `proposals`, `decline` — and the chat panel could already turn words into
 * proposals. Nothing joined them, so the one surface whose subject is the
 * declaration was the one surface you could not talk to: every change by
 * hand, one act at a time, with the whole shape held in your head.
 *
 * Three things make this trustworthy rather than merely convenient:
 *
 * NOTHING IS APPLIED BY ASKING. A turn produces proposals and stops. The
 * declaration is untouched until a person presses Keep.
 *
 * THE CHECKER SPEAKS FIRST. Every proposal is run through `studio.would`,
 * which applies it to a COPY and checks what the declaration would become.
 * A change that would break the build is shown struck through with the
 * finding that condemns it, and has no Keep button at all — being offered
 * something that cannot work is worse than being told no.
 *
 * KEEPING IS AN ORDINARY OP. Keep calls `studio.propose`, the same path the
 * studio's existing seat uses: a batch of its own under the agent's name,
 * with an inverse, so the trail says who proposed it and undo takes it back.
 */

type Verdict =
  | { readonly ok: true; readonly errors: number; readonly warnings: number; readonly findings: readonly Finding[]; readonly breaks: boolean }
  | { readonly ok: false; readonly reason: string };

interface Offer {
  readonly proposal: ProposedCall;
  readonly call: MutationCall;
  readonly verdict: Verdict;
  readonly said: string;
  state: "open" | "kept" | "discarded";
}

interface Turn {
  readonly role: "person" | "seat";
  readonly text: string;
  readonly offers?: readonly Offer[];
}

export function StudioAgentPanel({
  studio,
  testId = "studio-agent",
}: {
  readonly studio: Studio<AnySchema>;
  readonly testId?: string;
}) {
  const { principal } = useGraview<StudioSchema>();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<readonly Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [config, setConfig] = useState<IntelligenceConfig>(() => loadIntelligenceConfig());
  const [settings, setSettings] = useState(false);
  const [warmth, setWarmth] = useState<LocalStatus | null>(null);
  const anchor = useRef<HTMLDivElement | null>(null);
  const log = useRef<HTMLOListElement | null>(null);

  const statusToken = useRef(0);
  /*
   * THE SAME LADDER, WITH THE STUDIO'S OWN FLOOR. Keyless, the declaration
   * answers for itself — what kinds there are, what an act writes, which
   * kinds have no figure — and a model earns only the questions that floor
   * cannot answer. The drawing reaches the same configured provider through
   * `completionFor`, so there is one place a key is read.
   */
  const answer = useMemo<Responder<StudioSchema>>(() => {
    const token = ++statusToken.current;
    const onStatus = (status: LocalStatus) => {
      if (token === statusToken.current) setWarmth(status);
    };
    const complete = completionFor(config, { onStatus });
    const floor = studioResponder(complete ? { complete } : {});
    return configuredResponder<StudioSchema>(config, { onStatus, floor });
  }, [config]);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [turns]);

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    setBusy(true);
    setTurns((current) => [...current, { role: "person", text }]);
    const history = turns.map((turn) => ({ role: turn.role, text: turn.text }));
    let reply: ChatReply;
    try {
      reply = await answer(studio.store as never, text, { history });
    } catch (error) {
      reply = {
        say: `The seat could not answer: ${error instanceof Error ? error.message : String(error)}`,
        proposals: [],
      };
    }
    /*
     * Judged HERE, once, as the reply lands — not on every render, and not
     * after the person has already decided. The baseline matters: a
     * declaration that is already failing must not make every proposal
     * unkeepable, so what condemns a change is the errors it ADDS.
     */
    const before = studio.check().errors;
    const offers: Offer[] = reply.proposals.map((proposal) => {
      const call = toCall(proposal);
      const would = studio.would(call);
      const verdict: Verdict = would.ok
        ? {
            ok: true,
            errors: would.check.errors,
            warnings: would.check.warnings,
            findings: would.check.findings.slice(0, 4),
            breaks: would.check.errors > before,
          }
        : { ok: false, reason: would.reason };
      return { proposal, call, verdict, said: describeProposal(studio.store as never, proposal), state: "open" };
    });
    setTurns((current) => [...current, { role: "seat", text: reply.say, offers }]);
    setBusy(false);
  };

  const settle = (at: number, offerAt: number, state: Offer["state"], say: string) => {
    setTurns((current) => [
      ...current.map((turn, index) =>
        index === at && turn.offers
          ? { ...turn, offers: turn.offers.map((offer, o) => (o === offerAt ? { ...offer, state } : offer)) }
          : turn,
      ),
      { role: "seat" as const, text: say },
    ]);
  };

  const keep = (at: number, offerAt: number, offer: Offer) => {
    const result = studio.propose(
      offer.call,
      { kind: "agent", id: "studio-agent", session: "ui", ...(principal.roles ? { roles: principal.roles } : {}) },
      offer.proposal.why ?? `you asked for it in words`,
    );
    if (!result.ok) {
      settle(at, offerAt, "open", `Refused: ${result.reason}`);
      return;
    }
    settle(at, offerAt, "kept", `Kept — ${offer.said}. It is an op under the agent's name; undo takes it back.`);
  };

  return (
    <div ref={anchor} style={{ position: "relative" }}>
      <button
        type="button"
        data-testid={testId}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        title="Ask for a change to this declaration in words, see what the checker makes of it, and keep or discard it"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 11px", fontSize: "0.78125rem" }}
      >
        <span aria-hidden="true">◆</span>
        Ask
      </button>

      {open ? (
        <div
          data-testid={`${testId}-panel`}
          data-graview-offstage=""
          data-graview-overlay=""
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 45,
            width: 360,
            display: "grid",
            gridTemplateRows: "auto 1fr auto",
            borderRadius: 10,
            border: "1px solid var(--graview-edge)",
            background: "var(--graview-float)",
            boxShadow: "var(--graview-lift-high)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 8px 6px 12px",
              borderBottom: "1px solid var(--graview-edge)",
            }}
          >
            <span style={{ fontSize: "0.6875rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--graview-ink-faint)" }}>
              Declaration
            </span>
            <span
              data-testid={`${testId}-source`}
              title={warmth?.state === "failed" ? warmth.detail : undefined}
              style={{ fontSize: "0.6875rem", color: "var(--graview-ink-muted)" }}
            >
              {warmth?.state === "warming"
                ? `warming${warmth.progress !== undefined ? ` ${Math.round(warmth.progress * 100)}%` : "…"}`
                : warmth?.state === "failed"
                  ? `the declaration answering — ${warmth.detail ?? "the local model failed"}`
                  : describeIntelligence(config)}
            </span>
            <span style={{ flex: "1 1 auto" }} />
            <button
              type="button"
              data-testid={`${testId}-settings`}
              aria-expanded={settings}
              onClick={() => setSettings((current) => !current)}
              title="Choose what answers: the declaration itself, a model in this browser, or your own key"
              style={{ fontSize: "0.75rem", padding: "2px 8px", minHeight: 24 }}
            >
              ⚙
            </button>
          </div>

          {settings ? (
            <IntelligenceSettings
              config={config}
              onDone={(next) => {
                saveIntelligenceConfig(next);
                setConfig(next);
                setWarmth(null);
                setSettings(false);
              }}
            />
          ) : (
            <ol
              ref={log}
              style={{
                margin: 0,
                padding: 10,
                listStyle: "none",
                display: "grid",
                gap: 8,
                alignContent: "start",
                maxHeight: "min(46cqh, 420px)",
                minHeight: 140,
                overflowY: "auto",
              }}
            >
              {turns.length === 0 ? (
                <li style={{ fontSize: "0.75rem", color: "var(--graview-ink-muted)", lineHeight: 1.5 }}>
                  Ask about this declaration — what kinds there are, what an act writes, what a rule
                  judges, which kinds have no figure — or say a change: “add a due date to tasks”,
                  “draw a figure for person”. Nothing is applied until you keep it.
                </li>
              ) : null}
              {turns.map((turn, at) => (
                <li key={at} style={{ display: "grid", gap: 6, justifyItems: turn.role === "person" ? "end" : "start" }}>
                  <p
                    style={{
                      margin: 0,
                      maxWidth: 300,
                      padding: "6px 10px",
                      borderRadius: 10,
                      fontSize: "0.78125rem",
                      lineHeight: 1.45,
                      background: turn.role === "person" ? "var(--graview-panel-muted)" : "var(--graview-panel)",
                      border: "1px solid var(--graview-edge)",
                      color: "var(--graview-ink)",
                    }}
                  >
                    {turn.text}
                  </p>
                  {(turn.offers ?? []).map((offer, offerAt) => (
                    <Offered
                      key={offerAt}
                      offer={offer}
                      testId={testId}
                      onKeep={() => keep(at, offerAt, offer)}
                      onDiscard={() => settle(at, offerAt, "discarded", `Discarded — ${offer.said}. The declaration is as it was.`)}
                    />
                  ))}
                </li>
              ))}
              {busy ? <li style={{ fontSize: "0.75rem", color: "var(--graview-ink-faint)" }}>thinking…</li> : null}
            </ol>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
            style={{ display: "flex", gap: 6, padding: 8, borderTop: "1px solid var(--graview-edge)" }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask for a change…"
              aria-label="Ask for a change to the declaration"
              data-testid={`${testId}-draft`}
              style={{
                flex: 1,
                font: "inherit",
                fontSize: "0.78125rem",
                padding: "6px 9px",
                borderRadius: 8,
                border: "1px solid var(--graview-edge)",
                background: "var(--graview-panel)",
                color: "var(--graview-ink)",
              }}
            />
            <button type="submit" data-testid={`${testId}-send`} disabled={busy || draft.trim().length === 0} style={{ fontSize: "0.78125rem" }}>
              Send
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

/**
 * ONE PROPOSAL, WITH THE CHECKER'S VERDICT ON IT.
 *
 * A change that would break the build is a struck line and a sentence, not
 * a button: the whole point of checking before offering is that nobody is
 * asked to keep something that cannot work. Everything else says what the
 * checker found — including warnings, which are a reason to think rather
 * than a reason to refuse — and offers both answers.
 */
function Offered({
  offer,
  testId,
  onKeep,
  onDiscard,
}: {
  readonly offer: Offer;
  readonly testId: string;
  readonly onKeep: () => void;
  readonly onDiscard: () => void;
}) {
  const faint = { fontSize: "0.75rem", color: "var(--graview-ink-muted)" } as const;
  if (offer.state !== "open") {
    return (
      <span data-testid={`${testId}-settled`} data-state={offer.state} style={faint}>
        {offer.state === "kept" ? "Kept" : "Discarded"} — {offer.said}
      </span>
    );
  }
  if (!offer.verdict.ok) {
    return (
      <span data-testid={`${testId}-refused`} style={faint}>
        <s>{offer.said}</s> — the store refuses it: {offer.verdict.reason}
      </span>
    );
  }
  if (offer.verdict.breaks) {
    const errors = offer.verdict.findings.filter((finding) => finding.severity === "error");
    return (
      <span data-testid={`${testId}-refused`} style={faint}>
        <s>{offer.said}</s> — that would fail the build:{" "}
        {errors.length > 0 ? `${errors[0]!.where} — ${errors[0]!.message}` : `${offer.verdict.errors} errors`}
      </span>
    );
  }
  return (
    <span style={{ display: "grid", gap: 4, justifyItems: "start" }}>
      <ProposedDrawing offer={offer} />
      <span data-testid={`${testId}-check`} data-errors={offer.verdict.errors} data-warnings={offer.verdict.warnings} style={faint}>
        {offer.verdict.warnings === 0
          ? "The checker finds nothing wrong with it."
          : `The checker would warn: ${offer.verdict.findings[0]?.message ?? `${offer.verdict.warnings} warnings`}`}
      </span>
      <span style={{ display: "flex", gap: 6 }}>
        <button type="button" data-testid={`${testId}-keep`} onClick={onKeep} title={offer.proposal.why ?? "Keep this change"} style={{ fontSize: "0.75rem" }}>
          Keep {offer.said}
        </button>
        <button type="button" data-testid={`${testId}-discard`} onClick={onDiscard} style={{ fontSize: "0.75rem" }}>
          Discard
        </button>
      </span>
    </span>
  );
}

/**
 * A DRAWING IS SHOWN BEFORE IT IS KEPT, because a figure is the one change
 * whose whole content is what it looks like.
 *
 * It is safe to show because `figureFaults` — the checker's own function,
 * which `drawFigure` already ran — holds a figure to a closed vocabulary of
 * drawing elements and drawing attributes. Anything a model smuggled in
 * besides line art was refused before it ever reached a proposal.
 */
function ProposedDrawing({ offer }: { readonly offer: Offer }) {
  const art = offer.proposal.mutation === "set-figure" ? figureSvg(String(offer.proposal.args["figure"] ?? "")) : undefined;
  const drawing = useMemo(() => (art ? { __html: art } : null), [art]);
  if (!drawing) return null;
  return (
    <span
      data-testid="studio-agent-drawing"
      aria-hidden="true"
      dangerouslySetInnerHTML={drawing}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 34,
        height: 34,
        padding: 4,
        borderRadius: 8,
        border: "1px solid var(--graview-edge)",
        color: "var(--graview-ink)",
      }}
    />
  );
}
