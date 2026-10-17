/**
 * The Google test credentials, kept OUTSIDE the checkout.
 *
 * The proof that the calendar sync survives Google itself needs an OAuth
 * client and a test calendar. They live in a plain KEY=value file in the
 * home directory (`~/.graview-google-test.env`, or GRAVIEW_GOOGLE_ENV), so
 * no commit can ever carry them, and nothing here prints a value: a line
 * says which keys are set, never what they are.
 */
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const GOOGLE_ENV_FILE =
  process.env.GRAVIEW_GOOGLE_ENV ?? join(homedir(), ".graview-google-test.env");

/** Every KEY=value line; anything else in the file (a stray line) is skipped. */
export function readGoogleEnv(file = GOOGLE_ENV_FILE) {
  if (!existsSync(file)) {
    throw new Error(
      `No Google test credentials at ${file}. Put GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_TEST_CALENDAR_ID there (see scripts/google-calendar-once.mjs).`,
    );
  }
  const env = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

/** The keys a run needs, or a sentence naming the ones missing. */
export function requireGoogleEnv(keys, file = GOOGLE_ENV_FILE) {
  const env = readGoogleEnv(file);
  const missing = keys.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`${file} has no ${missing.join(", ")}.`);
  }
  return env;
}

/** Sets one key in the file, keeping every other line as it was. */
export function writeGoogleEnvKey(key, value, file = GOOGLE_ENV_FILE) {
  const lines = existsSync(file) ? readFileSync(file, "utf8").split("\n") : [];
  const at = lines.findIndex((line) => line.startsWith(`${key}=`));
  if (at >= 0) lines[at] = `${key}=${value}`;
  else {
    while (lines.length > 0 && lines.at(-1) === "") lines.pop();
    lines.push(`${key}=${value}`, "");
  }
  writeFileSync(file, lines.join("\n"));
  chmodSync(file, 0o600);
}

/** A fresh access token from the stored refresh token. */
export async function googleAccessToken(env) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Google refused the refresh token: ${body.error ?? response.status}. Run scripts/google-calendar-once.mjs again.`);
  }
  return { token: body.access_token, expiresIn: body.expires_in };
}
