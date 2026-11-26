import { FRAMEWORK_VERSION, keepRecentFriction, labelOf, layer, type AnySchema, type SupportContext, type SupportDeclaration, type SupportMessage } from "@graview/core";
import { supportContextOf, LONGEST_MESSAGE } from "@graview/core/rooms";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { MessageBody } from "./chat.js";
import type { PageContext } from "./page-context.js";
import { kindOfSlug } from "./registry.js";
import { useLocation } from "./routing.js";
import { BODY, SMALL, button, h2, quiet } from "./page-typography.js";
import { supportRowLabel, supportThreadOf, useSupportThread } from "./support-door.js";

/*
 * THE PERSON'S THREAD WITH THE HOST'S STAFF, AS A PANEL (Graview HQ
 * feature:f-support-chat): opened from "Chat with …" in their menu, it
 * says that replies come later and arrive here, holds the thread, and
 * sends each message with where they were — the app, the place, the
 * record, their role, what they last could not do, the version — said
 * openly under the field, so staff never have to ask. A dialog that does
 * not hold the page: Escape or Close shuts it and the keyboard goes back
 * to where it came from.
 */

const field: CSSProperties = {
  font: "inherit",
  fontSize: BODY,
  lineHeight: 1.45,
  flex: "1 1 auto",
  minWidth: 0,
  boxSizing: "border-box",
  minHeight: "2.75rem",
  maxHeight: "10rem",
  resize: "vertical",
  padding: "10px 12px",
  borderRadius: "var(--graview-radius-sm, 8px)",
  border: "1px solid var(--graview-edge-bright)",
  background: "var(--graview-panel)",
  color: "var(--graview-ink)",
};

/** Where the person is, as the routed face says it: the place and the record it is of. */
function useHere(context: PageContext<AnySchema>): { readonly place: string; readonly record?: SupportContext["record"] } {
  const location = useLocation();
  const store = context.store;
  return useMemo(() => {
    const segments = location.pathname.split("/").filter(Boolean);
    const kind = segments.length === 2 ? kindOfSlug(store.schema, segments[0]!) : undefined;
    const node = kind ? store.graph.getNode(decodeURIComponent(segments[1]!)) : undefined;
    return {
      place: location.pathname,
      ...(node ? { record: { id: node.id, kind: node.kind as string, label: labelOf(store.schema.tryDefinition(node.kind as string) as never, node as never) } } : {}),
    };
  }, [location.pathname, store]);
}

