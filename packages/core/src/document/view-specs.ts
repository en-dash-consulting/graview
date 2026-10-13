import type { AnySchema } from "../schema/schema.js";
import { isLongText } from "../schema/define-node.js";
import { fieldSpecOf } from "./field-spec.js";
import type { Finding } from "./findings.js";
import { blockLenses, holdsFiles, own, subjectless, validateAll, type KindNames, type Vocabulary } from "./views.js";

/*
 * A DECLARATION'S VIEW SPECS, CHECKED (FR-03): what `graview check` asks of
 * a TypeScript app's `viewSpecs`, `home` and blocks lenses, against the
 * vocabulary a document's `views` is held to. Apart from `views.ts`, which
 * a hosted page compiling a document carries up front: a page never checks
 * a declaration, and this reads each field as the document would say it.
 */

type DeclaredKind = { readonly fields?: { readonly shape?: Readonly<Record<string, unknown>> }; readonly edges?: Readonly<Record<string, { readonly to?: readonly string[] | "*" }>>; readonly figure?: string; readonly computed?: Readonly<Record<string, unknown>> };

/**
 * Findings about a declaration's view specs (FR-03), each at
 * `viewSpecs.<kind>.<slot>.<block>`: the vocabulary a document's `views`
 * is held to, read against the declared schema — its fields, its relations,
 * and its figures (the kind's own, or the brand's). With `home`, the
 * declaration's home view at `home.<block>`; with `lenses`, the blocks of
 * each lens drawn from blocks at `lenses.<i>.options.blocks` (FR-81).
 */
export function validateViewSpecs(
  schema: AnySchema,
  specs: unknown,
  options: {
    readonly figures?: Readonly<Record<string, string>>;
    readonly at?: string;
    readonly home?: unknown;
    readonly lenses?: unknown;
  } = {},
): Finding[] {
  const declared = schema.kinds as readonly string[];
  const kinds = new Set(declared);
  const definitionOf = (kind: string) => schema.tryDefinition(kind) as DeclaredKind | undefined;
  const edges = new Set(declared.flatMap((kind) => Object.keys(definitionOf(kind)?.edges ?? {})));
  const namesOf = (kind: string): KindNames | undefined => {
    if (!kinds.has(kind)) return undefined;
    const definition = definitionOf(kind);
    const fields = definition?.fields?.shape ?? {};
    const relations = definition?.edges ?? {};
    const computed = definition?.computed ?? {};
    return {
      field: (n) => n !== "id" && n !== "kind" && (own(fields, n) || own(computed, n)),
      relation: (n) => own(relations, n),
      figure: definition?.figure !== undefined || options.figures?.[kind] !== undefined,
      files: (n) => own(fields, n) && holdsFiles(fieldSpecOf(fields[n])),
      choices: (n) => {
        if (!own(fields, n)) return undefined;
        const spec = fieldSpecOf(fields[n]);
        return spec?.type === "enum" ? spec.options : undefined;
      },
      targets: (n) => (own(relations, n) ? relations[n]!.to : undefined),
      // Prose: a string declared to hold more than 500 characters, as a record's page reads it (`isLongText`).
      prose: (n) => own(fields, n) && isLongText(definition as never, n, undefined),
    };
  };
  const vocabulary: Vocabulary = { namesOf, sources: (edge) => declared.filter((kind) => own(definitionOf(kind)?.edges, edge)) };
  const findings = validateAll(specs, options.at ?? "viewSpecs", namesOf, kinds, edges, "app", vocabulary);
  if (options.home !== undefined) subjectless(options.home, "home", vocabulary, kinds, edges, findings, "the home");
  blockLenses(options.lenses, vocabulary, kinds, edges, findings);
  return findings;
}
