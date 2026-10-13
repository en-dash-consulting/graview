import type { Operation, Principal } from "@graview/core";
import { useEffect, useMemo, useState } from "react";

/*
 * WHAT CHANGED SINCE YOU WERE LAST HERE, AND WHAT IS YOURS (Roadmap
 * f-map-shows-state). From altitude a block glows faintly when somebody
 * else wrote its record after this person last left the page, and a
 * person's own records carry a mark.
 *
 * The last visit is this browser's: the moment the page was last hidden,
 * kept per seat in local storage — a convenience of one viewer's, so a
 * private window or storage refused means nothing glows, never that the
 * page fails. Read once when the scene opens, so what glows holds still
 * while you look; written when you leave.
 */

const keyOf = (kinds: readonly string[], seat: string | undefined) => `graview:last-visit:${seat ?? "anyone"}:${kinds.join(",")}`;

/** The ids somebody else wrote after `since` (epoch ms), from the log. */
export function writtenSince(ops: readonly Operation[], since: number, me: string | undefined): ReadonlySet<string> {
  const out = new Set<string>();
  for (const op of ops) {
    if (op.author.id !== undefined && op.author.id === me) continue;
    if (Date.parse(op.at) > since) for (const id of op.writes) out.add(id);
  }
  return out;
}

/** The records written by someone else since this seat last left the page. */
export function useSinceLastVisit(ops: readonly Operation[], kinds: readonly string[], principal: Principal | undefined): ReadonlySet<string> {
  const key = keyOf(kinds, principal?.id);
  const [since] = useState<number | null>(() => {
    try {
      const said = globalThis.localStorage?.getItem(key);
      return said ? Number(said) : null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    const leave = () => {
      if (document.visibilityState !== "hidden") return;
      try {
        globalThis.localStorage?.setItem(key, String(Date.now()));
      } catch {
        // Storage refused: nothing glows next time, which is all this costs.
      }
    };
    document.addEventListener("visibilitychange", leave);
    window.addEventListener("pagehide", leave);
    return () => {
      document.removeEventListener("visibilitychange", leave);
      window.removeEventListener("pagehide", leave);
    };
  }, [key]);
  return useMemo(() => (since === null ? new Set<string>() : writtenSince(ops, since, principal?.id)), [ops, since, principal?.id]);
}

/**
 * A SEAT'S OWN RECORDS, as a sight declared `own` reads them: the record
 * that is the person, what an edge joins to it, and what they made.
 */
export function ownRecords(
  graph: { out(id: string): readonly { readonly id: string }[]; in(id: string): readonly { readonly id: string }[] },
  ops: readonly Operation[],
  me: string | undefined,
): ReadonlySet<string> {
  const out = new Set<string>();
  if (me === undefined) return out;
  out.add(me);
  for (const other of [...graph.out(me), ...graph.in(me)]) out.add(other.id);
  for (const op of ops) {
    if (op.author.id !== me) continue;
    for (const primitive of op.primitives) if (primitive.op === "add-node") out.add(primitive.node.id);
  }
  return out;
}
