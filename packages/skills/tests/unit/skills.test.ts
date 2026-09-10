import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { readSkills, SKILLS_DIR, SKILL_DESTINATIONS } from "../../src/index.js";

/** The checker's own source, so a skill cannot name a finding it never emits. */
const checkSource = readFileSync(
  resolve(SKILLS_DIR, "../../core/src/cli/check.ts"),
  "utf8",
);

/**
 * The rule these skills exist to keep.
 *
 * A skill that says "you have added a node kind" is worth very little, because
 * the assistant writing that sentence is the one that just decided it was
 * done. Graview can answer the question itself, so every skill here has to end
 * in a real verdict — and has to be honest about the part of its own work the
 * checker cannot see.
 *
 * These are assertions about PROSE, which is unusual. They are here because
 * the failure mode is a skill that quietly stops running the check, and
 * nothing else in a build would notice.
 */
const skills = readSkills();

describe("the skills package", () => {
  it("ships the moves it claims to", () => {
    expect(skills.map((skill) => skill.name)).toEqual([
      "graview-agent-seat",
      "graview-brand",
      "graview-invariant",
      "graview-lens",
      "graview-new-app",
      "graview-node-kind",
      "graview-pages",
      "graview-permissions",
      "graview-port-app",
      "graview-ship",
    ]);
  });

  it("gives every skill the frontmatter an assistant discovers it by", () => {
    for (const skill of skills) {
      expect(skill.name).toMatch(/^graview-[a-z-]+$/);
      // The description is what decides whether a skill is reached for at all.
      expect(skill.description.length).toBeGreaterThan(40);
      expect(skill.description).not.toMatch(/^(Add|Write|Build)\.$/);
    }
  });

  it("ENDS EVERY SKILL IN A CHECK, rather than in a claim", () => {
    for (const skill of skills) {
      expect(skill.body, skill.name).toContain("graview check");
      expect(skill.body, skill.name).toMatch(/## Then find out whether it worked/);
    }
  });

  it("makes every skill say what its check cannot see", () => {
    /*
     * A skill that cannot verify its own outcome says so. The checker measures
     * declarations; it has nothing to say about whether the interface is any
     * good, whether the model is right, or whether the port is worth
     * finishing — and a skill that implies otherwise is teaching an assistant
     * to be overconfident.
     */
    for (const skill of skills) {
      expect(skill.body, skill.name).toMatch(/## What the check cannot see/);
    }
  });

  it("never names a finding code the checker cannot produce", () => {
    /*
     * The load-bearing test in this file.
     *
     * A skill that tells an assistant to look for `lens-role-missing` teaches
     * it to expect something that never arrives, and the assistant then either
     * invents an explanation or reports success. Codes are the one part of
     * these documents that CAN be checked against the code, so they are.
     */
    const real = new Set(
      [...checkSource.matchAll(/code: "([a-z-]+)"/g)].map((match) => match[1]!),
    );
    expect(real.size).toBeGreaterThan(15);
    for (const skill of skills) {
      // Codes appear in prose as `like-this`, which is also how filenames and
      // ordinary hyphenated words appear — so only check the ones that look
      // like codes AND are not obviously something else.
      const mentioned = [...skill.body.matchAll(/`([a-z]+(?:-[a-z]+){2,})`/g)].map(
        (match) => match[1]!,
      );
      for (const code of mentioned) {
        if (!code.includes("-")) continue;
        // A path, a package name or a DOM attribute is not a finding code.
        if (code.includes("/") || code.startsWith("graview-")) continue;
        if (code.startsWith("data-")) continue;
        expect(real, `${skill.name} names "${code}"`).toContain(code);
      }
    }
  });

  it("points at the worked examples rather than restating them", () => {
    // A skill that copies an example goes stale the moment the example
    // changes, and nothing tells you.
    const pointing = skills.filter((skill) => /apps\/|packages\/[a-z]+\/src\//.test(skill.body));
    expect(pointing.length).toBeGreaterThanOrEqual(3);
    for (const skill of skills) {
      // Nothing here should be long enough to be a copy of an app.
      expect(skill.body.length, skill.name).toBeLessThan(9000);
    }
  });
});

describe("installing them", () => {
  it("puts them where BOTH assistants look", () => {
    /*
     * Both, always. A skill installed for one and not the other works until
     * somebody opens the project in the other editor, and finding out that way
     * is worse than not having it.
     */
    const scratch = mkdtempSync(join(tmpdir(), "graview-skills-"));
    try {
      execFileSync(
        process.execPath,
        [resolve(SKILLS_DIR, "../dist/cli.js"), "install", scratch],
        { encoding: "utf8" },
      );
      for (const destination of SKILL_DESTINATIONS) {
        const installed = readdirSync(join(scratch, destination)).sort();
        expect(installed).toEqual(skills.map((skill) => skill.name));
        expect(existsSync(join(scratch, destination, skills[0]!.name, "SKILL.md"))).toBe(true);
      }
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});
