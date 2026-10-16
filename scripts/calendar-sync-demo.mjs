#!/usr/bin/env node
/**
 * A GRAVIEW APP IN STEP WITH A REAL GOOGLE CALENDAR, to work through by hand.
 *
 * Serves a small meetings app (`scripts/fixtures/calendar-sync/meetings.gdd.json`)
 * the way `graview preview` does, and runs `@graview/core/sync`'s engine
 * against the Google test calendar every few seconds. Add a meeting on the
 * page and it appears in Google Calendar; move or rename it there and it
 * moves here, credited to "google-calendar" in the record's history. Each
 * pass prints what it did.
 *
 * It needs the test credentials in ~/.graview-google-test.env (see
 * scripts/google-calendar-once.mjs), and `pnpm build`.
 *
 *   node scripts/calendar-sync-demo.mjs [--port <port>] [--every 4]
 *
 * It serves on the port ports.mjs names "calendar-sync-demo", moved by
 * GRAVIEW_PORT_BASE like every harness's.
 *
 * The app's data lives in memory: stopping and starting it again pulls the
 * calendar afresh, so nothing is sent twice.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SyncEngine, googleCalendar, googleCalendarMapping } from "../packages/core/dist/sync/index.js";
import { previewPrincipal, servePreview } from "../packages/ship/dist/index.js";
import { googleAccessToken, requireGoogleEnv } from "./lib/google-test-env.mjs";
import { portFor } from "./lib/ports.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const flag = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : fallback;
};
const port = Number(flag("--port", String(portFor("calendar-sync-demo"))));
const everyMs = Number(flag("--every", "4")) * 1000;

const env = requireGoogleEnv(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_TEST_CALENDAR_ID", "GOOGLE_REFRESH_TOKEN"]);
const document = JSON.parse(readFileSync(resolve(here, "fixtures/calendar-sync/meetings.gdd.json"), "utf8"));
const page = resolve(here, "../packages/graview/dist/preview/");

/** An access token, asked again a minute before Google says it ends, or when Google refused it. */
let held = { token: "", until: 0 };
async function token(request) {
  if (!request?.refresh && Date.now() < held.until) return held.token;
  const { token: fresh, expiresIn } = await googleAccessToken(env);
  held = { token: fresh, until: Date.now() + (expiresIn - 60) * 1000 };
  return fresh;
}

/**
 * One instant, said one way. Google answers in the calendar's own zone
 * ("…T10:00:00-04:00") for a time we sent as "…T14:00:00Z"; read back as it
 * comes, the same instant would look like a change every pass.
 */
const instant = (value) => (typeof value === "string" && value ? new Date(value).toISOString().replace(/\.000Z$/, "Z") : value);

const mapping = googleCalendarMapping({
  events: [
    {
      kind: "meeting",
      summary: "name",
      start: "starts",
      end: "ends",
      location: "where",
      description: "notes",
      encodeTime: instant,
      decodeTime: instant,
    },
  ],
});

const preview = await servePreview({
  document,
  page,
  port,
  host: "127.0.0.1",
  principal: previewPrincipal(document),
  // Loopback only, as `graview preview --trust-seat-headers`: lets a script on this machine act as a seat to try the sync without a browser.
  trustSeatHeaders: true,
});
const store = preview.served.store;

/** What Google sent, in the app's field names, keeping only what it said. */
const ours = (fields) => {
  const out = {};
  for (const [mine, theirs] of [["name", "summary"], ["starts", "start.dateTime"], ["ends", "end.dateTime"], ["where", "location"], ["notes", "description"]]) {
    if (fields[mine] !== undefined) out[mine] = fields[mine];
    else if (fields[theirs] !== undefined) out[mine] = theirs.endsWith("dateTime") ? instant(fields[theirs]) : fields[theirs];
  }
  return out;
};

let made = 0;
const engine = new SyncEngine({
  store,
  mapping,
  remote: googleCalendar({ calendarId: env.GOOGLE_TEST_CALENDAR_ID, token }),
  conflicts: "theirs",
  applyInbound: ({ localId, fields }) => ({ name: "edit-meeting", args: { id: localId, ...ours(fields) } }),
  removeInbound: ({ localId }) => ({ name: "remove-meeting", args: { id: localId } }),
  createInbound: ({ id, fields }) => {
    const said = ours(fields);
    // A canceled event Google still lists, or an all-day one (no time to keep): nothing to make.
    if (!said.name || !said.starts) return null;
    made += 1;
    return { name: "add-meeting", args: { id: `meeting-g-${id.slice(0, 12)}-${made}`, ...said } };
  },
});

const time = () => new Date().toLocaleTimeString();
let running = false;
async function pass() {
  if (running) return;
  running = true;
  try {
    const report = await engine.run();
    const said = [];
    if (report.applied?.length) said.push(`took ${report.applied.length} from Google`);
    if (report.pushed?.length) said.push(`sent ${report.pushed.length} to Google`);
    if (report.gone?.length) said.push(`${report.gone.length} removed there`);
    if (report.refused?.length) said.push(`Google refused ${report.refused.map((one) => `${one.localId} (${one.error})`).join(", ")}`);
    if (report.resolved?.length) said.push(`${report.resolved.length} conflicts settled, Google's side kept`);
    if (report.conflicts?.length) said.push(`${report.conflicts.length} conflicts held`);
    if (report.offline) said.push("could not reach Google; will try again");
    if (said.length > 0) console.log(`${time()}  ${said.join(" · ")}`);
  } catch (error) {
    console.log(`${time()}  the pass failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    running = false;
  }
}

console.log(`Meetings, in step with your Google test calendar.`);
console.log(`  The app:      ${preview.url}/   (the scene: ${preview.url}/places/overview)`);
console.log(`  Google:       https://calendar.google.com/calendar/r  (the test calendar, ticked in the sidebar)`);
console.log(`  A pass every ${everyMs / 1000} s. Ctrl-C stops it; the meetings in Google stay.\n`);
await pass();
console.log(`${time()}  first pass done: ${store.graph.allNodes().filter((node) => node.kind === "meeting").length} meetings here.`);
const timer = setInterval(pass, everyMs);

const stop = () => {
  clearInterval(timer);
  void preview.close().then(() => process.exit(0));
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
