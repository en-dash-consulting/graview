import { documentOf } from "../../document/to-document.js";
import type { AnySchema } from "../../schema/schema.js";
import type { CheckContext, Finding } from "./context.js";

/**
 * A DESCRIBE WRITTEN IN CODE THAT RETURNS A TEMPLATE (carried from the
 * twelfth walk). `{startsAt | datetime}` is filled in a document's strings,
 * where the framework reads the template; a `describe` or `label` written
 * in code is a function whose string is shown as it is returned, braces and
 * all. The function cannot be run without a record, so its source is read:
 * the text of its string literals (a template literal's `${…}` is code, not
 * text), for `{name}` naming a field, relation or computed value of the
 * kind — or an argument of the act — and for any `{name | filter}`.
 */
export function checkCodeDescribes<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, add } = ctx;
  if (documentOf(app)) return;
  const fieldsOfEvery = new Set<string>();
  for (const kind of app.schema.kinds as readonly string[]) {
    const definition = app.schema.tryDefinition(kind) as KindSource | undefined;
    if (!definition) continue;
    const names = namesOf(definition);
    for (const name of names) fieldsOfEvery.add(name);
    for (const slot of ["describe", "label"] as const) {
      const said = templatesIn(definition[slot], names);
      if (said.length > 0) add(finding(`defineNode("${kind}").${slot}`, said, "node"));
    }
  }
  for (const mutation of ctx.declaredMutations as readonly MutationSource[]) {
    const names = new Set([...fieldsOfEvery, ...Object.keys(mutation.input?.shape ?? {})]);
    const said = templatesIn(mutation.describe, names);
    if (said.length > 0) add(finding(`defineMutation("${mutation.name}").describe`, said, "args"));
  }
}

interface KindSource {
  readonly fields?: { readonly shape?: Record<string, unknown> };
  readonly edges?: Record<string, unknown>;
  readonly computed?: Record<string, unknown>;
  readonly describe?: unknown;
  readonly label?: unknown;
}

interface MutationSource {
  readonly name: string;
  readonly input?: { readonly shape?: Record<string, unknown> };
  readonly describe?: unknown;
}

const namesOf = (definition: KindSource): Set<string> =>
  new Set([...Object.keys(definition.fields?.shape ?? {}), ...Object.keys(definition.edges ?? {}), ...Object.keys(definition.computed ?? {})]);

function finding(where: string, said: readonly string[], value: "node" | "args"): Finding {
  const first = said[0]!.replace(/^\{\s*|\s*(\|[^}]*)?\}$/g, "");
  return {
    severity: "warning",
    code: "describe-template-in-code",
    where,
    message: `${where} returns ${said.map((one) => `"${one}"`).join(", ")}, which a person reads with its braces: a template is filled in only in a document's strings, and a describe written in code is shown as it returns.`,
    fix: `Say the value in code — \`\${${value}.${first}}\` in a template literal, a time with momentAsRead(${value}.${first}), a day with dayAsRead(${value}.${first}) — or declare the kind in a document, whose strings take {field | filter}.`,
  };
}

/** The `{name}` and `{name | filter}` templates in the text of a function's string literals. */
function templatesIn(fn: unknown, names: ReadonlySet<string>): string[] {
  if (typeof fn !== "function") return [];
  const found: string[] = [];
  for (const text of stringTexts(Function.prototype.toString.call(fn))) {
    for (const match of text.matchAll(/\{\s*([A-Za-z_$][\w$]*)\s*(\|\s*[A-Za-z][^{}]*)?\}/g)) {
      if ((match[2] !== undefined || names.has(match[1]!)) && !found.includes(match[0])) found.push(match[0]);
    }
  }
  return found;
}

/**
 * The text of every string literal in a source: '…', "…" and the text parts
 * of `…` (a `${…}` is skipped, nested literals in it read in turn). Comments
 * are skipped; a regular expression literal is not told apart, which costs
 * at most a template read in one.
 */
function stringTexts(source: string): string[] {
  const texts: string[] = [];
  let at = 0;
  const readCode = (until: string | null): void => {
    let depth = 0;
    while (at < source.length) {
      const char = source[at]!;
      if (char === "/" && source[at + 1] === "/") {
        const end = source.indexOf("\n", at);
        at = end < 0 ? source.length : end + 1;
      } else if (char === "/" && source[at + 1] === "*") {
        const end = source.indexOf("*/", at + 2);
        at = end < 0 ? source.length : end + 2;
      } else if (char === '"' || char === "'") {
        texts.push(readQuoted(char));
      } else if (char === "`") {
        readTemplate();
      } else if (char === "{") {
        depth += 1;
        at += 1;
      } else if (char === "}") {
        if (depth === 0 && until === "}") {
          at += 1;
          return;
        }
        depth -= 1;
        at += 1;
      } else at += 1;
    }
  };
  const readQuoted = (quote: string): string => {
    at += 1;
    let text = "";
    while (at < source.length && source[at] !== quote) {
      if (source[at] === "\\") {
        text += source[at + 1] ?? "";
        at += 2;
      } else text += source[at++];
    }
    at += 1;
    return text;
  };
  const readTemplate = (): void => {
    at += 1;
    let text = "";
    while (at < source.length && source[at] !== "`") {
      if (source[at] === "\\") {
        text += source[at + 1] ?? "";
        at += 2;
      } else if (source[at] === "$" && source[at + 1] === "{") {
        texts.push(text);
        text = "";
        at += 2;
        readCode("}");
      } else text += source[at++];
    }
    at += 1;
    texts.push(text);
  };
  readCode(null);
  return texts;
}
