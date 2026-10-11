import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { diagnose, doctor, lockedVersions } from "../../src/cli/doctor.js";
import { FORMAT_VERSION } from "../../src/document/schema.js";

/**
 * ONE RELEASE IS NAMED FIVE TIMES IN A PRODUCT, and n-dx's face met each
 * drifting apart by what broke: a pin of 0.1.19 beside 0.1.20, a lockfile
 * that kept the old one, a document of a format the installed core could
 * not read, and react 19.2.8 beside react-dom 19.3.0 — a blank page, since
 * React 19.3 refuses a mismatched pair at startup. `graview doctor` says
 * each as a sentence with its fix, and exits 1 on any.
 */
const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function product(files: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), "graview-doctor-"));
  made.push(dir);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), typeof content === "string" ? content : JSON.stringify(content));
  }
  return dir;
}
const installed = (name: string, version: string) => ({ [`node_modules/${name}/package.json`]: { name, version } });
const problems = (dir: string) => diagnose(dir).filter((finding) => finding.level === "problem");

const ONE = {
  "package.json": { dependencies: { "@graview/core": "0.1.20", "@graview/pages": "0.1.20", react: "19.3.0", "react-dom": "19.3.0" }, devDependencies: { graview: "0.1.20" } },
  ...installed("@graview/core", "0.1.20"),
  "node_modules/@graview/core/dist/document/schema.js": `export const FORMAT_VERSION = ${FORMAT_VERSION};\n`,
  ...installed("@graview/pages", "0.1.20"),
  ...installed("graview", "0.1.20"),
  ...installed("react", "19.3.0"),
  ...installed("react-dom", "19.3.0"),
  "pnpm-lock.yaml": "packages:\n\n  '@graview/core@0.1.20':\n    resolution: {}\n\n  '@graview/pages@0.1.20(react@19.3.0)':\n    resolution: {}\n\n  graview@0.1.20:\n    resolution: {}\n",
  "app.graview.json": { format: "graview-document", formatVersion: FORMAT_VERSION, name: "A", kinds: {} },
};

describe("graview doctor", () => {
  it("finds nothing to fix in a product on one release, with its document and React's pair", () => {
    const dir = product(ONE);
    expect(problems(dir)).toEqual([]);
    const said = diagnose(dir).map((finding) => finding.says);
    expect(said).toContain("package.json pins 3 Graview packages to 0.1.20.");
    expect(said).toContain(`app.graview.json is format version ${FORMAT_VERSION}, which the installed @graview/core 0.1.20 reads.`);
    expect(said).toContain("react and react-dom are both 19.3.0.");
  });

  it("says two releases in package.json, by version and package, and to pin them to the one most of them name", () => {
    const dir = product({ ...ONE, "package.json": { dependencies: { "@graview/core": "0.1.20", "@graview/pages": "0.1.20", "@graview/ship": "0.1.19" }, devDependencies: { graview: "0.1.20" } } });
    const [first] = problems(dir);
    expect(first?.says).toBe("package.json names 2 Graview releases: 0.1.20 (@graview/core, @graview/pages and graview); 0.1.19 (@graview/ship).");
    expect(first?.fix).toBe("Every @graview/* package and graview are one release: pin them all to 0.1.20 and run pnpm install.");
  });

  it("says an install that does not follow the pin, and a lockfile that holds a second copy", () => {
    const dir = product({
      ...ONE,
      ...installed("@graview/pages", "0.1.19"),
      "pnpm-lock.yaml": "packages:\n\n  '@graview/core@0.1.20':\n    resolution: {}\n\n  '@graview/pages@0.1.19':\n    resolution: {}\n\n  graview@0.1.20:\n    resolution: {}\n",
    });
    const said = problems(dir).map((finding) => finding.says);
    expect(said).toContain("package.json pins @graview/pages 0.1.20, and 0.1.19 is installed.");
    expect(said).toContain("node_modules holds 2 Graview releases: 0.1.20 (@graview/core and graview); 0.1.19 (@graview/pages).");
    expect(said).toContain("pnpm-lock.yaml resolves @graview/pages to 0.1.19, and package.json pins 0.1.20.");
    expect(said).toContain("pnpm-lock.yaml holds 2 Graview releases (0.1.19, 0.1.20): a second copy of a package is installed beside the first.");
  });

  it("says a document written for a newer format than the installed core reads", () => {
    const dir = product({ ...ONE, "app.graview.json": { format: "graview-document", formatVersion: FORMAT_VERSION + 1, name: "A", kinds: {} } });
    expect(problems(dir).map((finding) => finding.says)).toEqual([`app.graview.json is format version ${FORMAT_VERSION + 1}, and the installed @graview/core 0.1.20 reads up to ${FORMAT_VERSION}.`]);
  });

  it("says a react beside a react-dom of another version, which React refuses at startup, and the pair to pin", () => {
    const dir = product({ ...ONE, ...installed("react", "19.2.8") });
    const [problem] = problems(dir);
    expect(problem?.says).toBe("react 19.2.8 is installed beside react-dom 19.3.0: React refuses a mismatched pair at startup, and the page is blank.");
    expect(problem?.fix).toBe('Pin both to one version ("react": "19.3.0", "react-dom": "19.3.0") and run pnpm install.');
  });

  it("reads npm's and yarn's lockfiles as well as pnpm's", () => {
    const npm = product({ "package-lock.json": { packages: { "node_modules/@graview/core": { version: "0.1.20" }, "node_modules/graview": { version: "0.1.19" }, "node_modules/react": { version: "19.3.0" } } } });
    expect(Object.fromEntries([...lockedVersions(join(npm, "package-lock.json"))].map(([name, set]) => [name, [...set]]))).toEqual({ "@graview/core": ["0.1.20"], graview: ["0.1.19"] });
    const yarn = product({ "yarn.lock": '"@graview/core@npm:0.1.20":\n  version: 0.1.20\n\n"react@npm:19.3.0":\n  version: 19.3.0\n' });
    expect(Object.fromEntries([...lockedVersions(join(yarn, "yarn.lock"))].map(([name, set]) => [name, [...set]]))).toEqual({ "@graview/core": ["0.1.20"] });
  });

  it("exits 1 on a problem and 0 without one, saying each finding as a line", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => (written.push(String(chunk)), true));
    expect(doctor([product(ONE)])).toBe(0);
    expect(written.join("")).toContain("graview doctor: one release, nothing to fix.");
    expect(doctor([product({ ...ONE, ...installed("react", "19.2.8") })])).toBe(1);
    expect(written.join("")).toContain("✗ react 19.2.8 is installed beside react-dom 19.3.0");
  });
});
