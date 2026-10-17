#!/usr/bin/env node
/**
 * A GRAVIEW APP IN STEP WITH A REAL GOOGLE CALENDAR, to work through by hand.
 *
 * Serves a small meetings app (`scripts/fixtures/calendar-sync/meetings.gdd.json`)
 * the way `graview preview` does. The calendar is not wired here: the
 * declaration's `connections.calendar` says which calendar, which fields and
 * which way, and the preview runs it, as `graview preview` and `graview
 * serve` run any app's connections. Add a meeting on the page and it appears
 * in Google Calendar; move or rename it there and it moves here, credited to
 * "google-calendar" in the record's history. Each pass prints what it did.
 *
 * The same, with the CLI and nothing of this script:
 *
 *   graview preview scripts/fixtures/calendar-sync/meetings.gdd.json
 *
 * The declaration reads the credentials from the environment, and failing
 * that from ~/.graview-google-test.env (made once by
 * scripts/google-calendar-once.mjs); it holds none itself. Needs `pnpm build`.
 *
 *   node scripts/calendar-sync-demo.mjs [--port <port>] [--every 4]
 *
 * It serves on the port ports.mjs names "calendar-sync-demo", moved by
 * GRAVIEW_PORT_BASE like every harness's. To keep only some of the
 * calendar's events, give the connection a `filter`: `{ "tag": "#graview" }`
 * or `{ "color": "Basil" }`.
 *
 * The app's data lives in memory: stopping and starting it again pulls the
 * calendar afresh, so nothing is sent twice.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { previewPrincipal, servePreview } from "../packages/ship/dist/index.js";
import { portFor } from "./lib/ports.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const flag = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : fallback;
};
const port = Number(flag("--port", String(portFor("calendar-sync-demo"))));
const document = JSON.parse(readFileSync(resolve(here, "fixtures/calendar-sync/meetings.gdd.json"), "utf8"));
const every = flag("--every");
if (every) document.connections.calendar.every = Number(every);

const time = () => new Date().toLocaleTimeString();
const preview = await servePreview({
  document,
  page: resolve(here, "../packages/graview/dist/preview/"),
  port,
  host: "127.0.0.1",
  principal: previewPrincipal(document),
  // Loopback only, as `graview preview --trust-seat-headers`: lets a script on this machine act as a seat to try the sync without a browser.
  trustSeatHeaders: true,
  connections: { say: (line) => console.log(`${time()}  ${line}`) },
});

console.log(`Meetings, in step with your Google test calendar.`);
console.log(`  The app:      ${preview.url}/   (the scene: ${preview.url}/places/overview)`);
console.log(`  Google:       https://calendar.google.com/calendar/r  (the test calendar, ticked in the sidebar)`);
console.log(`  Ctrl-C stops it; the meetings in Google stay.\n`);
if (preview.connections.running.length === 0) console.log("  The calendar connection did not start: see the line above.");

const stop = () => void preview.close().then(() => process.exit(0));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
