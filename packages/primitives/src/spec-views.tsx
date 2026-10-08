import { labelOf, type AnyGraphNode, type AnySchema, type GraphReader } from "@graview/core";
import { compileBlocks, fieldSpecsOf, isTallBlock, resolveBlocks, whatBlocksSay, type BlockContext, type ResolvedBlock, type ResolvedList, type SpecBlock } from "@graview/core/blocks";
import { shapesOfSchema, type FieldSpec, type KindShape, type ViewSlot, type ViewSpecsByKind } from "@graview/core/document";
import { useGraph, useGraview, ViewModeProvider, type ReactViewRegistry, type ViewComponent, type ViewProps } from "@graview/react/provider";
import { createContext, useContext, type MouseEvent, type ReactNode } from "react";
import { DefaultView, useDefaultElsewhere } from "./default-view.js";
import { RecordHeadContext } from "./record-head.js";
import { KindFigure } from "./figure.js";
import { Panel } from "./primitives/index.js";

/*
 * VIEWS AS DATA, DRAWN (FR-03).
 *
 * A view spec is a short list of blocks from a closed set — title, text,
 * badge, field, progress, group, when, divider, figure, headline, list —
 * bound to the record by templates and conditions in the rule language.
 * This draws them into the framework's own view matrix, so the workbench
 * and the pages face resolve a spec exactly as they resolve a component:
 *
 *   card → one × summary   the card a record stands as beside the focus, and
 *                          a card of the pages face's gallery
 *   row  → one × glyph     the one line a record is drawn as among many: a
 *                          focused group's members, a list page's rows (FR-37)
 *   page → one × full      ABOVE the default record view, which keeps its
 *                          rename, fields and connections; on the pages
 *                          face, above the derived record page
 *
 * WHAT A BLOCK SAYS IS WORKED OUT IN CORE (`resolveBlocks`, FR-89) — the
 * same reading `describePlace` says in words — and only drawn here: a
 * resolved block becomes elements, a resolved list's records become their
 * own cards and rows. Nothing is parsed as markup, nothing is evaluated as
 * script, and the only styling is a fixed set of classes over the theme's
 * own tokens. The one link a view draws is a `url` field's own value, and
 * only when it is http(s).
 */

export { SPEC_VIEW_CSS } from "./spec-css.js";
export { compileBlocks, safeHref, sayNumber, type SpecBlock } from "@graview/core/blocks";

/** Everything a spec reads to draw one record: what core resolves from, and the kind's picture. */
export interface SpecContext extends BlockContext {
  readonly figure?: () => ReactNode;
}

/*
 * WHAT THE SURROUNDINGS ALREADY SAY (FR-117). A card standing in a status
 * board's "Contacted" column wore a "contacted" badge, and a row under a
 * grouped list's "Hard" heading said "hard" again: a state badge is the one
 * pill that earns its place, and repeated where its context already says it
 * it is the pill that teaches a reader to stop reading pills. Whoever draws a
 * record under a heading that names a value says so here; a badge whose
 * words are that value, and a field block of that field, are not drawn.
 * A list inside the card is about other records, so it starts afresh.
 */
export interface AlreadySaid {
  /** The field the context names a value of — a board's column field. */
  readonly field?: string;
  /** The value, and its words as the heading says them. */
  readonly values: readonly string[];
}
export const SaidAround = createContext<AlreadySaid | null>(null);
const sameWords = (a: string, b: string) => a.trim().toLowerCase().replace(/[_-]+/g, " ") === b.trim().toLowerCase().replace(/[_-]+/g, " ");

