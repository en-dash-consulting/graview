import { humanizeField } from "./define-node.js";
import type { AnyNodeDefinition } from "./types.js";

/**
 * WHAT EACH OPTION OF A KIND'S CHOICES IS CALLED (Roadmap f-option-labels),
 * by kind, field and option: `{ actor: { motive: { "state-sponsored":
 * "State-sponsored" } } }` — the field's `display.format` (a document's
 * `optionLabels`), else the option spoken, as `valueWords` says one. A view
 * somebody else wrote is handed records as they are kept, so it is handed
 * these beside them, to draw an option as every other face says it rather
 * than as its id. On `@graview/core`, apart from `valueWords`: the host
 * that hands a view its props is in a page's first chunk, and
 * `@graview/core/words` is not.
 */
export function choiceWords(
  schema: { tryDefinition(kind: string): AnyNodeDefinition | undefined },
  kinds: Iterable<string>,
): Readonly<Record<string, Readonly<Record<string, Readonly<Record<string, string>>>>>> {
  type Def = { readonly type?: string; readonly innerType?: unknown; readonly entries?: Record<string, unknown> };
  const defOf = (value: unknown): Def | undefined => (value as { _zod?: { def?: Def } } | undefined)?._zod?.def;
  const out: Record<string, Record<string, Record<string, string>>> = {};
  for (const kind of new Set(kinds)) {
    const definition = schema.tryDefinition(kind);
    const shape = (definition?.fields as { shape?: Record<string, unknown> } | undefined)?.shape ?? {};
    for (const [field, value] of Object.entries(shape)) {
      let def = defOf(value);
      for (let depth = 0; depth < 6 && def?.innerType !== undefined && def.type !== "enum"; depth++) def = defOf(def.innerType);
      if (def?.type !== "enum" || !def.entries) continue;
      const format = definition?.display?.format?.[field];
      (out[kind] ??= {})[field] = Object.fromEntries(Object.values(def.entries).map((option) => [String(option), format ? format(option) : humanizeField(String(option))]));
    }
  }
  return out;
}
