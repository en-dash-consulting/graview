/**
 * The Notion test credentials, kept OUTSIDE the checkout.
 *
 * The proof that the Notion connection survives Notion itself needs an
 * internal integration's secret and a page shared with it. They live in a
 * plain KEY=value file in the home directory (`~/.graview-notion-test.env`,
 * or GRAVIEW_NOTION_ENV), so no commit can ever carry them, and nothing here
 * prints a value: a sentence names the keys that are missing, never what
 * any key holds.
 *
 *   NOTION_TOKEN=ntn_…            the integration's Internal Integration Secret
 *   NOTION_PARENT_PAGE_ID=…       the page the harness makes its database in (32 hex characters)
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const NOTION_ENV_FILE = process.env.GRAVIEW_NOTION_ENV ?? join(homedir(), ".graview-notion-test.env");

/** Every KEY=value line; anything else in the file (a comment, a stray line) is skipped. */
export function readNotionEnv(file = NOTION_ENV_FILE) {
  if (!existsSync(file)) {
    throw new Error(`No Notion test credentials at ${file}. Put NOTION_TOKEN and NOTION_PARENT_PAGE_ID there (see scripts/verify-notion.mjs).`);
  }
  const env = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

/** The keys a run needs, or a sentence naming the ones missing. */
export function requireNotionEnv(keys, file = NOTION_ENV_FILE) {
  const env = readNotionEnv(file);
  const missing = keys.filter((key) => !env[key]);
  if (missing.length > 0) throw new Error(`${file} has no ${missing.join(", ")}.`);
  return env;
}