function Resolved({ block }: { readonly block: ResolvedBlock }): ReactNode {
  const said = useContext(SaidAround);
  const under = useContext(HeadingsUnder);
  const homeLine = useContext(HomeLine);
  if (said && block.t === "badge" && said.values.some((value) => sameWords(value, block.text))) return null;
  if (said && block.t === "field" && said.field !== undefined && block.field === said.field) return null;
  switch (block.t) {
    case "title":
      return <strong className="graview-spec-title">{block.text}</strong>;
    case "text":
      return (
        <p className="graview-spec-text" {...(block.tone ? { "data-graview-tone": block.tone } : {})}>
          {block.text}
        </p>
      );
    case "badge":
      return (
        <span className="graview-spec-badge" data-graview-tone={block.tone}>
          {block.text}
        </span>
      );
    case "field":
      return (
        <span className="graview-spec-field" data-graview-field={block.field}>
          <span className="graview-spec-label">{block.label}</span>
          <span className="graview-spec-value">
            {block.href ? (
              <a className="graview-spec-link" href={block.href} rel="noopener noreferrer" target="_blank">
                {block.text}
              </a>
            ) : (
              block.text
            )}
          </span>
        </span>
      );
    case "progress":
      if (block.value === undefined || block.max === undefined) {
        return (
          <span className="graview-spec-progress">
            <span className="graview-spec-label">{block.label}</span>
            <span className="graview-spec-value">{block.text}</span>
          </span>
        );
      }
      return (
        <span className="graview-spec-progress">
          <span className="graview-spec-label">{block.label}</span>
          <span className="graview-spec-track" role="progressbar" aria-label={block.label} aria-valuemin={0} aria-valuemax={block.max} aria-valuenow={Math.max(0, Math.min(block.value, block.max))} aria-valuetext={block.text}>
            <span className="graview-spec-fill" style={{ width: `${Math.round((Math.max(0, Math.min(block.value, block.max)) / block.max) * 100)}%` }} />
          </span>
          <span className="graview-spec-value">{block.text}</span>
        </span>
      );
    case "group":
      return (
        <span className="graview-spec-group" data-direction={block.direction}>
          <ResolvedBlocks blocks={block.blocks} />
        </span>
      );
    case "when":
      return block.shown ? <ResolvedBlocks blocks={block.blocks} /> : null;
    case "divider":
      return <hr className="graview-spec-divider" />;
    case "figure":
      return <SpecFigure />;
    case "headline": {
      const Tag = `h${Math.min(6, block.level + under)}` as "h1";
      const heading = (
        <Tag className="graview-spec-headline" data-level={block.level}>
          {block.text}
        </Tag>
      );
      // The home's first headline is the page's heading: the app's line follows it.
      return homeLine !== null && block.level === 1 ? (
        <>
          {heading}
          {homeLine}
        </>
      ) : (
        heading
      );
    }
    case "number":
      return (
        <span className="graview-spec-number">
          <span className="graview-spec-number-value">{block.text}</span>
          {block.label ? <span className="graview-spec-label">{block.label}</span> : null}
        </span>
      );
    case "list":
      return <SpecList list={block} />;
  }
}

/** The kind's picture, where the context has one to draw. */
const Figure = createContext<(() => ReactNode) | undefined>(undefined);
function SpecFigure() {
  const figure = useContext(Figure);
  return figure ? (
    <span className="graview-spec-figure" aria-hidden="true">
      {figure()}
    </span>
  ) : null;
}

function ResolvedBlocks({ blocks }: { readonly blocks: readonly ResolvedBlock[] }): ReactNode {
  return blocks.map((block, i) => <Resolved key={i} block={block} />);
}

/** Blocks, drawn for one record — or for none. Pure: everything they read is in `ctx`. */
export function SpecBlocks({ blocks, ctx }: { readonly blocks: readonly SpecBlock[]; readonly ctx: SpecContext }): ReactNode {
  const resolved = resolveBlocks(blocks, ctx);
  return ctx.figure ? <Figure.Provider value={ctx.figure}><ResolvedBlocks blocks={resolved} /></Figure.Provider> : <ResolvedBlocks blocks={resolved} />;
}

// ── figures and lists (FR-81, FR-82) ────────────────────────────────────────

/**
 * HOW DEEP LISTS NEST. A card that lists related records draws each with
 * its own card, which may list its own — and a relation that comes back
 * round (a package's offers' packages' offers…) would draw for ever. Past
 * this depth a list says its records' names, each a link, and draws no
 * view of them; every expression keeps its own step budget besides.
 */
export const MAX_LIST_DEPTH = 3;
const ListDepth = createContext(0);

/**
 * WHERE A LISTED RECORD LEADS. The routed face hands an address and a way
 * to go there; with none — the scene — a record is a `data-graview-pick`
 * target, which the scene routes to that record as it does every view's.
 */
export interface SpecLinkTo {
  readonly href: (node: AnyGraphNode) => string;
  readonly go: (node: AnyGraphNode) => void;
}
export const SpecLinks = createContext<SpecLinkTo | null>(null);

/**
 * HOW MANY LEVELS ABOVE A VIEW'S HEADLINES ARE ALREADY SAID (FR-131): under
 * the app bar, whose name is the page's `h1`, a home's "level 1" headline is
 * said at the level below it. The level the view declares stays on the
 * element (`data-level`), which is what it is drawn by.
 */
