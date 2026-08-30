import { labelOf, type AnySchema, type KindOfSchema } from "@graview/core";
import { createViews, type ReactViewRegistry, type ViewProps } from "@graview/react";
import { Aggregate, Chip, Panel, Roster } from "./primitives/index.js";

/**
 * A generic view for every cell of the matrix, derived from the declaration.
 *
 * This is what makes "a new node kind renders acceptably at all three
 * fidelities with zero custom view code" true rather than aspirational: the
 * declaration already carries the label, the plural and the fields, so a
 * sensible rendering exists the moment the kind does. An author overrides
 * only the cells they actually care about.
 */

/** Stable hue per kind, so a kind looks the same everywhere it appears. */
export function hueFor(kind: string): number {
  let h = 2166136261;
  for (let i = 0; i < kind.length; i++) {
    h ^= kind.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 360) / 360;
}

const HIDDEN_FIELDS = new Set(["id", "kind", "label"]);

/** The fields worth showing, in declaration order, scalars only. */
function salientFields(
  node: Record<string, unknown>,
  limit: number,
): { key: string; value: string }[] {
  const fields: { key: string; value: string }[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (HIDDEN_FIELDS.has(key) || value === undefined || value === null) continue;
    if (typeof value === "object" && !Array.isArray(value)) continue;
    fields.push({
      key,
      value: Array.isArray(value) ? value.join(", ") : String(value),
    });
    if (fields.length >= limit) break;
  }
  return fields;
}

export function registerDefaultViews<S extends AnySchema>(
  schema: S,
  registry: ReactViewRegistry<S> = createViews(schema),
): ReactViewRegistry<S> {
  for (const kind of schema.kinds as readonly KindOfSchema<S>[]) {
    const definition = schema.tryDefinition(kind as string);
    const hue = hueFor(kind as string);
    const plural = definition?.plural ?? `${String(kind)}s`;

    const Full = (props: ViewProps<S>) => {
      const node = props.node as (Record<string, unknown> & { id: string; kind: string }) | undefined;
      if (!node) return null;
      const fields = salientFields(node, 6);
      return (
        <Panel
          title={labelOf(definition, node)}
          subtitle={String(kind)}
          selected={props.selected}
        >
          <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 10px", fontSize: 13 }}>
            {fields.map((field) => (
              <div key={field.key} style={{ display: "contents" }}>
                <dt style={{ opacity: 0.6 }}>{field.key}</dt>
                <dd style={{ margin: 0 }}>{field.value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      );
    };

    /**
     * Summary is not "full, but smaller". Receded text must stay LEGIBLE, so
     * this drops to a denser arrangement rather than scaling the same content
     * down into mush — that is the whole reason fidelity is an axis.
     */
    const Summary = (props: ViewProps<S>) => {
      const node = props.node as (Record<string, unknown> & { id: string; kind: string }) | undefined;
      if (!node) return null;
      const fields = salientFields(node, 3);
      return (
        <Panel title={labelOf(definition, node)} selected={props.selected} tone="muted">
          <Roster
            items={fields.map((field) => ({
              id: field.key,
              label: field.value,
              hue,
            }))}
            max={3}
          />
        </Panel>
      );
    };

    const Glyph = (props: ViewProps<S>) => {
      const node = props.node as (Record<string, unknown> & { id: string; kind: string }) | undefined;
      if (!node) return null;
      return <Chip label={labelOf(definition, node)} hue={hue} selected={props.selected} title={String(kind)} />;
    };

    const Group = (props: ViewProps<S>) => (
      <Aggregate
        label={props.label ?? plural}
        count={props.nodes?.length ?? 0}
        items={(props.nodes ?? []).map((member) => ({
          id: member.id,
          label: labelOf(schema.tryDefinition(member.kind), member as never),
          hue: hueFor(member.kind),
        }))}
      />
    );

    const GroupGlyph = (props: ViewProps<S>) => (
      <Chip label={`${props.label ?? plural} (${props.nodes?.length ?? 0})`} hue={hue} />
    );

    registry
      .register(kind, { cardinality: "one", fidelity: "full" }, Full)
      .register(kind, { cardinality: "one", fidelity: "summary" }, Summary)
      .register(kind, { cardinality: "one", fidelity: "glyph" }, Glyph)
      .register(kind, { cardinality: "many", fidelity: "full" }, Group)
      .register(kind, { cardinality: "many", fidelity: "summary" }, Group)
      .register(kind, { cardinality: "many", fidelity: "glyph" }, GroupGlyph);
  }

  return registry;
}
