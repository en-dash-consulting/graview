import { LOCAL_LAYERS, pluralLabel } from "@graview/core";
import { KindFigure } from "@graview/primitives/pages";
import {
  humanizeField,
  type AnyNodeDefinition,
  type AnySchema,
  type Brand,
  type Operation,
  type Principal,
  type Store,
  nameOfAuthor,
  orderKinds,
  type PagesArrangement,
} from "@graview/core";
import { excerptOf, readableFields } from "@graview/core/words";
import { Fragment } from "react";


/*
 * A READING COLUMN, ONE SCALE.
 *
 * The scene's chrome is set at 14px because it is chrome; a page is read.
 * Its sizes are the theme's four steps of one scale — a minor third from
 * the reader's own rem (`--graview-text-small`, `-body`, `-heading`,
 * `-title`) — so a reader's larger text moves them all together, an app's
 * own stylesheet can set a step, and no page invents a size between two of
 * them. Headings take the brand's display face and weight from the theme's
 * own heading rule (never a `font` shorthand here, which would beat it).
 */
export const SMALL = "var(--graview-text-small)";
export const BODY = "var(--graview-text-body)";
export const DISPLAY = "var(--graview-font-display, var(--graview-font-body, system-ui))";
export const column: React.CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  // The end clears what stands over the foot: what stands there says its measured height (`--graview-foot-room`), a phone its home bar.
  // The sides are the page's gutter (`--graview-page-gutter`), which a view that bleeds takes back on a phone (`Bleed`).
  padding: "40px var(--graview-page-gutter, 20px) max(96px, calc(var(--graview-foot-room, 0px) + env(safe-area-inset-bottom, 0px)))",
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
/*
 * TWO WIDTHS, ONE FACE. A page that is READ keeps the 760 measure above; a
 * page that is LOOKED AT — the home's gallery, a picture at full width, the
 * shell that frames both — takes the room a desk has. The pictures were the
 * one thing on the face that was the app's own, and at 288 pixels in a 760
 * column they were the smallest thing on it.
 */
export const WIDE = 1160;
export const wide: React.CSSProperties = { ...column, maxWidth: WIDE };
export const h1: React.CSSProperties = {
  margin: 0,
  fontSize: "var(--graview-text-title)",
  lineHeight: 1.2,
  letterSpacing: "-0.012em",
  overflowWrap: "anywhere",
  textWrap: "balance",
};
export const h2: React.CSSProperties = {
  margin: 0,
  fontSize: "var(--graview-text-heading)",
  lineHeight: 1.3,
  textWrap: "balance",
};
export const eyebrow: React.CSSProperties = {
  margin: 0,
  fontSize: SMALL,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--graview-ink-muted)",
};
// The sentence under a title: secondary, at the reading size, in the muted ink.
export const lede: React.CSSProperties = {
  margin: 0,
  fontSize: BODY,
  color: "var(--graview-ink-muted)",
  maxWidth: "60ch",
};
export const quiet: React.CSSProperties = { color: "var(--graview-ink-muted)", fontSize: SMALL };
export const rule: React.CSSProperties = { borderTop: "1px solid var(--graview-edge)", paddingTop: 24 };
/*
 * A link is a target, tall enough for a fingertip without leaving the line:
 * in the accent `graview check` holds to 4.5:1 on the ground ("a link on a
 * page"), the same visited or not, its underline a hairline a little below
 * the words in its own color at half strength.
 */
export const link: React.CSSProperties = {
  color: "var(--graview-accent)",
  textDecorationColor: "color-mix(in srgb, currentColor 50%, transparent)",
  textDecorationThickness: 1,
  textUnderlineOffset: "0.2em",
  display: "inline-flex",
  alignItems: "center",
  // A flex box drops the space between its words and a mark after them: "a list→". The gap is that space, kept.
  columnGap: "0.3em",
  minHeight: 24,
};
/** A link that leads on (`Onward` draws its words and its mark): undecorated itself, its words underlined, the arrow not. */
export const onward: React.CSSProperties = { ...link, textDecoration: "none" };
export { Onward } from "./onward.js";
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