export const HeadingsUnder = createContext(0);

/**
 * THE LINE UNDER THE HOME'S HEADING: the app's description, said on the
 * routed face's home (FR-131). Where the declaration writes its home as
 * blocks, the line follows the home's own headline — the page's heading —
 * rather than standing over it as an eyebrow; a home with no headline says
 * it first. Given only where the home is the page.
 */
export const HomeLine = createContext<ReactNode>(null);

/** The steps a list or a figure about no one record may take: it sweeps whole kinds. */
const SWEEP_BUDGET = 5_000;

function Listed({ node, as, depth, said = null }: { readonly node: AnyGraphNode; readonly as: "card" | "row"; readonly depth: number; readonly said?: AlreadySaid | null }) {
  const { store, views } = useGraview();
  const label = labelOf(store.schema.tryDefinition(node.kind), node);
  const View = views.lookup(node.kind as never, { cardinality: "one", fidelity: as === "card" ? "summary" : "glyph" }) as ViewComponent<AnySchema> | undefined;
  return (
    <li className="graview-spec-item" data-graview-listed={node.id} data-as={as}>
      {depth <= MAX_LIST_DEPTH && View ? (
        // A listed card is a card on a page as in the scene: drawn as the scene draws it.
        <ViewModeProvider mode="scene">
          <ListDepth.Provider value={depth}>
            <SaidAround.Provider value={said}>
              <View node={node as never} cardinality="one" fidelity={as === "card" ? "summary" : "glyph"} mode="scene" selected={false} />
            </SaidAround.Provider>
          </ListDepth.Provider>
        </ViewModeProvider>
      ) : (
        <span className="graview-spec-item-name">{label}</span>
      )}
      <ListedLink node={node} label={label} />
    </li>
  );
}

/** The whole item is the way to its record: a link stretched over it, under any link the item draws itself. */
export function ListedLink({ node, label }: { readonly node: AnyGraphNode; readonly label: string }) {
  const links = useContext(SpecLinks);
  if (links) {
    return (
      <a
        className="graview-spec-item-link"
        href={links.href(node)}
        aria-label={label}
        onClick={(event: MouseEvent<HTMLAnchorElement>) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          links.go(node);
        }}
      />
    );
  }
  return <button type="button" className="graview-spec-item-link" data-graview-pick={node.id} aria-label={label} />;
}

/**
 * A LIST OF RECORDS, DRAWN: the records core resolved (`resolveBlocks`) —
 * in their order, a few, under their headings, from the graph the seat may
 * see — each with its own card or row and each a link; past the nesting
 * depth, their names.
 */
function SpecList({ list }: { readonly list: ResolvedList }) {
  const depth = useContext(ListDepth) + 1;
  const { store } = useGraview();
  if (list.failed) return <p className="graview-spec-text">—</p>;
  if (list.members.length === 0) return list.empty ? <p className="graview-spec-text graview-spec-empty">{list.empty}</p> : null;
  const listOf = (members: readonly AnyGraphNode[], said: AlreadySaid | null = null) =>
    depth > MAX_LIST_DEPTH ? (
      // Too deep to draw views: the names, each a link.
      <ul className="graview-spec-list" data-as="names">
        {members.map((node) => (
          <li key={node.id} className="graview-spec-item" data-graview-listed={node.id} data-as="name">
            <span className="graview-spec-item-name">{labelOf(store.schema.tryDefinition(node.kind), node)}</span>
            <ListedLink node={node} label={labelOf(store.schema.tryDefinition(node.kind), node)} />
          </li>
        ))}
      </ul>
    ) : (
      <ul className="graview-spec-list" data-as={list.as}>
        {members.map((node) => (
          <Listed key={node.id} node={node} as={list.as} depth={depth} said={said} />
        ))}
      </ul>
    );
  const tail = list.more > 0 ? <p className="graview-spec-text graview-spec-more">{`and ${list.more} more`}</p> : null;
  if (!list.groups) {
    return (
      <div className="graview-spec-listing">
        {listOf(list.members)}
        {tail}
      </div>
    );
  }
  const Heading = `h${list.headingLevel}` as "h2";
  return (
    <div className="graview-spec-listing">
      {list.groups.map((group) => (
        <section key={group.value ?? ""} className="graview-spec-list-group" data-graview-group={group.value ?? ""}>
          {group.heading ? <Heading className="graview-spec-list-heading">{group.heading}</Heading> : null}
          {listOf(group.members, group.value !== null ? { values: [group.value, ...(group.heading ? [group.heading] : [])] } : null)}
        </section>
      ))}
      {tail}
    </div>
  );
}

