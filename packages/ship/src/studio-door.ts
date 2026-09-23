import { readdir, readFile, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join, relative, resolve } from "node:path";
import {
  STUDIO_DOOR_PATH,
  type StudioDoorAnswer,
  type StudioDoorAsk,
  type StudioDoorStatus,
} from "@graview/core";
import type * as TS from "typescript";
import { fromThisApp, readBody, sendJson, type DevServerPlugin } from "./door.js";
import { editDeclaration } from "./source-edit.js";

/**
 * THE STUDIO DOOR: the dev server writing the studio's change into the
 * checkout, because a browser cannot.
 *
 * It takes CHANGES, never files and never paths. The files it edits are the
 * `.ts` files it finds in its own `src/domain/`, read fresh on every
 * request, so there is nothing a request could point anywhere else — and
 * each change is made inside the checkout's own declarations by
 * `editDeclaration`, so what somebody wrote by hand is still there after.
 *
 * Dev-server only, same-origin only, like every door: a build never carries
 * it, the probe 404s on a static host, and the studio falls back to handing
 * over the files.
 */

export interface StudioDoorOptions {
  /** The app's root. The directory the dev server was started in, unless a test says otherwise. */
  readonly root?: string;
  /** Where the declaration lives, under the root. */
  readonly domain?: string;
  readonly path?: string;
  /** The parser. Loaded from the app's own `typescript` unless a test hands one over. */
  readonly typescript?: typeof TS;
}

const LIMIT = 2_000_000;

async function domainFiles(folder: string): Promise<string[]> {
  const names = await readdir(folder).catch(() => [] as string[]);
  return names.filter((name) => name.endsWith(".ts") && !name.endsWith(".d.ts")).sort();
}

export function studioDoorHandler(options: StudioDoorOptions = {}) {
  const root = resolve(options.root ?? process.cwd());
  const domain = options.domain ?? "src/domain";
  const folder = resolve(root, domain);
  const parser = async (): Promise<typeof TS> =>
    options.typescript ?? ((await import("typescript")) as unknown as { default: typeof TS }).default;

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const send = (status: number, body: StudioDoorStatus | StudioDoorAnswer) => sendJson(res, status, body);
    if (!fromThisApp(req)) {
      send(403, { error: "The studio door answers this app only." });
      return;
    }
    // The declaration folder must be inside the app: a `domain` of "../x" is a misconfiguration, not a door.
    if (relative(root, folder).startsWith("..")) {
      send(500, { error: `${domain} is outside ${root}.` });
      return;
    }
    const names = await domainFiles(folder);
    if (req.method === "GET") {
      send(
        200,
        names.length > 0
          ? { available: true, domain, files: names.map((name) => `${domain}/${name}`) }
          : { available: false, reason: `No declaration files in ${domain}.` },
      );
      return;
    }
    if (req.method !== "POST") {
      send(405, { error: "GET to ask whether the door is open; POST the changes." });
      return;
    }
    try {
      const ask = JSON.parse(await readBody(req, LIMIT, "changes")) as Partial<StudioDoorAsk>;
      if (!Array.isArray(ask.changes)) {
        send(400, { error: "A request is { changes }." });
        return;
      }
      const files = await Promise.all(
        names.map(async (name) => ({ path: `${domain}/${name}`, text: await readFile(join(folder, name), "utf8") })),
      );
      const edited = editDeclaration(await parser(), files, ask.changes);
      if (!edited.ok) {
        send(200, { refused: edited.refused });
        return;
      }
      const diff = edited.files.flatMap((file) => {
        const before = files.find((one) => one.path === file.path)!.text;
        return before === file.text ? [] : [{ path: file.path, before, after: file.text }];
      });
      if (!ask.dryRun) {
        for (const changed of diff) await writeFile(join(folder, changed.path.slice(domain.length + 1)), changed.after);
      }
      send(200, { written: ask.dryRun ? [] : diff.map((changed) => changed.path), diff });
    } catch (error) {
      send(500, { error: error instanceof Error ? error.message : String(error) });
    }
  };
}

/** The Vite plugin. One path: GET says whether the door is open and what it would edit, POST makes the change. */
export function studioDoor(options: StudioDoorOptions = {}): DevServerPlugin {
  const handler = studioDoorHandler(options);
  return {
    name: "graview:studio-door",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(options.path ?? STUDIO_DOOR_PATH, (req, res) => {
        void handler(req, res);
      });
    },
  };
}
