import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { readSkills, SKILLS_DIR, SKILL_DESTINATIONS } from "./index.js";

/**
 * `graview skills` — installs the skills where Claude Code and Codex look
 * for them.
 *
 * Copies rather than symlinks: a symlink into `node_modules` breaks the moment
 * somebody prunes or reinstalls, and a skill that silently stops existing is
 * worse than one that is a little stale. `install` is idempotent and replaces
 * what it wrote before.
 *
 * Reached through the `graview` command line, which dispatches here; this
 * package ships the skills and the move, not a bin of its own.
 */

export const SKILLS_USAGE = `  graview skills install [dir]   copy the skills into ${SKILL_DESTINATIONS.join(" and ")}
  graview skills list            what is in this package
  graview skills path            where the skill files live
`;

export function skills(argv: readonly string[]): number {
  const [command = "help", target = process.cwd()] = argv;
  const root = resolve(target);

  if (command === "list") {
    for (const skill of readSkills()) {
      process.stdout.write(`${skill.name.padEnd(22)} ${skill.description}\n`);
    }
    return 0;
  }
  if (command === "path") {
    process.stdout.write(`${SKILLS_DIR}\n`);
    return 0;
  }
  if (command === "install") {
    const all = readSkills();
    for (const destination of SKILL_DESTINATIONS) {
      const dir = join(root, destination);
      mkdirSync(dir, { recursive: true });
      for (const skill of all) {
        const into = join(dir, skill.name);
        // Replace rather than merge: a stale file left behind from an older
        // version of a skill is a instruction nobody meant to give.
        if (existsSync(into)) rmSync(into, { recursive: true, force: true });
        cpSync(join(SKILLS_DIR, skill.name), into, { recursive: true });
      }
      process.stdout.write(`${all.length} skills → ${relative(root, dir) || destination}\n`);
    }
    process.stdout.write("\nEvery one of them ends in `graview check` and reports what it actually said.\n");
    return 0;
  }
  process.stdout.write(`graview skills — the authoring moves, each ending in a real check\n\n${SKILLS_USAGE}`);
  return command === "help" ? 0 : 1;
}
