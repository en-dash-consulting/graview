import { rolesOf, type AnySchema, type Policy, type Principal } from "@graview/core";
import { forgetSeatView } from "@graview/core/seat";
import type { GuestUnseen } from "../protocol.js";
import { readsOnlyUnseen, unseenOf, viewKinds } from "../host/unseen.js";
import type { HeadlessFailureReason } from "./protocol.js";
import type { HeadlessResult, RunWorkerViewHeadlessOptions } from "./index.js";

/*
 * A VIEW'S CHECK DRAWS IT AS EACH SEAT (Roadmap
 * f-view-check-draws-for-each-seat). A headless run is seated as one
 * principal — its author, as a host runs it, or the system — so a view that
 * drew well for its owner could look empty, or be stopped, for a signed-out
 * visitor or a lower role, and the check said nothing. This runs the same
 * view once for each seat the app's policy names, or the seats the host
 * hands, and says for each whether it drew, fell back or was stopped, and
 * what it reads that the seat is not handed.
 */

/** One seat a view is checked as: what the report calls it, and the principal it is run as. */
export interface HeadlessSeat {
  readonly name: string;
  readonly principal: Principal;
}

/**
 * THE SEATS AN APP'S POLICY NAMES: the owner (the author, as handed); each
 * role the policy names, as a person holding that role alone with an id
 * that is no account's (`view-as:<role>`), who owns no record; and, where
 * the app has one, a visitor — signed out, a seat every stranger shares,
 * holding the `visitor` role where the policy names it. The app has a
 * visitor where its policy names that role, or grants or shows anything
 * to everybody (`"*"`). With no policy, every seat sees all of it: the
 * owner alone.
 */
export function seatsOfPolicy(policy: Policy | undefined, owner: Principal): readonly HeadlessSeat[] {
  const seats: HeadlessSeat[] = [{ name: "owner", principal: owner }];
  if (!policy) return seats;
  const named = new Set<string>(rolesOf(policy));
  for (const sight of policy.sees ?? []) if (sight.roles !== "*") for (const role of sight.roles) named.add(role);
  for (const role of [...named].sort()) if (role !== VISITOR_ROLE) seats.push({ name: role, principal: { kind: "human", id: `view-as:${role}`, roles: [role] } });
  const toEverybody = [...policy.grants, ...(policy.sees ?? [])].some((one) => one.roles === "*");
  if (named.has(VISITOR_ROLE) || toEverybody) seats.push({ name: "visitor", principal: { kind: "human", shared: true, roles: named.has(VISITOR_ROLE) ? [VISITOR_ROLE] : [] } });
  return seats;
}

/** What came of a view for one seat. */
export interface SeatCheck {
  /** The seat, as `seatsOfPolicy` or the host named it. */
  readonly seat: string;
  readonly principal: Principal;
  /**
   * `drew`: it ran and drew. `fell-back`: it was never started for this
   * seat — everything it reads is kept from the seat (`unseen`, and the
   * host draws its way in instead), or its manifest or its code was
   * refused. `stopped`: it started and was stopped, as a page would stop it.
   */
  readonly outcome: "drew" | "fell-back" | "stopped";
  /** Why it fell back or was stopped. */
  readonly reason?: HeadlessFailureReason | "unseen";
  /** It drew, and drew nothing a person could read. */
  readonly empty?: true;
  /** What it is handed of what its seat is kept from (`props.unseen`), when anything is. */
  readonly unseen?: GuestUnseen;
  /**
   * WHAT IT READS THAT THE SEAT IS NOT HANDED: the kinds it reads that the
   * seat sees none of, and the hidden fields of the kinds it does see that
   * its code names, so a view that draws `player.phone` hears that a parent
   * is handed no phone.
   */
  readonly reads: { readonly kinds: readonly string[]; readonly fields: Readonly<Record<string, readonly string[]>> };
  /** The sentence for this seat. */
  readonly says: string;
  /** The run itself, where it ran. */
  readonly result?: HeadlessResult;
}

export interface SeatsChecked {
  /** Every seat drew, or fell back because nothing it reads is the seat's to see. */
  readonly ok: boolean;
  readonly seats: readonly SeatCheck[];
  /** One line a seat. */
  readonly text: string;
}

export type RunForEachSeatOptions<S extends AnySchema> = Omit<RunWorkerViewHeadlessOptions<S>, "principal"> & {
  /** The author: the owner's seat. The system by default. */
  readonly owner?: Principal;
  /** The seats to run it as, in place of the ones the app's policy names. */
  readonly seats?: readonly HeadlessSeat[];
};

