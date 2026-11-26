import type { SupportDeclaration, SupportMessage } from "@graview/core";
import { createContext, useContext, useSyncExternalStore } from "react";

/*
 * THE DOOR TO A PERSON'S THREAD WITH THE HOST'S STAFF (Graview HQ
 * feature:f-support-chat): what the person's menu offers ("Chat with …")
 * and the thread itself, held for the page's life whether or not the panel
 * is open — so a reply that arrives while it is shut is there when it opens,
 * and the bell says it came. The panel is fetched when it is first opened.
 */

export { supportRowLabel } from "@graview/core";

export interface SupportThread {
  messages(): readonly SupportMessage[];
  /** Replies from staff the person has not seen in the panel. */
  unseen(): number;
  seen(): void;
  add(message: SupportMessage): void;
  subscribe(listener: () => void): () => void;
}

const THREADS = new WeakMap<object, SupportThread>();

/** The one thread a host's transport carries on this page, listening for replies from the moment it is first asked for. */
export function supportThreadOf(support: SupportDeclaration): SupportThread {
  let thread = THREADS.get(support.transport);
  if (thread) return thread;
  let messages: readonly SupportMessage[] = [];
  let unseen = 0;
  const listeners = new Set<() => void>();
  const told = () => {
    for (const listener of listeners) listener();
  };
  const add = (message: SupportMessage, counts: boolean) => {
    if (messages.some((one) => one.id === message.id)) return;
    messages = [...messages, message].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
    if (counts && message.from === "staff") unseen++;
    told();
  };
  thread = {
    messages: () => messages,
    unseen: () => unseen,
    seen() {
      if (unseen === 0) return;
      unseen = 0;
      told();
    },
    add: (message) => add(message, false),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  THREADS.set(support.transport, thread);
  try {
    support.transport.subscribe((reply) => add(reply, true));
  } catch {
    // A transport that cannot listen still sends; replies come with `history`.
  }
  void support.transport.history?.().then((kept) => kept.forEach((one) => add(one, false)), () => undefined);
  return thread;
}

/** The thread's messages and its unseen replies, as they move. */
export function useSupportThread(thread: SupportThread): { readonly messages: readonly SupportMessage[]; readonly unseen: number } {
  const messages = useSyncExternalStore(thread.subscribe, thread.messages, thread.messages);
  const unseen = useSyncExternalStore(thread.subscribe, thread.unseen, thread.unseen);
  return { messages, unseen };
}

/** What the face knows of its support: the host's, and the way to open the panel. */
export interface SupportHere {
  readonly support: SupportDeclaration;
  readonly open: () => void;
}

export const SupportHereContext = createContext<SupportHere | null>(null);
export const useSupportHere = (): SupportHere | null => useContext(SupportHereContext);
