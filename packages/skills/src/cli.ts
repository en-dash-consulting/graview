#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { readSkills, SKILLS_DIR, SKILL_DESTINATIONS } from "./index.js";

/**
 * Installs the skills where Claude Code and Codex look for them.
 *
 * Copies rather than symlinks: a symlink into `node_modules` breaks the moment
 * somebody prunes or reinstalls, and a skill that silently stops existing is
 * worse than one that is a little stale. `install` is idempotent and replaces
 * what it wrote before.
 */

const USAGE = `graview-skills — the authoring moves, each ending in a real check

  graview-skills install [dir]   copy the skills into ${SKILL_DESTINATIONS.join(" and ")}
  graview-skills list            what is in this package
  graview-skills path            where the skill files live
`;

const [command = "help", target = process.cwd()] = process.argv.slice(2);
const root = resolve(target);

if (command === "list") {
  for (const skill of readSkills()) {
    process.stdout.write(`${skill.name.padEnd(22)} ${skill.description}\n`);
  }
} else if (command === "path") {
  process.stdout.write(`${SKILLS_DIR}\n`);
} else if (command === "install") {
  const skills = readSkills();
  for (const destination of SKILL_DESTINATIONS) {
    const dir = join(root, destination);
    mkdirSync(dir, { recursive: true });
    for (const skill of skills) {
      const into = join(dir, skill.name);
      // Replace rather than merge: a stale file left behind from an older
      // version of a skill is a instruction nobody meant to give.
      if (existsSync(into)) rmSync(into, { recursive: true, force: true });
      cpSync(join(SKILLS_DIR, skill.name), into, { recursive: true });
    }
    process.stdout.write(
      `${skills.length} skills → ${relative(root, dir) || destination}\n`,
    );
  }
  process.stdout.write(
    "\nEvery one of them ends in `graview check` and reports what it actually said.\n",
  );
} else {
  process.stdout.write(USAGE);
  process.exit(command === "help" ? 0 : 1);
}
