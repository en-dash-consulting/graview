import type { GraviewDocument } from "./document/schema.js";

/**
 * WHAT AN ASK NEEDS THE APP TO HAVE, AND THE SMALLEST CHANGE THAT GIVES IT
 * (Roadmap f-menu-type-anything). "Assign all these to Nick" on tasks that
 * have nobody to give them to: the model names the need — a link from a
 * task to a person, called "assigned to"; or a field — and code writes the
 * least the app needs to finish the ask, in the edit vocabulary
 * (`editDocument`): the kind the link points to where the app has none, the
 * link or the field, and the one act that sets it. No rule, no new place,
 * nothing the ask did not need. Each step is said as a thing that will
 * happen, in plain words, from the edits themselves.
 *
 * Pure and small: a page fetches it with the inline AI (`@graview/core/catalog`)
 * and a host's conformance check (`@graview/core/conformance`) uses it too.
 */

/** A link from each record of a kind to a record of another (made where the app has none), or a field on each. */
export type PlanNeed =
  | { readonly link: { readonly on: string; readonly called: string; readonly to: string } }
  | { readonly field: { readonly on: string; readonly called: string; readonly type?: "string" | "number" | "date" | "boolean" } };

/** The smallest change, its steps in words, and what the records that finish the ask will call. */
export interface PlannedEdits {
  readonly edits: readonly Readonly<Record<string, unknown>>[];
  /** What each edit does, as the plan says it: "Add a People list." */
  readonly steps: readonly string[];
  /** The kind the need is on. */
  readonly on: string;
  /** For a link: the relation, the kind it points to (new or the app's), and whether that kind is new. */
  readonly relation?: string;
  readonly to?: string;
  readonly made?: boolean;
  /** For a field: its name. */
  readonly field?: string;
  /** The act that sets it, by name, and its argument for the value (a link's other end, or the field's value). */
  readonly act: string;
  readonly arg: string;
  /** The act that makes one of `to`, where the change adds the kind. */
  readonly makes?: string;
  /** How the need is said in the plan's own steps: "Assigned to". */
  readonly called: string;
}

const lower = (words: string) => words.trim().toLowerCase();
const capital = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);
const vowel = (word: string) => /^(?:[aeio]|u(?![sn]i|se|ser))/i.test(word);
const an = (word: string) => `${vowel(word) ? "an" : "a"} ${word}`;
const camel = (words: string) => lower(words).replace(/[^a-z0-9]+([a-z0-9])/g, (_, letter: string) => letter.toUpperCase()).replace(/[^A-Za-z0-9]/g, "");
const kebab = (words: string) => lower(words).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const PEOPLE = new Set(["person", "people", "someone", "somebody", "user", "users", "member", "members"]);

/** A kind of the document named by a word: its name, noun or plural, in any case. */
function kindNamed(document: GraviewDocument, word: string): string | undefined {
  const said = lower(word);
  return Object.entries(document.kinds).find(([name, spec]) => [name, spec.noun, spec.plural].some((one) => one !== undefined && lower(one) === said))?.[0];
}

/** A free name: `wanted`, else with a number after it. */
function free(taken: (name: string) => boolean, wanted: string): string {
  if (!taken(wanted)) return wanted;
  for (let n = 2; ; n++) if (!taken(`${wanted}${n}`)) return `${wanted}${n}`;
}

/** The smallest change to `document` that meets `need`, or why none can. */
export function planEdits(document: GraviewDocument, need: PlanNeed): PlannedEdits | { readonly refused: string } {
  const acts = document.acts ?? {};
  const actTaken = (name: string) => name in acts;
  if ("link" in need) {
    const on = kindNamed(document, need.link.on);
    if (!on) return { refused: `This app has no ${need.link.on} to give it to.` };
    const spec = document.kinds[on]!;
    const noun = lower(spec.noun ?? on);
    const called = lower(need.link.called) || "linked to";
    // The kind it names, else — for a person — the kind that is the app's people, by its flag or its words.
    let to =
      kindNamed(document, need.link.to) ??
      (PEOPLE.has(lower(need.link.to))
        ? (Object.entries(document.kinds).find(([, one]) => (one as { people?: boolean }).people) ?? Object.entries(document.kinds).find(([name, one]) => [name, one.noun, one.plural].some((word) => word !== undefined && PEOPLE.has(lower(word)))))?.[0]
        : undefined);
    const edits: Record<string, unknown>[] = [];
    const steps: string[] = [];
    let makes: string | undefined;
    const made = to === undefined;
    if (!to) {
      const word = lower(need.link.to) || "person";
      const person = PEOPLE.has(word);
      const kindNoun = person ? "person" : word.replace(/s$/, "");
      const kindPlural = person ? "people" : `${kindNoun}s`;
      to = free((name) => name in document.kinds, kebab(kindNoun));
      // The kind brings its own "add" act (`add-<kind>`), as every kind added by an edit does.
      edits.push({ op: "add-kind", kind: to, noun: kindNoun, plural: kindPlural, fields: { name: { type: "string", required: true } }, label: "{name}" });
      makes = free(actTaken, `add-${to}`);
      steps.push(`Add ${an(capital(kindPlural))} list.`);
    }
    const toSpec = (to in document.kinds ? document.kinds[to] : (edits[0] as { noun: string })) as { noun?: string };
    const toNoun = lower(toSpec.noun ?? to);
    const relation = free((name) => name in (spec.edges ?? {}) || name in (spec.fields ?? {}), camel(called) || "linkedTo");
    // Said as the person said it, so the record says the link in their words, not its name.
    edits.push({ op: "add-relation", kind: on, relation, to: [to], cardinality: "one", description: capital(called) });
    const act = free(actTaken, `set-${kebab(called)}`);
    edits.push({ op: "add-act", act, title: `Set “${capital(called)}”`, on, connects: relation, description: `Say who ${an(noun)} is ${called}.` });
    steps.push(`Give each ${noun} ${vowel(called) ? "an" : "a"} “${capital(called)}” field that points to ${an(toNoun)}.`);
    return { edits, steps, on, relation, to, made, act, arg: "to", ...(makes ? { makes } : {}), called };
  }
  const on = kindNamed(document, need.field.on);
  if (!on) return { refused: `This app has no ${need.field.on} to give it to.` };
  const spec = document.kinds[on]!;
  const noun = lower(spec.noun ?? on);
  const called = lower(need.field.called) || "note";
  const type = need.field.type ?? "string";
  const field = free((name) => name in (spec.fields ?? {}) || name in (spec.edges ?? {}), camel(called) || "note");
  const act = free(actTaken, `set-${kebab(called)}`);
  return {
    edits: [
      { op: "add-field", kind: on, field, spec: { type } },
      { op: "add-act", act, title: `Set “${capital(called)}”`, on, args: { value: { type, required: true } }, sets: { [field]: "$value" }, description: `Say ${an(noun)}'s ${called}.` },
    ],
    steps: [`Give each ${noun} ${vowel(called) ? "an" : "a"} “${capital(called)}” field.`],
    on,
    field,
    act,
    arg: "value",
    called,
  };
}
