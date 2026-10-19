import { derivedActOf, relationActTitles } from "../mutations/derived-names.js";
import { documentRelationActOf } from "./relation-acts.js";
import { capitalize, listed } from "../capital.js";
import { quoted, quotedAtTheEnd } from "./quote.js";
import type { GraviewDocument } from "./schema.js";

/*
 * WHO MAY DO WHAT AND SEE WHAT, IN THE DECLARATION'S WORDS (FR-170).
 *
 * A grant, a sight and the people kind as a person reads them: a kind by
 * its noun and plural, an act by its title (a derived edit is "Change the
 * participant"), a relation by the name the declaration gives it. What an
 * edit says it did and what the preview of a change says are these same
 * sentences, so the two never tell a person different things.
 */

type Policy = NonNullable<GraviewDocument["policy"]>;
export type GrantWords = Policy["grants"][number];
export type SightWords = NonNullable<Policy["sees"]>[number];
type Kinds = GraviewDocument["kinds"];

const spoken = (name: string) => name.replace(/[A-Z]/g, (c) => ` ${c.toLowerCase()}`).replace(/-/g, " ");
const withA = (noun: string) => `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;

export const nounWords = (kinds: Kinds, kind: string): string => kinds[kind]?.noun ?? spoken(kind);
export function pluralWords(kinds: Kinds, kind: string): string {
  const plural = kinds[kind]?.plural;
  return plural ? plural.charAt(0).toLowerCase() + plural.slice(1) : `${spoken(kind)}s`;
}

/** The one kind whose records are the people who sign in, when exactly one says so. */
export const peopleKinds = (kinds: Kinds): string[] => Object.keys(kinds).filter((kind) => kinds[kind]!.people === true);

/** "everyone", "an organizer", "an organizer or a participant". */
export const whoWords = (roles: readonly string[] | "*"): string => (roles === "*" ? "everyone" : listed(roles.map((role) => withA(spoken(role))), "or"));

/** An act as its button says it: its title, or a derived edit's ("Change the participant"). */
export function actWords(document: GraviewDocument, act: string): string {
  const title = document.acts?.[act]?.title;
  if (title) return quoted(title);
  const derived = derivedActOf(act);
  if (derived && document.kinds[derived.kind]) {
    const noun = nounWords(document.kinds, derived.kind);
    const words = { edit: `Change the ${noun}`, remove: `Remove the ${noun}`, archive: `Archive the ${noun}`, unarchive: `Bring back the ${noun}`, merge: `Merge the ${noun} into another`, "leave-alone": "Leave this one alone", "allow-tidying": "Allow tidying again", skip: "Skip this one", detach: "Change just this one", split: "Change from here" }[derived.act];
    return quoted(words);
  }
  // A relation's connect or disconnect, as its button says it: "Set the day", "Link a traveler".
  const relation = documentRelationActOf(act, document.kinds);
  if (relation) {
    const edges = Object.entries(document.kinds[relation.kind]?.edges ?? {});
    const reaches = (to: readonly string[] | "*") => (to === "*" ? "record" : to.map((target) => nounWords(document.kinds, target)).join(" or "));
    const edge = document.kinds[relation.kind]!.edges![relation.relation]!;
    const to = reaches(edge.to);
    const shared = edges.some(([other, spec]) => other !== relation.relation && reaches(spec.to) === to);
    return quoted(relationActTitles(relation.act, { to, from: nounWords(document.kinds, relation.kind), one: edge.cardinality === "one", also: shared ? spoken(relation.relation).trim() : undefined }).title);
  }
  return quoted(act);
}

/** What a grant lets, without its stop: "a participant may "Change the participant" on participants, only on their own record". */
export function grantBody(document: GraviewDocument, grant: GrantWords): string {
  const acts = grant.mutations === "*" ? "do anything" : listed(grant.mutations.map((act) => actWords(document, act)));
  // A grant naming no kind gives nothing (the policy matches no kind against it), and says so rather than reading as a grant on every kind.
  const kinds = !Array.isArray(grant.kinds) ? "" : grant.kinds.length > 0 ? ` on ${listed(grant.kinds.map((kind) => pluralWords(document.kinds, kind)))}` : " on no kind, so on nothing";
  const person = peopleKinds(document.kinds)[0];
  return `${whoWords(grant.roles)} may ${acts}${kinds}${grant.self ? ", only on their own record" : ""}${grant.ownEnd ? `, only where they are the ${person ? nounWords(document.kinds, person) : "person"} at the other end of the link` : ""}`;
}

/** A grant, said: "Everyone may "Take back a vote", only where they are the member at the other end of the link: "A vote is taken back only by whoever cast it."" */
export const grantSentence = (document: GraviewDocument, grant: GrantWords): string => `${capitalize(grantBody(document, grant))}${grant.describe ? `: ${quotedAtTheEnd(grant.describe)}` : "."}`;

export const grantGone = (document: GraviewDocument, grant: GrantWords): string => `The grant is removed that said ${grantBody(document, grant)}.`;

/** What a sight shows, without who: "matches, only those "givenBy" joins to their own participant". */
export function sightWords(document: GraviewDocument, sight: SightWords): string {
  const person = peopleKinds(document.kinds)[0];
  const fields = (names: readonly string[]) => listed(names.map((field) => spoken(field)));
  return `${listed(sight.kinds.map((kind) => pluralWords(document.kinds, kind)))}${sight.own ? ", only their own" : ""}${sight.via ? `, only those ${quoted(sight.via)} joins to their own ${person ? nounWords(document.kinds, person) : "record"}` : ""}${sight.fields ? `, only their ${fields(sight.fields)}` : ""}${sight.hide?.length ? `, without their ${fields(sight.hide)}` : ""}`;
}

/** A sight, said: "A participant sees matches, only those "givenBy" joins to their own participant." */
export const sightSentence = (document: GraviewDocument, sight: SightWords): string => `${capitalize(whoWords(sight.roles))} sees ${sightWords(document, sight)}.`;

export const sightGone = (document: GraviewDocument, sight: SightWords): string => `The sight is removed that showed ${whoWords(sight.roles)} ${sightWords(document, sight)}.`;

/** The people kind said or unsaid: "Participants are now the people who sign in: a participant whose id is someone's is that person." */
export function peopleSentence(kinds: Kinds, kind: string, people: boolean, already = false): string {
  const plural = capitalize(pluralWords(kinds, kind));
  if (people) return already ? `${plural} are already the people who sign in.` : `${plural} are now the people who sign in: ${withA(nounWords(kinds, kind))} whose id is someone's is that person.`;
  return already ? `${plural} were not the people who sign in.` : `${plural} are no longer the people who sign in.`;
}

