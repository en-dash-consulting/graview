import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LINKED_PACKAGES, scaffoldProject, validateScaffoldOptions, type ScaffoldOptions } from "../scaffold/index.js";
import type { GraviewTemplate } from "../document/graview-template.js";
import { instantiateTemplate } from "../document/instantiate-template.js";

/**
 * `graview create <dir>`: a product on Graview, started.
 *
 * The generator (`../scaffold`) decides what a project is; this decides
 * what touching a real filesystem should look like — refusing to write into
 * a directory that already has things in it, installing with the package
 * manager the person is evidently using, and saying what to do next rather
 * than printing a file list.
 */

export const CREATE_USAGE = `  graview create <dir> [--name "Field Notes"] [--kind note] [--plural notes]
      Starts a product on Graview in <dir>: the declaration split into domain
      and UI, an eighty-line shell, a headless test, a CI workflow.
        --name <text>      the product's name (default: from <dir>)
        --kind <slug>      the first node kind (default: item)
        --plural <slug>    its plural (default: <kind>s)
        --link <path>      consume the framework from a sibling checkout by
                           path rather than from a registry
        --pm pnpm|npm      the package manager (default: whichever ran this)
        --port <n>         the dev server port (default: 5170)
        --accent <#hex>    the brand accent (default: a worked green)
        --no-install       write the files and stop
        --no-skills        do not install the authoring skills
        --no-git           do not initialize a git repository
        --workspace        the layout every real product ends up with: a
                           workspace root with the app under app/ and the
                           harness scripts at the root
        --merge            write only the files that do not exist yet, and
                           name every collision without touching it
        --force            write into a directory that is not empty
        --template <file|url>
                           start from a template made anywhere (Graview
                           Cloud's graview-template shape): the project keeps
                           its document as src/domain/app.json and the
                           template as template.json, for \`graview apply
                           --template\` to set a store up from. Named after
                           the template unless --name says otherwise.
`;

export interface CreateIo {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
  /** Runs a command in a directory and reports whether it succeeded. */
  readonly run: (command: string, args: readonly string[], cwd: string) => boolean;
}

const defaultIo: CreateIo = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  run: (command, args, cwd) =>
    spawnSync(command, [...args], { cwd, stdio: "inherit", shell: process.platform === "win32" }).status === 0,
};

function flag(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  return value === undefined || value.startsWith("--") ? "" : value;
}

/** pnpm when it ran this (`pnpm create graview`, `pnpm dlx`), else npm. */
export function packageManagerFromEnv(env: NodeJS.ProcessEnv = process.env): "pnpm" | "npm" {
  const agent = env["npm_config_user_agent"] ?? "";
  return agent.startsWith("pnpm") ? "pnpm" : "npm";
}

/**
 * The core that is running: its version, so a project pins what made it.
 * Every @graview/* package and the `graview` tool share one version (a
 * changesets fixed group), so `^<this>` names a version of each that exists.
 */
function ownManifest(): { version: string } {
  try {
    const manifest = JSON.parse(
      readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../package.json"), "utf8"),
    ) as { version?: string };
    return { version: manifest.version ?? "0.0.0" };
  } catch {
    return { version: "0.0.0" };
  }
}

