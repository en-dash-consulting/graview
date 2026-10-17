import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { keptSubscription, type Subscription, type SubscriptionStore } from "@graview/core";

/**
 * SUBSCRIPTIONS KEPT IN A FILE BESIDE THE STORE (Roadmap
 * f-notify-subscriptions): `subscriptions.json` in the store's own
 * directory, read again whenever another process wrote it — so a chat that
 * subscribes through `graview mcp --data <dir>` is heard by `graview serve`
 * on the same directory at its next commit. Plain JSON a person can read,
 * written whole and moved into place, like the file adapter's snapshot.
 *
 * Not in the op log, on purpose: a subscription is about the app, not part
 * of it — not undone with a change, not in an export, not seen by anybody
 * else.
 */
export function fileSubscriptions(path: string): SubscriptionStore {
  let held: Subscription[] = [];
  let stamp = -1;
  const listeners = new Set<() => void>();
  const fresh = (): Subscription[] => {
    if (!existsSync(path)) {
      held = [];
      stamp = -1;
      return held;
    }
    const at = statSync(path).mtimeMs;
    if (at !== stamp) {
      held = (JSON.parse(readFileSync(path, "utf8")) as { subscriptions?: Subscription[] }).subscriptions ?? [];
      stamp = at;
    }
    return held;
  };
  const write = (next: Subscription[]) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(`${path}.tmp`, `${JSON.stringify({ subscriptions: next }, null, 2)}\n`);
    renameSync(`${path}.tmp`, path);
    held = next;
    stamp = statSync(path).mtimeMs;
    for (const listener of listeners) listener();
  };
  return {
    list: (whoId) => {
      const all = fresh();
      return whoId === undefined ? all : all.filter((one) => one.who.id === whoId);
    },
    add(draft) {
      const kept = keptSubscription(draft);
      write([...fresh().filter((one) => one.id !== kept.id), kept]);
      return kept;
    },
    remove(id) {
      const all = fresh();
      if (!all.some((one) => one.id === id)) return false;
      write(all.filter((one) => one.id !== id));
      return true;
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
