import { labelOf, pluralOf, type AnySchema, type Principal, type Store } from "@graview/core";
import type { Telling, ToldStore } from "@graview/core/told";
import type { HostAi } from "@graview/tools";
import { useEffect, useMemo, useState } from "react";
import { seenOnThisPage, toldListed } from "./told-listed.js";

/**
 * WHAT WORKED BEFORE, OFFERED AS THE MENU IS TYPED IN (Roadmap
 * f-menu-learns): up to two of this app's kept tellings (`HostAi.told`)
 * like the words typed on this kind, that were accepted or 👍 and not
 * excluded — another person's only once enough people's agree
 * (`similarTellings`) — each said as what it did, re-aimed at what the
 * menu is on: "Finish the 6 tasks in This week, like last time". The
 * Fast slot re-ranks them with the menu's rows in the same Choice, at the
 * same rest (`useFastRank`). Chosen, the words are asked on the quick
 * ask's card and previewed like any plan: nothing is applied from here.
 *
 * Retrieval is local and cheap: the tellings are read once a menu is typed
 * in (and kept a few seconds), and compared by words, kind and act. The
 * comparing is `@graview/core/told`'s, fetched with the first typing.
 */

export interface ToldSuggestion {
  /** The row's key, as the menu ranks it: `told:<id>`. */
  readonly key: string;
  readonly telling: Telling;
  /** What it would do here, in words. */
  readonly label: string;
}

/** How many the menu offers. */
export const TOLD_SUGGESTED_MOST = 2;

const capital = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);

/** The kind of what the menu is on: a record's, or a district's (`kind:task`, `aggregate:task`). */
function kindOn(store: Store<AnySchema>, on: string | undefined): string | undefined {
  if (!on) return undefined;
  const node = store.graph.getNode(on);
  if (node) return node.kind;
  const district = /^(?:kind|aggregate):(.+)$/.exec(on)?.[1];
  return district && store.schema.tryDefinition(district) ? district : undefined;
}

/**
 * THE TELLING RE-AIMED AT WHAT THE MENU IS ON: its act's title over the
 * records here, as it was over the records there — the record itself, or
 * the records of its kind it holds; a plan in its own words. Nothing when
 * it cannot be aimed here (no record of the kind it acted on).
 */
export function reaimed(store: Store<AnySchema>, telling: Telling, on: string | undefined): string | undefined {
  const schema = store.schema;
  if (telling.decided.type === "plan") return `${capital(telling.words)}, like last time`;
  if (telling.decided.type !== "act") return undefined;
  const actName = telling.decided.act;
  const mutation = store.allMutations().find((one) => one.name === actName);
  if (!mutation) return undefined;
  const title = mutation.title ?? mutation.name;
  /* "Mark it done" over the records here: "Mark the 6 tasks in This week done" — the act's own words, its object put in. */
  const said = (object: string) => (/\b(?:it|this|them)\b/i.test(title) ? title.replace(/\b(?:it|this|them)\b/i, object) : `${title} ${object}`);
  const node = on ? store.graph.getNode(on) : undefined;
  const name = node ? labelOf(schema.tryDefinition(node.kind), node as never) : undefined;
  const kind = telling.reading?.kind ?? telling.target.kind;
  if (!kind || !schema.tryDefinition(kind)) return undefined;
  if (telling.reading?.which === "itself" || (!telling.reading && node?.kind === kind)) {
    return node && node.kind === kind && name ? `${capital(said(name))}, like last time` : undefined;
  }
  const held = node
    ? new Set([...store.graph.in(node.id), ...store.graph.out(node.id)].filter((one) => one.kind === kind).map((one) => one.id)).size
    : kindOn(store, on) === kind
      ? store.graph.allNodes().filter((one) => one.kind === kind).length
      : 0;
  if (held === 0) return undefined;
  const noun = held === 1 ? ((schema.tryDefinition(kind) as { noun?: string } | undefined)?.noun ?? kind).toLowerCase() : pluralOf(schema, kind).toLowerCase();
  return `${capital(said(`the ${held} ${noun}${name ? ` in ${name}` : ""}`))}, like last time`;
}

/** The tellings like the words typed in the menu that worked, re-aimed here: at most `most`, before the Fast slot re-ranks them. */
export function useToldSuggestions(ai: HostAi | undefined, store: Store<AnySchema>, principal: Principal, words: string, on: string | undefined, opened: unknown, most = 4): readonly ToldSuggestion[] {
  const told: ToldStore | undefined = ai && !ai.off ? ai.told : undefined;
  const typing = words.trim() !== "";
  const [read, setRead] = useState<{ readonly tellings: readonly Telling[]; readonly similar: typeof import("@graview/core/told").similarTellings } | null>(null);
  // Each menu reads them again: what was told since the last one is suggested in the next.
  useEffect(() => setRead(null), [opened]);
  useEffect(() => {
    if (!told || !typing || read) return;
    let live = true;
    void import("@graview/core/told")
      .then(async (core) => {
        const listed = await toldListed(told);
        if (live) setRead({ tellings: core.toldSeenBy(listed, seenOnThisPage(store, principal)), similar: core.similarTellings });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [told, typing, read, store, principal]);
  return useMemo(() => {
    if (!read || !typing) return [];
    const kind = kindOn(store, on);
    return read
      .similar(read.tellings, { words, ...(kind ? { kind } : {}) }, { reader: principal, most })
      .flatMap(({ telling }) => {
        const label = reaimed(store, telling, on);
        return label ? [{ key: `told:${telling.id}`, telling, label }] : [];
      });
  }, [read, typing, words, store, principal, on, most]);
}
