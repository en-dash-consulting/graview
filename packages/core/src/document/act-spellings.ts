import { actSpelledAs, nearestAct } from "../mutations/act-spelling.js";
import { derivedActsOf, relationActsOf } from "../mutations/derived-names.js";
import { documentRelations } from "./relation-acts.js";
import type { GraviewDocument } from "./schema.js";

/*
 * AN ACT A DECLARATION NAMES IN ANOTHER SPELLING IS THAT ACT (Roadmap
 * f-act-spellings-in-declarations). 0.1.48 let a call name
 * `connect-threat-partOf` for `connect-threat-part-of`; a grant or a rule's
 * repair that named it so was still refused by the compile. Read here,
 * before the document's shape is judged, the document is said in its acts'
 * own names — so the policy matches real names at run time, and the log, a
 * refusal and Activity never meet the other spelling.
 */

/** Every act a document gives, by name: those it declares, each kind's derived acts and each relation's. */
export function actsOfDocument(document: Pick<GraviewDocument, "acts" | "kinds">): readonly string[] {
  return [...Object.keys(document.acts ?? {}), ...Object.keys(document.kinds).flatMap((kind) => derivedActsOf(kind)), ...relationActsOf(documentRelations(document.kinds))];
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A document as it came, with every act a grant or a repair names written
 * as the act it spells; a name no act spells stays, to be refused by that
 * name. Anything not shaped as a document is left for the shape to refuse.
 */
export function actsSpelledAsGiven(raw: unknown): unknown {
  if (!isRecord(raw) || !isRecord(raw["kinds"])) return raw;
  let acts: readonly string[];
  try {
    const kinds = Object.fromEntries(Object.entries(raw["kinds"]).map(([kind, spec]) => [kind, isRecord(spec) && isRecord(spec["edges"]) ? { edges: spec["edges"] } : {}]));
    acts = actsOfDocument({ acts: (isRecord(raw["acts"]) ? raw["acts"] : {}) as never, kinds: kinds as never });
  } catch {
    return raw;
  }
  const known = new Set(acts);
  let changed = false;
  const said = (name: unknown): unknown => {
    if (typeof name !== "string" || known.has(name)) return name;
    const real = actSpelledAs(name, acts);
    if (real === undefined) return name;
    changed = true;
    return real;
  };
  const policy = isRecord(raw["policy"]) && Array.isArray(raw["policy"]["grants"]) ? { ...raw["policy"], grants: raw["policy"]["grants"].map((grant: unknown) => (isRecord(grant) && Array.isArray(grant["mutations"]) ? { ...grant, mutations: grant["mutations"].map(said) } : grant)) } : undefined;
  const rules = isRecord(raw["rules"])
    ? Object.fromEntries(Object.entries(raw["rules"]).map(([name, rule]) => [name, isRecord(rule) && Array.isArray(rule["repairs"]) ? { ...rule, repairs: rule["repairs"].map((repair: unknown) => (isRecord(repair) ? { ...repair, act: said(repair["act"]) } : repair)) } : rule]))
    : undefined;
  return changed ? { ...raw, ...(policy ? { policy } : {}), ...(rules ? { rules } : {}) } : raw;
}

/** "Did you mean …?" for an act a declaration names that no act spells, when one is near. */
export function didYouMeanAct(name: string, document: Pick<GraviewDocument, "acts" | "kinds">): string | undefined {
  const near = nearestAct(name, actsOfDocument(document));
  return near && near !== name ? `did you mean "${near}"?` : undefined;
}
