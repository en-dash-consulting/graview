import { formFields, humanizeField, labelOf, type AnySchema, type FormField, type Store } from "@graview/core";
import { figureSvg } from "@graview/core/figures";
import type { Finding } from "@graview/core/check";
import { POPOVER_STYLE, useGraview, usePopover } from "@graview/react";
import {
  describeSource,
  proposalKey,
  SeatComposer,
  SeatHeader,
  SeatSettings,
  SeatThread,
  useSeatConversation,
} from "@graview/primitives";
import {
  completionFor,
  configuredResponder,
  describeIntelligence,
  describeProposal,
  resolveProposal,
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
 * The same conversation as the app's own seat — the thread, the header,
 * the field, what the model is told was kept — from `@graview/primitives`.
 * What is the studio's own is what a proposal is here: a change to the
 * declaration, and three things make that trustworthy rather than merely
 * convenient.
 *
 * NOTHING IS APPLIED BY ASKING. A turn produces proposals and stops. The
 * declaration is untouched until a person presses Keep.
 *
 * THE CHECKER SPEAKS FIRST. Every proposal is run through `studio.would`,
 * which applies it to a COPY and checks what the declaration would become.
 * A change that would break the build says so and cannot be kept — being
 * offered something that cannot work is worse than being told no.
 *
 * KEEPING IS AN ORDINARY OP. Keep calls `studio.propose`, the same path the
 * studio's existing seat uses: a batch of its own under the agent's name,
 * with an inverse, so the trail says who proposed it and undo takes it back.
 */

type Verdict =
  | { readonly ok: true; readonly errors: number; readonly warnings: number; readonly findings: readonly Finding[]; readonly breaks: boolean }
  | { readonly ok: false; readonly reason: string };

/** One proposal as it stands now: the person's corrections over what was proposed, read against the declaration as it is. */
interface Offer {
  readonly proposal: ProposedCall;
  readonly args: Record<string, unknown>;
  readonly verdict: Verdict;
}

export function StudioAgentPanel({
  studio,
  respond,
  testId = "studio-agent",
}: {
  readonly studio: Studio<AnySchema>;
  /** How the seat answers, when a host decides — as on the app's own chat. Defaults to the ladder over the declaration's floor. */
  readonly respond?: Responder<StudioSchema>;
  readonly testId?: string;
}) {
  const { principal, intelligence: config } = useGraview<StudioSchema>();
  /* One of the family (FR-77): in the top layer, hung from its pill; Escape or a press elsewhere in the studio closes it. */
  const popover = usePopover("studio-ask");
  const open = popover.open;
  const [settings, setSettings] = useState(false);
  const [warmth, setWarmth] = useState<LocalStatus | null>(null);
  useEffect(() => setWarmth(null), [config]);
  /** What the person changed on each proposal before keeping it, by proposal key. */
  const [edits, setEdits] = useState<ReadonlyMap<string, Record<string, unknown>>>(new Map());
  const anchor = useRef<HTMLDivElement | null>(null);

  const statusToken = useRef(0);
  /*
   * THE SAME LADDER, WITH THE STUDIO'S OWN FLOOR. Keyless, the declaration
   * answers for itself — what kinds there are, what an act writes, which
   * kinds have no figure — and a model earns only the questions that floor
   * cannot answer. The drawing reaches the same configured provider through
   * `completionFor`, so there is one place a key is read.
   */
  const configNow = useRef(config);
  configNow.current = config;
  const answer = useMemo<Responder<StudioSchema>>(() => {
    const token = ++statusToken.current;
    const onStatus = (status: LocalStatus) => {
      if (token === statusToken.current) setWarmth(status);
    };
    const complete = completionFor(config, { onStatus });
    const floor = studioResponder(complete ? { complete } : {});
    return respond ?? configuredResponder<StudioSchema>(config, { onStatus, floor, current: () => configNow.current });
  }, [config, respond]);

  const conversation = useSeatConversation({
    answer: (text, context) => answer(studio.store, text, context),
  });
  const { outcomes, settle } = conversation;

  /*
   * WHAT THE CHECKER WOULD SAY, for the arguments as they now stand.
   *
   * The baseline matters: a declaration that is already failing must not
   * make every proposal unkeepable, so what condemns a change is the errors
   * it ADDS — and only the findings it brought are shown under it. Rota
   * ships a standing finding about a role that may run nothing; shown under
   * a proposal, it read as a verdict ON the proposal.
   */
  const judge = (args: Record<string, unknown>, proposal: ProposedCall): Verdict => {
    const now = studio.check();
    const would = studio.would({ name: proposal.mutation, args: { ...args } });
    if (!would.ok) return { ok: false, reason: would.reason };
    const standing = new Set(now.findings.map((finding) => `${finding.code}:${finding.where}`));
    const added = would.check.findings.filter((finding) => !standing.has(`${finding.code}:${finding.where}`));
    return {
      ok: true,
      errors: would.check.errors,
      warnings: would.check.warnings,
      findings: added.slice(0, 4),
      breaks: would.check.errors > now.errors,
    };
  };

  /*
   * EVERY OPEN PROPOSAL IS ABOUT THE DECLARATION AS IT NOW STANDS.
   *
   * A loose sentence describes several changes that depend on each other:
   * "a Meal kind, with a name and how many it feeds" is one act that creates
   * the kind and two that need it. Read afresh against the declaration each
   * time it moves, the name the model used resolves the moment the thing it
   * names exists, and an undo puts them back where they were — so the
   * verdict on screen is never about a declaration that has moved on.
   */
  const tick = useStoreTick(studio.store);
  const offerFor = (proposal: ProposedCall, key: string): Offer => {
    const resolved = resolveProposal(studio.store, { ...proposal, args: edits.get(key) ?? proposal.args });
    const args = { ...resolved.args };
    return { proposal: resolved, args, verdict: judge(args, resolved) };
  };
  // Judging runs the checker twice per proposal: once per declaration change and edit, not per render.
  const offers = useMemo(() => {
    const judged = new Map<string, Offer>();
    conversation.turns.forEach((turn, index) =>
      (turn.proposals ?? []).forEach((proposal, at) => {
        const key = proposalKey(index, at);
        if (!outcomes.has(key) || outcomes.get(key)?.state === "refused") judged.set(key, offerFor(proposal, key));
      }),
    );
    return judged;
    // `offerFor` reads the store as it is, so the tick stands for it.
  }, [conversation.turns, outcomes, edits, tick]);

  /*
   * KEPT, THE KEYBOARD MOVES ON. Keeping or discarding an offer turns it into
   * a line of what happened, and the button the keyboard was on goes with it;
   * on the nightly's runner the keyboard was still on <body> seconds later.
   * It goes to the next offer still open, or to the words to ask with when
   * none is — where a person works next.
   */
  const handOn = () => {
    const panel = anchor.current;
    if (!panel) return;
    const pressed = document.activeElement;
    let tries = 20;
    const land = () => {
      const active = document.activeElement;
      // Still on the button that was pressed, while the panel redraws: ask again next frame.
      if (active === pressed && active?.isConnected && --tries > 0) return void requestAnimationFrame(land);
      if (active && active !== pressed && active !== document.body && active.isConnected) return;
      const next =
        panel.querySelector<HTMLElement>('[data-testid="studio-agent-keep"]:not([disabled])') ??
        panel.querySelector<HTMLElement>("textarea, input[type='text'], input:not([type])");
      if (next) next.focus({ preventScroll: true });
      else if (--tries > 0) requestAnimationFrame(land);
    };
    requestAnimationFrame(land);
  };

  const keep = (key: string, offer: Offer): boolean => {
    // Said before it lands: a removal described afterwards names what is no longer there.
    const said = describeProposal(studio.store, { ...offer.proposal, args: offer.args });
    const result = studio.propose(
      { name: offer.proposal.mutation, args: { ...offer.args } },
      { kind: "agent", id: "studio-agent", session: "ui", ...(principal.roles ? { roles: principal.roles } : {}) },
      offer.proposal.why ?? `you asked for it in words`,
    );
    if (!result.ok) {
      settle(key, { state: "refused", error: result.reason });
      return false;
    }
    settle(key, { state: "applied", said });
    return true;
  };

  /*
   * ONE REQUEST, ONE PRESS — judged as what the proposals make TOGETHER.
   * "Remove the edge from the plot, add it to the planting" breaks the
   * build after its first half and is whole after its second, so the set
   * is tried in order on a copy and only its end is checked; kept, each is
   * read afresh after the one before it has landed, so a field waiting on
   * its kind resolves against the declaration that now has it.
   */
  const keepAll = (turn: number, proposals: readonly ProposedCall[]) => {
    const open = proposals.flatMap((proposal, at) => {
      const key = proposalKey(turn, at);
      const state = outcomes.get(key)?.state;
      return state === "applied" || state === "declined" ? [] : [{ proposal, key }];
    });
    const together = studio.would(open.map(({ proposal, key }) => ({ name: proposal.mutation, args: { ...offerFor(proposal, key).args } })));
    const before = studio.check().errors;
    if (!together.ok || together.check.errors > before) {
      const reason = together.ok ? together.check.findings.find((finding) => finding.severity === "error")?.message : together.reason;
      settle(open[0]!.key, { state: "refused", error: `Together these would fail the build: ${reason ?? "the checker refuses them"}` });
      return;
    }
    for (const { proposal, key } of open) {
      if (!keep(key, offerFor(proposal, key))) return;
    }
  };

  return (
    <div ref={anchor} style={{ position: "relative" }}>
      <button
        type="button"
        data-testid={testId}
        {...popover.trigger}
        onClick={popover.toggle}
        title="Ask for a change to this declaration in words, see what the checker makes of it, and keep or discard it"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 11px", fontSize: "0.875rem" }}
      >
        <span aria-hidden="true">◆</span>
        Ask
      </button>

      {open ? (
        <div
          {...popover.pane}
          data-testid={`${testId}-panel`}
          data-graview-offstage=""
          style={{
            ...POPOVER_STYLE,
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
          {/*
            * The studio has no profile of its own on its bar, so the one
            * setting the app's profile holds is behind the gear here.
            */}
          <SeatHeader
            label="Declaration"
            testId={testId}
            source={describeSource(describeIntelligence(config), warmth, "the declaration")}
            {...(warmth?.state === "failed" && warmth.detail ? { sourceTitle: warmth.detail } : {})}
            settings={settings}
            onSettings={() => setSettings((current) => !current)}
          />
          {settings ? (
            <SeatSettings testId={testId} onDone={() => setSettings(false)} />
          ) : (
            <SeatThread
              turns={conversation.turns}
              outcomes={outcomes}
              busy={conversation.busy}
              testId={testId}
              minHeight={140}
              maxHeight="min(46cqh, 420px)"
              empty={
                <>
                  Ask about this declaration — what kinds there are, what an act writes, what a rule
                  judges, which kinds have no figure — or say a change: “add a due date to tasks”,
                  “draw a figure for person”. Nothing is applied until you keep it.
                </>
              }
              renderProposal={(proposal, { key }) => {
                const offer = offers.get(key) ?? offerFor(proposal, key);
                return (
                  <Offered
                    offer={offer}
                    testId={testId}
                    store={studio.store}
                    onEdit={(name, value) => setEdits((current) => new Map(current).set(key, { ...offer.args, [name]: value }))}
                    onKeep={() => {
                      keep(key, offer);
                      handOn();
                    }}
                    onDiscard={() => {
                      settle(key, { state: "declined", said: describeProposal(studio.store, { ...offer.proposal, args: offer.args }) });
                      handOn();
                    }}
                  />
                );
              }}
              onApplyAll={keepAll}
              applyAllLabel="Keep all"
              {...(config.source === "graph" ? { onChooseModel: () => setSettings(true) } : {})}
            />
          )}
          <SeatComposer
            busy={conversation.busy}
            placeholder="Ask for a change…"
            ariaLabel="Ask for a change to the declaration"
            testId={testId}
            onSend={(text) => void conversation.send(text)}
          />
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
  const faint = { fontSize: "0.8125rem", color: "var(--graview-ink-muted)" } as const;
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
        .map((field) => humanizeField(field.name).toLowerCase())
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
        .map(({ field, value }) => `${humanizeField(field.name).toLowerCase()} "${String(value)}"`)
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
        <strong style={{ fontSize: "0.875rem", fontWeight: 550 }}>{declared?.title ?? offer.proposal.mutation}</strong>
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
          style={{ fontSize: "0.8125rem" }}
        >
          Keep
        </button>
        <button type="button" data-testid={`${testId}-discard`} onClick={onDiscard} style={{ fontSize: "0.8125rem" }}>
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
  const label = humanizeField(field.name);
  const box: React.CSSProperties = {
    font: "inherit",
    fontSize: "0.8125rem",
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
      <span style={{ fontSize: "0.75rem", color: "var(--graview-ink-muted)" }}>{label}</span>
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
            {labelOf(store.schema.tryDefinition(node.kind as string), node)}
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
        // The field's range, as every form asks for it (FR-114).
        {...(field.min === undefined ? {} : { min: field.min })}
        {...(field.max === undefined ? {} : { max: field.max })}
        {...(field.step === undefined ? {} : { step: field.step })}
        value={typeof value === "number" ? value : ""}
        onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
        style={box}
      />,
    );
  }
  if (field.control === "date") {
    return row(
      <input type={field.time ? "datetime-local" : "date"} data-testid={testId} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} style={box} />,
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
  return row(<span style={{ fontSize: "0.8125rem", color: "var(--graview-ink-faint)" }}>{String(value ?? "—")}</span>);
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