/** Whether a kind's records are archived and merged, or only kept and removed (FR-173), as an edit and a preview say it. */
export function archivesSentence(kinds: Kinds, kind: string, archives: boolean, already = false): string {
  const plural = capitalize(pluralWords(kinds, kind));
  const acts = (and: string) => `archive-${kind}, unarchive-${kind} ${and} merge-${kind}`;
  if (archives) return already ? `${plural} can already be archived and merged.` : `${plural} can be archived and merged again: the app offers ${acts("and")}.`;
  return already
    ? `${plural} are already kept or removed, never archived.`
    : `${plural} are kept or removed, never archived: the app no longer offers ${acts("or")}, and ${withA(nounWords(kinds, kind))} archived before is brought back when the change lands.`;
}

/** What the app's own actor may do to a kind, or to one relation of it, on its own, as an edit and a preview say it. */
export function tidyingSentence(kinds: Kinds, kind: string, relation: string | undefined, tidying: "never" | "no-links" | "allowed", already = false): string {
  const plural = capitalize(pluralWords(kinds, kind));
  if (relation !== undefined) {
    const link = `${withA(nounWords(kinds, kind))}'s “${relation}” links`;
    if (tidying === "never") return already ? `${capitalize(link)} were already never made or broken automatically.` : `${capitalize(link)} are never made or broken automatically: tidying may suggest one, and a person decides.`;
    return already ? `${capitalize(link)} could already be tidied.` : `${capitalize(link)} can be tidied again.`;
  }
  if (tidying === "never") return already ? `${plural} were already never tidied.` : `${plural} are never tidied: nothing automated changes them or their links on its own, and tidying may only suggest.`;
  if (tidying === "no-links") return already ? `${plural} were already never linked automatically.` : `${plural} are never linked or unlinked automatically: tidying may change them, and only suggest a link.`;
  return already ? `${plural} could already be tidied.` : `${plural} can be tidied again.`;
}

export const FIRST_GRANT = "The app gets a policy: from now on, only what a grant gives is allowed.";
export const FIRST_SIGHT = "From now on, a kind no sight names is seen by nobody but the system.";
export const NO_GRANT_LEFT = "No grant is left, so nobody but the system may do anything.";
export const NO_SIGHT_LEFT = "With no sight left, everyone sees everything.";