export function SupportPanel({ context, support, onClose }: { readonly context: PageContext<AnySchema>; readonly support: SupportDeclaration; readonly onClose: () => void }) {
  const thread = supportThreadOf(support);
  const { messages } = useSupportThread(thread);
  const here = useHere(context);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const heading = useId();
  const fieldId = useId();
  const hint = `${fieldId}-hint`;
  const area = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const cameFrom = useRef<Element | null>(typeof document === "undefined" ? null : document.activeElement);
  const principal = context.principal ?? { kind: "human" };
  // The person's own last few could-not-dos, kept in this page from now on for the messages they send.
  const friction = useMemo(() => keepRecentFriction(context.store as object), [context.store]);
  const me = principal.id !== undefined ? context.store.graph.getNode(principal.id) : undefined;
  const name = me ? labelOf(context.store.schema.tryDefinition(me.kind as string) as never, me as never) : principal.name;
  const appTitle = context.brand?.name ?? context.app?.name;
  const carried = (): SupportContext =>
    supportContextOf({
      app: context.app?.name ?? appTitle ?? "app",
      ...(appTitle ? { appTitle } : {}),
      place: here.place,
      ...(here.record ? { record: here.record } : {}),
      person: { kind: principal.kind, ...(principal.id !== undefined ? { id: principal.id } : {}), ...(name ? { name } : {}) },
      roles: principal.roles ?? [],
      friction,
      version: FRAMEWORK_VERSION,
    });
  useEffect(() => {
    thread.seen();
  }, [messages.length]);
  useEffect(() => {
    area.current?.focus();
    return () => {
      const back = cameFrom.current as HTMLElement | null;
      if (back && typeof back.focus === "function" && back.isConnected) back.focus();
    };
  }, []);
  useLayoutEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages.length]);
  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setSaid(null);
    try {
      const kept = await support.transport.send({ body }, carried());
      thread.add(kept ?? ({ id: `support:local:${Date.now()}`, body, at: new Date().toISOString(), author: principal.id ?? "person", from: "person" } as SupportMessage));
      setText("");
    } catch (error) {
      setSaid(`That did not send: ${error instanceof Error ? error.message : String(error)}. It is still here to try again.`);
    } finally {
      setSending(false);
      area.current?.focus();
    }
  };
  const label = supportRowLabel(support.title);
  const who = support.title.replace(/^chat with\s+/i, "");
  const context0 = carried();
  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby={heading}
      data-testid="support-panel"
      data-graview-offstage=""
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
      style={{
        position: "fixed",
        zIndex: layer("dialog"),
        insetInlineEnd: "max(8px, env(safe-area-inset-right, 0px))",
        insetBlockEnd: "max(8px, env(safe-area-inset-bottom, 0px))",
        width: "min(400px, calc(100vw - 16px))",
        height: "min(580px, calc(100dvh - 72px))",
        display: "grid",
        gridTemplateRows: "auto auto minmax(0, 1fr) auto",
        boxSizing: "border-box",
        borderRadius: "var(--graview-radius, 12px)",
        border: "1px solid var(--graview-edge)",
        background: "var(--graview-float)",
        color: "var(--graview-ink)",
        boxShadow: "var(--graview-lift-high)",
        overflow: "hidden",
        fontFamily: "var(--graview-font-body, system-ui)",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "12px 12px 4px 16px" }}>
        <h2 id={heading} style={{ ...h2, fontSize: "var(--graview-text-body)", fontWeight: 600 }}>
          {label}
        </h2>
        <button type="button" data-testid="support-close" onClick={onClose} aria-label={`Close ${label}`} style={{ ...button, minHeight: 36, minWidth: 44 }}>
          Close
        </button>
      </header>
      <p data-testid="support-later" style={{ ...quiet, margin: 0, padding: "0 16px 8px" }}>
        {support.description ?? `Write to ${who} here. Replies can take a while: they arrive here, and you can close this and come back.`}
      </p>
      <div ref={log} role="log" aria-live="polite" aria-label={`Your messages with ${who}`} data-testid="support-log" tabIndex={0} style={{ overflowY: "auto", padding: "4px 12px", borderBlock: "1px solid var(--graview-edge)", background: "var(--graview-panel)" }}>
        {messages.length === 0 ? (
          <p style={{ ...quiet, margin: "12px 4px" }}>Nothing yet. Ask anything — how to do something here, something that went wrong, or help building your app.</p>
        ) : (
          <ol style={{ listStyle: "none", margin: 0, padding: "4px 0", display: "grid", gap: 8 }}>
            {messages.map((message) => {
              const mine = message.from === "person";
              return (
                <li key={message.id} data-testid="support-message" data-from={message.from} style={{ justifySelf: mine ? "end" : "start", maxWidth: "88%", padding: "8px 12px", borderRadius: 12, background: mine ? "color-mix(in srgb, var(--graview-accent) 14%, var(--graview-panel))" : "var(--graview-panel-muted)", border: "1px solid var(--graview-edge)" }}>
                  <div style={{ fontSize: SMALL, fontWeight: 600, marginBottom: 2 }}>{mine ? "You" : (message.authorName ?? who)}</div>
                  <div style={{ fontSize: BODY, lineHeight: 1.45 }}>
                    <MessageBody body={message.body} people={[]} />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      <form
        data-testid="support-composer"
        aria-label={`Write to ${who}`}
        style={{ display: "grid", gap: 6, padding: 12 }}
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label htmlFor={fieldId} style={{ fontSize: SMALL, fontWeight: 600 }}>
          Write to {who}
        </label>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            ref={area}
            id={fieldId}
            data-testid="support-field"
            aria-describedby={hint}
            value={text}
            maxLength={LONGEST_MESSAGE}
            rows={2}
            style={field}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void send();
              }
            }}
          />
          <button type="submit" data-testid="support-send" disabled={text.trim() === "" || sending} style={{ ...button, minHeight: 44, minWidth: 44, background: "var(--graview-accent)", color: "var(--graview-accent-ink)", borderColor: "transparent", fontWeight: 600 }}>
            Send
          </button>
        </div>
        <details id={hint} style={{ ...quiet }}>
          <summary style={{ cursor: "pointer", minHeight: 24 }}>Sent with each message: where you are, so you need not explain</summary>
          <ul data-testid="support-context" style={{ margin: "4px 0 0", paddingInlineStart: 18 }}>
            <li>{context0.appTitle ?? context0.app}, at {context0.place}{context0.record ? ` (${context0.record.label})` : ""}</li>
            <li>{context0.person?.name ?? "You"}{context0.roles.length > 0 ? `, as ${context0.roles.join(", ")}` : ""}</li>
            {context0.friction.length > 0 ? <li>What you last could not do: {context0.friction.join(" ")}</li> : null}
            <li>Graview {context0.version}</li>
          </ul>
        </details>
        {said ? (
          <p role="alert" data-testid="support-refused" style={{ ...quiet, margin: 0, color: "var(--graview-bad)" }}>
            {said}
          </p>
        ) : null}
      </form>
    </section>
  );
}

export default SupportPanel;
