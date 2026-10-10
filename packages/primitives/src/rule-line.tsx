import { nounOf, type AnySchema, type Brand, type InvariantDefinition, type RuleLine, type RulePart, type Violation } from "@graview/core";
import { retryingImport } from "@graview/core/retry";
import { lazyModule } from "@graview/react/provider";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { KindFigure } from "./figure.js";
import { VISUALLY_HIDDEN } from "./primitives/measure.js";

/*
 * A RULE, DRAWN AS ITS SHAPE.
 *
 * The kind's mark and name, then what must hold in the declaration's own
 * labels and the symbols a person knows from arithmetic: "◆ Scenario
 * margin ≥ target margin". Broken, the record and its values: "A club on
 * Team — margin 44% < target margin 50%". The symbols are drawn; the words
 * are what a screen reader hears ("margin at least target margin"), so the
 * drawing is hidden from it and the sentence is not.
 *
 * THE WORDS ARE FETCHED WHEN A RULE IS DRAWN (`@graview/core/lines`): a
 * page judges its rules on its first load and says one only where it is
 * shown, so the renderer comes when a problem is drawn, and is asked for
 * again when it did not arrive. Until it does, a problem says its rule's
 * sentence, as it always has.
 */
type Lines = typeof import("@graview/core/lines");
type LineSource = Parameters<Lines["withLines"]>[0];
let made: ReturnType<typeof lazyModule<Lines>> | undefined;
// Made when first asked for, so a page that never draws a rule carries none of this.
const lines = () => (made ??= lazyModule(retryingImport(() => import("@graview/core/lines"))));

/** The words, once they are here; asked for when `wanted`. */
function useLines(wanted: boolean): Lines | undefined {
  const [here, setHere] = useState(() => lines().current);
  useEffect(() => {
    if (!wanted || here) return;
    let live = true;
    lines()
      .load()
      .then(
        (module) => live && setHere(module),
        () => undefined,
      );
    return () => {
      live = false;
    };
  }, [wanted, here]);
  return here;
}

/** The problems, each with its rule's line where the rule has a shape: "A club on Team — margin 44% < target margin 50%". */
export function useLined<V extends Violation>(source: LineSource, violations: readonly V[]): readonly V[] {
  const words = useLines(violations.length > 0);
  return useMemo(() => (words ? words.withLines(source, violations) : violations), [words, source, violations]);
}

/** Each rule's line, by name, for the rules that have a shape; empty until the words are here. */
export function useRuleLines(schema: AnySchema, rules: readonly Pick<InvariantDefinition, "name" | "shape">[]): ReadonlyMap<string, RuleLine> {
  const words = useLines(rules.some((rule) => rule.shape));
  return useMemo(() => {
    const found = new Map<string, RuleLine>();
    if (!words) return found;
    for (const rule of rules) {
      const line = words.ruleLine(rule, schema);
      if (line) found.set(rule.name, line);
    }
    return found;
  }, [words, schema, rules]);
}

/** A problem in one line: the record and the shape it found, else the rule's own sentence. */
export function problemLine(violation: Pick<Violation, "message" | "line">): string {
  const line = violation.line;
  return line ? (line.record !== undefined ? `${line.record} — ${line.text}` : line.text) : violation.message;
}

const PART: Readonly<Record<RulePart["as"], CSSProperties>> = {
  name: {},
  // A symbol stands apart a little, in the ink a label is drawn in: it reads as arithmetic, not as a word.
  op: { color: "var(--graview-ink-muted)", fontWeight: 500 },
  value: { fontWeight: 600, fontVariantNumeric: "tabular-nums" },
  word: { color: "var(--graview-ink-muted)" },
  open: { color: "var(--graview-ink-faint)" },
  close: { color: "var(--graview-ink-faint)" },
};

/** The parts of a line, drawn one by one and spaced as the words are. Hidden from a screen reader: the line says them. */
export function RuleParts({ parts }: { readonly parts: readonly RulePart[] }) {
  return (
    <>
      {parts.map((part, at) => (
        <span key={at}>
          {part.space ? " " : ""}
          <span data-graview-rule-part={part.as} style={PART[part.as]}>
            {part.text}
          </span>
        </span>
      ))}
    </>
  );
}

/** What a kind is called standing alone at the head of a line: "Scenario". */
function kindName(schema: AnySchema | undefined, kind: string): string {
  const noun = nounOf(schema?.tryDefinition(kind), kind);
  return noun.charAt(0).toUpperCase() + noun.slice(1);
}

/**
 * ONE RULE'S LINE. `lead` is what stands before the shape: the kind's mark
 * and name for a rule (`"kind"`), the kind's mark and the record's name for
 * a violation (`"record"`), or nothing where the surface already said it.
 */
export function RuleLineView({
  line,
  schema,
  brand,
  lead = line.record === undefined ? "kind" : "record",
  stacked = false,
  style,
}: {
  readonly line: RuleLine;
  readonly schema?: AnySchema;
  readonly brand?: Brand;
  readonly lead?: "kind" | "record" | "none";
  /** The head on a line of its own, the shape under it: for a narrow list, where one run of words would wrap mid-comparison. */
  readonly stacked?: boolean;
  readonly style?: CSSProperties;
}) {
  const kind = line.kind;
  const head = lead === "kind" ? (kind ? kindName(schema, kind) : undefined) : lead === "record" ? line.record : undefined;
  const spoken = lead === "kind" && head ? `${head}: ${line.said}` : lead === "record" && head ? `${head} — ${line.said}` : line.said;
  return (
    <span data-graview-rule-line="" style={{ overflowWrap: "anywhere", ...style }}>
      <span style={VISUALLY_HIDDEN}>{spoken}</span>
      <span aria-hidden="true">
        {lead !== "none" && kind ? (
          <span style={{ display: "inline-flex", verticalAlign: "-0.1em", marginRight: "0.4em" }}>
            <KindFigure kind={kind} {...(schema ? { schema } : {})} {...(brand ? { brand } : {})} size={13} />
          </span>
        ) : null}
        {head ? (
          <span data-graview-rule-head="" style={{ fontWeight: 600, marginRight: lead === "record" || stacked ? 0 : "0.6em" }}>
            {head}
            {lead === "record" && !stacked ? <span style={{ color: "var(--graview-ink-faint)", fontWeight: 400 }}> — </span> : null}
          </span>
        ) : null}
        {stacked && head ? <br /> : null}
        <RuleParts parts={line.parts} />
        {line.when && line.when.length > 0 ? (
          <span data-graview-rule-when="" style={{ color: "var(--graview-ink-faint)" }}>
            , when <RuleParts parts={line.when} />
          </span>
        ) : null}
      </span>
    </span>
  );
}

/**
 * A PROBLEM'S LINE: the rule's shape with the record's values where the
 * rule has one, else the sentence the rule wrote — and under it, the rule's
 * own title where it says something the line does not.
 */
export function problemTitle(violation: Pick<Violation, "label" | "message" | "line">): string | undefined {
  if (!violation.line) return violation.label && violation.label !== violation.message ? violation.label : undefined;
  return violation.label && violation.label.trim().length > 0 ? violation.label : undefined;
}
