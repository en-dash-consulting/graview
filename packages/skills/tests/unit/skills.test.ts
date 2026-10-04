import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readSkills, SKILLS_DIR, SKILL_DESTINATIONS } from "../../src/index.js";

/** The checker's own source — `check.ts` and its families — so a skill cannot name a finding it never emits. */
const checkDir = resolve(SKILLS_DIR, "../../core/src/cli/check");
const checkSource = [
  readFileSync(resolve(SKILLS_DIR, "../../core/src/cli/check.ts"), "utf8"),
  ...readdirSync(checkDir).map((name) => readFileSync(resolve(checkDir, name), "utf8")),
].join("\n");

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
      "graview-desk",
      "graview-embed",
      "graview-invariant",
      "graview-lens",
      "graview-new-app",
      "graview-node-kind",
      "graview-pages",
      "graview-permissions",
      "graview-port-app",
      "graview-seed",
      "graview-ship",
      "graview-studio",
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

  it("sends a page to the derivation for its act list, not to the mutations", () => {
    /*
     * A design that scans `store.allMutations()` by subject kind gets acts
     * that cannot act — "Take it back" on a record with nothing taken, and a
     * picker with no honest candidates in it. `facts.actions` is the same
     * `AffordanceSet` the scene's strip reads and is the only list that stays
     * right on its own. The skill used to name `store.permits` and stop
     * there, and a design written from it had exactly that defect.
     */
    const pages = skills.find((skill) => skill.name === "graview-pages")!;
    expect(pages.body).toMatch(/facts\.actions|recordFacts\([^)]*\)\.actions/);
    expect(pages.body).toContain("withheld");
    expect(pages.body).toContain("store.permits");
    /*
     * AND SO DOES THE WORKED EXAMPLE IT POINTS AT. The skill said "never
     * your own scan of the mutations" and `apps/seedbed/src/ui/design.tsx`
     * — named in the skill as the design to copy — picked acts by name
     * and asked `store.permits`. A reader copies the example, not the rule.
     */
    for (const example of [...pages.body.matchAll(/apps\/seedbed\/src\/ui\/[\w-]+\.tsx/g)].map((m) => m[0])) {
      const source = readFileSync(resolve(SKILLS_DIR, "../../..", example), "utf8");
      expect(source, `${example} lists acts by name`).not.toMatch(/<Acts[^>]*names=\{\[/);
      expect(source, `${example} asks permission itself`).not.toContain("store.permits(");
      expect(source, `${example} takes its acts from the derivation`).toMatch(/recordFacts\(|kindFacts\(/);
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

  /*
   * A SKILL'S CODE IS CODE.
   *
   * `graview-agent-seat` told an agent to write
   * `expect(byAgent.diff).toEqual(byHand.diff)` — and `ToolResult` is a
   * union, because a refusal is a result, so following the skill verbatim in
   * a TypeScript test does not compile. Same class as W-021: a project that
   * cannot follow its own skill.
   *
   * Reading a property off a union arm is the shape that recurs, so this
   * holds every skill to narrowing a result it has just awaited before it
   * reads through it.
   */
  it("narrows a result before reading through it", () => {
    const awaited = /const (\w+) = await [^;]*\.call\(/g;
    for (const skill of skills) {
      for (const [, name] of skill.body.matchAll(awaited)) {
        const after = skill.body.slice(skill.body.indexOf(`const ${name} = await`));
        const reads = new RegExp(`${name}\\.(?!ok\\b|error\\b)\\w+`).exec(after);
        if (!reads) continue;
        const narrowsAt = after.search(new RegExp(`if \\(!${name}\\.ok\\)`));
        expect(
          narrowsAt >= 0 && narrowsAt < after.indexOf(reads[0]),
          `${skill.name} reads ${reads[0]} without establishing ${name}.ok first`,
        ).toBe(true);
      }
    }
  });

  /*
   * A SWITCH A SKILL NAMES IS A SWITCH THE FRAMEWORK READS.
   *
   * `graview-new-app` told a reader the GPU path was `?renderer=gpu` for a
   * long time after nothing anywhere read `renderer` from a URL — W-030 had
   * taken the same switch out of the walkthrough, and the skill kept it. A
   * URL parameter is prose that can be checked against the code, the way a
   * finding code can, so it is: every `?name=` a skill mentions has to be
   * one the sources ask a `URLSearchParams` for.
   */
  it("names only URL switches the framework reads", () => {
    const packages = resolve(SKILLS_DIR, "../..");
    const read = new Set<string>();
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (entry.name !== "node_modules" && entry.name !== "dist") walk(join(dir, entry.name));
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          for (const match of readFileSync(join(dir, entry.name), "utf8").matchAll(/\.get\("([a-z]+)"\)/g)) {
            read.add(match[1]!);
          }
        }
      }
    };
    for (const name of readdirSync(packages)) {
      if (existsSync(join(packages, name, "src"))) walk(join(packages, name, "src"));
    }
    expect(read.size).toBeGreaterThan(5);
    for (const skill of skills) {
      for (const match of skill.body.matchAll(/\?([a-z]+)=/g)) {
        expect(read, `${skill.name} names "?${match[1]}=" and nothing reads it`).toContain(match[1]!);
      }
    }
  });

  it("points at the worked examples rather than restating them", () => {
    // A skill that copies an example goes stale the moment the example
    // changes, and nothing tells you.
    const pointing = skills.filter((skill) => /apps\/|packages\/[a-z]+\/src\//.test(skill.body));
    expect(pointing.length).toBeGreaterThanOrEqual(3);
    for (const skill of skills) {
      /*
       * NOTHING HERE IS LONG ENOUGH TO BE A COPY OF AN APP.
       *
       * That is the rule; the number is a proxy for it, and the proxy was
       * set when the framework was smaller. One product's thirty-two
       * findings put fourteen new facts into these files — the chain a blank
       * graph walks, the doors a provider declares, where a lens gets its
       * nodes, which role map wins, the plan a model proposes — and the last
       * few were paid for by tightening prose that was carrying meaning.
       * That trade is worth making once or twice and is a bad habit by the
       * fifth time: the skills are the highest-value documentation in the
       * repository, and shaving them to fit a round number is how they stop
       * being read.
       *
       * Raised deliberately rather than removed. `graview-pages` is the
       * largest because it covers three rungs, and at 11k it is still a
       * quarter of the app it describes. When a skill nears the number the
       * answer is a job of its own, not shaving: the embed was one, and is
       * `graview-embed` now.
       */
      expect(skill.body.length, skill.name).toBeLessThan(11_000);
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
        [resolve(SKILLS_DIR, "../../graview/dist/cli.js"), "skills", "install", scratch],
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

  /*
   * AND THIS REPOSITORY'S OWN COPIES ARE CURRENT.
   *
   * The skills are installed here too, because the framework is the first
   * project anybody works in — and the copies drifted: `graview-pages` had
   * never been installed at all, and three others were an edit behind. An
   * agent reading the walkthrough in this checkout was told to follow a skill
   * it could not load. Nothing in a build noticed, because every check was
   * about a scratch directory.
   *
   * Run `pnpm skills` when this fails. It is a copy, not a judgement.
   */
  it("keeps this repository's own installed copies current", () => {
    const root = resolve(SKILLS_DIR, "../../..");
    for (const destination of SKILL_DESTINATIONS) {
      const here = join(root, destination);
      const installed = readdirSync(here).filter((name) => name.startsWith("graview-")).sort();
      expect(installed, `${destination} is missing skills — run pnpm skills`).toEqual(
        skills.map((skill) => skill.name),
      );
      for (const skill of skills) {
        expect(
          readFileSync(join(here, skill.name, "SKILL.md"), "utf8"),
          `${destination}/${skill.name} is out of date — run pnpm skills`,
        ).toBe(readFileSync(join(SKILLS_DIR, skill.name, "SKILL.md"), "utf8"));
      }
    }
  });
});