/*
 * A LIST'S ROWS, ONE ANATOMY (a kind's list and the search's hits).
 *
 * A row is its record's name and its glance. The name is the row: reading
 * size, medium weight, two lines at most (the rest on its page, and in its
 * title when it is long), the link stretched over the whole row. The glance
 * is secondary — small, muted, two lines at most — and on a desk stands in a column of its
 * own beside the names, one column for the whole list (a subgrid), so the
 * dates down a list start at one x; where the list is narrower than 36rem
 * it stands under the name. A row is one line or two, never more, so a
 * list keeps two heights. A group's heading is small and semibold, its
 * count beside it, over the rows' own hairline; over the framework's own
 * rows it stays at the top of the scroll on a desk while they pass under
 * it, on the ground the face stands on (a design's rows keep their own).
 */
export const ROWS_CSS = `.graview-list{container-type:inline-size}
.graview-rows{display:grid;grid-template-columns:minmax(0,1fr);column-gap:1.5rem;margin:0;padding:0;list-style:none;border-top:1px solid var(--graview-edge)}
.graview-row{grid-column:1/-1;display:grid;grid-template-columns:subgrid;align-items:baseline;align-content:center;position:relative;box-sizing:border-box;min-height:2.75rem;padding:.5rem 0;border-bottom:1px solid var(--graview-edge);overflow-wrap:anywhere}
.graview-row-title{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;min-height:24px;color:inherit;text-decoration:none;font-size:var(--graview-text-body);font-weight:500;line-height:1.3;text-wrap:pretty;hyphens:manual}
.graview-row-title::after{content:"";position:absolute;inset:0}
.graview-row-title:focus-visible{outline:0}
.graview-row-title:focus-visible::after{outline:2px solid var(--graview-accent);outline-offset:-2px;border-radius:var(--graview-radius-sm)}
.graview-row:hover .graview-row-title{text-decoration:underline 1px color-mix(in srgb,currentColor 50%,transparent);text-underline-offset:.2em}
.graview-row:active .graview-row-title{color:var(--graview-accent)}
.graview-row :is(a,button):not(.graview-row-title){position:relative}
.graview-row-glance,.graview-row>[data-testid=search-why]{font-size:var(--graview-text-small);line-height:1.5;color:var(--graview-ink-muted)}
.graview-row>[data-testid=search-why]{grid-column:1/-1}
.graview-row-glance{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.graview-chip{display:inline-block;padding:0 .5em;border-radius:var(--graview-radius-sm);background:color-mix(in srgb,var(--graview-ink) 7%,transparent);color:var(--graview-ink);font-weight:500;line-height:1.6;white-space:nowrap}
.graview-group-head{display:flex;gap:.5em;align-items:baseline;margin:0;padding:.375rem 0;font-family:var(--graview-font-body);font-size:var(--graview-text-small);font-weight:var(--graview-weight-label);line-height:1.3;letter-spacing:.02em;scroll-margin-top:4rem}
.graview-group-head>span{color:var(--graview-ink-muted);font-weight:var(--graview-weight-body)}
.graview-group-toggle{display:inline-flex;gap:.5em;align-items:center;min-height:2.75rem;margin:-.375rem 0;padding:0 .5rem 0 0;border:0;background:none;color:inherit;font:inherit;letter-spacing:inherit;text-align:start;cursor:pointer;border-radius:var(--graview-radius-sm)}
.graview-group-toggle:focus-visible{outline:2px solid var(--graview-accent);outline-offset:2px}
.graview-group-toggle>span{color:var(--graview-ink-muted);font-weight:var(--graview-weight-body)}
@container (min-width:36rem){.graview-rows{grid-template-columns:minmax(0,1fr) fit-content(40%)}.graview-group-head:has(+.graview-rows){position:sticky;top:0;z-index:${LOCAL_LAYERS.raised};background:var(--graview-ground)}}`;

export const button: React.CSSProperties = {
  font: "inherit",
  fontSize: SMALL,
  padding: "8px 14px",
  borderRadius: "var(--graview-radius-sm, 8px)",
  border: "1px solid var(--graview-edge-bright)",
  background: "var(--graview-panel)",
  color: "var(--graview-ink)",
  cursor: "pointer",
};

