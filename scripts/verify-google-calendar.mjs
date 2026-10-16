#!/usr/bin/env node
/**
 * THE CALENDAR SYNC, AGAINST GOOGLE ITSELF.
 *
 * `@graview/core/sync` is covered against a scripted remote; this runs its
 * engine and `googleCalendar` transport against a real Google test calendar
 * and writes what happened to docs/google-calendar.json as named claims: a
 * round trip both ways, our own write not echoed back, an access token
 * Google refuses (refreshed, and the run goes on), a sync token Google
 * rejects (a full resync that loses and duplicates nothing), events made in
 * Berlin and Tokyo read and moved with the instant kept, an all-day event
 * left as a day, every page of a pull followed, and everything the run made
 * removed again.
 *
 * It needs credentials, so it is NOT in `pnpm verify` or CI. They are read
 * from ~/.graview-google-test.env (or GRAVIEW_GOOGLE_ENV) through
 * scripts/lib/google-test-env.mjs, which never prints a value; make them once
 * with scripts/google-calendar-once.mjs. Needs `pnpm build`.
 *
 *   node scripts/verify-google-calendar.mjs
 *
 * Every event it makes carries the run's id in its title, and only those are
 * touched: another person's events on the same calendar (the demo, say) are
 * left alone.
 */
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bindSchema, createSchema, defineNode, nodeRef, Store, z } from "../packages/core/dist/index.js";
import { SyncEngine, googleCalendar, googleCalendarMapping } from "../packages/core/dist/sync/index.js";
import { googleAccessToken, requireGoogleEnv } from "./lib/google-test-env.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const run = `gv-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
const report = { at: new Date().toISOString(), run, checks: {} };
const claim = (name, ok, said = {}) => {
  report.checks[name] = { ...said, ok: Boolean(ok) };
  process.stdout.write(`${ok ? "ok  " : "FAIL"}  ${name}\n`);
};

