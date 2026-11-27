import type { FrictionDraft } from "../friction-record.js";
import { withArticle } from "../schema/define-node.js";
import type { MessageRecord } from "./shape.js";

/*
 * SUPPORT: A PERSON'S THREAD WITH THE HOST'S STAFF (Graview HQ
 * feature:f-support-chat). The same messages a room holds, never in the
 * app's graph: the person's and the staff's alone, carried by a transport
 * the host gives (`PagesApp`'s and `mount`'s `support`) — Graview Cloud's
 * staff inbox, a help desk, or `memorySupport` in development. Each message
 * a person sends carries where they were and what they could not do
 * (`SupportContext`), so staff never have to ask.
 */

/** One message of a support thread: a room's message's shape, from the person or from staff. */
export interface SupportMessage extends Pick<MessageRecord, "id" | "body" | "at" | "author"> {
  readonly from: "person" | "staff";
  readonly authorName?: string;
  readonly replyTo?: string;
}

/** What the person wrote, before the transport keeps it. */
export interface SupportDraft {
  readonly body: string;
  readonly replyTo?: string;
}

/** A reply from staff, as the transport hands it to the page. */
export type SupportReply = SupportMessage;

/**
 * WHERE THE PERSON WAS WHEN THEY WROTE, carried by every message: the app,
 * the place and the record they were on, who they are and which roles they
 * hold, what they last could not do, and the framework's version.
 */
export interface SupportContext {
  readonly app: string;
  readonly appTitle?: string;
  /** The page's address, as the routed face says it: `/tasks/t-book`. */
  readonly place?: string;
  /** The record the place is of, where it is one. */
  readonly record?: { readonly id: string; readonly kind: string; readonly label: string };
  readonly person?: { readonly id?: string; readonly name?: string; readonly kind: string };
  readonly roles: readonly string[];
  /** What they last looked for and could not do, in words: at most `SUPPORT_CONTEXT_FRICTION`, newest last. */
  readonly friction: readonly string[];
  /** The framework's version, `FRAMEWORK_VERSION`. */
  readonly version: string;
  readonly at: string;
}

/** The most of the person's recent friction a message carries. */
export const SUPPORT_CONTEXT_FRICTION = 5;

/**
 * HOW A HOST CARRIES THE THREAD: `send` keeps a message the person wrote,
 * with its context, and answers it as kept (or nothing, and the page keeps
 * its own copy); `subscribe` tells the page each reply from staff, and
 * answers how to stop; `history`, where the host keeps the thread, gives
 * it back when the panel opens.
 */
export interface SupportTransport {
  send(message: SupportDraft, context: SupportContext): Promise<SupportMessage | void>;
  subscribe(onReply: (reply: SupportReply) => void): () => void;
  history?(): Promise<readonly SupportMessage[]>;
}

/** What a host hands `PagesApp` and `mount` to offer "Chat with …" in the person's menu. */
export interface SupportDeclaration {
  /** Who the person talks to, as the menu says it: "Chat with Graview". The row is "Chat with <title>" unless the title already says so. */
  readonly title: string;
  readonly transport: SupportTransport;
  /** A sentence at the top of the panel; unsaid, that replies come later and arrive here. */
  readonly description?: string;
}

/** One friction draft said in words, never a selector. */
function frictionLine(draft: FrictionDraft): string {
  switch (draft.type) {
    case "search-miss":
      return `Searched for “${draft.words}”${draft.kind ? ` in ${draft.kind}` : ""} and found nothing.`;
    case "unanswered":
      return `Asked “${draft.question}” and was not answered${draft.lacks ? `: ${draft.lacks}` : "."}`;
    case "refused":
      return `Pressed ${draft.act}${draft.kind ? ` on ${withArticle(draft.kind)}` : ""} and was refused (${draft.code}).`;
    case "tool-invalid":
      return `An agent's call of ${draft.tool} was refused: ${draft.message}`;
  }
}

/** The context a message carries, from what the page knows: friction said in words, the last few only. */
export function supportContextOf(input: Omit<SupportContext, "friction" | "at"> & { readonly friction?: readonly FrictionDraft[]; readonly at?: string }): SupportContext {
  const { friction, at, ...rest } = input;
  return { ...rest, friction: (friction ?? []).slice(-SUPPORT_CONTEXT_FRICTION).map(frictionLine), at: at ?? new Date().toISOString() };
}

/** A transport that keeps the thread in memory, for tests and development, answering each message with a reply after a while. */
export interface MemorySupport extends SupportTransport {
  /** Everything the person sent, with its context, in order. */
  readonly sent: readonly { readonly message: SupportMessage; readonly context: SupportContext }[];
  /** Hand the page a reply from staff now, as a staff inbox would. */
  reply(body: string, options?: { readonly authorName?: string; readonly replyTo?: string }): SupportReply;
}

/**
 * A SUPPORT THREAD IN MEMORY: what the person sends is kept here, and —
 * unless `answer` says nothing — staff answer it `delayMs` later
 * (`answer`'s words, else that a person will read it soon). `reply` hands
 * the page a reply of your own.
 */
export function memorySupport(options: { readonly answer?: (message: SupportMessage, context: SupportContext) => string | undefined; readonly delayMs?: number; readonly staffName?: string } = {}): MemorySupport {
  const thread: SupportMessage[] = [];
  const sent: { message: SupportMessage; context: SupportContext }[] = [];
  const listeners = new Set<(reply: SupportReply) => void>();
  let n = 0;
  const staffName = options.staffName ?? "Support";
  const reply = (body: string, more: { readonly authorName?: string; readonly replyTo?: string } = {}): SupportReply => {
    const message: SupportReply = { id: `support:${++n}`, body, at: new Date().toISOString(), author: "staff", authorName: more.authorName ?? staffName, from: "staff", ...(more.replyTo ? { replyTo: more.replyTo } : {}) };
    thread.push(message);
    for (const listener of listeners) listener(message);
    return message;
  };
  return {
    sent,
    reply,
    async send(draft, context) {
      const message: SupportMessage = { id: `support:${++n}`, body: draft.body, at: new Date().toISOString(), author: context.person?.id ?? "person", ...(context.person?.name ? { authorName: context.person.name } : {}), from: "person", ...(draft.replyTo ? { replyTo: draft.replyTo } : {}) };
      thread.push(message);
      sent.push({ message, context });
      const answer = options.answer ? options.answer(message, context) : `Thanks, ${context.person?.name ?? "there"} — a person will read this and answer here.`;
      if (answer !== undefined) setTimeout(() => reply(answer, { replyTo: message.id }), options.delayMs ?? 600);
      return message;
    },
    subscribe(onReply) {
      listeners.add(onReply);
      return () => listeners.delete(onReply);
    },
    async history() {
      return [...thread];
    },
  };
}
