import type { Principal } from "../permissions/types.js";
import type { ToldStore } from "../told.js";
import { tellingOf, type Telling, type TellingDraft } from "../told.js";

/**
 * A HOST THAT KEEPS WHAT PEOPLE TELL GRAVIEW, CHECKED AS GRAVIEW CHECKS ITS
 * OWN (Roadmap f-menu-learns). A host keeps tellings its own way (Graview
 * Cloud per app, `graview serve` in `told.json`) and hands each page a door
 * as its seat (`HostAi.told`); what it must keep the same is who a telling
 * is said to be by, who may change it, and who may read it. Run against the
 * host's door for each seat (`as`): the session's author, never the body's;
 * nothing of a visitor's; a rating only its teller's; another person's
 * words read only once enough people agree; a telling about a record the
 * reader cannot see never served to them; a deleted one gone.
 */
export interface ToldHost {
  /** The host's door as this seat would reach it: `toldOver(url, { headers })` with that seat's session, or the host's own. */
  as(seat: Principal): ToldStore;
}

export interface ToldHostReport {
  readonly ok: boolean;
  readonly claims: {
    readonly keptAsTheSession: boolean;
    readonly aVisitorsIsNeverKept: boolean;
    readonly onlyItsTellerRatesIt: boolean;
    readonly anotherPersonsWaitsForAgreement: boolean;
    readonly unseenRecordsHideIt: boolean;
    readonly deletedIsGone: boolean;
  };
  readonly said: readonly string[];
}

/**
 * Runs the claims with three people of the app (`people`: whose tellings
 * are kept and read) — a record each of them sees (`seen`), and, where the
 * app's sight keeps one from `people[0]`, its id (`hidden`).
 */
export async function checkToldHost(host: ToldHost, scenario: { readonly people: readonly [Principal, Principal, Principal]; readonly seen: string; readonly hidden?: string }): Promise<ToldHostReport> {
  const said: string[] = [];
  const [ada, bo, cy] = scenario.people;
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const draft = (id: string, extra: Partial<TellingDraft> = {}): TellingDraft & { readonly id: string } => ({
    id: `tl-conformance-${stamp}-${id}`,
    words: "mark these done",
    target: { on: "record", id: scenario.seen },
    decided: { type: "act", act: "conformance", records: 1 },
    outcome: "accepted",
    ...extra,
  });
  const listed = async (seat: Principal) => [...(await host.as(seat).list())];
  /* Posted as the page would, its body claiming `claimedBy`; a visitor's posted as it stands, since no page makes one. */
  const add = async (seat: Principal, one: TellingDraft & { readonly id: string }, claimedBy?: Principal) =>
    host.as(seat).add(tellingOf(one, claimedBy ?? seat) ?? ({ ...one, by: seat, at: new Date().toISOString(), conversation: one.id } as Telling));

  const claims = { keptAsTheSession: false, aVisitorsIsNeverKept: false, onlyItsTellerRatesIt: false, anotherPersonsWaitsForAgreement: false, unseenRecordsHideIt: scenario.hidden === undefined, deletedIsGone: false };
  const mine = draft("mine");
  await add(ada, mine, { kind: "human", id: "somebody-else" });
  const kept = (await listed(ada)).find((one) => one.id === mine.id);
  claims.keptAsTheSession = kept?.by.id === ada.id;
  if (!claims.keptAsTheSession) said.push(kept ? `A telling posted as ${ada.id} was kept as ${kept.by.id}: the author is the session's, never the body's.` : "A telling posted was not read back by its teller.");

  const visitor: Principal = { kind: "visitor", id: `visitor-${stamp}` };
  const theirs = draft("visitor");
  await add(visitor, theirs).catch(() => undefined);
  claims.aVisitorsIsNeverKept = !(await listed(ada)).some((one) => one.id === theirs.id) && !(await listed(bo)).some((one) => one.id === theirs.id);
  if (!claims.aVisitorsIsNeverKept) said.push("A visitor's telling was kept.");

  await Promise.resolve(host.as(bo).change(mine.id, { rating: "down" })).catch(() => undefined);
  await host.as(ada).change(mine.id, { rating: "up" });
  claims.onlyItsTellerRatesIt = (await listed(ada)).find((one) => one.id === mine.id)?.rating === "up" && (await listed(ada)).find((one) => one.id === mine.id)?.rating !== "down";
  if (!claims.onlyItsTellerRatesIt) said.push("Somebody other than its teller rated a telling, or its teller could not.");

  claims.anotherPersonsWaitsForAgreement = !(await listed(cy)).some((one) => one.id === mine.id);
  if (!claims.anotherPersonsWaitsForAgreement) said.push("One person's telling was read by another before anybody else told the app the same.");

  if (scenario.hidden !== undefined) {
    const about = draft("hidden", { target: { on: "record", id: scenario.hidden } });
    await add(ada, about);
    claims.unseenRecordsHideIt = !(await listed(ada)).some((one) => one.id === about.id);
    if (!claims.unseenRecordsHideIt) said.push("A telling about a record its reader cannot see was read back to them.");
    await Promise.resolve(host.as(ada).remove(about.id)).catch(() => undefined);
  }

  await host.as(ada).remove(mine.id);
  claims.deletedIsGone = !(await listed(ada)).some((one) => one.id === mine.id);
  if (!claims.deletedIsGone) said.push("A telling its teller deleted was still read back.");
  return { ok: Object.values(claims).every(Boolean), claims, said };
}
