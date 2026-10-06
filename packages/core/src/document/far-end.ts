/*
 * WHERE AN ACT'S SUBJECT STANDS ON A RELATION (FR-115).
 *
 * A relation is declared on the kind it goes from: `owns` on person, to
 * component. An act on a person that `connects: "owns"` makes a link from
 * its subject; an act on a component that says the same makes one TO its
 * subject, from the person it is given — the far end is read off the
 * declaration, as a TypeScript mutation's `connects` is. What a
 * `setsOther` sets and what a `replaces` severs are at the other end.
 */

type Kinds = Readonly<Record<string, { readonly edges?: Readonly<Record<string, { readonly to: readonly string[] | "*" }>> }>>;

export interface FarEnd {
  /** True when the subject is the end the relation goes TO: the link is made from the other record. */
  readonly reversed: boolean;
  /** The kinds at the other end from the subject, or any kind. */
  readonly kinds: readonly string[] | "*";
}

/** Where a subject of these kinds stands on a relation, and the kinds at its other end; undefined when no kind declares it. */
export function farEnd(kinds: Kinds, relation: string, subject: readonly string[]): FarEnd | undefined {
  const sources = Object.keys(kinds).filter((kind) => kinds[kind]!.edges?.[relation] !== undefined);
  if (sources.length === 0) return undefined;
  const tos = sources.map((kind) => kinds[kind]!.edges![relation]!.to);
  const targets: readonly string[] | "*" = tos.some((to) => to === "*") ? "*" : [...new Set(tos.flatMap((to) => to as readonly string[]))];
  if (subject.length === 0 || subject.some((kind) => sources.includes(kind))) return { reversed: false, kinds: targets };
  const toward = sources.filter((kind) => {
    const to = kinds[kind]!.edges![relation]!.to;
    return to === "*" || subject.every((s) => to.includes(s));
  });
  return toward.length > 0 ? { reversed: true, kinds: toward } : { reversed: false, kinds: targets };
}
