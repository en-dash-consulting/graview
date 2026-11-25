/**
 * A RECORD SET ASIDE KEEPS ITS EVENT: the claims, against whatever calendar
 * they are handed. `verify-google-calendar.mjs` runs them against Google;
 * with `--stub` it runs them alone against `scriptedCalendar()`, so they are
 * proven wired before a calendar is reached. Every event made here carries
 * the run's id in its title, its guest is an example.com address, and no
 * write mails anybody.
 */
import { Store } from "../../packages/core/dist/index.js";
import { compileDocument } from "../../packages/core/dist/check.js";
import { connection } from "../../packages/core/dist/sync/index.js";

/** `google(method, path, body, query)` is another person at the calendar; `fetch` and `token` are the connection's. */
export async function setAsideClaims({ run, claim, google, calendarId, token, fetch }) {
  const tag = `#${run}-aside`;
  const compiled = compileDocument({
    format: "graview-document",
    formatVersion: 1,
    name: `Set aside ${run}`,
    kinds: {
      person: { fields: { name: { type: "string", required: true }, emails: { type: "list", of: "string" }, inviteMe: { type: "boolean" } } },
      meeting: { fields: { name: { type: "string", required: true }, starts: { type: "datetime" }, ends: { type: "datetime" } }, edges: { who: { to: ["person"] } } },
    },
    acts: { "add-person": { creates: "person" }, "add-meeting": { creates: "meeting" } },
    connections: { team: { system: "google-calendar", calendar: "unused", kind: "meeting", fields: { summary: "name", start: "starts", end: "ends", guests: { via: "who" } }, direction: "both", conflicts: "theirs", filter: { tag } } },
  });
  if (!compiled.ok) throw new Error(`the set-aside declaration does not compile: ${JSON.stringify(compiled.findings)}`);
  const { app } = compiled;
  const store = new Store({ schema: app.schema, mutations: app.mutations, snapshot: { nodes: [], edges: [] } });
  const writes = [];
  const open = (state) =>
    connection({
      name: "team",
      declaration: app.connections.team,
      app,
      store,
      calendarId,
      token,
      fetch: (url, init) => {
        const method = init?.method ?? "GET";
        if (method !== "GET") writes.push(`${method} ${new URL(url).searchParams.get("sendUpdates") ?? "(unsaid)"}`);
        return fetch(url, init);
      },
      ...(state ? { state: structuredClone(state) } : {}),
    }).engine;
  let engine = open();
  /** A host starting again from what it kept. */
  const restart = () => void (engine = open(engine.snapshot));
  const pass = async () => {
    const result = await engine.run();
    if (result.offline) throw new Error(`the set-aside connection could not reach the calendar: ${result.problem ?? ""}`);
    return result;
  };
  const act = (name, args) => store.apply({ name, args }, { author: { kind: "human", id: "verify" }, intent: name });
  const node = (id) => store.graph.getNode(id);
  const idOf = (id) => engine.linkOf(id);
  const there = (id) => google("GET", `/${id}`);
  const theirs = (method, id, body) => google(method, `/${id}`, body, "sendUpdates=none");
  const quiet = (text) => text.replaceAll(run, "<run id>");
  const guest = `guest-aside-${run}@example.com`;
  const lunch = "meeting:lunch";
  const supper = "meeting:supper";

  await pass();
  act("add-person", { id: "person:ana", name: "Ana", emails: [guest], inviteMe: true });
  act("add-meeting", { id: lunch, name: "Lunch", starts: "2026-11-09T18:00:00Z", ends: "2026-11-09T19:00:00Z" });
  act("add-meeting", { id: supper, name: "Supper", starts: "2026-11-09T23:00:00Z", ends: "2026-11-10T00:00:00Z" });
  for (const id of [lunch, supper]) act("connect-meeting-who", { id, to: "person:ana" });
  await pass();
  const lunchId = idOf(lunch);
  const supperId = idOf(supper);
  if (!lunchId || !supperId) throw new Error("the meetings made to be set aside did not reach the calendar");

  const before = writes.length;
  for (const id of [lunch, supper]) act("archive-meeting", { id });
  const aside = await pass();
  restart();
  await pass();
  const kept = await there(lunchId);
  const invited = (kept.attendees ?? []).map((one) => one.email.toLowerCase());
  claim("aRecordSetAsideKeepsItsEventAndItsGuestsAreSentNothing", aside.pushed.length === 0 && writes.length === before && kept.status !== "cancelled" && invited.includes(guest), {
    sentWhileAside: writes.slice(before),
    status: kept.status ?? null,
    stillInvited: invited.map(quiet),
  });

  await theirs("PATCH", lunchId, { summary: `Long lunch ${tag}` });
  const took = await pass();
  claim("anEditInGoogleToTheEventOfARecordSetAsideLandsHere", took.refused.length === 0 && node(lunch)?.name === "Long lunch" && node(lunch)?.$archived === true && writes.length === before, {
    here: node(lunch)?.name ?? null,
    stillAside: node(lunch)?.$archived === true,
    refused: took.refused.map((one) => one.error),
  });

  act("unarchive-meeting", { id: lunch });
  restart();
  const back = await pass();
  const quietBack = writes.length === before;
  act("edit-meeting", { id: lunch, name: "Longer lunch" });
  await pass();
  const edited = await there(lunchId);
  claim("aRecordBroughtBackIsTheSameEventsAndAnEditHereGoes", back.pushed.length === 0 && quietBack && idOf(lunch) === lunchId && edited.summary === `Longer lunch ${tag}` && (back.said ?? []).length === 0, {
    pushedOnBringingBack: back.pushed,
    sameEvent: idOf(lunch) === lunchId,
    summary: quiet(edited.summary ?? ""),
  });

  await theirs("DELETE", supperId);
  const gone = await pass();
  const keptHere = node(supper)?.$archived === true;
  const again = await pass();
  restart();
  const beforeBack = writes.length;
  act("unarchive-meeting", { id: supper });
  const remade = await pass();
  const remadeId = idOf(supper);
  const remadeThere = remadeId ? await there(remadeId) : undefined;
  const oldThere = await there(supperId);
  const settled = await pass();
  const made = writes.slice(beforeBack);
  claim(
    "anEventDeletedWhileItsRecordIsAsideIsMadeOnceAgainWhenItIsBroughtBackAndSaid",
    keptHere &&
      (gone.said ?? []).some((line) => /was deleted in Google Calendar: it is kept here/.test(line)) &&
      (again.said ?? []).length === 0 &&
      (remade.said ?? []).some((line) => /so a new one was made/.test(line)) &&
      remadeId !== supperId &&
      remadeThere?.status !== "cancelled" &&
      remadeThere?.summary === `Supper ${tag}` &&
      oldThere.status === "cancelled" &&
      made.join() === "POST none" &&
      settled.pushed.length === 0,
    { keptHere, saidWhenDeleted: gone.said ?? [], saidWhenMade: remade.said ?? [], sent: made, settled: settled.pushed },
  );

  act("archive-meeting", { id: lunch });
  await pass();
  for (const id of [lunch, supper]) act("remove-meeting", { id });
  const removed = await pass();
  const removedThere = [await there(lunchId), ...(remadeId ? [await there(remadeId)] : [])].map((event) => event.status);
  claim("onlyRemovingTheRecordDeletesItsEventAndNoWriteMailsAnybody", removed.refused.length === 0 && removedThere.length === 2 && removedThere.every((status) => status === "cancelled") && writes.every((one) => one.endsWith(" none")), {
    statusAfterRemoval: removedThere,
    sendUpdates: [...new Set(writes.map((one) => one.split(" ")[1]))],
  });
}

