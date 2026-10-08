import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SettingDeclaration } from "../../src/app.js";
import { DocumentSpec, RESPELLED } from "../../src/document/index.js";

/**
 * FR-134. NO KEY A DOCUMENT COULD CARRY IS TAKEN AWAY UNSAID.
 *
 * 0.1.16 renamed a setting's key in passing, and every document written
 * before stopped compiling. `fixtures/document-keys.json` records every key
 * path a document has been able to carry — the closed shape the reader
 * holds (`DocumentSpec`) and a setting's keys, which the document carries
 * as the declaration says them — and the list only grows. A path on it that
 * this build no longer reads fails here, unless RESPELLED (respell.ts) reads
 * it as its new name; a key truly removed is a new format version with an
 * upgrade step (upgrade.ts), and a line here saying so.
 *
 * A key added is not judged: add its path to the list when it ships, so the
 * next rename of it is caught too.
 */
const recorded = JSON.parse(readFileSync(new URL("./fixtures/document-keys.json", import.meta.url), "utf8")) as string[];

type Def = { readonly type: string } & Record<string, unknown>;
const defOf = (schema: unknown): Def | undefined => (schema as { _zod?: { def?: Def } } | undefined)?._zod?.def;

/** Every key path the schema reads: `*` for a record's names, `[]` for a list's items. */
function pathsOf(schema: unknown, at: string, out: Set<string>, seen: Set<unknown>): Set<string> {
  const def = defOf(schema);
  if (!def || seen.has(schema)) return out;
  const inner = new Set(seen).add(schema);
  switch (def.type) {
    case "object":
      for (const [key, value] of Object.entries(def["shape"] as Record<string, unknown>)) {
        const path = at ? `${at}.${key}` : key;
        out.add(path);
        pathsOf(value, path, out, inner);
      }
      break;
    case "record":
      pathsOf(def["valueType"], `${at}.*`, out, inner);
      break;
    case "array":
      pathsOf(def["element"], `${at}[]`, out, inner);
      break;
    case "union":
      for (const option of def["options"] as unknown[]) pathsOf(option, at, out, inner);
      break;
    case "intersection":
      pathsOf(def["left"], at, out, inner);
      pathsOf(def["right"], at, out, inner);
      break;
    case "pipe":
      pathsOf(def["in"], at, out, inner);
      break;
    case "lazy":
      pathsOf((def["getter"] as () => unknown)(), at, out, inner);
      break;
    case "optional":
    case "nullable":
    case "default":
    case "prefault":
    case "readonly":
    case "catch":
    case "nonoptional":
      pathsOf(def["innerType"], at, out, inner);
      break;
  }
  return out;
}

/** A setting's keys as the declaration says them: a key renamed in `SettingDeclaration` fails the typecheck here first. */
const SETTING_KEYS: Readonly<Record<keyof SettingDeclaration, true>> = { name: true, title: true, description: true, honored: true, options: true, initial: true };
const OPTION_KEYS: Readonly<Record<keyof SettingDeclaration["options"][number], true>> = { value: true, label: true };

function readable(): Set<string> {
  const paths = pathsOf(DocumentSpec, "", new Set(), new Set());
  for (const key of Object.keys(SETTING_KEYS)) paths.add(`settings[].${key}`);
  for (const key of Object.keys(OPTION_KEYS)) paths.add(`settings[].options[].${key}`);
  return paths;
}

describe("the keys a document could carry", () => {
  it("are read: the walk finds the shape the reader holds", () => {
    const paths = readable();
    for (const path of ["name", "kinds.*.fields.*.type", "kinds.*.edges.*.cardinality", "rules.*.require", "brand.currency", "pages.scene", "pages.pages", "settings[].honored"]) expect(paths).toContain(path);
  });

  it("are every one still read, as it was spelled or as RESPELLED reads it", () => {
    const paths = readable();
    const respelled = new Map(RESPELLED.map((one) => [`${one.where}.${one.was}`, `${one.where}.${one.now}`]));
    const lost = recorded.filter((path) => !paths.has(path) && !paths.has(respelled.get(path) ?? ""));
    expect(lost, "a key an older document carries is no longer read: add a line to RESPELLED in packages/core/src/document/respell.ts, or move the format with an upgrade step").toEqual([]);
  });

  it("keep the old spelling on the list beside the new", () => {
    expect(recorded).toContain("settings[].honoured");
    expect(recorded).toContain("settings[].honored");
    expect([...recorded].sort()).toEqual(recorded);
    expect(new Set(recorded).size).toBe(recorded.length);
  });
});