const env = requireGoogleEnv(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_TEST_CALENDAR_ID", "GOOGLE_REFRESH_TOKEN"]);

/* ----------------------------------------------------- tokens, honestly */
/**
 * The token source a host would write: a cached access token, minted again
 * when it is about to end or when the adapter says Google refused it. `stale`
 * hands out a token Google will not take, as an hour-old one would be.
 */
const tokens = { held: "", until: 0, stale: false, asked: [] };
async function token(request) {
  tokens.asked.push(request?.refresh ? "refresh" : "plain");
  if (tokens.stale && !request?.refresh) return `ya29.expired-${run}`;
  if (request?.refresh) tokens.stale = false;
  if (!request?.refresh && Date.now() < tokens.until) return tokens.held;
  const { token: fresh, expiresIn } = await googleAccessToken(env);
  tokens.held = fresh;
  tokens.until = Date.now() + (expiresIn - 60) * 1000;
  return fresh;
}

/* ------------------------------------------- Google, as another person */
const eventsUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(env.GOOGLE_TEST_CALENDAR_ID)}/events`;
async function google(method, path = "", body, query = "") {
  const { token: access } = await googleAccessToken(env);
  const response = await fetch(`${eventsUrl}${path}${query ? `?${query}` : ""}`, {
    method,
    headers: { authorization: `Bearer ${access}`, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (response.status === 204) return {};
  const answer = await response.json();
  if (!response.ok) throw new Error(`Google answered ${response.status} to ${method} ${path || "/events"}: ${answer.error?.message ?? ""}`);
  return answer;
}
/** This run's events still in the calendar (by the id in their title), every page read. */
async function ours() {
  const found = [];
  let page = "";
  do {
    const answer = await google("GET", "", undefined, `maxResults=2500${page ? `&pageToken=${encodeURIComponent(page)}` : ""}`);
    found.push(...(answer.items ?? []).filter((event) => String(event.summary ?? "").includes(run)));
    page = answer.nextPageToken ?? "";
  } while (page);
  return found;
}

/* ------------------------------------------------------------ the app */
const meeting = defineNode("meeting", {
  fields: z.object({ name: z.string(), starts: z.string().optional(), ends: z.string().optional() }),
  plural: "Meetings",
});
const schema = createSchema([meeting]);
const bound = bindSchema(schema);
const mutations = [
  bound.defineMutation("add-meeting", {
    title: "Add a meeting",
    description: "Put a meeting on the calendar.",
    input: z.object({ id: z.string(), name: z.string(), starts: z.string().optional(), ends: z.string().optional() }),
    apply(ctx, args) {
      ctx.addNode({ kind: "meeting", ...args });
    },
  }),
  bound.defineMutation("edit-meeting", {
    title: "Change a meeting",
    description: "Rename or move a meeting.",
    subject: { kinds: ["meeting"], arg: "id" },
    input: z.object({ id: nodeRef(["meeting"]), name: z.string().optional(), starts: z.string().optional(), ends: z.string().optional() }),
    apply(ctx, { id, ...patch }) {
      ctx.patchNode(id, Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)));
    },
  }),
  bound.defineMutation("remove-meeting", {
    title: "Remove a meeting",
    description: "Take a meeting off the calendar.",
    subject: { kinds: ["meeting"], arg: "id" },
    input: z.object({ id: nodeRef(["meeting"]) }),
    apply(ctx, { id }) {
      ctx.removeNode(id);
    },
  }),
];
const store = new Store({ schema, mutations, snapshot: { nodes: [], edges: [] } });
const act = (name, args) => store.apply({ name, args }, { author: { kind: "human", id: "verify" }, intent: name });

/** One instant, said one way: Google answers in the calendar's own zone. */
const instant = (value) => (typeof value === "string" && value ? new Date(value).toISOString().replace(/\.000Z$/, "Z") : value);
const mapping = googleCalendarMapping({
  events: [{ kind: "meeting", summary: "name", start: "starts", end: "ends", encodeTime: instant, decodeTime: instant }],
});
const inOurNames = (fields) => {
  const out = {};
  for (const [mine, theirs] of [["name", "summary"], ["starts", "start.dateTime"], ["ends", "end.dateTime"]]) {
    if (fields[mine] !== undefined) out[mine] = fields[mine];
    else if (fields[theirs] !== undefined) out[mine] = theirs.endsWith("dateTime") ? instant(fields[theirs]) : fields[theirs];
  }
  return out;
};

/** The transport, with what each pull carried kept for the claims. */
const pulls = [];
/** The pages the transport asked for, by the page token each carried. */
const pageTokens = [];
const transport = googleCalendar({
  calendarId: env.GOOGLE_TEST_CALENDAR_ID,
  token,
  pageSize: 2,
  fetch: (url, init) => {
    const page = new URL(url).searchParams.get("pageToken");
    if (page) pageTokens.push(page);
    return fetch(url, init);
  },
});
const remote = {
  name: transport.name,
  async pull(cursor) {
    const result = await transport.pull(cursor);
    pulls.push({ cursor, changes: result.changes });
    return result;
  },
  push: (writes) => transport.push(writes),
};
const offered = [];
let made = 0;
const engineFrom = (state) =>
  new SyncEngine(
    {
      store,
      mapping,
      remote,
      conflicts: "theirs",
      applyInbound: ({ localId, fields }) => ({ name: "edit-meeting", args: { id: localId, ...inOurNames(fields) } }),
      removeInbound: ({ localId }) => ({ name: "remove-meeting", args: { id: localId } }),
      createInbound: ({ id, fields }) => {
        // Only this run's events: the calendar is shared with whoever else is trying it.
        if (!String(fields["summary"] ?? "").includes(run)) return null;
        offered.push({ id, fields });
        const said = inOurNames(fields);
        // An all-day event has a day and no time; this app keeps timed meetings, so it is not one.
        if (!said.starts) return null;
        made += 1;
        return { name: "add-meeting", args: { id: `g-${made}`, ...said } };
      },
    },
    state,
  );
let engine = engineFrom(undefined);
const pass = async () => {
  const result = await engine.run();
  if (result.offline) throw new Error("the engine could not reach Google");
  return result;
};
const node = (id) => store.graph.getNode(id);
const meetings = () => store.graph.allNodes().filter((one) => one.kind === "meeting");
const sameInstant = (a, b) => typeof a === "string" && typeof b === "string" && Date.parse(a) === Date.parse(b);

try {
  // A first full pull, so this run starts from the calendar as it is.
  await pass();

  /* ----------------------------------------------- here, then there */
  act("add-meeting", { id: "standup", name: `Standup ${run}`, starts: "2026-11-02T15:00:00Z", ends: "2026-11-02T15:30:00Z" });
  const sent = await pass();
  const standupId = engine.snapshot.links["standup"]?.id;
  const there = standupId ? await google("GET", `/${standupId}`) : undefined;
  claim("aMeetingMadeHereReachesGoogle", sent.pushed.includes("standup") && there?.summary === `Standup ${run}` && sameInstant(there?.start?.dateTime, "2026-11-02T15:00:00Z"), {
    pushed: sent.pushed,
    google: there ? { summary: there.summary, start: there.start, end: there.end } : null,
  });

  const quiet = await pass();
  claim("graviewsOwnWriteIsNotEchoedBackAsAChange", quiet.applied.length === 0 && quiet.pushed.length === 0 && node("standup")?.name === `Standup ${run}`, {
    applied: quiet.applied,
    echoes: quiet.echoes,
    pushed: quiet.pushed,
  });

  /* ----------------------------------------------- there, then here */
  await google("PATCH", `/${standupId}`, { summary: `Standup, moved ${run}`, start: { dateTime: "2026-11-02T16:00:00Z" }, end: { dateTime: "2026-11-02T16:30:00Z" } });
  const madeThere = await google("POST", "", {
    summary: `Review ${run}`,
    start: { dateTime: "2026-11-04T18:00:00Z" },
    end: { dateTime: "2026-11-04T19:00:00Z" },
  });
  const took = await pass();
  const review = meetings().find((one) => one.name === `Review ${run}`);
  claim("aChangeMadeInGoogleLandsHere", took.applied.includes("standup") && node("standup")?.name === `Standup, moved ${run}` && node("standup")?.starts === "2026-11-02T16:00:00Z", {
    applied: took.applied,
    here: { name: node("standup")?.name, starts: node("standup")?.starts },
  });
  claim("anEventMadeInGoogleIsMadeHere", Boolean(review) && review.starts === "2026-11-04T18:00:00Z" && engine.snapshot.links[review.id]?.id === madeThere.id, {
    here: review ? { id: review.id, name: review.name, starts: review.starts } : null,
  });

  /* ------------------------------------------- across timezones */
  const berlin = await google("POST", "", {
    summary: `Berlin ${run}`,
    start: { dateTime: "2026-11-03T09:00:00", timeZone: "Europe/Berlin" },
    end: { dateTime: "2026-11-03T10:00:00", timeZone: "Europe/Berlin" },
  });
  const tokyo = await google("POST", "", {
    summary: `Tokyo ${run}`,
    start: { dateTime: "2026-11-03T09:00:00", timeZone: "Asia/Tokyo" },
    end: { dateTime: "2026-11-03T10:00:00", timeZone: "Asia/Tokyo" },
  });
  await pass();
  const berlinHere = meetings().find((one) => one.name === `Berlin ${run}`);
  const tokyoHere = meetings().find((one) => one.name === `Tokyo ${run}`);
  // 09:00 in Berlin on 3 November is CET, UTC+1; in Tokyo it is UTC+9.
  const readRight = berlinHere?.starts === "2026-11-03T08:00:00Z" && tokyoHere?.starts === "2026-11-03T00:00:00Z";
  // Moved an hour here, renamed there unmoved: Google must hold the instants we meant.
  act("edit-meeting", { id: berlinHere?.id, starts: "2026-11-03T09:00:00Z", ends: "2026-11-03T10:00:00Z" });
  act("edit-meeting", { id: tokyoHere?.id, name: `Tokyo, renamed ${run}` });
  const tzSent = await pass();
  const berlinThere = await google("GET", `/${berlin.id}`);
  const tokyoThere = await google("GET", `/${tokyo.id}`);
  const settled = await pass();
  claim(
    "anEventMadeInAnotherZoneKeepsItsInstantBothWays",
    readRight &&
      sameInstant(berlinThere.start?.dateTime, "2026-11-03T09:00:00Z") &&
      sameInstant(berlinThere.end?.dateTime, "2026-11-03T10:00:00Z") &&
      sameInstant(tokyoThere.start?.dateTime, "2026-11-03T00:00:00Z") &&
      tokyoThere.summary === `Tokyo, renamed ${run}` &&
      settled.applied.length === 0,
    {
      readHere: { berlin: berlinHere?.starts, tokyo: tokyoHere?.starts },
      pushed: tzSent.pushed,
      google: { berlin: berlinThere.start, tokyo: tokyoThere.start },
      afterwards: { applied: settled.applied, echoes: settled.echoes },
    },
  );

  /* ----------------------------------------------- an all-day event */
  const day = await google("POST", "", { summary: `Offsite ${run}`, start: { date: "2026-11-05" }, end: { date: "2026-11-06" } });
  const before = meetings().length;
  await pass();
  await pass();
  const dayThere = await google("GET", `/${day.id}`);
  const seen = offered.find((one) => one.id === day.id);
  claim(
    "anAllDayEventArrivesAsADayAndIsNotMadeIntoATimedMeeting",
    seen?.fields["start.date"] === "2026-11-05" && seen?.fields["start.dateTime"] === undefined && meetings().length === before && dayThere.etag === day.etag,
    {
      decided: "the transport carries start.date and end.date and invents no time; this app keeps timed meetings, so createInbound declines it, and nothing is sent for it",
      carried: seen?.fields ?? null,
      unchangedInGoogle: dayThere.etag === day.etag,
    },
  );

  /* ---------------------------------------------- every page followed */
  // Two events to a page: a full listing of this calendar takes several pages.
  pageTokens.length = 0;
  const everything = await transport.pull();
  const listed = new Set(everything.changes.map((change) => change.id));
  const eventsOfThisRun = await ours();
  claim("aPullFollowsEveryPage", pageTokens.length >= 2 && eventsOfThisRun.every((event) => listed.has(event.id)) && Boolean(everything.cursor), {
    pageSize: 2,
    pagesFollowed: pageTokens.length + 1,
    eventsListed: listed.size,
    eventsOfThisRunAllListed: eventsOfThisRun.every((event) => listed.has(event.id)),
  });

  /* -------------------------------------------- an access token refused */
  tokens.stale = true;
  tokens.asked.length = 0;
  act("edit-meeting", { id: "standup", name: `Standup, after the token ${run}` });
  const afterToken = await engine.run();
  const standupAfter = await google("GET", `/${standupId}`);
  claim(
    "anAccessTokenGoogleRefusesIsRefreshedAndTheRunGoesOn",
    !afterToken.offline && tokens.asked.includes("refresh") && afterToken.pushed.includes("standup") && standupAfter.summary === `Standup, after the token ${run}`,
    { asked: [...tokens.asked], offline: afterToken.offline, pushed: afterToken.pushed, refused: afterToken.refused },
  );

  /* -------------------------------------------- a sync token rejected */
  // Changed in Google while the cursor is no good: the full resync must still bring it.
  await google("PATCH", `/${madeThere.id}`, { summary: `Review, during the resync ${run}` });
  const countBefore = meetings().length;
  const eventsBefore = (await ours()).length;
  engine = engineFrom({ ...engine.snapshot, cursor: `corrupt-${run}` });
  const pullsBefore = pulls.length;
  const resync = await pass();
  const resyncPull = pulls[pullsBefore];
  claim(
    "aRejectedSyncTokenStartsAFullResyncThatLosesAndDuplicatesNothing",
    resyncPull?.cursor === `corrupt-${run}` &&
      resyncPull.changes.length >= eventsBefore &&
      meetings().length === countBefore &&
      (await ours()).length === eventsBefore &&
      review && node(review.id)?.name === `Review, during the resync ${run}` &&
      resync.pushed.length === 0 &&
      engine.snapshot.cursor !== `corrupt-${run}`,
    {
      eventsInTheFullList: resyncPull?.changes.length,
      applied: resync.applied,
      echoes: resync.echoes.length,
      meetingsHere: { before: countBefore, after: meetings().length },
      eventsInGoogle: { before: eventsBefore, after: (await ours()).length },
      changedDuringTheResync: review ? node(review.id)?.name : null,
    },
  );

  /* ---------------------------------------- everything it made, removed */
  for (const one of meetings()) act("remove-meeting", { id: one.id });
  const removed = await pass();
  await google("DELETE", `/${day.id}`);
  const left = await ours();
  claim("everythingTheRunMadeIsRemoved", removed.refused.length === 0 && left.length === 0 && meetings().length === 0, {
    deletesSentFromHere: removed.pushed.length,
    refused: removed.refused,
    leftInGoogle: left.length,
  });

  report.passed = Object.values(report.checks).every((check) => check.ok);
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
  report.passed = false;
} finally {
  // Whatever happened, nothing of this run stays on the calendar.
  try {
    for (const event of await ours()) await google("DELETE", `/${event.id}`);
  } catch (error) {
    report.cleanup = error instanceof Error ? error.message : String(error);
  }
}

writeFileSync(resolve(repoRoot, "docs/google-calendar.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`\n${report.passed ? "passed" : `failed${report.error ? `: ${report.error}` : ""}`} (run ${run}); wrote docs/google-calendar.json\n`);
process.exit(report.passed ? 0 : 1);
