import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { ConnectionStateStore, ConnectionStates } from "./connections.js";

/*
 * THE NODE HALF OF A DECLARED CONNECTION: the file its engines' state is
 * kept in beside the app's data, and the credentials file a declaration's
 * `auth.file` names. Main entry only — `./connections.ts` reaches no `node:`
 * builtin, so the runtime entry runs connections with a host's own store.
 */

/** The engines' state in a JSON file — `connections.json` beside the store — written whole and moved into place. */
export function fileConnectionState(path: string): ConnectionStateStore {
  return {
    read: () => (existsSync(path) ? ((JSON.parse(readFileSync(path, "utf8")) as { connections?: ConnectionStates }).connections ?? {}) : {}),
    write(states) {
      mkdirSync(dirname(path), { recursive: true });
      const temporary = `${path}.${process.pid}.tmp`;
      writeFileSync(temporary, `${JSON.stringify({ connections: states }, null, 2)}\n`);
      renameSync(temporary, path);
    },
  };
}

/** The KEY=value lines of a credentials file (`~/` is the home directory); anything else in it is skipped, and a missing file reads as empty. */
export function readEnvFile(file: string): Record<string, string> {
  const path = file.startsWith("~/") ? join(homedir(), file.slice(2)) : file;
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) out[match[1]!] = match[2]!.replace(/^["']|["']$/g, "");
  }
  return out;
}
