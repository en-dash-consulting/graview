#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { GraviewApp } from "../app.js";
import { checkApp, formatFindings } from "./check.js";
import { create, CREATE_USAGE } from "./create.js";
import { generateAgentsMd, generateLlmsTxt } from "./docs.js";
import { figureFaults, FIGURE_NAMES, FIGURES } from "../schema/figures.js";

const USAGE = `graview — start a product, check its declaration, write its agent docs

${CREATE_USAGE}

  graview check <entry> [--json]
      Loads <entry> (a module whose default export, or \`app\` export, is a
      GraviewApp) and reports schema problems. Exits 1 on any error.

  graview docs <entry> [--out <dir>]
      Writes llms.txt and agents.md next to the entry, or into <dir>.

  graview figure <entry> --kind <kind> [--name <shipped>]
      Prints the figure line to paste into defineNode. With --name it is one
      of the shipped drawings; without a model to ask, it suggests the
      nearest one by name and says so. Whatever it prints, it has already
      been judged by the same rules graview check holds a figure to.
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

/**
 * The shipped figure whose NAME is closest to a kind's — never a guess
 * about what a thing is. A cleat is not a box, and the framework has never
 * met this domain.
 */
function nearest(kind: string): string {
  const said = kind.toLowerCase();
  if (FIGURES[said]) return said;
  return FIGURE_NAMES.find((name) => said.includes(name) || name.includes(said)) ?? "note";
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
    case "figure": {
      /*
       * A DRAWING YOU CAN PASTE, judged before it is printed.
       *
       * No model here: reaching a vendor is `@graview/tools`' job and the
       * CLI has no key, no seam and no business holding one. What this
       * does is the other half — name a figure, judge it against the rules
       * `graview check` will judge it against, and print the line. An
       * agent that HAS a model calls `drawFigure` and lands here anyway,
       * because the judging is the same judging.
       */
      const app = await loadApp(entry);
      const kind = flag(argv, "--kind");
      if (!kind) {
        process.stderr.write(`graview figure: --kind <kind> is required\n\n${USAGE}`);
        return 2;
      }
      if (!(app.schema.kinds as readonly string[]).includes(kind)) {
        process.stderr.write(
          `graview figure: "${kind}" is not a kind of ${app.name}. It declares: ${(app.schema.kinds as readonly string[]).join(", ")}\n`,
        );
        return 1;
      }
      const named = flag(argv, "--name");
      const figure = named || nearest(kind);
      const faults = figureFaults(figure);
      if (faults.length > 0) {
        process.stderr.write(`graview figure: that figure cannot be drawn — ${faults.join(" ")}\n`);
        return 1;
      }
      process.stdout.write(
        `${named ? "" : `graview figure: nothing was asked to draw one, so this is the nearest shipped figure by name.\n`}` +
          `  figure: ${JSON.stringify(figure)},\n` +
          `Paste it into defineNode("${kind}", { ... }). The shipped set: ${FIGURE_NAMES.join(", ")}.\n`,
      );
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
