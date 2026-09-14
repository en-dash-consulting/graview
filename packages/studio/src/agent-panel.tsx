import { figureSvg, formFields, humaniseField, labelOf, type AnySchema, type Finding, type FormField, type Store } from "@graview/core";
import { useGraview } from "@graview/react";
import { IntelligenceSettings } from "@graview/primitives";
import {
  completionFor,
  configuredResponder,
  describeIntelligence,
  describeProposal,
  loadIntelligenceConfig,
  resolveProposal,
  saveIntelligenceConfig,
  type ChatReply,
  type IntelligenceConfig,
  type LocalStatus,
  type ProposedCall,
  type Responder,
} from "@graview/tools";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useStoreTick } from "@graview/pages";
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
  /** What would actually be applied — the person's to correct before it is. */
  readonly args: Record<string, unknown>;
  readonly verdict: Verdict;
  readonly said: string;
  state: "open" | "kept" | "discarded";
}

interface Turn {
  readonly role: "person" | "seat";
  readonly text: string;
  readonly offers?: readonly Offer[];
  /**
   * The rung that answered could not read the sentence — and no model is
   * chosen. The way out is one press, so the turn carries it.
   */
  readonly offerModel?: boolean;
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
    const offers: Offer[] = reply.proposals.map((proposal) => {
      /*
       * A model names things the way a person does — "Meal", not
       * `declared:meal`. Reading a label that means exactly one node as that
       * node is what turns a validation refusal into a working proposal.
       */
      const resolved = resolveProposal(studio.store as never, proposal);
      const args = { ...resolved.args };
      return { proposal: resolved, args, verdict: judge(args, resolved), said: describeProposal(studio.store as never, resolved), state: "open" };
    });
    setTurns((current) => [
      ...current,
      {
        role: "seat",
        text: reply.say,
        offers,
        /*
         * "I could not read that" is honest and, on its own, a dead end:
         * the person is left guessing which phrasing the pattern-matcher
         * wants, when the rung that reads any phrasing is one press away
         * behind the gear. Only when none is chosen — a surface that
         * already has a model has nothing to offer.
         */
        ...(reply.unsure && config.source === "graph" ? { offerModel: true } : {}),
      },
    ]);
    setBusy(false);
  };

  /*
   * WHAT THE CHECKER WOULD SAY, for the arguments as they now stand.
   *
   * Recomputed on every edit rather than once on arrival: the whole point
   * of letting a person correct a proposal is that the verdict has to be
   * about what they corrected it to.
   */
  const judge = (args: Record<string, unknown>, proposal: ProposedCall): Verdict => {
    const before = studio.check().errors;
    const would = studio.would({ name: proposal.mutation, args: { ...args } });
    if (!would.ok) return { ok: false, reason: would.reason };
    /*
     * ONLY WHAT THIS CHANGE BROUGHT. The declaration has its own standing
     * findings — rota ships one about a role that may run nothing — and
     * showing the first of them under a proposal reads as a verdict ON the
     * proposal. What a person needs to know is what they are ADDING.
     */
    const standing = new Set(studio.check().findings.map((finding) => `${finding.code}:${finding.where}`));
    const added = would.check.findings.filter((finding) => !standing.has(`${finding.code}:${finding.where}`));
    return {
      ok: true,
      errors: would.check.errors,
      warnings: would.check.warnings,
      findings: added.slice(0, 4),
      breaks: would.check.errors > before,
    };
  };

  /*
   * EVERY OPEN PROPOSAL IS ABOUT THE DECLARATION AS IT NOW STANDS.
   *
   * A loose sentence describes several changes and several of them depend
   * on each other: "a Meal kind, with a name and how many it feeds" is one
   * act that creates the kind and two that need it to exist. Judged once on
   * arrival, the two fields refuse — they name a kind that is not there yet
   * — and keeping the first one changed nothing about them, so a person saw
   * two dead proposals under a live one and no way to tell they were only
   * waiting.
   *
   * So they are re-read and re-judged whenever the declaration changes: the
   * name the model used resolves the moment the thing it names exists, and
   * an undo puts them back where they were. The verdict on screen is never
   * about a declaration that has moved on.
   */
  const tick = useStoreTick(studio.store);
  useEffect(() => {
    setTurns((current) =>
      current.map((turn) =>
        turn.offers === undefined
          ? turn
          : {
              ...turn,
              offers: turn.offers.map((offer) => {
                if (offer.state !== "open") return offer;
                const resolved = resolveProposal(studio.store as never, { ...offer.proposal, args: offer.args });
                const args = { ...resolved.args };
                return {
                  ...offer,
                  args,
                  verdict: judge(args, offer.proposal),
                  said: describeProposal(studio.store as never, { ...offer.proposal, args }),
                };
              }),
            },
      ),
    );
    // Only when the declaration moved: `judge` reads the store as it is, so
    // the tick is the whole dependency.
  }, [tick]);

  const edit = (at: number, offerAt: number, name: string, value: unknown) => {
    setTurns((current) =>
      current.map((turn, index) =>
        index === at && turn.offers
          ? {
              ...turn,
              offers: turn.offers.map((offer, o) => {
                if (o !== offerAt) return offer;
                const args = { ...offer.args, [name]: value };
                return {
                  ...offer,
                  args,
                  verdict: judge(args, offer.proposal),
                  said: describeProposal(studio.store as never, { ...offer.proposal, args }),
                };
              }),
            }
          : turn,
      ),
    );
  };

  /*
   * ONE LINE PER DECISION. Settling used to mark the offer AND append a
   * turn saying the same thing, so keeping a field wrote "Kept — Add a
   * field" twice, one above the other, in two different voices.
   */
  const settle = (at: number, offerAt: number, state: Offer["state"], say?: string) => {
    setTurns((current) => [
      ...current.map((turn, index) =>
        index === at && turn.offers
          ? { ...turn, offers: turn.offers.map((offer, o) => (o === offerAt ? { ...offer, state } : offer)) }
          : turn,
      ),
      ...(say ? [{ role: "seat" as const, text: say }] : []),
    ]);
  };

  const keep = (at: number, offerAt: number, offer: Offer) => {
    const result = studio.propose(
      { name: offer.proposal.mutation, args: { ...offer.args } },
      { kind: "agent", id: "studio-agent", session: "ui", ...(principal.roles ? { roles: principal.roles } : {}) },
      offer.proposal.why ?? `you asked for it in words`,
    );
    if (!result.ok) {
      settle(at, offerAt, "open", `Refused: ${result.reason}`);
      return;
    }
    settle(at, offerAt, "kept");
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
                  {turn.offerModel ? (
                    <button
                      type="button"
                      data-testid={`${testId}-offer-model`}
                      onClick={() => setSettings(true)}
                      title="A model reads a sentence however it is phrased, and proposes the acts it describes"
                      style={{ fontSize: "0.75rem", justifySelf: "start" }}
                    >
                      Let a model read it →
                    </button>
                  ) : null}
                  {(turn.offers ?? []).map((offer, offerAt) => (
                    <Offered
                      key={offerAt}
                      offer={offer}
                      testId={testId}
                      store={studio.store}
                      onEdit={(name, value) => edit(at, offerAt, name, value)}
                      onKeep={() => keep(at, offerAt, offer)}
                      onDiscard={() => settle(at, offerAt, "discarded")}
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
 * ONE PROPOSAL, AS THE ACT'S OWN FORM, WITH THE CHECKER ON IT.
 *
 * It was a sentence and a button, and that made the conversation the only
 * way to correct anything: asked to add a field to Meal and told the field
 * would land on "user", a person's only move was to argue with a chat and
 * hope. Hoping is not an interface.
 *
 * So a proposal is the act's own arguments, drawn from the same
 * `formFields` the actions strip draws — a picker for a kind, a choice for
 * a type, a box for a name — filled with what was proposed and editable
 * before it is kept. The checker re-runs on every edit, so the verdict is
 * about what you are actually about to do; a change that would add an error
 * says so and cannot be kept.
 *
 * This is also what makes a half-right answer USEFUL. A model that names
 * the wrong kind, or leaves an argument out, now costs one press to fix
 * rather than a fresh sentence and another turn.
 */
function Offered<S extends AnySchema>({
  offer,
  store,
  testId,
  onEdit,
  onKeep,
  onDiscard,
}: {
  readonly offer: Offer;
  readonly store: Store<S>;
  readonly testId: string;
  readonly onEdit: (name: string, value: unknown) => void;
  readonly onKeep: () => void;
  readonly onDiscard: () => void;
}) {
  const faint = { fontSize: "0.75rem", color: "var(--graview-ink-muted)" } as const;
  if (offer.state !== "open") {
    return (
      <span data-testid={`${testId}-settled`} data-state={offer.state} style={faint}>
        {offer.state === "kept" ? "Kept" : "Discarded"} — {offer.said}
        {offer.state === "kept" ? " · undo takes it back" : ""}
      </span>
    );
  }

  const declared = store.allMutations().find((one) => one.name === offer.proposal.mutation);
  const fields = declared ? formFields(declared.input) : [];
  const breaks = offer.verdict.ok && offer.verdict.breaks;
  const refused = !offer.verdict.ok;
  /*
   * A REFUSAL NAMES THE ARGUMENT, not the parser. The store answers with
   * zod's own sentence — `label: Invalid input: expected string, received
   * undefined` — which tells a person nothing they can act on. The form
   * below is what they act on, so the line above it says which of its boxes
   * is the problem.
   */
  const wanted = refused
    ? fields
        .filter((field) => !field.optional && (offer.args[field.name] === undefined || offer.args[field.name] === ""))
        .map((field) => humaniseField(field.name).toLowerCase())
    : [];
  /*
   * AND AN ARGUMENT THAT NAMES SOMETHING NOT THERE YET SAYS THAT.
   *
   * A sentence split into several acts usually splits into acts that wait
   * on each other: the field cannot be added until the kind exists. The
   * store's own refusal for that is `Edge "of" references missing node`,
   * which is true, internal, and no use at all to somebody looking at a
   * form with an empty picker in it.
   */
  const awaiting = refused
    ? fields
        .filter((field) => field.control === "node")
        .map((field) => ({ field, value: offer.args[field.name] }))
        .filter(({ value }) => typeof value === "string" && value.length > 0 && !store.graph.getNode(value))
        .map(({ field, value }) => `${humaniseField(field.name).toLowerCase()} "${String(value)}"`)
    : [];

  return (
    <span
      data-testid={`${testId}-offer`}
      data-mutation={offer.proposal.mutation}
      style={{
        display: "grid",
        gap: 6,
        justifySelf: "stretch",
        padding: 8,
        borderRadius: 8,
        border: `1px solid ${breaks || refused ? "var(--graview-warn)" : "var(--graview-edge)"}`,
        background: "var(--graview-panel)",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <strong style={{ fontSize: "0.78125rem", fontWeight: 550 }}>{declared?.title ?? offer.proposal.mutation}</strong>
        <ProposedDrawing offer={offer} />
      </span>

      {fields.map((field) => (
        <Argument
          key={field.name}
          field={field}
          value={offer.args[field.name]}
          store={store}
          testId={`${testId}-arg-${field.name}`}
          onChange={(value) => onEdit(field.name, value)}
        />
      ))}

      <span data-testid={`${testId}-check`} data-errors={offer.verdict.ok ? offer.verdict.errors : -1} data-warnings={offer.verdict.ok ? offer.verdict.warnings : -1} style={faint}>
        {refused
          ? awaiting.length > 0
            ? `Waiting on ${awaiting.join(" and ")} — keep the one that makes it first, or choose something that is already here.`
            : wanted.length > 0
              ? `It still needs ${wanted.join(" and ")}.`
              : `The store will not take it: ${offer.verdict.reason}`
          : breaks
            ? `That would fail the build: ${offer.verdict.findings.find((finding) => finding.severity === "error")?.message ?? `${offer.verdict.errors} errors`}`
            : offer.verdict.findings.length === 0
              ? "The checker finds nothing wrong with it."
              : `It would add a warning: ${offer.verdict.findings[0]!.message}`}
      </span>

      <span style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          data-testid={`${testId}-keep`}
          disabled={breaks || refused}
          onClick={onKeep}
          title={breaks ? "The checker refuses this one" : (offer.proposal.why ?? "Keep this change")}
          style={{ fontSize: "0.75rem" }}
        >
          Keep
        </button>
        <button type="button" data-testid={`${testId}-discard`} onClick={onDiscard} style={{ fontSize: "0.75rem" }}>
          Discard
        </button>
      </span>
    </span>
  );
}

/**
 * ONE ARGUMENT, drawn as what it is.
 *
 * The same controls the actions strip derives, because they come from the
 * same declaration: a kind is a picker over the kinds that exist, a type is
 * its own enum, a flag is a checkbox. Nothing here knows what "kind" or
 * "type" mean — it reads `formFields` and draws what it is told.
 */
function Argument<S extends AnySchema>({
  field,
  value,
  store,
  testId,
  onChange,
}: {
  readonly field: FormField;
  readonly value: unknown;
  readonly store: Store<S>;
  readonly testId: string;
  readonly onChange: (value: unknown) => void;
}) {
  const label = humaniseField(field.name);
  const box: React.CSSProperties = {
    font: "inherit",
    fontSize: "0.75rem",
    padding: "3px 6px",
    minHeight: 24,
    borderRadius: 6,
    border: "1px solid var(--graview-edge)",
    background: "var(--graview-float)",
    color: "var(--graview-ink)",
    maxWidth: "100%",
  };
  const row = (control: ReactNode) => (
    <label style={{ display: "grid", gridTemplateColumns: "minmax(0, 5.5rem) minmax(0, 1fr)", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: "0.6875rem", color: "var(--graview-ink-muted)" }}>{label}</span>
      {control}
    </label>
  );

  if (field.control === "node") {
    const choices = [...store.graph.allNodes()].filter(
      (node) => field.kinds.includes("*") || field.kinds.includes(node.kind as string),
    );
    return row(
      <select
        data-testid={testId}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        style={box}
      >
        <option value="">— choose —</option>
        {choices.map((node) => (
          <option key={node.id} value={node.id}>
            {labelOf(store.schema.tryDefinition(node.kind as string), node as never)}
          </option>
        ))}
      </select>,
    );
  }
  if (field.control === "choice" && field.options) {
    return row(
      <select data-testid={testId} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} style={box}>
        {field.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>,
    );
  }
  if (field.control === "boolean") {
    return row(
      <input
        type="checkbox"
        data-testid={testId}
        checked={value === true}
        onChange={(event) => onChange(event.target.checked)}
        style={{ justifySelf: "start", width: 16, height: 16 }}
      />,
    );
  }
  if (field.control === "number") {
    return row(
      <input
        type="number"
        data-testid={testId}
        value={typeof value === "number" ? value : ""}
        onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
        style={box}
      />,
    );
  }
  if (field.control === "date") {
    return row(
      <input type="date" data-testid={testId} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} style={box} />,
    );
  }
  if (field.control === "list") {
    // A list of plain words — an enum's own options, most of the time.
    const held = Array.isArray(value) ? (value as unknown[]).map(String) : [];
    return row(
      <input
        data-testid={testId}
        value={held.join(", ")}
        placeholder="one, two, three"
        onChange={(event) => {
          const words = event.target.value.split(",").map((word) => word.trim()).filter(Boolean);
          onChange(words.length > 0 ? words : undefined);
        }}
        style={box}
      />,
    );
  }
  if (field.control === "text") {
    return row(
      <input data-testid={testId} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} style={box} />,
    );
  }
  // Anything the framework cannot draw is said rather than silently dropped.
  return row(<span style={{ fontSize: "0.75rem", color: "var(--graview-ink-faint)" }}>{String(value ?? "—")}</span>);
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
