import { linkedReads, linkedRelations, readLinkedThrough, type AnySchema, type LinkedReads, type LinkedRecords, type Principal, type Store } from "@graview/core";
import { useEffect, useState } from "react";

/*
 * RECORDS IN ANOTHER APP, READ AS WHOEVER IS LOOKING (FR-171).
 *
 * Where the host hands the provider `linkedRecords` and the app has a
 * relation to another app's kind, the page reads far records through one
 * cache for this viewer: each asked of the host once, and the store told
 * to read again (`store.reread()`) as answers arrive — so a computed value,
 * a rule or a label that walks the link reads the far value once it is in,
 * and reads it as not read until then. Registered on the store's graph, so
 * every expression judged over it walks the link as this viewer. What draws
 * a linked record is `@graview/primitives`'s, fetched with the first one.
 */

/** Whether an app has a relation to another app's kind at all. */
const linksAnotherApp = (schema: AnySchema): boolean => schema.definitions.some((definition) => linkedRelations(definition).size > 0);

export function useLinkedReads<S extends AnySchema>(store: Store<S>, host: LinkedRecords | undefined, viewer: Principal): LinkedReads | undefined {
  const [reads, setReads] = useState<LinkedReads | undefined>(undefined);
  const roles = (viewer.roles ?? []).join("\u0000");
  const behalf = viewer.onBehalfOf ? JSON.stringify(viewer.onBehalfOf) : "";
  useEffect(() => {
    if (!host || !linksAnotherApp(store.schema)) {
      setReads(undefined);
      return;
    }
    let live = true;
    let soon = false;
    const graph = store.graph;
    // Many answers in one turn are one reading again.
    const answered = () => {
      if (soon) return;
      soon = true;
      queueMicrotask(() => {
        soon = false;
        if (live) store.reread();
      });
    };
    // Who the viewer acts for goes with it, so the far app judges a delegated seat as the person it sits with.
    const made = linkedReads(host, { kind: viewer.kind, ...(viewer.id === undefined ? {} : { id: viewer.id }), ...(viewer.roles ? { roles: viewer.roles } : {}), ...(viewer.onBehalfOf ? { onBehalfOf: viewer.onBehalfOf } : {}) }, answered);
    readLinkedThrough(graph, made.read);
    setReads(made);
    store.reread();
    return () => {
      live = false;
      readLinkedThrough(graph, undefined);
    };
  }, [store, host, viewer.kind, viewer.id, roles, behalf]);
  return reads;
}
