#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { GraviewApp } from "../app.js";
import type { AnySchema } from "../schema/schema.js";
import { checkApp, formatFindings } from "./check.js";
import { compileDocument, readDocument } from "../document/compile.js";
import { sayFindings } from "../document/findings.js";
import { isGraviewTemplate } from "../document/graview-template.js";
import { create, CREATE_USAGE } from "./create.js";
import { describeApp } from "./describe.js";
import { generateAgentsMd, generateLlmsTxt } from "./docs.js";
import { figureBrief, figureFaults, FIGURE_NAMES, FIGURES } from "../schema/figures.js";
import { scaffoldLens, validateLensOptions, type LensScaffoldOptions } from "../scaffold/lens.js";

export const USAGE = `graview — start a product, check its declaration, write its agent docs

${CREATE_USAGE}

  graview check <entry> [--views <module>] [--json]
      Loads <entry> (a module whose default export, or \`app\` export, is a
      GraviewApp) and reports schema problems. Exits 1 on any error.

  --document <file>
      Any command that takes an <entry> takes a declaration document instead
      (a .json file in the Graview document format): compiled, never run as
      code, and checked with the JSON path of every finding. With
      --previous <file>, check holds every renamedFrom to the version before.
      A template (a graview-template .json) is read as the document inside it.

  graview docs <entry> [--out <dir>] [--views <module>]
      Writes llms.txt and agents.md next to the entry, or into <dir>.

  graview describe <entry> [--as <role>] [--views <module>]
      Reads the app out: what a blank installation meets and in what order,
      what is drawn and what falls back, the hues, what a seat may do, how a
      model is reached, what is judged. The rung between check and a browser
      — "run it and look" for something that cannot see.

  graview lens <name> --roles a,b,c [--binds fields|entities] [--dir <dir>]
      Writes a lens that compiles: the role check that fails loudly, the
      createXLens factory, three fidelities, pick targets — and beside it a
      REUSE TEST in a domain the app is not about, red until you make the
      claim true. If you cannot make it pass, you wrote a view, and a view
      is a legitimate thing to have written.

  graview figure <entry> --kind <kind> [--name <shipped>]
                         [--from "<what the thing is>"] [--judge <file|->]
      Prints the figure line to paste into defineNode. With --name it is one
      of the shipped drawings; with neither, it suggests the nearest one by
      name and says so. --from prints the brief to hand a model — the rules,
      the angle and a shipped figure as the style — and --judge reads the
      answer back, holds it to the rules graview check holds a figure to, and
      prints the line. Nine shipped figures is a vocabulary to start from,
      not a vocabulary to finish in.
`;

/**
 * THE ENTRY A COMMAND IS ABOUT: `--document <file>` when given, otherwise
 * the module named where the command expects it. A document is JSON a host
 * can accept from a stranger and run without running their code (FR-01).
 */
export function entryArg(argv: readonly string[], at: number): string | undefined {
  const document = flag(argv, "--document");
  if (document) return document;
  const positional = argv[at];
  return positional && !positional.startsWith("--") ? positional : undefined;
}

/** Whether an entry is a declaration document rather than a module. */
export const isDocument = (entry: string): boolean => entry.endsWith(".json");

/** A declaration document compiled, with the findings it came with — or every finding that refused it. */
export function loadDocument(entry: string, previous?: string): ReturnType<typeof compileDocument> {
  const before = previous ? readDocument(documentIn(previous)).document : undefined;
  return compileDocument(documentIn(entry), before ? { previous: before } : {});
}

/**
 * The declaration a .json file holds: the file itself, or — when it is a
 * template (FR-08) — the document inside it, so `graview describe` and
 * `graview check` read a template made anywhere as the app it makes.
 */
export function documentIn(file: string): unknown {
  const text = readFileSync(resolve(process.cwd(), file), "utf8");
  try {
    const parsed = JSON.parse(text) as unknown;
    return isGraviewTemplate(parsed) ? (parsed as { document?: unknown }).document : text;
  } catch {
    return text;
  }
}

