/*
 * WHO OPENS A SUPPORT PANEL (Graview HQ feature:f-support-chat): the face
 * that draws it says so for the host's declaration (`whenSupportOpened`),
 * and whatever offers "Chat with …" — the routed face's own menu, an
 * embed's bar above it — asks for it (`openSupport`). A weak map and a
 * call, so a bar that offers the row carries nothing of the panel.
 */

const OPENERS = new WeakMap<object, () => void>();

/** Says how a support declaration's panel is opened, until the answer is called. */
export function whenSupportOpened(support: object, open: () => void): () => void {
  OPENERS.set(support, open);
  return () => {
    if (OPENERS.get(support) === open) OPENERS.delete(support);
  };
}

/** Opens the panel of a support declaration, where a face draws one. Answers whether one did. */
export function openSupport(support: object): boolean {
  const open = OPENERS.get(support);
  open?.();
  return open !== undefined;
}

/** The row's words: "Chat with Graview", or the host's title where it already says chat. */
export const supportRowLabel = (title: string): string => (/^chat\b/i.test(title.trim()) ? title.trim() : `Chat with ${title.trim()}`);