/** The role a visitor holds where the app names one: `VISITOR_ROLE` of `@graview/core/forms`, said here so a check carries none of the forms. */
const VISITOR_ROLE = "visitor";

const STOPS: readonly HeadlessFailureReason[] = ["refused", "error", "silent", "nodes", "flood", "slow", "act", "isolate"];

/** Whether a source names a field: as a property (`node.phone`), a key or a string. */
const names = (source: string, field: string) => new RegExp(`(?<![\\w$])${field.replace(/[$]/g, "\\$")}(?![\\w$])`).test(source);

const listed = (words: readonly string[]) => (words.length <= 1 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`);

/**
 * Run a worker view headless once for each seat, and say for each what came
 * of it.
 *
 * FOR SOMEBODY WHO MAY SEE AS EVERY SEAT: what it says of one seat — what
 * the view drew for it, what it was kept from — is said to whoever asked,
 * so hand the result only to the app's owner or someone the policy lets see
 * what each seat sees, never to one of the seats. A seat it made up
 * (`view-as:<role>`, the visitor) has the views kept for it let go of once
 * its run is done, so nothing of it outlives the check; a seat the host
 * handed in `seats` keeps what is kept for it.
 */
export async function runWorkerViewForEachSeat<S extends AnySchema>(options: RunForEachSeatOptions<S>): Promise<SeatsChecked> {
  const { runWorkerViewHeadless } = await import("./index.js");
  const { store, manifest, source } = options;
  const owner = options.owner ?? { kind: "system", id: "graview-view-check" };
  const seats = options.seats ?? seatsOfPolicy(store.policy, owner);
  const kinds = viewKinds(manifest);
  const checked: SeatCheck[] = [];
  for (const { name, principal } of seats) {
    const unseen = unseenOf(store, principal, kinds);
    const fields = Object.fromEntries(Object.entries(unseen?.fields ?? {}).flatMap(([kind, hidden]) => {
      const read = hidden.filter((field) => names(source, field));
      return read.length > 0 ? [[kind, read]] : [];
    }));
    const reads = { kinds: unseen?.kinds ?? [], fields };
    const base = { seat: name, principal, ...(unseen ? { unseen } : {}), reads };
    if (readsOnlyUnseen(kinds, unseen)) {
      checked.push({ ...base, outcome: "fell-back", reason: "unseen", says: `${name}: falls back — ${listed(kinds)} ${kinds.length === 1 ? "is" : "are"} kept from this seat, so the host draws its way in (or that nothing here is shown) instead of the view.` });
      continue;
    }
    const { owner: _owner, seats: _seats, ...rest } = options;
    let result: HeadlessResult;
    try {
      /* A view of one record over the first of its kind this seat sees, unless the host said which. */
      const over = !options.input && manifest.cardinality === "one" && manifest.attach !== "home" ? store.seenBy(principal).graph.nodesOfKind(manifest.attach as never)[0] : undefined;
      result = await runWorkerViewHeadless({ ...rest, principal, ...(over ? { input: { node: { id: over.id } } } : {}) });
    } finally {
      /* Only a seat this run made up (each role's, the visitor's) is let go of: one the host handed is somebody's, and its view stays theirs. */
      if (!options.seats && principal !== owner) forgetSeatView(store, principal);
    }
    const told = [
      ...(reads.kinds.length > 0 ? [`it reads ${listed(reads.kinds)}, which this seat sees none of`] : []),
      ...Object.entries(fields).map(([kind, read]) => `it reads ${listed(read)} of ${kind}, which this seat is not handed`),
    ];
    const also = told.length > 0 ? `; ${told.join("; ")}` : "";
    if (!result.ok) {
      const stopped = STOPS.includes(result.reason);
      checked.push({ ...base, outcome: stopped ? "stopped" : "fell-back", reason: result.reason, result, says: `${name}: ${stopped ? "stopped" : "falls back"} (${result.reason}) — ${result.detail}${also}` });
      continue;
    }
    const empty = result.description.parts.length === 0;
    checked.push({ ...base, outcome: "drew", ...(empty ? { empty: true as const } : {}), result, says: `${name}: drew ${empty ? "nothing a person can read" : `${result.description.parts.length} part${result.description.parts.length === 1 ? "" : "s"}`}${also}.` });
  }
  const ok = checked.every((one) => one.outcome === "drew" || one.reason === "unseen");
  return { ok, seats: checked, text: `${checked.map((one) => one.says).join("\n")}\n` };
}