export async function loadApp(entry: string): Promise<GraviewApp> {
  if (isDocument(entry)) {
    const compiled = loadDocument(entry);
    if (!compiled.ok) throw new Error(`${entry} is not a declaration that compiles:\n${sayFindings(compiled.findings)}`);
    return compiled.app as GraviewApp;
  }
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

/**
 * THE PICTURES, FROM WHERE THEY LIVE (F-042).
 *
 * A view registry is React, and the declaration is the domain tier, which
 * must not import React — so no app can pass `defineApp({ views })`, and
 * everything outside a browser went quiet about what is drawn. The
 * pictures are still a module: `--views ./dist/ui/views.js` names it, and
 * this reads the registry — `places()`, `kindsWithViews()`, `all()` —
 * without rendering anything. The module exports `views` (a registry, or
 * a function that builds one), or the registry as its default export.
 */
export function withViews<S extends AnySchema>(app: GraviewApp<S>, module: Record<string, unknown>, name: string): GraviewApp<S> {
  const candidate = module["views"] ?? module["default"] ?? module["registry"];
  const registry = typeof candidate === "function" ? (candidate as () => unknown)() : candidate;
  const looksLikeOne =
    typeof registry === "object" &&
    registry !== null &&
    typeof (registry as { kindsWithViews?: unknown }).kindsWithViews === "function" &&
    typeof (registry as { places?: unknown }).places === "function";
  if (!looksLikeOne) {
    throw new Error(
      `${name} does not export a view registry. Export \`views\` — the registry, or a function that builds it — or the registry as default.`,
    );
  }
  return { ...app, views: registry as GraviewApp<S>["views"] };
}

async function loadViews(app: GraviewApp, entry: string | undefined): Promise<GraviewApp> {
  if (!entry) return app;
  const path = resolve(process.cwd(), entry);
  const module = (await import(pathToFileURL(path).href)) as Record<string, unknown>;
  return withViews(app, module, entry);
}

function flag(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  return argv[index + 1] ?? "";
}

export async function main(argv: string[]): Promise<number> {
  const command = argv[0];
  const entry = entryArg(argv, 1);
  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(USAGE);
    return 0;
  }
  if (command === "create") return create(argv.slice(1));
  if (command === "lens") {
    /*
     * A LENS, STARTED. The rules in `graview-lens` are the kind that are
     * easy to agree with and easy to forget at line 300, so they arrive in
     * the file already — and the reuse test arrives RED, which is the only
     * way an instruction nothing can enforce ever gets followed.
     */
    const name = argv[1];
    if (!name || name.startsWith("--")) {
      process.stderr.write(`graview lens: a name is required\n\n${USAGE}`);
      return 2;
    }
    const roles = (flag(argv, "--roles") ?? "").split(",").map((role) => role.trim()).filter(Boolean);
    const bindsFlag = flag(argv, "--binds");
    const dir = flag(argv, "--dir");
    const options: LensScaffoldOptions = {
      name,
      roles,
      ...(bindsFlag === "entities" || bindsFlag === "fields" ? { binds: bindsFlag as "entities" | "fields" } : {}),
      ...(dir ? { dir } : {}),
    };
    const problems = validateLensOptions(options);
    if (problems.length > 0) {
      process.stderr.write(`graview lens: ${problems.join("\ngraview lens: ")}\n`);
      return 2;
    }
    const files = scaffoldLens(options);
    for (const file of files) {
      const path = resolve(process.cwd(), file.path);
      if (existsSync(path)) {
        process.stderr.write(`graview lens: ${file.path} already exists — nothing was written.\n`);
        return 1;
      }
    }
    for (const file of files) {
      const path = resolve(process.cwd(), file.path);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, file.contents, "utf8");
    }
    process.stdout.write(
      `${files.map((file) => `  ${file.path}\n`).join("")}` +
        `\nThe reuse test is RED on purpose: bind the roles to a domain this app is not\n` +
        `about and make it pass, or say plainly that you wrote a view.\n`,
    );
    return 0;
  }
  if (!entry) {
    process.stderr.write(`graview ${command}: an entry module is required\n\n${USAGE}`);
    return 2;
  }

  switch (command) {
    case "check": {
      /*
       * A DOCUMENT IS CHECKED AS A DOCUMENT: its own findings — a rule that
       * sweeps every record for every record, a field a template names and
       * the kind lacks — beside the framework's, each with the JSON path a
       * person or an agent fixes it at.
       */
      if (isDocument(entry)) {
        const compiled = loadDocument(entry, flag(argv, "--previous"));
        if (argv.includes("--json")) process.stdout.write(`${JSON.stringify({ ok: compiled.ok, findings: compiled.findings }, null, 2)}\n`);
        else process.stdout.write(`${compiled.findings.length > 0 ? sayFindings(compiled.findings) : "✓ the document compiles and checks clean"}\n`);
        return compiled.ok ? 0 : 1;
      }
      const app = await loadViews(await loadApp(entry), flag(argv, "--views"));
      const result = checkApp(app);
      if (argv.includes("--json")) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else {
        process.stdout.write(`${formatFindings(result)}\n`);
      }
      return result.ok ? 0 : 1;
    }
    case "docs": {
      const app = await loadViews(await loadApp(entry), flag(argv, "--views"));
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
    case "describe": {
      /*
       * The one instruction an agent cannot follow is the one every skill
       * ends on. It can declare, and it cannot see — so the derivations say
       * what they would do, in words.
       */
      const app = await loadViews(await loadApp(entry), flag(argv, "--views"));
      const role = flag(argv, "--as");
      process.stdout.write(
        `${describeApp(app, role ? { as: { kind: "human", id: role, roles: [role] } } : {})}\n`,
      );
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
      /*
       * THE AUTHORING LOOP, through the door every app has: a prompt to
       * copy and an answer to paste. The CLI still holds no key and reaches
       * no vendor — that is `@graview/tools`' job — and it does the half it
       * is actually good at, which is saying what a figure must be and then
       * judging what came back.
       */
      const from = flag(argv, "--from");
      if (from) {
        process.stdout.write(`${figureBrief(kind, from)}\n`);
        return 0;
      }
      const judge = flag(argv, "--judge");
      if (judge) {
        const drawn = judge === "-" ? readFileSync(0, "utf8") : readFileSync(resolve(process.cwd(), judge), "utf8");
        const trimmed = drawn.trim();
        const faults = figureFaults(trimmed);
        if (faults.length > 0) {
          process.stderr.write(
            `graview figure: that drawing cannot be kept —\n${faults.map((fault) => `  ${fault}\n`).join("")}` +
              `Ask again with the fault quoted; the brief is graview figure ${entry} --kind ${kind} --from "…".\n`,
          );
          return 1;
        }
        process.stdout.write(
          `  figure:\n    ${JSON.stringify(trimmed)},\n` +
            `Paste it into defineNode(${JSON.stringify(kind)}, { ... }), then look at it at twenty pixels.\n`,
        );
        return 0;
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
