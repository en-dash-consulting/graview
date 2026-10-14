import { linkedEdges, parseLinkedTarget, reachesAnotherApp } from "../schema/linked.js";
import { analyzeExpr } from "./expr/analyze.js";
import { parseExpr } from "./expr/parse.js";
import { effectsOf } from "./compile.js";
import { error, type Finding } from "./findings.js";
import type { EdgeSpec, GraviewDocument } from "./schema.js";

/*
 * A RELATION TO ANOTHER APP'S KINDS (FR-171), JUDGED — with the checker
 * (`compileDocument`, `graview check`), not by a page that compiles without
 * it: every sentence here is one a host or an author reads, and a page
 * handed a document carries none of their words. Until judged, a relation
 * that is not one app's kinds is no relation the page links by.
 */

/**
 * Every target names one app's kind (`@nick/house/house`), all of them the
 * same app, none of this document beside them; and nothing of it asks the
 * far app to change — no name from that end, no link kept from being taken
 * back.
 */
function relationFindings(path: string, name: string, kind: string, edge: EdgeSpec): Finding[] {
  const findings: Finding[] = [];
  const targets = edge.to === "*" ? [] : edge.to;
  const far = targets.map((target) => [target, parseLinkedTarget(target)] as const);
  for (const [target, parsed] of far) {
    if (!target.startsWith("@")) findings.push(error("linked-mixed", `${path}.to`, `${kind}'s ${name} goes to "${target}" here and to another app beside it, and a relation goes to one app or the other`, "make two relations, one to each"));
    else if (!parsed) findings.push(error("linked-target", `${path}.to`, `"${target}" does not name a kind in another app`, 'write "@", the app\'s address, "/" and the kind, like "@nick/house/house"'));
  }
  const apps = [...new Set(far.flatMap(([, parsed]) => (parsed ? [parsed.address] : [])))];
  if (apps.length > 1) findings.push(error("linked-apps", `${path}.to`, `${kind}'s ${name} goes to kinds in ${apps.length} apps (${apps.join(", ")}), and a relation reaches one app`, "make a relation for each app"));
  if (edge.inverse) findings.push(error("linked-inverse", `${path}.inverse`, `${kind}'s ${name} links a record in another app, whose declaration this one does not change: it has no name from that end`, "drop inverse; the other app may declare its own relation back"));
  if (edge.appendOnly) findings.push(error("linked-append-only", `${path}.appendOnly`, `${kind}'s ${name} links a record in another app, and is changed like a value rather than appended to`, "drop appendOnly"));
  return findings;
}

/** What a document says of its relations to other apps that it cannot mean: in its relations, its acts and its rules. */
export function linkedFindings(document: GraviewDocument): Finding[] {
  const findings: Finding[] = [];
  const linkedHere = (kind: string, name: string) => linkedEdges(document.kinds[kind]?.edges).has(name);
  const linkedAnywhere = (name: string) => Object.keys(document.kinds).some((kind) => linkedHere(kind, name));
  const local = (name: string) => Object.values(document.kinds).some((spec) => spec.edges?.[name] !== undefined && !reachesAnotherApp(spec.edges[name]!));
  const written = (path: string, kind: string, name: string) => error("act-linked", path, `${kind}'s ${name} links a record in another app, and a declared act does not set it`, `let the derived edit change it ("edit-${kind}"), which picks a record there`);

  for (const [kind, spec] of Object.entries(document.kinds)) {
    for (const [name, edge] of Object.entries(spec.edges ?? {})) if (reachesAnotherApp(edge)) findings.push(...relationFindings(`kinds.${kind}.edges.${name}`, name, kind, edge));
  }

  for (const [name, act] of Object.entries(document.acts ?? {})) {
    const at = `acts.${name}`;
    const subjects = [act.on ?? []].flat();
    if (act.creates && act.on === undefined) for (const field of act.writes ?? []) if (linkedHere(act.creates, field)) findings.push(written(`${at}.writes`, act.creates, field));
    const effects = effectsOf(act, document);
    const shorthands = effects.length - (act.effects?.length ?? 0);
    const created = new Map<string, string>();
    effects.forEach((effect, i) => {
      const where = act.effects && i >= shorthands ? `${at}.effects.${i - shorthands}` : at;
      if ("create" in effect) {
        if (effect.as) created.set(effect.as, effect.create);
      } else if ("connect" in effect || "sever" in effect) {
        const relation = "connect" in effect ? effect.connect : effect.sever;
        if (!local(relation) && linkedAnywhere(relation)) findings.push(error("act-linked", `${where}.${"connect" in effect ? "connect" : "sever"}`, `"${relation}" links a record in another app, which is kept on the record that links it rather than connected`, `let the derived edit change it ("edit-<kind>"), which picks a record there`));
      } else if ("set" in effect) {
        const target = typeof effect.target === "string" ? effect.target.slice(1) : "subject";
        const kinds = target === "subject" ? subjects : created.has(target) ? [created.get(target)!] : [];
        for (const field of Object.keys(effect.set)) for (const kind of kinds) if (linkedHere(kind, field)) findings.push(written(`${where}.set.${field}`, kind, field));
      }
    });
  }

  for (const [name, rule] of Object.entries(document.rules ?? {})) {
    for (const key of ["when", "require"] as const) {
      const source = rule[key];
      if (!source) continue;
      let walked: readonly string[];
      try {
        walked = analyzeExpr(parseExpr(source)).edges;
      } catch {
        continue; // A rule that does not parse is said by the compile.
      }
      for (const relation of walked) if (!local(relation) && linkedAnywhere(relation)) findings.push(error("rule-linked", `rules.${name}.${key}`, `"${relation}" links a record in another app, which out() and in() cannot walk`, `walk it by name: ${relation}.<field>`));
    }
  }
  return findings;
}