/** Blocks about no one record — the home's body, a blocks lens — drawn under the provider, from the graph its seat may see. */
export function SpecPlace({ blocks, heading = 2, firstHeading, slot }: { readonly blocks: readonly SpecBlock[]; readonly heading?: number; readonly firstHeading?: number; readonly slot: "home" | "place" }) {
  const { store, brand } = useGraview();
  useGraph();
  const ctx: SpecContext = {
    node: null,
    graph: store.graph as unknown as GraphReader,
    schema: store.schema as AnySchema,
    kinds: shapesFor(store.schema as AnySchema),
    fields: {},
    today: today(),
    // The app's currency and locale are its brand's (FR-100).
    ...(brand ? { money: brand } : {}),
    heading,
    ...(firstHeading !== undefined ? { firstHeading } : {}),
    budget: SWEEP_BUDGET,
  };
  // The app's line goes under the home's headline when it has one (`HomeLine`), else first.
  const line = useContext(HomeLine);
  const headed = blocks.some((block) => block.t === "headline");
  return (
    <div className={`graview-spec graview-spec-${slot}`} data-graview-spec={slot}>
      {line !== null && !headed ? line : null}
      <HomeLine.Provider value={headed ? line : null}>
        <SpecBlocks blocks={blocks} ctx={ctx} />
      </HomeLine.Provider>
    </div>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

const SHAPES = new WeakMap<object, Map<string, KindShape>>();
const FIELDS = new WeakMap<object, Map<string, Readonly<Record<string, FieldSpec>>>>();

/** What each kind holds, for names and hops: read once per schema. */
function shapesFor(schema: AnySchema): Map<string, KindShape> {
  let shapes = SHAPES.get(schema);
  if (!shapes) SHAPES.set(schema, (shapes = shapesOfSchema(schema)));
  return shapes;
}

/** A kind's fields in the document's words, read once per schema. */
function fieldsFor(schema: AnySchema, kind: string): Readonly<Record<string, FieldSpec>> {
  let byKind = FIELDS.get(schema);
  if (!byKind) FIELDS.set(schema, (byKind = new Map()));
  let fields = byKind.get(kind);
  if (!fields) byKind.set(kind, (fields = fieldSpecsOf(schema, kind)));
  return fields;
}

/** The drawing context for a record, from the provider every view is drawn under. */
export function useSpecContext(node: AnyGraphNode): SpecContext {
  const { store, brand } = useGraview();
  const schema = store.schema as AnySchema;
  const definition = schema.tryDefinition(node.kind) as SpecContext["definition"];
  return {
    node,
    graph: store.graph as unknown as GraphReader,
    schema,
    kinds: shapesFor(schema),
    fields: fieldsFor(schema, node.kind),
    ...(definition ? { definition } : {}),
    today: today(),
    ...(brand ? { money: brand } : {}),
    figure: () => <KindFigure kind={node.kind} schema={schema} {...(brand ? { brand } : {})} size={22} />,
  };
}

/** One slot of a spec, drawn for one record. */
export function SpecView({ slot, blocks, node, selected }: { readonly slot: ViewSlot; readonly blocks: readonly SpecBlock[]; readonly node: AnyGraphNode; readonly selected?: boolean }) {
  const ctx = useSpecContext(node);
  return (
    <div
      className={`graview-spec graview-spec-${slot}`}
      data-graview-spec={slot}
      data-graview-kind={node.kind}
      // A row that lists records or says a figure is more than one line, and is drawn as a block rather than a pill.
      {...(slot === "row" && blocks.some(isTallBlock) ? { "data-graview-tall": "" } : {})}
      {...(selected ? { "data-selected": "" } : {})}
    >
      <SpecBlocks blocks={blocks} ctx={slot === "page" ? { ...ctx, heading: 2 } : ctx} />
    </div>
  );
}

/** A card: the framework's own Panel, so selection, a broken rule and the theme read as they do on a default card. */
function SpecCard({ blocks, node, selected, flagged }: { readonly blocks: readonly SpecBlock[]; readonly node: AnyGraphNode; readonly selected: boolean; readonly flagged: boolean }) {
  const ctx = useSpecContext(node);
  const [first, ...rest] = blocks;
  const titled = first?.t === "title";
  return (
    <Panel {...(titled ? { title: (resolveBlocks([first], ctx)[0] as { text: string }).text } : {})} selected={selected} tone={flagged ? "warning" : "muted"} fit>
      <div className="graview-spec graview-spec-card" data-graview-spec="card" data-graview-kind={node.kind}>
        <SpecBlocks blocks={titled ? rest : blocks} ctx={ctx} />
      </div>
    </Panel>
  );
}

/**
 * A KIND'S PAGE, AT THE HEAD OF ITS RECORD — DRAWN ONCE (FR-141).
 *
 * The page's blocks were drawn bare above the framework's record, the two
 * in one column the scene centered on a box sized for the record alone: the
 * page spilled out of it, under the app bar where nothing scrolls to it and
 * over the cards beside it, while the record in front said the page's goal
 * and its four topics again. A selected record is one thing now. Where the
 * surface is the framework's own record (the pages face) the page heads it
 * as before; everywhere else the page is handed to the record as its head
 * — its title the frame's, its blocks first — and the record draws only
 * what the page did not say.
 */
function SpecPage<S extends AnySchema>({ blocks, props }: { readonly blocks: readonly SpecBlock[]; readonly props: ViewProps<S> }) {
  const node = props.node as AnyGraphNode;
  const ctx = useSpecContext(node);
  const elsewhere = useDefaultElsewhere();
  if (elsewhere) return <SpecView slot="page" blocks={blocks} node={node} />;
  const resolved = resolveBlocks(blocks, { ...ctx, heading: 2 });
  const said = whatBlocksSay(blocks, resolved);
  const body = (
    <div className="graview-spec graview-spec-page" data-graview-spec="page" data-graview-kind={node.kind}>
      <Figure.Provider value={ctx.figure}>
        <ResolvedBlocks blocks={said.title !== undefined ? resolved.slice(1) : resolved} />
      </Figure.Provider>
    </div>
  );
  return (
    <RecordHeadContext.Provider value={{ nodeId: node.id, ...(said.title !== undefined ? { title: said.title } : {}), body, fields: said.fields, records: said.records }}>
      <DefaultView<S> {...props} />
    </RecordHeadContext.Provider>
  );
}

/** A row: one line, named for assistive technology by the record's own label. */
function SpecRow({ blocks, node, selected }: { readonly blocks: readonly SpecBlock[]; readonly node: AnyGraphNode; readonly selected: boolean }) {
  const { store } = useGraview();
  return (
    <div title={labelOf(store.schema.tryDefinition(node.kind), node)} style={{ minWidth: 0, maxWidth: "100%" }}>
      <SpecView slot="row" blocks={blocks} node={node} selected={selected} />
    </div>
  );
}

/**
 * A kind's specs, registered into the view matrix over whatever is there:
 * `card` at one × summary, `row` at one × glyph, and `page` at one × full,
 * drawn above the framework's own view for that cell. A kind the schema
 * does not declare is skipped — `graview check` says so. Returns the
 * registry, as `register` does.
 */
export function registerViewSpecs<S extends AnySchema>(registry: ReactViewRegistry<S>, schema: S, specs: ViewSpecsByKind | undefined): ReactViewRegistry<S> {
  if (!specs) return registry;
  const declared = new Set(schema.kinds as readonly string[]);
  for (const [kind, slots] of Object.entries(specs)) {
    if (!declared.has(kind) || !slots) continue;
    const at = kind as never;
    if (slots.card) {
      const blocks = compileBlocks(slots.card);
      const Card: ViewComponent<S> = (props: ViewProps<S>) =>
        props.node ? <SpecCard blocks={blocks} node={props.node as AnyGraphNode} selected={props.selected} flagged={props.flagged?.includes(props.node.id) ?? false} /> : null;
      registry.register(at, { cardinality: "one", fidelity: "summary" }, Card);
    }
    if (slots.row) {
      const blocks = compileBlocks(slots.row);
      const Row: ViewComponent<S> = (props: ViewProps<S>) => (props.node ? <SpecRow blocks={blocks} node={props.node as AnyGraphNode} selected={props.selected} /> : null);
      registry.register(at, { cardinality: "one", fidelity: "glyph" }, Row);
    }
    if (slots.page) {
      const blocks = compileBlocks(slots.page);
      const Page: ViewComponent<S> = (props: ViewProps<S>) => (props.node ? <SpecPage<S> blocks={blocks} props={props} /> : null);
      registry.register(at, { cardinality: "one", fidelity: "full" }, Page);
    }
  }
  return registry;
}