/** A calendar in memory: list with sync tokens, read, insert, patch and delete, as both the connection's fetch and another person's `google`. */
export function scriptedCalendar() {
  const base = "https://www.googleapis.com/calendar/v3/calendars/scripted/events";
  const events = new Map();
  let seq = 0;
  let next = 0;
  const touch = (event) => {
    seq += 1;
    const kept = { status: "confirmed", ...event, etag: `"e${seq}"`, seq };
    events.set(kept.id, kept);
    return kept;
  };
  const answer = (status, body) => ({ ok: status < 300, status, json: async () => body });
  const merged = (was, patch) => Object.fromEntries(Object.entries({ ...was, ...patch }).map(([key, value]) => [key, value && typeof value === "object" && !Array.isArray(value) ? { ...was[key], ...value } : value]));
  const fetch = async (url, init) => {
    const at = new URL(url);
    const id = decodeURIComponent(at.pathname.split("/events")[1]?.slice(1) ?? "");
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(init.body) : {};
    if (method === "GET" && !id) {
      const since = Number(at.searchParams.get("syncToken") ?? "0");
      return answer(200, { items: [...events.values()].filter((event) => event.seq > since), nextSyncToken: String(seq) });
    }
    if (method === "POST") return answer(200, touch({ id: `evt${(next += 1)}`, ...body }));
    const was = events.get(id);
    if (!was) return answer(404, { error: { message: "Not Found" } });
    if (method === "GET") return answer(200, was);
    if (was.status === "cancelled") return answer(410, { error: { message: "Resource has been deleted" } });
    if (method === "DELETE") {
      touch({ ...was, status: "cancelled" });
      return answer(204);
    }
    return answer(200, touch(merged(was, body)));
  };
  const google = async (method, path = "", body, query = "") => {
    const response = await fetch(`${base}${path}${query ? `?${query}` : ""}`, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (response.status === 204) return {};
    const said = await response.json();
    if (!response.ok) throw new Error(`the scripted calendar answered ${response.status} to ${method} ${path}: ${said.error?.message ?? ""}`);
    return said;
  };
  return { fetch, google };
}