export async function create(argv: readonly string[], io: CreateIo = defaultIo): Promise<number> {
  const dir = argv.find((arg, index) => !arg.startsWith("--") && (index === 0 || !argv[index - 1]!.startsWith("--")));
  if (!dir) {
    io.stderr(`graview create: a directory is required\n\n${CREATE_USAGE}`);
    return 2;
  }
  const asked = resolve(process.cwd(), dir);
  const force = argv.includes("--force");
  /*
   * A DIRECTORY THAT ALREADY EXISTS IS THE NORMAL CASE.
   *
   * The realistic start is a repository somebody has already made: a README
   * they wrote, a license, CI, assistant instruction files from some other
   * tool. `--force` is too blunt for that — it writes over the README — so
   * two products independently worked around it by scaffolding into `app/`
   * and hand-writing a workspace root, which is a scaffolder gap rather
   * than a taste they shared.
   *
   * `--merge` writes only what is not there, names every collision without
   * touching it, and exits non-zero so a script cannot mistake a partial
   * write for a clean one. `--force` keeps its meaning exactly.
   */
  const merge = argv.includes("--merge");
  if (existsSync(asked) && readdirSync(asked).length > 0 && !force && !merge) {
    io.stderr(
      `graview create: ${dir} is not empty. Pass --merge to write only what is missing, or --force to write into it anyway.\n`,
    );
    return 2;
  }

  /*
   * A TEMPLATE IS JUDGED BEFORE A DIRECTORY EXISTS (FR-08): its shape, its
   * document through the compiler every document goes through, its setup
   * acts against that document, its examples against the schema. Only the
   * answers are left open — nobody has been asked anything yet.
   */
  const templateFlag = flag(argv, "--template");
  let template: GraviewTemplate | undefined;
  if (templateFlag !== undefined) {
    const read = await readTemplateFrom(templateFlag);
    if (typeof read === "string") {
      io.stderr(`graview create: ${read}\n`);
      return 2;
    }
    const judged = instantiateTemplate(read.raw);
    const wrong = judged.ok ? [] : judged.findings.filter((f) => f.code !== "answer");
    if (!judged.ok && wrong.length > 0) {
      io.stderr(
        `graview create: ${templateFlag} is not a template that installs:\n${wrong.map((f) => `  ${f.path || "(template)"}: ${f.message}\n`).join("")}`,
      );
      return 2;
    }
    template = read.raw as GraviewTemplate;
  }

  const { version } = ownManifest();
  const pmFlag = flag(argv, "--pm");
  const packageManager: "pnpm" | "npm" =
    pmFlag === "pnpm" || pmFlag === "npm" ? pmFlag : packageManagerFromEnv();
  const portFlag = flag(argv, "--port");
  const linkFlag = flag(argv, "--link");

  // Everything that can be refused is refused before a directory exists.
  const base: ScaffoldOptions = {
    name: flag(argv, "--name") || template?.title || fromDirectoryName(dir),
    ...(template ? { template } : {}),
    ...(flag(argv, "--kind") ? { kind: flag(argv, "--kind") } : {}),
    // "Shifts" is what a person types; the slug is what the generator wants.
    ...(flag(argv, "--plural") ? { plural: flag(argv, "--plural")!.trim().toLowerCase() } : {}),
    ...(flag(argv, "--accent") ? { accent: flag(argv, "--accent") } : {}),
    ...(portFlag ? { port: Number(portFlag) } : {}),
    packageManager,
    ...(argv.includes("--workspace") ? { workspace: true } : {}),
    range: `^${version}`,
  };
  const problems = [...validateScaffoldOptions(base)];
  if (linkFlag !== undefined && linkFlag !== "") {
    const checkout = resolve(process.cwd(), linkFlag);
    if (!existsSync(resolve(checkout, "packages/core"))) {
      problems.push(`--link ${linkFlag} is not a framework checkout: no packages/core in it`);
    } else {
      // A linked project resolves every type from the framework's dist, so
      // an unbuilt framework fails later, in tsc, one package at a time.
      const unbuilt = LINKED_PACKAGES.filter(
        (pkg) => !existsSync(resolve(checkout, "packages", pkg, "dist/index.js")),
      );
      if (unbuilt.length > 0) {
        problems.push(
          `the framework at ${linkFlag} is not built (no dist in ${unbuilt.join(", ")}). Run: pnpm -C ${linkFlag} install && pnpm -C ${linkFlag} build`,
        );
      }
    }
  }
  if (problems.length > 0) {
    io.stderr(`graview create: ${problems.join("\ngraview create: ")}\n`);
    return 2;
  }

  /*
   * Relative paths are computed from where the project REALLY is. A temp
   * directory on macOS is reached through a symlink, and a `link:` written
   * from the unresolved path is one level short of the framework once pnpm
   * resolves the project — a dangling symlink, and no error until tsc.
   */
  mkdirSync(asked, { recursive: true });
  const target = realpathSync(asked);
  const framework =
    linkFlag !== undefined && linkFlag !== "" ? realpathSync(resolve(process.cwd(), linkFlag)) : undefined;
  const link = framework !== undefined ? toPosix(relative(target, framework)) : undefined;
  if (framework !== undefined && !relative(framework, target).startsWith("..")) {
    io.stderr(
      `graview create: ${dir} is inside the framework checkout, so it will land in the framework's git history. A product lives in its own repository beside it — e.g. ${toPosix(relative(process.cwd(), resolve(framework, "..", dir.split(/[\\/]/).pop() ?? dir)))}.\n`,
    );
  }
  const frameworkRepo = framework !== undefined ? originSlug(framework) : undefined;

  const options: ScaffoldOptions = {
    ...base,
    ...(link !== undefined ? { link } : {}),
    ...(frameworkRepo ? { frameworkRepo } : {}),
  };

  const scaffold = scaffoldProject(options);
  const collisions: string[] = [];
  let written = 0;
  for (const file of scaffold.files) {
    const path = resolve(target, file.path);
    if (merge && existsSync(path)) {
      collisions.push(file.path);
      continue;
    }
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, file.contents, "utf8");
    written += 1;
  }
  io.stdout(`graview create: ${written} files → ${dir}\n`);

  const install = !argv.includes("--no-install");
  const skills = !argv.includes("--no-skills");
  const pm = scaffold.packageManager;
  const run = pm === "pnpm" ? "pnpm" : "npm run";

  // A repository, because the CI workflow just written assumes one — unless
  // this directory is already inside one, which is the person's own choice.
  let initialized = false;
  if (!argv.includes("--no-git") && !insideGitRepo(target)) {
    initialized = io.run("git", ["init", "--quiet"], target);
  }

  if (install) {
    io.stdout(`graview create: ${pm} install\n`);
    if (!io.run(pm, ["install"], target)) {
      io.stderr(`graview create: ${pm} install failed. The files are in place; install by hand and run \`${run} verify\`.\n`);
      return 1;
    }
    if (skills) {
      const bin = resolve(target, "node_modules/.bin/graview");
      if (existsSync(bin)) {
        io.run(bin, ["skills", "install", "."], target);
      } else {
        io.stderr("graview create: graview did not install, so the authoring skills were not written.\n");
      }
    }
  } else if (skills) {
    /*
     * THE SKILLS COME THROUGH THE PACKAGE MANAGER, so `--no-install` skips
     * them too — and it used to skip them SILENTLY, which is the expensive
     * half: an agent starts on a fresh product without the skills that teach
     * it how, which is the single highest-leverage thing the framework
     * ships, and nothing on the screen said they were missing.
     */
    io.stdout(`graview create: skills: skipped (needs install — then \`${run} skills\`)\n`);
  }

  io.stdout(
    `\n${scaffold.name} is a product on Graview. Its first kind is "${scaffold.kind}".\n\n` +
      `  cd ${dir}\n` +
      (install ? "" : `  ${pm} install\n`) +
      `  ${run} dev        # http://localhost:${scaffold.port}  (/pages is the routed face)\n` +
      `  ${run} verify     # typecheck, tests, build, graview check\n` +
      (initialized ? `  git add -A && git commit -m "${scaffold.name}, on Graview"\n` : "") +
      "\n" +
      (scaffold.linked
        ? `The framework is consumed by path from ${link}: rebuild it (pnpm -C ${link} build) when its sources change.\n` +
          `Its CI checks the framework out beside the app${frameworkRepo ? ` from ${frameworkRepo}` : " — fill in the repository in .github/workflows/ci.yml"}; a private framework needs a FRAMEWORK_TOKEN secret.\n\n`
        : "") +
      (template
        ? `Made from the template "${template.title}": its document is src/domain/app.json, and\n` +
          `\`${run} apply-template\` runs its setup into ./data as one batch that one undo takes back\n` +
          `(answer its questions with \`${run} apply-template ${pm === "pnpm" ? "" : "-- "}--answers '{"${template.questions[0]?.id ?? "question"}": …}'\`).\n\n`
        : "") +
      `Then declare more: src/domain/ is the whole surface, and \`${run} check\` says what is wrong with it.\n`,
  );
  if (collisions.length > 0) {
    io.stderr(
      `\ngraview create: ${collisions.length} file${collisions.length === 1 ? "" : "s"} already existed and ${
        collisions.length === 1 ? "was" : "were"
      } left exactly as ${collisions.length === 1 ? "it was" : "they were"}:\n` +
        collisions.map((path) => `  ${path}\n`).join("") +
        `Merge what you want from a scaffold written elsewhere, or pass --force to overwrite.\n`,
    );
    return 1;
  }
  return 0;
}