/** The kind's own color, as a small mark — the thread the scene wears too. */
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
    return definition?.plural ?? humanizeField(kind);
  });
  return said.length > 0 ? said.join(" and ") : humanizeField(group.edgeKind);
}

/** Words for who did something, from the op's own author. */
/** Who did an op, as the person at the keyboard reads it: "you" only for their own work. */
export function whoDid(
  op: Operation,
  principal?: Principal,
  where?: Parameters<typeof nameOfAuthor>[1],
): string {
  if (op.author.kind === "human" && (op.author.id === undefined || principal?.id === undefined || op.author.id === principal.id)) return "you";
  // By name where the graph or the seats have one — never an id a person was not offered.
  if (where) return nameOfAuthor(op.author, where);
  if (op.author.kind === "agent") return op.author.id ?? "an agent";
  return op.author.id ?? op.author.kind;
}

/** A node's own one-line facts, for a list line or a front-page glance. */
export function glance(
  node: Record<string, unknown>,
  definition: AnyNodeDefinition | undefined,
  said: string,
): string {
  return glanceRuns(node, definition, said).map((run) => run.text).join(" · ");
}

/** One fact of a glance: its words, and its field's key where the field is a choice (drawn as a chip, `Glance`). */
export interface GlanceRun {
  readonly text: string;
  readonly choice?: string;
}

/** A node's glance as its facts, each marked where it is a choice (`isChoice`), in the glance's own order. */
export function glanceRuns(
  node: Record<string, unknown>,
  definition: AnyNodeDefinition | undefined,
  said: string,
  isChoice: (key: string) => boolean = () => false,
): readonly GlanceRun[] {
  // A bare number says nothing on its own — "12 · 8" is not a sentence —
  // so each fact is read the way it stands alone, the same words a card uses.
  return readableFields(node, definition, { limit: 3, said: [said], glance: true })
    // A record's prose is said by its start on a glance — its first paragraph or a line's worth, Markdown's syntax taken out (FR-180) — and whole on its page.
    .map((field) => (field.long ? { text: excerptOf(field.stored, { markdown: field.markdown, most: 100 }) } : isChoice(field.key) ? { text: field.alone, choice: field.key } : { text: field.alone }));
}

/**
 * A GLANCE, DRAWN: its choices as small chips, its other facts quiet words
 * after them, in the order the glance says them — so a status no longer
 * reads like the date beside it. Two facts in words keep the dot between
 * them, in the words; a chip stands a space from what is beside it — never
 * a dot of its own, which a screen reader says as a word.
 */
export function Glance({ runs }: { readonly runs: readonly GlanceRun[] }) {
  return (
    <>
      {runs.map((run, at) => {
        const after = at === 0 ? "" : run.choice === undefined && runs[at - 1]!.choice === undefined ? " · " : " ";
        return (
          <Fragment key={at}>
            {run.choice !== undefined ? (
              <>
                {after}
                <span className="graview-chip" data-graview-field={run.choice}>
                  {run.text}
                </span>
              </>
            ) : (
              `${after}${run.text}`
            )}
          </Fragment>
        );
      })}
    </>
  );
}

/** The plural, as declared. */
/** The plural as a label (`pluralLabel`); a sentence lower-cases it. */
export const pluralOf = <S extends AnySchema>(store: Store<S>, kind: string): string => pluralLabel(store.schema, kind);

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

/**
 * The kinds this face lists, in the declaration's order (FR-80): the kinds
 * `pages.order` names first, the rest as declared.
 */
type Arranged<S extends AnySchema> = { readonly store: Store<S>; readonly principal?: Principal; readonly views?: { arrangement?(): PagesArrangement | undefined } };

export const arrangedKinds = <S extends AnySchema>(context: Arranged<S>): readonly string[] =>
  orderKinds(liveKinds(context.store, context.principal), context.views?.arrangement?.()?.order);

/** The kinds the home shows: arranged, less the ones `pages.hide` leaves off it — which keep their lists, links and search. */
export const homeKinds = <S extends AnySchema>(context: Arranged<S>): readonly string[] => {
  const hidden = new Set(context.views?.arrangement?.()?.hide ?? []);
  return arrangedKinds(context).filter((kind) => !hidden.has(kind));
};

export const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
