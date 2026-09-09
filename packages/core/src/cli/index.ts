#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { GraviewApp } from "../app.js";
import { checkApp, formatFindings } from "./check.js";
import { create, CREATE_USAGE } from "./create.js";
import { generateAgentsMd, generateLlmsTxt } from "./docs.js";

const USAGE = `graview — start a product, check its declaration, write its agent docs

${CREATE_USAGE}

  graview check <entry> [--json]
      Loads <entry> (a module whose default export, or \`app\` export, is a
      GraviewApp) and reports schema problems. Exits 1 on any error.

  graview docs <entry> [--out <dir>]
      Writes llms.txt and agents.md next to the entry, or into <dir>.
`;

async function loadApp(entry: string): Promise<GraviewApp> {
  const path = resolve(process.cwd(), entry);
  const module = (await import(pathToFileURL(path).href)) as Record<string, unknown>;
  const app = (module["default"] ?? module["app"]) as GraviewApp | undefined;
  if (!app || typeof app !== "object" || !("schema" in app)) {
    throw new Error(
      `${entry} does not export a GraviewApp. Export it as default, or as \`app\`.`,
    );
  }
  return app;
}

function flag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  return argv[index + 1] ?? "";
}

export async function main(argv: string[]): Promise<number> {
  const [command, entry] = argv;
  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(USAGE);
    return 0;
  }
  if (command === "create") return create(argv.slice(1));
  if (!entry) {
    process.stderr.write(`graview ${command}: an entry module is required\n\n${USAGE}`);
    return 2;
  }

  switch (command) {
    case "check": {
      const app = await loadApp(entry);
      const result = checkApp(app);
      if (argv.includes("--json")) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else {
        process.stdout.write(`${formatFindings(result)}\n`);
      }
      return result.ok ? 0 : 1;
    }
    case "docs": {
      const app = await loadApp(entry);
      const outDir = resolve(
        process.cwd(),
        flag(argv, "--out") || dirname(resolve(process.cwd(), entry)),
      );
      await mkdir(outDir, { recursive: true });
      await writeFile(`${outDir}/llms.txt`, generateLlmsTxt(app), "utf8");
      await writeFile(`${outDir}/agents.md`, generateAgentsMd(app), "utf8");
      process.stdout.write(`graview docs: wrote llms.txt and agents.md to ${outDir}\n`);
      return 0;
    }
    default:
      process.stderr.write(`graview: unknown command "${command}"\n\n${USAGE}`);
      return 2;
  }
}

/*
 * Whether this module is the program, not an import. Compared by REAL path:
 * a project's `node_modules/.bin/graview` is a symlink to this file, and
 * comparing the unresolved path made `npx graview check` exit 0 having done
 * nothing — the quietest possible way for a check to pass.
 */
function invokedAs(argv1: string | undefined): boolean {
  if (argv1 === undefined) return false;
  try {
    return realpathSync(argv1) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return import.meta.url === pathToFileURL(argv1).href;
  }
}
const invokedDirectly = invokedAs(process.argv[1]);

if (invokedDirectly) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      process.stderr.write(`graview: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
