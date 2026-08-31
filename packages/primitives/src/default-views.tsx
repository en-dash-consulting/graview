import { describeNode, labelOf, type AnySchema, type KindOfSchema } from "@graview/core";
import { createViews, type ReactViewRegistry, type ViewProps } from "@graview/react";
import { Connections } from "./connections.js";
import { EditableTitle, Fields } from "./editable.js";
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

/**
 * The field a shortened label was shortened FROM, when there is one.
 *
 * Matched by stem rather than by name, because which field a label came from
 * is the app's business — `label: (node) => summarise(node.text)` names no
 * field the framework can see, and asking every app to declare it would be
 * asking them to repeat themselves.
 */
function longFormOf(
  node: Record<string, unknown>,
  short: string,
): string | undefined {
  if (!short.endsWith("…") && !short.endsWith("...")) return undefined;
  const stem = short.replace(/[…]|\.\.\.$/g, "").trim();
  if (stem.length < 12) return undefined;
  for (const value of Object.values(node)) {
    if (typeof value !== "string") continue;
    if (value.length > stem.length && value.startsWith(stem)) return value;
  }
  return undefined;
}

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
      /*
       * On a page, the heading is the WHOLE thing.
       *
       * A kind whose label is its own prose shortened — a rationale, a note, a
       * reason — gets a heading cut at sixty characters, which is right on a
       * card in the scene and wrong on a page that has room for all of it.
       * Shortening then ALSO listing the full text below is worse again: the
       * same sentence twice, one of them mutilated.
       *
       * So the page looks for the long form of its own heading and uses that,
       * and `Fields` then drops it as already said. The abbreviation was for
       * the card.
       */
      const short = labelOf(definition, node);
      const heading =
        props.mode === "fullscreen" ? (longFormOf(node, short) ?? short) : short;
      return (
        <Panel
          // The name is the rename control. Nothing else on the page repeats
          // it, so the thing you click to change it is the thing itself.
          title={<EditableTitle<S> nodeId={node.id}>{heading}</EditableTitle>}
          /*
           * What THIS node is, when the declaration can say — and only the
           * kind's own description as a fallback.
           *
           * A subtitle that is the kind's description is identical on every
           * node of that kind, which makes it furniture rather than
           * information: it tells you what a rationale is, on a page you
           * reached by choosing one particular rationale.
           */
          subtitle={
            // `describeNode` falls back to "<kind> <label>", which would put
            // the heading back under the heading — so only take it when the
            // declaration actually supplied one.
            definition?.describe
              ? describeNode(definition, node)
              : (definition?.description ?? String(kind))
          }
          selected={props.selected}
          // Something broken is marked WHERE IT IS. A violation implicating
          // two people has to show on those people, not only in a list
          // somebody has to go and open.
          {...(props.flagged?.includes(node.id) ? { tone: "warning" as const } : {})}
          // A card in the scene; a document on a page. Same component, and the
          // only difference is which of those two things it is sitting on.
          variant={props.mode === "fullscreen" ? "page" : "card"}
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
            {/*
              * Every value is editable where a mutation writes it, and
              * visibly read-only where none does. Reading a node closely is
              * when you most want to change it, and the alternative was
              * finding a named mutation in the strip and answering its
              * arguments in a form.
              */}
            <Fields<S>
              id={node.id}
              // What the panel already said: its title and its subtitle. A
              // record repeating its own heading is what made this read as a
              // debug dump rather than as a page about something.
              shown={[heading, short, definition?.description]}
            />
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
      /*
       * A kind the focus does not touch is QUIETER, not hidden.
       *
       * The layout already draws it smaller and further back; this is the
       * other half of the same reading, so the card does not look like a
       * full-size one that merely shrank. It stays a real card with a real
       * name — a secondary relation is still somewhere you can go.
       */
      const secondary = props.rank === "secondary" && !accent;
      const nested = props.nestedUnder !== undefined;
      return (
        <div
          className="graview-kind-card"
          data-graview-rank={props.rank}
          data-graview-nested={nested || undefined}
          // Tucked behind its parent there is no room for the description, so
          // it moves to the tooltip rather than being lost.
          {...(nested && definition?.description ? { title: definition.description } : {})}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: nested ? 1 : 4,
            padding: nested ? "6px 7px" : "10px 11px",
            boxSizing: "border-box",
            borderRadius: 10,
            border: accent
              ? "1px solid var(--graview-accent)"
              : `1px solid hsl(${Math.round(hue * 360)} 55% var(--graview-tint-lightness) / 0.34)`,
            // The kind you are looking at is brighter and lit, not labelled:
            // a ninety-pixel card has no room for a word that says so.
            background: accent
              ? `hsl(${Math.round(hue * 360)} 55% var(--graview-tint-lightness) / calc(var(--graview-tint-alpha) * 1.1)), var(--graview-panel)`
              : `hsl(${Math.round(hue * 360)} 55% var(--graview-tint-lightness) / calc(var(--graview-tint-alpha) * ${
                  secondary ? 0.28 : 0.5
                }))`,
            boxShadow: accent ? "0 0 0 1px var(--graview-accent-dim)" : undefined,
          }}
        >
          {/* Title on its own line, marks on the next. Nothing shares a line
              with anything that could grow, so nothing can ever collide —
              which is what a single flex row of title, badge, warning and
              count did at ninety pixels wide. */}
          <span
            style={{
              fontSize: nested ? 10.5 : 13,
              lineHeight: 1.25,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              overflowWrap: "anywhere",
              color: accent ? "var(--graview-accent)" : "var(--graview-ink-muted)",
            }}
          >
            {props.label ?? plural}
          </span>

          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5 }}>
            <span
              style={{
                fontVariantNumeric: "tabular-nums",
                color: trouble ? "var(--graview-warn)" : "var(--graview-ink-faint)",
              }}
            >
              {trouble ? "⚠ " : ""}
              {members.length}
            </span>
            {/*
              * Whether this kind has a picture of its own to go into.
              * Derived: a view the app registered rather than the generic one
              * the framework fell back to.
              */}
            {props.hasOwnView ? (
              <span
                title={`${plural} has a view of its own`}
                aria-label="has its own view"
                style={{ fontSize: 9.5, color: "var(--graview-accent)" }}
              >
                ◆
              </span>
            ) : null}
          </div>

          {/* The description is what a full-size card has room for. A nested
              one is a corner peeking out from behind its parent; its name and
              its count are the whole of what fits, and the title attribute
              still carries the rest. */}
          {definition?.description && !nested ? (
            <span
              className="graview-kind-note"
              title={definition.description}
              style={{
                fontSize: 11.5,
                lineHeight: 1.45,
                color: "var(--graview-ink-muted)",
                /*
                 * Clamped to the card rather than overflowing it.
                 *
                 * A kind's description is a sentence and a kind card is
                 * ninety pixels tall, so a long one spilled five pixels past
                 * the card's edge — small, and the sort of thing that reads
                 * as a rendering error rather than as a long sentence. The
                 * whole of it stays in the tooltip.
                 */
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 3,
                overflow: "hidden",
              }}
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
