import type { AnySchema } from "@graview/core";
import { useAttention, useGraview, useSelection } from "@graview/react";
import {
  configuredResponder,
  createToolRuntime,
  describeIntelligence,
  describeProposal,
  loadIntelligenceConfig,
  loadPins,
  saveIntelligenceConfig,
  type ChatReply,
  type IntelligenceConfig,
  type LocalStatus,
  type OfferedQuestion,
  type ProposedCall,
  type Responder,
  type ToolCall,
} from "@graview/tools";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * A SEAT YOU CAN TALK TO.
 *
 * The agent seat runs a turn when pressed; the providers whisper into the
 * inspector; nothing let a person ASK. This panel does — and it earns no
 * new trust to do it: every answer comes from a Responder (the graph's own
 * deterministic one by default, a model through the one-function seam when
 * the host supplies it), and every proposal is an ordinary validated call,
 * applied through the same runtime a seat uses, attributed to `chat` in
 * the log, previewer-visible, undoable. Words in, the usual paths out.
 */

interface Turn {
  readonly role: "person" | "seat";
  readonly text: string;
  readonly proposals?: readonly ProposedCall[];
  /** Questions the seat is asking back, each at the node it is about. */
  readonly questions?: readonly OfferedQuestion[];
}

export interface ChatPanelProps<S extends AnySchema> {
  /** How the seat answers. Defaults to the graph's own responder. */
  readonly respond?: Responder<S>;
  /** Feeds the app's activity rail, like any other seat. */
  readonly onCall?: (call: ToolCall) => void;
  readonly testId?: string;
}

