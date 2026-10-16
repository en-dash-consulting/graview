#!/usr/bin/env node
/**
 * ONCE, BY A PERSON: let the calendar proof act on a Google test calendar.
 *
 * `scripts/verify-google-calendar.mjs` runs the sync against Google itself,
 * which needs a refresh token for a test account. This gets one: it opens
 * Google's consent page in the browser, listens on a loopback port for the
 * answer, trades the code for a refresh token and writes it into the
 * credentials file as GOOGLE_REFRESH_TOKEN. It prints no token.
 *
 * WHAT IT NEEDS first, in ~/.graview-google-test.env (or GRAVIEW_GOOGLE_ENV),
 * never in the checkout:
 *
 *   GOOGLE_CLIENT_ID=…          a "Desktop app" OAuth client
 *   GOOGLE_CLIENT_SECRET=…
 *   GOOGLE_TEST_CALENDAR_ID=…   a calendar the proof may fill and empty
 *
 * The client's project has the Google Calendar API enabled, and its consent
 * screen is in testing with the test account added as a test user.
 *
 *   node scripts/google-calendar-once.mjs
 *
 * It is never run by `pnpm verify`, by CI or by an agent: a person signs in.
 */
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { GOOGLE_ENV_FILE, requireGoogleEnv, writeGoogleEnvKey } from "./lib/google-test-env.mjs";

/** Events on one calendar: what the proof writes, reads and deletes. */
const SCOPE = "https://www.googleapis.com/auth/calendar.events";

const env = requireGoogleEnv(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_TEST_CALENDAR_ID"]);
const verifier = randomBytes(48).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");
const state = randomBytes(16).toString("hex");

const server = createServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const redirect = `http://127.0.0.1:${server.address().port}/`;

const consent = new URL("https://accounts.google.com/o/oauth2/v2/auth");
consent.search = new URLSearchParams({
  client_id: env.GOOGLE_CLIENT_ID,
  redirect_uri: redirect,
  response_type: "code",
  scope: SCOPE,
  access_type: "offline",
  prompt: "consent",
  state,
  code_challenge: challenge,
  code_challenge_method: "S256",
}).toString();

const code = await new Promise((resolve, reject) => {
  server.on("request", (request, response) => {
    const answer = new URL(request.url, redirect);
    if (answer.pathname !== "/") {
      response.writeHead(404).end();
      return;
    }
    const said = answer.searchParams.get("error");
    const ok = !said && answer.searchParams.get("state") === state && answer.searchParams.get("code");
    response.writeHead(ok ? 200 : 400, { "content-type": "text/plain; charset=utf-8" });
    response.end(ok ? "Done. You can close this tab and go back to the terminal." : `Not allowed: ${said ?? "the answer did not match"}.`);
    if (ok) resolve(answer.searchParams.get("code"));
    else reject(new Error(`Google's consent page answered ${said ?? "with a mismatched state"}.`));
  });
  console.log("Opening Google's consent page. Sign in as the test account and allow access.");
  console.log(`If no browser opens, visit:\n${consent}`);
  spawn(process.platform === "darwin" ? "open" : "xdg-open", [consent.toString()], { stdio: "ignore", detached: true }).unref();
});
server.close();

const response = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    code,
    code_verifier: verifier,
    redirect_uri: redirect,
    grant_type: "authorization_code",
  }),
});
const body = await response.json();
if (!response.ok || !body.refresh_token) {
  console.error(`Google did not hand over a refresh token: ${body.error ?? response.status} ${body.error_description ?? ""}`);
  process.exit(1);
}
writeGoogleEnvKey("GOOGLE_REFRESH_TOKEN", body.refresh_token);
console.log(`A refresh token is in ${GOOGLE_ENV_FILE} as GOOGLE_REFRESH_TOKEN. The proof can run: node scripts/verify-google-calendar.mjs`);
