import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GRAVIEW_PACKAGES, scaffoldProject, validateScaffoldOptions, type ScaffoldOptions } from "../scaffold/index.js";

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
        --no-git           do not initialise a git repository
        --force            write into a directory that is not empty
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
 * The core that is running: its version, so a project pins what made it,
 * and whether it is published at all. A version number says nothing about
 * that — the packages were 0.0.1 and on no registry — but \`private: true\`
 * is exactly the flag that keeps them off one.
 */
function ownManifest(): { version: string; unpublished: boolean } {
  try {
    const manifest = JSON.parse(
      readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../package.json"), "utf8"),
    ) as { version?: string; private?: boolean };
    return { version: manifest.version ?? "0.0.0", unpublished: manifest.private === true };
  } catch {
    return { version: "0.0.0", unpublished: true };
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
  if (existsSync(asked) && readdirSync(asked).length > 0 && !force) {
    io.stderr(`graview create: ${dir} is not empty. Pass --force to write into it anyway.\n`);
    return 2;
  }

  const { version, unpublished } = ownManifest();
  const pmFlag = flag(argv, "--pm");
  const packageManager: "pnpm" | "npm" =
    pmFlag === "pnpm" || pmFlag === "npm" ? pmFlag : packageManagerFromEnv();
  const portFlag = flag(argv, "--port");
  const linkFlag = flag(argv, "--link");

  // Everything that can be refused is refused before a directory exists.
  const base: ScaffoldOptions = {
    name: flag(argv, "--name") || fromDirectoryName(dir),
    ...(flag(argv, "--kind") ? { kind: flag(argv, "--kind") } : {}),
    // "Shifts" is what a person types; the slug is what the generator wants.
    ...(flag(argv, "--plural") ? { plural: flag(argv, "--plural")!.trim().toLowerCase() } : {}),
    ...(flag(argv, "--accent") ? { accent: flag(argv, "--accent") } : {}),
    ...(portFlag ? { port: Number(portFlag) } : {}),
    packageManager,
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
      const unbuilt = [...GRAVIEW_PACKAGES, "skills"].filter(
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

  /*
   * The framework's zod, at its real location. pnpm's node_modules/zod is a
   * symlink into its store, and tsc's `paths` does not see through it the way
   * it sees through a bare import — so the project gets the resolved path.
   */
  const dedupeTypes =
    framework !== undefined
      ? Object.fromEntries(
          ["zod"].flatMap((module) => {
            // The framework's copy lives under the package that declares it.
            const candidate = [
              resolve(framework, "packages/core/node_modules", module),
              resolve(framework, "node_modules", module),
            ].find((path) => existsSync(path));
            return candidate ? [[module, toPosix(relative(target, realpathSync(candidate)))]] : [];
          }),
        )
      : undefined;

  const options: ScaffoldOptions = {
    ...base,
    ...(link !== undefined ? { link } : {}),
    ...(dedupeTypes && Object.keys(dedupeTypes).length > 0 ? { dedupeTypes } : {}),
    ...(frameworkRepo ? { frameworkRepo } : {}),
  };

  if (link === undefined && unpublished) {
    io.stderr(
      `graview create: this copy of @graview/core (${version}) is unpublished, so the project's\n` +
        "dependencies cannot resolve from a registry. Pass --link <path-to-framework> to consume\n" +
        "the framework by path, or install from a published version.\n",
    );
  }

  const scaffold = scaffoldProject(options);
  for (const file of scaffold.files) {
    const path = resolve(target, file.path);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, file.contents, "utf8");
  }
  io.stdout(`graview create: ${scaffold.files.length} files → ${dir}\n`);

  const install = !argv.includes("--no-install");
  const skills = !argv.includes("--no-skills");
  const pm = scaffold.packageManager;
  const run = pm === "pnpm" ? "pnpm" : "npm run";

  // A repository, because the CI workflow just written assumes one — unless
  // this directory is already inside one, which is the person's own choice.
  let initialised = false;
  if (!argv.includes("--no-git") && !insideGitRepo(target)) {
    initialised = io.run("git", ["init", "--quiet"], target);
  }

  if (install) {
    io.stdout(`graview create: ${pm} install\n`);
    if (!io.run(pm, ["install"], target)) {
      io.stderr(`graview create: ${pm} install failed. The files are in place; install by hand and run \`${run} verify\`.\n`);
      return 1;
    }
    if (skills) {
      const bin = resolve(target, "node_modules/.bin/graview-skills");
      if (existsSync(bin)) {
        io.run(bin, ["install", "."], target);
      } else {
        io.stderr("graview create: @graview/skills did not install, so the authoring skills were not written.\n");
      }
    }
  }

  io.stdout(
    `\n${scaffold.name} is a product on Graview. Its first kind is "${scaffold.kind}".\n\n` +
      `  cd ${dir}\n` +
      (install ? "" : `  ${pm} install\n`) +
      `  ${run} dev        # http://localhost:${scaffold.port}  (/pages is the routed face)\n` +
      `  ${run} verify     # typecheck, tests, build, graview check\n` +
      (initialised ? `  git add -A && git commit -m "${scaffold.name}, on Graview"\n` : "") +
      "\n" +
      (scaffold.linked
        ? `The framework is consumed by path from ${link}: rebuild it (pnpm -C ${link} build) when its sources change.\n` +
          `Its CI checks the framework out beside the app${frameworkRepo ? ` from ${frameworkRepo}` : " — fill in the repository in .github/workflows/ci.yml"}; a private framework needs a FRAMEWORK_TOKEN secret.\n\n`
        : "") +
      `Then declare more: src/domain/ is the whole surface, and \`${run} check\` says what is wrong with it.\n`,
  );
  return 0;
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
