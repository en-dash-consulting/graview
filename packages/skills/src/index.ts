import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Where the skill files live, relative to this module.
 *
 * `dist/` sits one level below the package root and `skills/` sits at it, so
 * this resolves the same whether it is running from source or from an
 * installed tarball — both of which ship `skills/`.
 */
export const SKILLS_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "skills",
);

export interface SkillFile {
  readonly name: string;
  readonly description: string;
  readonly path: string;
  readonly body: string;
}

/** Reads the frontmatter a skill is required to carry. */
function frontmatter(text: string): Record<string, string> {
  if (!text.startsWith("---\n")) return {};
  const end = text.indexOf("\n---", 4);
  if (end === -1) return {};
  const fields: Record<string, string> = {};
  for (const line of text.slice(4, end).split("\n")) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    fields[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return fields;
}

/** Every skill this package ships, read from disk. */
export function readSkills(dir: string = SKILLS_DIR): readonly SkillFile[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const path = join(dir, entry.name, "SKILL.md");
      const body = readFileSync(path, "utf8");
      const fields = frontmatter(body);
      return {
        name: fields["name"] ?? entry.name,
        description: fields["description"] ?? "",
        path,
        body,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Where each assistant looks for skills.
 *
 * Both, always. A skill installed for one and not the other is a skill that
 * works until somebody opens the project in the other editor, and finding out
 * that way is worse than not having it.
 */
export const SKILL_DESTINATIONS = [".claude/skills", ".agents/skills"] as const;
