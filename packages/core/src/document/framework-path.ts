import { derivedActOf } from "../mutations/derived-names.js";
import { documentRelationActOf } from "./relation-acts.js";
import type { GraviewDocument } from "./schema.js";

/*
 * THE CHECKER, SAID IN THE DOCUMENT'S WORDS. `checkApp` locates a finding
 * the way a TypeScript author writes the declaration —
 * `defineMutation("finish").subject.kinds`, `defineInvariant("x").repairs[0]`
 * — and a document's author has no such call to find: they hold
 * `acts.finish.on` and `rules.x.repairs.0`. Every finding on a document is
 * located by its dotted path from the document's root, and its sentence
 * names the same places the same way.
 */

/** A declaration's own key, as the document spells it, under each call. */
const KIND_KEYS: Readonly<Record<string, string | null>> = {
  "display.glance": "glance",
  "display.page": "page",
  display: null,
  plot: null,
  fixed: null,
  requiresInvariant: null,
};
const ACT_KEYS: Readonly<Record<string, string | null>> = { "subject.kinds": "on", "subject.arg": "on", subject: "on", input: "args" };
const RULE_KEYS: Readonly<Record<string, string | null>> = { scope: "over" };
const APP_KEYS: Readonly<Record<string, string | null>> = {};

/** `.edges["holds"]` → `.edges.holds`; `.repairs[0]` → `.repairs.0`. */
const dotted = (rest: string): string =>
  rest
    .replace(/\[\s*"([^"]*)"\s*\]/g, ".$1")
    .replace(/\[(\d+)\]/g, ".$1")
    .replace(/^\./, "");

/** The rest of a call's chain, in the document's keys: the longest key the map renames wins. */
function respelled(rest: string, keys: Readonly<Record<string, string | null>>): string {
  const parts = dotted(rest);
  if (!parts) return "";
  for (const from of Object.keys(keys).sort((a, b) => b.length - a.length)) {
    if (parts === from || parts.startsWith(`${from}.`)) {
      const to = keys[from];
      const tail = parts.slice(from.length).replace(/^\./, "");
      if (to === null) return "";
      return [to, tail].filter(Boolean).join(".");
    }
  }
  return parts;
}

const joined = (...parts: string[]) => parts.filter(Boolean).join(".");

/** Where an act lives: its own entry under `acts`, or — derived (`edit-task`) — the kind it is derived from. */
function actPath(name: string, rest: string, document: GraviewDocument): string {
  if (document.acts?.[name]) return joined(`acts.${name}`, respelled(rest, ACT_KEYS));
  const derived = derivedActOf(name);
  if (derived && document.kinds[derived.kind]) return `kinds.${derived.kind}`;
  // A relation's connect or disconnect lives with the relation it is derived from.
  const relation = documentRelationActOf(name, document.kinds);
  if (relation) return `kinds.${relation.kind}.edges.${relation.relation}`;
  return joined(`acts.${name}`, respelled(rest, ACT_KEYS));
}

/** One call — `defineNode("task").edges["holds"]` — as the document's path to the same place. */
function callPath(call: string, name: string, rest: string, document: GraviewDocument): string {
  switch (call) {
    case "defineNode":
      return joined(`kinds.${name}`, respelled(rest, KIND_KEYS));
    case "defineMutation":
      return actPath(name, rest, document);
    case "defineInvariant":
      return joined(`rules.${name}`, respelled(rest, RULE_KEYS));
    default:
      return respelled(rest, APP_KEYS);
  }
}

const CALL = /(defineNode|defineMutation|defineInvariant|defineApp)\("([^"]+)"\)((?:\.[A-Za-z_$][\w$]*|\[\s*"[^"]*"\s*\]|\[\d+\])*)/g;

/** Map a framework check's "where" back to the document's dotted path from its root. */
export function frameworkPath(where: string, document: GraviewDocument): string {
  const call = new RegExp(CALL.source).exec(where);
  if (call && call.index === 0) return callPath(call[1]!, call[2]!, call[3] ?? "", document);
  // A lens by name: the document holds its lenses in a list.
  const lens = /^lens "([^"]+)"\s*(.*)$/.exec(where);
  if (lens) {
    const index = (document.lenses ?? []).findIndex((l) => (l as { name?: unknown }).name === lens[1]);
    return index >= 0 ? joined(`lenses.${index}`, dotted(lens[2]!.trim())) : "lenses";
  }
  // A setting by name: the document holds its settings in a list.
  const setting = /^settings\["([^"]+)"\](.*)$/.exec(where);
  if (setting) {
    const index = (document.settings ?? []).findIndex((s) => (s as { name?: unknown }).name === setting[1]);
    return index >= 0 ? joined(`settings.${index}`, dotted(setting[2]!)) : "settings";
  }
  // `modules["x"].kinds`, `brand.accents["task"]`, `intelligence["x"].may`.
  if (/^[A-Za-z]+(\.[A-Za-z]+)*\[\s*"/.test(where)) return dotted(where);
  // `views.register("task", ...)`: the kind's views.
  const view = /^views\.register\("([^"]+)"/.exec(where);
  if (view) return `views.${view[1]}`;
  // `policy.grants (mutation "x")`, `x (policy.grants)`, `migrations[1→2]`: the place, without the aside.
  const place = [/^([\w.]+) \(/.exec(where)?.[1], /\(([\w.]+)\)$/.exec(where)?.[1]].find((p) => p !== undefined && /^(policy|people|settings|migrations|brand|pages|lenses|modules)\b/.test(p));
  if (place) return place;
  if (/^migrations\[/.test(where)) return "migrations";
  const word = where.split(/[\s:·]/).find((w) => w.length > 0) ?? where;
  if (document.kinds[word]) return `kinds.${word}`;
  if (document.acts?.[word]) return `acts.${word}`;
  if (document.rules?.[word]) return `rules.${word}`;
  return where;
}

/**
 * A checker's sentence, with every TypeScript call it names respelled as the
 * document's path — "Declare severs on acts.link" rather than "on
 * defineMutation("link")", and "which no kind declares" for "which no
 * defineNode declares".
 */
export function inDocumentText(text: string, document: GraviewDocument): string {
  return text
    .replace(new RegExp(CALL.source, "g"), (_, call: string, name: string, rest: string) => callPath(call, name, rest ?? "", document) || "the document")
    .replace(/\bno defineNode\b/g, "no kind")
    .replace(/\bno defineMutation\b/g, "no act")
    .replace(/\bdefineNode\b/g, "a kind")
    .replace(/\bdefineMutation\b/g, "an act")
    .replace(/\bdefineInvariant\b/g, "a rule");
}
