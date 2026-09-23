import { KindFigure } from "@graview/primitives";
import {
  humaniseField,
  readableFields,
  type AnyNodeDefinition,
  type AnySchema,
  type Brand,
  type Operation,
  type Principal,
  type Store,
} from "@graview/core";


/*
 * A reading column, a real scale. The scene's chrome is set at 14px because
 * it is chrome; a page is read, so it gets the size a page gets. Headings
 * take the brand's display face through the token the theme already sets —
 * as a variable, never a `font` shorthand, which would silently beat it.
 */
export const DISPLAY = "var(--graview-font-display, var(--graview-font-body, system-ui))";
export const column: React.CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  padding: "40px 20px 96px",
  display: "grid",
  /*
   * A TRACK THAT MAY BE NARROWER THAN WHAT IS IN IT.
   *
   * An `auto` track is at least the min-content width of its item, and a
   * grid item's own `min-width: auto` is the same measure — so a section
   * whose min-content the engine puts above the column's width pushes the
   * whole page sideways. The engines do not agree on that measure: at a
   * 32px root on a 390 screen, WebKit and Firefox made the list page's
   * header 388 in a 350 track and the document scrolled two ways, while
   * Chromium fitted it. `minmax(0, 1fr)` says the column is the width it
   * was given, and what is inside it wraps.
   */
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: 40,
};
export const h1: React.CSSProperties = {
  margin: 0,
  fontFamily: DISPLAY,
  fontSize: "clamp(30px, 4.6vw, 40px)",
  lineHeight: 1.12,
  fontWeight: 600,
  letterSpacing: "-0.012em",
  overflowWrap: "anywhere",
};
export const h2: React.CSSProperties = {
  margin: 0,
  fontFamily: DISPLAY,
  fontSize: "1.375rem",
  lineHeight: 1.25,
  fontWeight: 600,
  letterSpacing: "-0.006em",
};
export const eyebrow: React.CSSProperties = {
  margin: 0,
  fontSize: "0.75rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--graview-ink-muted)",
};
export const lede: React.CSSProperties = {
  margin: 0,
  fontSize: "1.125rem",
  lineHeight: 1.5,
  color: "var(--graview-ink-muted)",
  maxWidth: "58ch",
};
export const quiet: React.CSSProperties = { color: "var(--graview-ink-muted)", fontSize: "0.875rem" };
export const rule: React.CSSProperties = { borderTop: "1px solid var(--graview-edge)", paddingTop: 24 };
// A link is a target: tall enough for a fingertip without leaving the line.
export const link: React.CSSProperties = {
  color: "inherit",
  textDecorationColor: "var(--graview-edge-bright)",
  textUnderlineOffset: 3,
  display: "inline-flex",
  alignItems: "center",
  minHeight: 24,
};
/*
 * An UNDERLINED link is a target and an undecorated one is the same target.
 *
 * `link` carried the 24px minimum and `plain` — the same thing without the
 * underline, used on the record page's eyebrow, the list's rows and the
 * masthead — did not, so the framework's own record page had a 19-pixel
 * control on it. One site had already patched the minimum back in by hand,
 * which is the style telling you where it should have lived.
 */
export const plain: React.CSSProperties = {
  color: "inherit",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  minHeight: 24,
};
export const button: React.CSSProperties = {
  font: "inherit",
  fontSize: "0.875rem",
  padding: "8px 14px",
  borderRadius: "var(--graview-radius-sm, 8px)",
  border: "1px solid var(--graview-edge-bright)",
  background: "var(--graview-panel)",
  color: "var(--graview-ink)",
  cursor: "pointer",
};

/** The kind's own colour, as a small mark — the thread the scene wears too. */
/**
 * The mark beside a kind's name — its FIGURE where it has one, and the dot
 * it has always had where it does not.
 *
 * One component in `@graview/primitives`, so the routed face, the scene and
 * the relation key draw the same thing from the same declaration. A second
 * rendering here would be a second place for a kind's picture to be wrong.
 */
export function KindMark({
  kind,
  brand,
  size = 10,
  schema,
}: {
  kind: string;
  brand?: Brand;
  size?: number;
  schema?: AnySchema;
}) {
  // A figure wants more room than a dot: the dot is the figure's own inner
  // circle, so passing the dot's size straight through would draw a stamp.
  return <KindFigure kind={kind} {...(schema ? { schema } : {})} {...(brand ? { brand } : {})} size={Math.round(size * 1.6)} />;
}

/**
 * The kinds on the far end of a connections group, in their own plurals:
 * "Owners" over an item's assignment, "Items" over the owner's.
 */
export function listed<S extends AnySchema>(
  store: Store<S>,
  group: { readonly targets: readonly { readonly kind: string }[]; readonly edgeKind: string },
): string {
  const kinds = [...new Set(group.targets.map((target) => target.kind))];
  const said = kinds.map((kind) => {
    const definition = store.schema.tryDefinition(kind);
    return definition?.plural ?? humaniseField(kind);
  });
  return said.length > 0 ? said.join(" and ") : humaniseField(group.edgeKind);
}

/** Words for who did something, from the op's own author. */
/** Who did an op, as the person at the keyboard reads it: "you" only for their own work. */
export function whoDid(op: Operation, principal?: Principal): string {
  if (op.author.kind === "human") {
    if (op.author.id === undefined || principal?.id === undefined || op.author.id === principal.id) return "you";
    return op.author.id;
  }
  if (op.author.kind === "agent") return op.author.id ?? "an agent";
  return op.author.id ?? op.author.kind;
}

/** A node's own one-line facts, for a list line or a front-page glance. */
export function glance(
  node: Record<string, unknown>,
  definition: AnyNodeDefinition | undefined,
  said: string,
): string {
  const raw = (key: string) => node[key];
  return readableFields(node, definition, { limit: 3, said: [said] })
    .map((field) => {
      // A bare number says nothing on its own — "12 · 8" is not a sentence.
      // The label the declaration already gave it makes it one.
      const value = raw(field.key);
      if (typeof value === "number") return `${field.value} ${field.label.toLowerCase()}`;
      if (typeof value === "boolean") return `${field.label}: ${field.value.toLowerCase()}`;
      return field.value;
    })
    .join(" · ");
}

/** The plural, as declared. */
export const pluralOf = <S extends AnySchema>(store: Store<S>, kind: string): string =>
  store.schema.tryDefinition(kind)?.plural ?? `${kind}s`;

/**
 * The kinds this face lists: not a disabled module's, and not an administered
 * module's unless the seat administers it — a gardener's pages never have a
 * People section, the coordinator's always do.
 */
export const liveKinds = <S extends AnySchema>(store: Store<S>, principal?: Principal): readonly string[] => {
  const kept = store.kindsKeptFrom(principal);
  return (store.schema.kinds as readonly string[]).filter(
    (kind) => !store.modules.disabledKinds.has(kind) && !kept.has(kind),
  );
};

export const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
