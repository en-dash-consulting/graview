import { labelOf, type AnySchema, type KindOfSchema } from "@graview/core";
import { createViews, type ReactViewRegistry, type ViewProps } from "@graview/react";
import { Connections } from "./connections.js";
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
      const fields = salientFields(node, 8);
      return (
        <Panel
          title={labelOf(definition, node)}
          subtitle={definition?.description ?? String(kind)}
          selected={props.selected}
          // Something broken is marked WHERE IT IS. A violation implicating
          // two people has to show on those people, not only in a list
          // somebody has to go and open.
          {...(props.flagged?.includes(node.id) ? { tone: "warning" as const } : {})}
          fit
        >
          {/*
            * Fields and relationships side by side, both filling the panel.
            *
            * A focused node used to be a short column of raw fields in the
            * corner of a very large white box, which read as an empty page
            * with a debug dump in it. What the panel is FOR is the answer to
            * "what is this and what is it caught up in" — so the graph gets
            * equal billing with the record.
            */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(200px, 1fr) minmax(220px, 1.4fr)",
              gap: "22px 34px",
              alignItems: "start",
            }}
          >
            <dl
              style={{
                margin: 0,
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "4px 14px",
                fontSize: 13,
              }}
            >
              {fields.map((field) => (
                <div key={field.key} style={{ display: "contents" }}>
                  <dt style={{ color: "var(--graview-ink-faint)" }}>{field.key}</dt>
                  <dd style={{ margin: 0 }}>{field.value}</dd>
                </div>
              ))}
            </dl>
            <Connections
              id={node.id}
              empty={`Nothing is connected to this ${String(kind)} yet.`}
            />
          </div>
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
        <Panel
          title={labelOf(definition, node)}
          selected={props.selected}
          tone={props.flagged?.includes(node.id) ? "warning" : "muted"}
          fit
        >
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
      const broken = props.flagged?.includes(node.id) ?? false;
      return (
        <Chip
          label={broken ? `${labelOf(definition, node)} ⚠` : labelOf(definition, node)}
          hue={hue}
          selected={props.selected}
          title={broken ? `${String(kind)} — implicated in a problem` : String(kind)}
        />
      );
    };

    const Group = (props: ViewProps<S>) => (
      <Aggregate
        label={props.label ?? plural}
        count={props.nodes?.length ?? 0}
        // A receded group still has to report trouble inside it, or the only
        // way to find a problem is to open every group in turn.
        flagged={(props.nodes ?? []).some((member) => props.flagged?.includes(member.id))}
        items={(props.nodes ?? []).map((member) => ({
          id: member.id,
          label: labelOf(schema.tryDefinition(member.kind), member as never),
          hue: hueFor(member.kind),
        }))}
      />
    );

    /**
     * A group at glyph fidelity.
     *
     * It names its MEMBERS, not just how many there are. "4 AGREEMENTS" tells
     * you a number and nothing you wanted to know; the whole point of a
     * context plane is to be glanceable, and a count is not a glance at
     * anything. What fits, fits; the rest is "+n".
     */
    /**
     * A group at glyph fidelity — the card the kinds plane is made of.
     *
     * Its name, how many there are, and what it is FOR on hover. The members
     * used to be listed and it was the wrong answer: ten cards each showing
     * three truncated names is ten unreadable things, and "which kinds exist
     * and how big are they" is the question a map of kinds is asked. The
     * description has been on every declaration since the first commit and
     * nothing has ever shown it.
     */
    const GroupGlyph = (props: ViewProps<S>) => {
      const members = props.nodes ?? [];
      const trouble = members.some((member) => props.flagged?.includes(member.id));
      const accent = props.focused || props.raised;
      return (
        <div
          className="graview-kind-card"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 3,
            padding: "8px 9px",
            boxSizing: "border-box",
            borderRadius: 10,
            border: accent
              ? "1px solid var(--graview-accent)"
              : `1px solid hsl(${Math.round(hue * 360)} 55% var(--graview-tint-lightness) / 0.34)`,
            background: `hsl(${Math.round(hue * 360)} 55% var(--graview-tint-lightness) / calc(var(--graview-tint-alpha) * 0.5))`,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
            {/* Wraps rather than truncating: "UNAVAILABILITY" on two lines
                is readable and "U…" is not, and at ten kinds across a screen
                there is no width at which every plural fits on one. */}
            <span
              style={{
                fontSize: 10.5,
                lineHeight: 1.25,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                minWidth: 0,
                color: accent ? "var(--graview-accent)" : "var(--graview-ink-muted)",
              }}
            >
              {props.label ?? plural}
            </span>
            {/*
              * Whether this kind has a picture of its own to go into.
              * Derived: a view the app registered rather than the generic one
              * the framework fell back to — so it is true the moment an app
              * writes a lens and false the moment it stops.
              */}
            {props.hasOwnView ? (
              <span
                title={`${plural} has a view of its own — double click to go there`}
                aria-hidden="true"
                style={{ fontSize: 9, color: "var(--graview-accent)", flex: "0 0 auto" }}
              >
                ◆
              </span>
            ) : null}
            <span
              style={{
                marginLeft: "auto",
                flex: "0 0 auto",
                fontSize: 12,
                fontVariantNumeric: "tabular-nums",
                color: trouble ? "var(--graview-warn)" : "var(--graview-ink-faint)",
              }}
            >
              {trouble ? "⚠ " : ""}
              {members.length}
            </span>
          </div>

          {props.focused || props.raised ? (
            <span
              style={{
                fontSize: 9,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--graview-accent)",
              }}
            >
              {props.focused ? "in view" : "raised"}
            </span>
          ) : null}

          {definition?.description ? (
            <span
              className="graview-kind-note"
              style={{ fontSize: 11, lineHeight: 1.4, color: "var(--graview-ink-muted)" }}
            >
              {definition.description}
            </span>
          ) : null}
        </div>
      );
    };

    // Marked so the interface can tell a view the app chose from one the
    // framework fell back to.
    (Group as unknown as { generic?: boolean }).generic = true;
    (GroupGlyph as unknown as { generic?: boolean }).generic = true;

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