/** A template from a file or a URL, parsed — or the sentence saying why it could not be. */
async function readTemplateFrom(where: string): Promise<{ readonly raw: unknown } | string> {
  if (where === "") return "--template needs a file or a URL";
  let text: string;
  try {
    if (/^https?:\/\//.test(where)) {
      const response = await fetch(where);
      if (!response.ok) return `${where} answered ${response.status}`;
      text = await response.text();
    } else {
      text = readFileSync(resolve(process.cwd(), where), "utf8");
    }
  } catch (error) {
    return `${where} could not be read: ${error instanceof Error ? error.message : String(error)}`;
  }
  try {
    return { raw: JSON.parse(text) as unknown };
  } catch (error) {
    return `${where} is not JSON: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/** Whether a directory already sits inside a git work tree. */
function insideGitRepo(dir: string): boolean {
  let current = dir;
  for (;;) {
    if (existsSync(resolve(current, ".git"))) return true;
    const parent = dirname(current);
    if (parent === current) return false;
    current = parent;
  }
}

/** The framework's GitHub "owner/name", from its origin remote, if it has one. */
function originSlug(framework: string): string | undefined {
  const result = spawnSync("git", ["-C", framework, "remote", "get-url", "origin"], { encoding: "utf8" });
  if (result.status !== 0) return undefined;
  const match = /github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?\s*$/.exec(result.stdout);
  return match?.[1];
}

function fromDirectoryName(dir: string): string {
  const base = dir.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? dir;
  return base
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toPosix(path: string): string {
  const posix = path.split("\\").join("/");
  return isAbsolute(path) || posix.startsWith(".") ? posix : `./${posix}`;
}
