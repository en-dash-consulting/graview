/* Only what the store and the policy say: the seat's lens (`seatLens`, `seesId`) would bring the whole seat view into every page that draws a guest. */
import { actingAs, FIELD_SIGHT, isSystem, type AnySchema, type Principal, type Sight, type Store } from "@graview/core";
import type { GuestUnseen } from "../protocol.js";

/*
 * WHAT A VIEW'S SEAT IS KEPT FROM, OF WHAT THE VIEW READS (Roadmap
 * f-view-knows-what-its-seat-cannot-see). A view written by its owner can
 * look empty for a signed-out visitor or a lower role, and nothing told
 * it why: a list of vendors kept from a visitor was handed as no vendors.
 * Now the view is told what its seat's sight withholds, and only what the
 * seat may know of it:
 *
 *   kinds      each kind the view reads that the seat sees none of — no
 *              sight shows it to the seat's roles, an `own` or `via` sight
 *              asks for an id the seat has none of (a visitor), a sight
 *              that shows only some fields cannot be judged here, or its
 *              module is off. Kinds are the declaration's, which the view
 *              names already; nothing about a record is said.
 *   fields     for each kind it reads and sees, the declared fields some
 *              record of it may be handed without, read from the policy
 *              alone (`hide`, `fields`): the sights that show the seat
 *              every record of the kind, else every sight that shows it
 *              some. Never from a record.
 *   withheld   for each kind it reads that a sight shows the seat every
 *              record of (one with no `own` or `via`), how many of them it
 *              is handed none of, because a field the record cannot be
 *              without is kept from it or names a record it may not see.
 *              Those are records the seat's sight says it may know of. A
 *              kind it sees only its own records of has no count — another
 *              person's record is never counted — nor has a kind kept from
 *              it, not even 0; nor any kind of an app that publishes, whose
 *              reader may not know what is not published yet.
 *
 * Absent where none of that is so: nothing kept, no field hidden and no
 * record withheld.
 */

/** The kinds a view's manifest reads: the kind it attaches to (not the home) and every kind it reads beside. */
export function viewKinds(manifest: { readonly attach: string; readonly reads?: { readonly kinds?: readonly string[] } }): readonly string[] {
  return [...new Set([...(manifest.attach === "home" ? [] : [manifest.attach]), ...(manifest.reads?.kinds ?? [])])];
}

const grants = (sight: Sight, principal: Principal) => sight.roles === "*" || (principal.roles ?? []).some((role) => (sight.roles as readonly string[]).includes(role));
const partial = (sight: Sight) => sight.fields !== undefined || (sight.hide?.length ?? 0) > 0;
const showsField = (sight: Sight, field: string) => !partial(sight) || ((sight.fields === undefined || sight.fields.includes(field)) && !sight.hide?.includes(field));

/** The declared fields of a kind, by name. */
function declaredFields(schema: AnySchema, kind: string): readonly string[] {
  const fields = (schema.tryDefinition(kind) as { fields?: { shape?: Record<string, unknown> } } | undefined)?.fields?.shape;
  return fields ? Object.keys(fields) : [];
}

/**
 * WHAT THE SEAT IS KEPT FROM, of these kinds — or undefined where nothing
 * is: what a view is handed as `props.unseen`.
 */
export function unseenOf<S extends AnySchema>(store: Store<S>, principal: Principal, asked: readonly string[], keptAlready?: ReadonlySet<string>): GuestUnseen | undefined {
  const sights = store.policy?.sees ?? [];
  const system = isSystem(principal);
  // Nothing kept from it: no sight, no module off (`hidesFrom`), or the system.
  if (asked.length === 0 || system || (sights.length === 0 && store.modules.disabledKinds.size === 0)) return undefined;
  const kinds = asked.filter((kind) => store.schema.tryDefinition(kind));
  const judged = FIELD_SIGHT.on === true || FIELD_SIGHT.served.has(store);
  const acting = actingAs(principal);
  /* The sights that may show this seat some record of a kind, as the store's own `sees` reads them. */
  const showing = (kind: string) => sights.filter((sight) => sight.kinds.includes(kind) && grants(sight, acting) && ((!sight.own && !sight.via) || acting.id !== undefined) && (judged || !partial(sight)));
  const off = store.modules.disabledKinds;
  /* What the store keeps from the seat, as a caller that asked already for this push hands it. */
  const kept = keptAlready ?? store.kindsKeptFrom(principal);
  const hidden = kinds.filter((kind) => off.has(kind) || kept.has(kind) || (sights.length > 0 && showing(kind).length === 0));
  const shown = kinds.filter((kind) => !hidden.includes(kind));
  const fields: Record<string, readonly string[]> = {};
  for (const kind of shown) {
    const all = showing(kind);
    const every = all.filter((sight) => !sight.own && !sight.via);
    const by = every.length > 0 ? every : all;
    if (by.length === 0) continue;
    const without = declaredFields(store.schema, kind).filter((field) => !by.some((sight) => showsField(sight, field)));
    if (without.length > 0) fields[kind] = without;
  }
  /* Records a sight shows it every one of, and it is handed none of: worked out over the whole store, said only as a number. */
  const withheld: Record<string, number> = {};
  let any = hidden.length > 0 || Object.keys(fields).length > 0;
  if (store.publishing === undefined) {
    const seen = store.seenBy(principal).graph;
    for (const kind of shown) {
      if (!showing(kind).some((sight) => !sight.own && !sight.via)) continue;
      let count = 0;
      for (const node of store.graph.nodesOfKind(kind as never)) if (!seen.has(node.id)) count += 1;
      withheld[kind] = count;
      if (count > 0) any = true;
    }
  }
  return any ? { kinds: hidden, fields, withheld } : undefined;
}

/** Whether every kind a view reads is kept from its seat: the host draws the way in where the view would draw nothing. */
export function readsOnlyUnseen(asked: readonly string[], unseen: GuestUnseen | undefined): boolean {
  return asked.length > 0 && unseen !== undefined && asked.every((kind) => unseen.kinds.includes(kind));
}