export function ChatPanel<S extends AnySchema>({
  respond,
  onCall,
  testId = "chat",
}: ChatPanelProps<S>) {
  const { store, principal } = useGraview<S>();
  const { selection } = useSelection();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<readonly Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  /*
   * THE LADDER IS A SETTING. Which rung answers — the graph, a model in
   * this browser, or a frontier model with the person's own key — lives in
   * the person's own storage, never in the repo or the bundle. The gear
   * changes it in place; a host that passes `respond` has decided for them.
   */
  const [config, setConfig] = useState<IntelligenceConfig>(() => loadIntelligenceConfig());
  const [settings, setSettings] = useState(false);
  const [warmth, setWarmth] = useState<LocalStatus | null>(null);
  const anchor = useRef<HTMLDivElement | null>(null);
  const log = useRef<HTMLOListElement | null>(null);

  const runtime = useMemo(
    () =>
      createToolRuntime(store, {
        author: {
          kind: "agent",
          id: "chat",
          session: "ui",
          ...(principal.roles ? { roles: principal.roles } : {}),
        },
        // The person's pins reach this seat too — read per call, so a pin
        // toggled in the menu reorders the chat's tool list without a
        // rebuild. No surface may disagree with another about the acts.
        derive: () => ({ pins: loadPins() }),
      }),
    [store, principal],
  );
  const statusToken = useRef(0);
  /*
   * The setting as it is NOW, for a turn that started before it changed:
   * the answer says which rung made it and which the person has moved to,
   * rather than finishing silently on a rung they left.
   */
  const configNow = useRef(config);
  configNow.current = config;
  const answer = useMemo<Responder<S>>(() => {
    // A replaced responder must not keep narrating: only the current
    // build's status reaches the header.
    const token = ++statusToken.current;
    return (
      respond ??
      configuredResponder<S>(config, {
        onStatus: (status) => {
          if (token === statusToken.current) setWarmth(status);
        },
        current: () => configNow.current,
      })
    );
  }, [respond, config]);

  useEffect(() => (onCall ? runtime.onCall(onCall) : undefined), [runtime, onCall]);
  // What the conversation looked at reaches the picture, like any seat's reads.
  useAttention(runtime);

  // Escape and click-away close it — it floats over the scene.
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (!anchor.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [turns]);

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    setBusy(true);
    setTurns((current) => [...current, { role: "person", text }]);
    let reply: ChatReply;
    try {
      reply = await answer(store, text, {
        selection,
        history: turns.map((turn) => ({ role: turn.role, text: turn.text })),
      });
    } catch (error) {
      reply = {
        say: `The seat could not answer: ${error instanceof Error ? error.message : String(error)}`,
        proposals: [],
      };
    }
    setTurns((current) => [
      ...current,
      { role: "seat", text: reply.say, proposals: reply.proposals, ...(reply.questions ? { questions: reply.questions } : {}) },
    ]);
    setBusy(false);
  };

  const apply = async (proposal: ProposedCall) => {
    try {
      /*
       * The runtime RESOLVES refusals rather than throwing them — a
       * policy denial, a validation failure — so the flag must be read.
       * Skipping it had the chat saying "Done — … Undo works." over a
       * change the store had refused, which is the one lie a seat must
       * never tell.
       */
      const result = await runtime.call(proposal.mutation, { ...proposal.args });
      if (!result.ok) {
        setTurns((current) => [...current, { role: "seat", text: `Refused: ${result.error}` }]);
        return;
      }
      setTurns((current) => [
        ...current,
        { role: "seat", text: `Done — ${describeProposal(store, proposal)}. Undo works.` },
      ]);
    } catch (error) {
      // A refusal is a result, in the thread where the ask was made.
      setTurns((current) => [
        ...current,
        {
          role: "seat",
          text: `Refused: ${error instanceof Error ? error.message : String(error)}`,
        },
      ]);
    }
  };

  return (
    <div ref={anchor} style={{ position: "relative" }}>
      <button
        type="button"
        data-testid={testId}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        title="Talk to the seat: ask about anything here, or say a change in words"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.78125rem" }}
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
            zIndex: 30,
            width: 320,
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
              Seat
            </span>
            <span
              data-testid="chat-source"
              // The WHY rides along: "no WebGPU" is actionable, "failed" is not.
              title={warmth?.state === "failed" ? warmth.detail : undefined}
              style={{ fontSize: "0.6875rem", color: "var(--graview-ink-muted)" }}
            >
              {respond
                ? "app-provided"
                : warmth?.state === "warming"
                  ? `warming${warmth.progress !== undefined ? ` ${Math.round(warmth.progress * 100)}%` : "…"}`
                  : warmth?.state === "failed"
                    ? `graph answering — ${warmth.detail ?? "the local model failed"}`
                    : describeIntelligence(config)}
            </span>
            <span style={{ flex: "1 1 auto" }} />
            {respond ? null : (
              <button
                type="button"
                data-testid="chat-settings"
                aria-expanded={settings}
                onClick={() => setSettings((current) => !current)}
                title="Choose what answers: the graph, a model in this browser, a decision provider, or your own key"
                style={{ fontSize: "0.75rem", padding: "2px 8px", minHeight: 24 }}
              >
                ⚙
              </button>
            )}
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
              maxHeight: "min(46cqh, 400px)",
              minHeight: 120,
              overflowY: "auto",
            }}
          >
            {turns.length === 0 ? (
              <li style={{ fontSize: "0.75rem", color: "var(--graview-ink-muted)", lineHeight: 1.5 }}>
                Ask what's wrong, ask about anything by name, or say a change in its own words.
                {selection.length > 0 ? " “This” means what you have selected." : ""}
              </li>
            ) : null}
            {turns.map((turn, index) => (
              <li key={index} style={{ display: "grid", gap: 6, justifyItems: turn.role === "person" ? "end" : "start" }}>
                <p
                  style={{
                    margin: 0,
                    maxWidth: 260,
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
                {(turn.questions ?? []).map((asked) => (
                  /*
                   * A QUESTION STANDS AT ITS NODE. The seat was not sure
                   * enough to propose — a split, or a shrug — so it asks,
                   * naming the node, with each option as a press that lands
                   * through the same path a proposal does.
                   */
                  <div
                    key={asked.id}
                    data-testid="chat-question"
                    data-chat-question-node={asked.nodeId}
                    style={{ display: "grid", gap: 4, justifySelf: "start", maxWidth: 260 }}
                  >
                    <span style={{ fontSize: "0.75rem", color: "var(--graview-ink-muted)" }}>
                      {asked.nodeLabel ? <strong>{asked.nodeLabel}: </strong> : null}
                      {asked.asks}
                      {asked.because === "split" ? " (it could be either)" : " (it was not sure)"}
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {asked.options.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          data-testid="chat-option"
                          disabled={!option.call}
                          title={option.call ? option.call.why ?? "Take this answer" : "Nothing to do for this answer"}
                          onClick={() => (option.call ? void apply(option.call) : undefined)}
                          style={{ fontSize: "0.75rem" }}
                        >
                          {option.value} {Math.round(option.probability * 100)}%
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {(turn.proposals ?? []).map((proposal, at) => {
                  /*
                   * WITHHELD, NOT OFFERED — the same rule as the strip. The
                   * responder proposes from the graph and knows nothing of
                   * the policy, so the seat was handed "Add an item" with
                   * an apply button and refused on press. The store's own
                   * verdict, asked as the person at the keyboard, decides
                   * whether a proposal is a press or a struck line with
                   * the policy's reason beside it.
                   */
                  const verdict = store.permits({ name: proposal.mutation, args: { ...proposal.args } }, principal);
                  if (!verdict.ok) {
                    return (
                      <span key={at} data-testid="chat-withheld" style={{ fontSize: "0.75rem", color: "var(--graview-ink-muted)" }}>
                        <s>{describeProposal(store, proposal)}</s> — {verdict.refusal.message}
                      </span>
                    );
                  }
                  return (
                    <button
                      key={at}
                      type="button"
                      data-testid="chat-apply"
                      onClick={() => void apply(proposal)}
                      title={proposal.why ?? "Apply this change"}
                      style={{ fontSize: "0.75rem", justifySelf: "start" }}
                    >
                      {describeProposal(store, proposal)}
                    </button>
                  );
                })}
              </li>
            ))}
            {busy ? (
              <li style={{ fontSize: "0.75rem", color: "var(--graview-ink-faint)" }}>thinking…</li>
            ) : null}
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
              placeholder="Ask, or say a change…"
              aria-label="Message the seat"
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
            <button type="submit" disabled={busy || draft.trim().length === 0} style={{ fontSize: "0.78125rem" }}>
              Send
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The rung picker. Three honest choices, stated costs, one Save — and the
 * key field says exactly where the key lives: this browser's storage, sent
 * only to the provider chosen, never to a server of ours, never in a repo.
 *
 * Exported because the studio's own agent panel climbs the same ladder: a
 * second picker beside this one would be a second place a person's key
 * could be asked for, and two surfaces that could disagree about which
 * rung is chosen.
 */
export function IntelligenceSettings({
  config,
  onDone,
}: {
  readonly config: IntelligenceConfig;
  readonly onDone: (next: IntelligenceConfig) => void;
}) {
  const [source, setSource] = useState<IntelligenceConfig["source"]>(config.source);
  const [preset, setPreset] = useState<"xai" | "custom">(config.remote?.preset ?? "xai");
  const [apiKey, setApiKey] = useState(config.remote?.apiKey ?? "");
  const [model, setModel] = useState(config.remote?.model ?? "");
  const [baseUrl, setBaseUrl] = useState(config.remote?.baseUrl ?? "");
  const [decisionKey, setDecisionKey] = useState(config.decision?.apiKey ?? "");

  const label: React.CSSProperties = { fontSize: "0.6875rem", color: "var(--graview-ink-muted)" };
  const field: React.CSSProperties = {
    font: "inherit",
    fontSize: "0.78125rem",
    padding: "6px 9px",
    borderRadius: 8,
    border: "1px solid var(--graview-edge)",
    background: "var(--graview-panel)",
    color: "var(--graview-ink)",
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <form
      data-testid="chat-settings-form"
      onSubmit={(event) => {
        event.preventDefault();
        /*
         * A saved key SURVIVES switching rungs — losing it on a visit to
         * "graph" would mean re-pasting secrets — and choosing "remote"
         * with no key at all is not a save that does anything, so the
         * submit button refuses it below.
         */
        const key = apiKey || config.remote?.apiKey || "";
        const remote =
          key.length > 0
            ? {
                remote: {
                  preset,
                  apiKey: key,
                  ...(model ? { model } : {}),
                  ...(preset === "custom" && baseUrl ? { baseUrl } : {}),
                },
              }
            : config.remote
              ? { remote: config.remote }
              : {};
        /*
         * The decision rung needs no key in the browser at all — the dev
         * server's door holds one — so an empty key is a choice, not a
         * refusal: the door is used. A key typed here goes straight to
         * the provider, like the LLM rung's.
         */
        const decisionHeld = decisionKey || config.decision?.apiKey || "";
        const decision =
          decisionHeld.length > 0
            ? { decision: { ...(config.decision ?? {}), apiKey: decisionHeld } }
            : config.decision
              ? { decision: config.decision }
              : {};
        onDone({ source, ...remote, ...decision });
      }}
      style={{ display: "grid", gap: 10, padding: 12, maxHeight: "min(46cqh, 400px)", overflowY: "auto" }}
    >
      {(
        [
          ["graph", "Graph only", "Keyless and instant. The graph answers from its own structure."],
          ["local", "Onboard AI", "A small model runs in this browser. First use downloads ~1–2GB, then it is free and private."],
          ["decision", "Jev (decides, does not talk)", "A decision provider answers typed questions exactly — which surface, which zone, does this help — with a confidence. It writes no prose, so the graph still answers the chat."],
          ["remote", "LLM (your key)", "A frontier model answers. Calls go straight from this browser to the provider."],
        ] as const
      ).map(([value, title, detail]) => (
        <label key={value} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8, alignItems: "start", cursor: "pointer" }}>
          <input
            type="radio"
            name="intelligence-source"
            value={value}
            checked={source === value}
            onChange={() => setSource(value)}
          />
          <span style={{ display: "grid", gap: 2 }}>
            <span style={{ fontSize: "0.78125rem" }}>{title}</span>
            <span style={{ ...label, lineHeight: 1.4 }}>{detail}</span>
          </span>
        </label>
      ))}

      {source === "decision" ? (
        <div style={{ display: "grid", gap: 8, paddingLeft: 22 }}>
          <label style={{ display: "grid", gap: 3 }}>
            <span style={label}>TypeSafe key (optional)</span>
            <input
              type="password"
              data-testid="chat-decision-key"
              value={decisionKey}
              onChange={(event) => setDecisionKey(event.target.value)}
              placeholder="leave empty to use the dev server's door"
              autoComplete="off"
              style={field}
            />
          </label>
          <p style={{ ...label, margin: 0, lineHeight: 1.4 }}>
            With no key here, questions go through this app's own decision door, which holds a key
            on the server side (TYPESAFE_API_KEY in the environment `pnpm dev` was started from). A
            key typed here is stored in this browser only and sent only to the provider.
          </p>
        </div>
      ) : null}

      {source === "remote" ? (
        <div style={{ display: "grid", gap: 8, paddingLeft: 22 }}>
          <label style={{ display: "grid", gap: 3 }}>
            <span style={label}>Provider</span>
            <select value={preset} onChange={(event) => setPreset(event.target.value as "xai" | "custom")} style={field}>
              <option value="xai">xAI (Grok)</option>
              <option value="custom">Custom OpenAI-compatible endpoint</option>
            </select>
          </label>
          {preset === "custom" ? (
            <label style={{ display: "grid", gap: 3 }}>
              <span style={label}>Base URL</span>
              <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://…/v1" style={field} />
            </label>
          ) : null}
          <label style={{ display: "grid", gap: 3 }}>
            <span style={label}>API key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={preset === "xai" ? "xai-…" : "sk-…"}
              autoComplete="off"
              style={field}
            />
          </label>
          <label style={{ display: "grid", gap: 3 }}>
            <span style={label}>Model</span>
            <input value={model} onChange={(event) => setModel(event.target.value)} placeholder={preset === "xai" ? "grok-4-fast" : "model id"} style={field} />
          </label>
          <p style={{ ...label, margin: 0, lineHeight: 1.4 }}>
            The key is stored in this browser only and sent only to the provider above — never to
            any server of this app's, never into the project.
          </p>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={source === "remote" && !apiKey && !config.remote?.apiKey}
        title={
          source === "remote" && !apiKey && !config.remote?.apiKey
            ? "A remote model needs a key"
            : undefined
        }
        style={{ justifySelf: "start", fontSize: "0.78125rem" }}
      >
        Use this
      </button>
    </form>
  );
}
