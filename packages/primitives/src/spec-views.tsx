import { labelOf, type AnyGraphNode, type AnySchema, type GraphReader } from "@graview/core";
import { blockContextFor, blocksName, compileBlocks, isTallBlock, resolveBlocks, whatBlocksSay, type BlockContext, type BlocksSaid, type ResolvedBlock, type ResolvedList, type SpecBlock } from "@graview/core/blocks";
import type { ViewSlot, ViewSpecsByKind } from "@graview/core/document";
import { isDefaultView, useGraph, useGraview, ViewModeProvider, type ReactViewRegistry, type ViewComponent, type ViewProps } from "@graview/react/provider";
import { createContext, Fragment, Suspense, useContext, useRef, useState, type ComponentType, type MouseEvent, type ReactNode } from "react";
import { useEndsAboveItsList } from "./stretched-link.js";
import { DefaultView, useDefaultElsewhere } from "./default-view.js";
import { RecordHeadContext } from "./record-head.js";
import { KindFigure } from "./figure.js";
import { NamedByItsLink, Panel } from "./primitives/index.js";
import { hasShape, TextBody } from "./text-body.js";
import { Files } from "./files-door.js";
import { AppLink } from "./app-link-door.js";
import { LinkedRecordView } from "./linked-record-door.js";

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

/** Past this many characters a headline is a sentence or more, drawn a step smaller and clamped (`[data-long]`). */
const LONG_HEADLINE = 90;
export const SaidAround = createContext<AlreadySaid | null>(null);
const sameWords = (a: string, b: string) => a.trim().toLowerCase().replace(/[_-]+/g, " ") === b.trim().toLowerCase().replace(/[_-]+/g, " ");

/*
 * A FACE CLAIMS A BLOCK BY ITS KEY. A product that draws a few of a view's
 * blocks its own way — a change's rewrites as a timeline, the rest as
 * declared — says which by key, view by view, and the framework draws every
 * other block. A key is the declaration's (`"key": "rewrites"`) or derived
 * from the block's sort and place (`list.2`), never from its words: a title
 * said differently is still the block the face claimed.
 */

/** What a claimed block is drawn with: the block worked out, the record it is about (null on the home), and the framework's own drawing of it, to wrap or leave out. */
export interface BlockSlotProps {
  readonly block: ResolvedBlock;
  readonly node: AnyGraphNode | null;
  readonly drawn: ReactNode;
}
export type BlockSlotComponent = ComponentType<BlockSlotProps>;
/**
 * A face's claims, by view — `"home"`, a kind's `"<kind>.page"`,
 * `"<kind>.card"` or `"<kind>.row"`, or a blocks lens's own address
 * (`"the-offers"`), as `describe_place` names them — and in
 * each, by block key. A component may be `lazy`: the framework's drawing
 * stands in until it arrives.
 */
export type ClaimedSlots = Readonly<Record<string, Readonly<Record<string, BlockSlotComponent>>>>;
export const BlockSlots = createContext<ClaimedSlots | null>(null);

/**
 * THE VIEW BEING DRAWN: its kind's picture, and the blocks a face claims in
 * it. Each view says its own, so a record a list draws inside another view
 * answers to its own view's claims and draws its own picture.
 */
const Drawing = createContext<{ readonly figure?: (() => ReactNode) | undefined; readonly slots?: Readonly<Record<string, BlockSlotComponent>> | undefined; readonly node: AnyGraphNode | null } | null>(null);

function Resolved({ block }: { readonly block: ResolvedBlock }): ReactNode {
  const drawing = useContext(Drawing);
  const Claim = drawing?.slots?.[block.key];
  const drawn = <Drawn block={block} />;
  return Claim ? (
    <Suspense fallback={drawn}>
      <Claim block={block} node={drawing!.node} drawn={drawn} />
    </Suspense>
  ) : (
    drawn
  );
}

function Drawn({ block }: { readonly block: ResolvedBlock }): ReactNode {
  const said = useContext(SaidAround);
  const under = useContext(HeadingsUnder);
  const homeLine = useContext(HomeLine);
  const linked = useContext(NamedByItsLink);
  if (said && block.t === "badge" && said.values.some((value) => sameWords(value, block.text))) return null;
  if (said && block.t === "field" && said.field !== undefined && block.field === said.field) return null;
  // A count of nothing is not a badge: "0 votes" was a pill saying there is nothing to say.
  if (block.t === "badge" && /^0(?:\s+\p{L}+)?$/u.test(block.text.trim())) return null;
  switch (block.t) {
    case "title":
      return (
        <strong className="graview-spec-title" {...(linked !== null && sameWords(linked, block.text) ? { "aria-hidden": true } : {})}>
          {block.text}
        </strong>
      );
    case "text":
      // A value with lines in it keeps them — its paragraphs and lists (FR-146); one line of words stays a line. A Markdown field is drawn as prose (FR-180).
      if (block.markdown || hasShape(block.text)) {
        return (
          <div className="graview-spec-text" {...(block.tone ? { "data-graview-tone": block.tone } : {})}>
            <TextBody text={block.text} markdown={block.markdown} />
          </div>
        );
      }
      // A card's or a row's line of facts with a choice in it: the choices as chips, the rest quiet after them, in the order written.
      if (block.runs) {
        return (
          <p className="graview-spec-text graview-spec-meta" {...(block.tone ? { "data-graview-tone": block.tone } : {})}>
            {block.runs.map((run, at) => (
              <Fragment key={at}>
                {/* A space between two facts, for whoever hears or copies the line; the gap is what is seen. Two runs of words keep their dot, in the words, never a mark of its own. */}
                {at > 0 ? " " : null}
                {run.field !== undefined ? (
                  <span className="graview-spec-chip" data-graview-field={run.field}>
                    {run.text}
                  </span>
                ) : (
                  <span className="graview-spec-meta-words">{at > 0 && block.runs![at - 1]!.field === undefined ? `· ${run.text}` : run.text}</span>
                )}
              </Fragment>
            ))}
          </p>
        );
      }
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
          {/* A value with lines in it keeps them (FR-146): a field block stays one span, its breaks drawn where they stand. */}
          <span className="graview-spec-value" {...(hasShape(block.text) ? { style: { whiteSpace: "pre-line" } } : {})}>
            {block.linked ? (
              // A record in another app (FR-171), named as its home app names it, above the link the whole card is.
              <LinkedRecordView relation={block.linked.relation} refs={block.linked.refs} as="chip" />
            ) : block.app ? (
              // Another app, as the host names it (FR-171), above the link the whole card is.
              <AppLink address={block.app} />
            ) : block.href ? (
              // A web address and a place open in a tab of their own; a phone's tel: link calls.
              <a className="graview-spec-link" href={block.href} {...(block.href.startsWith("tel:") ? {} : { rel: "noopener noreferrer", target: "_blank" })}>
                {block.text}
              </a>
            ) : (
              block.text
            )}
          </span>
        </span>
      );
    case "image":
      // A record's pictures (FR-162): its first, small, or a gallery of each, opening full size.
      return <Files as="block" field={block.field} files={block.files} label={block.label} view={block.as} />;
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
      /* A headline past about 90 characters (a long text bound whole) is drawn a step smaller and clamped: CSS's [data-long]. */
      const Tag = `h${Math.min(6, block.level + under)}` as "h1";
      const heading = (
        <Tag className="graview-spec-headline" data-level={block.level} data-long={block.text.length > LONG_HEADLINE ? "" : undefined}>
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
        <span className="graview-spec-number" {...(block.emphasis ? { "data-emphasis": block.emphasis } : {})}>
          <span className="graview-spec-number-value">{block.text}</span>
          {block.label ? <span className="graview-spec-label">{block.label}</span> : null}
        </span>
      );
    case "list":
      return <SpecList list={block} />;
  }
}

/** The kind's picture, where the view has one to draw. */
function SpecFigure() {
  const figure = useContext(Drawing)?.figure;
  return figure ? (
    <span className="graview-spec-figure" aria-hidden="true">
      {figure()}
    </span>
  ) : null;
}

/**
 * BADGES SIDE BY SIDE. A card's "high", "layout" and "now" each stood on a
 * line of its own, the view being a column: three states read as a list.
 * Badges that follow one another are one run, flowing and wrapping as chips
 * do; a badge alone stands where it is.
 */
function ResolvedBlocks({ blocks }: { readonly blocks: readonly ResolvedBlock[] }): ReactNode {
  const drawn: ReactNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    let end = i;
    while (blocks[end]?.t === "badge" && blocks[end + 1]?.t === "badge") end++;
    if (end === i) {
      drawn.push(<Resolved key={i} block={blocks[i]!} />);
      continue;
    }
    drawn.push(
      <span key={i} className="graview-spec-badges">
        {blocks.slice(i, end + 1).map((block, at) => (
          <Resolved key={at} block={block} />
        ))}
      </span>,
    );
    i = end;
  }
  return drawn;
}

/** Resolved blocks, drawn as `view` — `"home"`, `"<kind>.page"` — whose blocks a face claims by key (`BlockSlots`). */
function Viewed({ blocks, ctx, view }: { readonly blocks: readonly ResolvedBlock[]; readonly ctx: SpecContext; readonly view: string | undefined }): ReactNode {
  const slots = useContext(BlockSlots)?.[view!];
  return (
    <Drawing.Provider value={{ figure: ctx.figure, slots, node: ctx.node }}>
      <ResolvedBlocks blocks={blocks} />
    </Drawing.Provider>
  );
}

/** Blocks, drawn for one record — or for none — as `view`. Pure: everything they read is in `ctx`. */
export function SpecBlocks({ blocks, ctx, view }: { readonly blocks: readonly SpecBlock[]; readonly ctx: SpecContext; readonly view?: string }): ReactNode {
  return <Viewed blocks={resolveBlocks(blocks, ctx)} ctx={ctx} view={view} />;
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
  /**
   * The way to the rest of a list cut short, where the face has somewhere to
   * go ("See all 96 features"): drawn by the face, under the records shown.
   */
  readonly more?: (list: { readonly members: readonly AnyGraphNode[]; readonly total: number }) => ReactNode;
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

/**
 * A PAGE NEVER STACKS TWO HEADINGS. A place's page heads its picture with
 * the place's title and a line under it; a blocks lens that opened with a
 * headline drew a second, larger heading under that one, often saying the
 * count again. The page says the lens's first headline as the line under
 * its title (the place's lede) and tells the lens so (`lede`), and the
 * lens leaves that headline out. Given at all, the lens stands in the
 * page's own column, on the edge the title stands on: no inset of its own.
 */
export const PlacePageHead = createContext<{ readonly lede: boolean } | null>(null);

function Listed({ node, as, depth, said = null }: { readonly node: AnyGraphNode; readonly as: "card" | "row"; readonly depth: number; readonly said?: AlreadySaid | null }) {
  const { store, views } = useGraview();
  const label = labelOf(store.schema.tryDefinition(node.kind), node);
  const View = views.lookup(node.kind as never, { cardinality: "one", fidelity: as === "card" ? "summary" : "glyph" }) as ViewComponent<AnySchema> | undefined;
  /*
   * A ROW IS A LINE OF THE LIST, AS WIDE AS THE LIST. A kind with no row of
   * its own drew the framework's glyph — the scene's chip, capped at 28
   * characters for a band slot — so a list of findings on a page 1440 wide
   * was a column of pills, every name cut at about thirty characters. Here
   * the record's name is the row's, whole, wrapping where it must.
   */
  if (as === "row" && depth <= MAX_LIST_DEPTH && (!View || isDefaultView(View))) {
    return (
      <li className="graview-spec-item" data-graview-listed={node.id} data-as={as}>
        <ListedLink node={node} label={label} />
        <div className="graview-spec graview-spec-row" data-graview-spec="row" data-graview-kind={node.kind} aria-hidden="true">
          <strong className="graview-spec-title">{label}</strong>
        </div>
      </li>
    );
  }
  return (
    <li className="graview-spec-item" data-graview-listed={node.id} data-as={as}>
      {/* The link first: a reader hears the record's name, then what its card says of it. */}
      <ListedLink node={node} label={label} />
      {depth <= MAX_LIST_DEPTH && View ? (
        // A listed card is a card on a page as in the scene: drawn as the scene draws it.
        <ViewModeProvider mode="scene">
          <ListDepth.Provider value={depth}>
            <SaidAround.Provider value={said}>
              <NamedByItsLink.Provider value={label}>
                <View node={node as never} cardinality="one" fidelity={as === "card" ? "summary" : "glyph"} mode="scene" selected={false} />
              </NamedByItsLink.Provider>
            </SaidAround.Provider>
          </ListDepth.Provider>
        </ViewModeProvider>
      ) : (
        <span className="graview-spec-item-name" aria-hidden="true">
          {label}
        </span>
      )}
    </li>
  );
}

/**
 * The whole item is the way to its record: a link stretched over it, under
 * any link the item draws itself. First in the item, so a reader hears the
 * name before the details; raised over the picture drawn after it, and
 * under what is raised after it (a link, a box to choose it).
 */
export function ListedLink({ node, label, describedBy }: { readonly node: AnyGraphNode; readonly label: string; /** What else a reader hears on it: how a board's card moves. */ readonly describedBy?: string }) {
  const links = useContext(SpecLinks);
  const stretched = useRef<HTMLAnchorElement & HTMLButtonElement>(null);
  useEndsAboveItsList(stretched);
  if (links) {
    return (
      <a
        ref={stretched}
        className="graview-spec-item-link"
        href={links.href(node)}
        aria-label={label}
        {...(describedBy ? { "aria-describedby": describedBy } : {})}
        onClick={(event: MouseEvent<HTMLAnchorElement>) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          links.go(node);
        }}
      />
    );
  }
  return <button ref={stretched} type="button" className="graview-spec-item-link" data-graview-pick={node.id} aria-label={label} {...(describedBy ? { "aria-describedby": describedBy } : {})} />;
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
  const links = useContext(SpecLinks);
  /* How many it draws: the first page, and a page more each time "Show N more" is pressed (2026-10-15). */
  const [shown, show] = useState(list.members.length);
  if (list.failed) return <p className="graview-spec-text">—</p>;
  if (list.members.length === 0) return list.empty ? <p className="graview-spec-text graview-spec-empty">{list.empty}</p> : null;
  const listOf = (members: readonly AnyGraphNode[], said: AlreadySaid | null = null) =>
    depth > MAX_LIST_DEPTH ? (
      // Too deep to draw views: the names, each a link.
      <ul className="graview-spec-list" data-as="names">
        {members.map((node) => (
          <li key={node.id} className="graview-spec-item" data-graview-listed={node.id} data-as="name">
            <ListedLink node={node} label={labelOf(store.schema.tryDefinition(node.kind), node)} />
            <span className="graview-spec-item-name" aria-hidden="true">
              {labelOf(store.schema.tryDefinition(node.kind), node)}
            </span>
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
  /*
   * PAST A PAGE, A PAGE MORE AT A TIME. A list held more than it drew, and
   * said "and 58 more" with no way to them; the records past the first page
   * (`rest`) are drawn a page at a time when "Show N more" is pressed.
   */
  const rest = list.rest ?? [];
  const drawnNow = Math.min(shown, list.members.length + rest.length);
  const members = drawnNow > list.members.length ? [...list.members, ...rest].slice(0, drawnNow) : list.members;
  const waiting = list.members.length + rest.length - drawnNow;
  const page = Math.max(1, list.members.length);
  const showMore =
    waiting > 0 ? (
      <p className="graview-spec-text graview-spec-more">
        <button type="button" className="graview-spec-show-more" data-graview-show-more={waiting} onClick={() => show(drawnNow + page)}>
          {`Show ${Math.min(page, waiting)} more`}
        </button>
      </p>
    ) : null;
  // A list cut short says where the rest is, where the face has somewhere to go (`SpecLinkTo.more`); else how many more.
  const total = list.total ?? list.members.length + list.more;
  const beyond = list.more - rest.length;
  const tail =
    showMore ??
    (links?.more && total > members.length ? (
      links.more({ members, total })
    ) : beyond > 0 ? (
      <p className="graview-spec-text graview-spec-more">{`and ${beyond} more`}</p>
    ) : null);
  if (!list.groups) {
    return (
      <div className="graview-spec-listing">
        {listOf(members)}
        {tail}
      </div>
    );
  }
  const Heading = `h${list.headingLevel}` as "h2";
  // Past the first page, the groups over every record listed, cut to as many as are drawn, in their order.
  let left = drawnNow;
  const groups =
    drawnNow > list.members.length && list.everyGroup
      ? list.everyGroup.flatMap((group) => {
          if (left <= 0) return [];
          const some = group.members.slice(0, left);
          left -= some.length;
          return [{ ...group, members: some }];
        })
      : list.groups;
  return (
    <div className="graview-spec-listing">
      {groups.map((group) => (
        <section key={group.value ?? ""} className="graview-spec-list-group" data-graview-group={group.value ?? ""}>
          {/* A group's heading is its name and how many it holds — every one listed, not only the page drawn. */}
          {group.heading ? (
            <Heading className="graview-spec-list-heading">
              {group.heading} <span className="graview-spec-list-count">{(list.everyGroup?.find((every) => every.value === group.value) ?? group).members.length}</span>
            </Heading>
          ) : null}
          {listOf(group.members, group.value !== null ? { values: [group.value, ...(group.heading ? [group.heading] : [])] } : null)}
        </section>
      ))}
      {tail}
    </div>
  );
}

/** Blocks about no one record — the home's body, a blocks lens — drawn under the provider, from the graph its seat may see, as `view`: `"home"`, or a blocks lens's own address. */
export function SpecPlace({ blocks, heading = 2, firstHeading, slot, view = slot }: { readonly blocks: readonly SpecBlock[]; readonly heading?: number; readonly firstHeading?: number; readonly slot: "home" | "place"; readonly view?: string }) {
  const { store, brand } = useGraview();
  useGraph();
  // As `resolveFor` reads them: the store's own day, the brand's money (FR-100), a page's budget — blocks about no record sweep whole kinds.
  const ctx: SpecContext = blockContextFor(store, null, null, { heading, firstHeading, money: brand });
  // The app's line goes under the home's headline when it has one (`HomeLine`), else first.
  const line = useContext(HomeLine);
  // The page above says the first headline as its lede (`PlacePageHead`): drawn once, there.
  const ledeAbove = useContext(PlacePageHead)?.lede === true;
  const drawn = ledeAbove && slot === "place" && blocks[0]?.t === "headline" ? blocks.slice(1) : blocks;
  const headed = drawn.some((block) => block.t === "headline");
  return (
    <div className={`graview-spec graview-spec-${slot}`} data-graview-spec={slot}>
      {line !== null && !headed ? line : null}
      <HomeLine.Provider value={headed ? line : null}>
        <SpecBlocks blocks={drawn} ctx={ctx} view={view} />
      </HomeLine.Provider>
    </div>
  );
}

/** The drawing context for a record's view (its card unless said), from the provider every view is drawn under: what `resolveFor` reads, and the kind's picture. */
export function useSpecContext(node: AnyGraphNode, slot: ViewSlot = "card"): SpecContext {
  const { store, brand } = useGraview();
  const schema = store.schema as AnySchema;
  return {
    ...blockContextFor(store, null, node, { slot, money: brand }),
    figure: () => <KindFigure kind={node.kind} schema={schema} {...(brand ? { brand } : {})} size={22} />,
  };
}

/** One slot of a spec, drawn for one record. */
export function SpecView({ slot, blocks, node, selected }: { readonly slot: ViewSlot; readonly blocks: readonly SpecBlock[]; readonly node: AnyGraphNode; readonly selected?: boolean }) {
  const ctx = useSpecContext(node, slot);
  return (
    <div
      className={`graview-spec graview-spec-${slot}`}
      data-graview-spec={slot}
      data-graview-kind={node.kind}
      // A row that lists records or says a figure is more than one line, and is drawn as a block rather than a pill.
      {...(slot === "row" && blocks.some(isTallBlock) ? { "data-graview-tall": "" } : {})}
      {...(selected ? { "data-selected": "" } : {})}
    >
      <SpecBlocks blocks={blocks} ctx={ctx} view={`${node.kind}.${slot}`} />
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
        <SpecBlocks blocks={titled ? rest : blocks} ctx={ctx} view={`${node.kind}.card`} />
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
  // Drawn once: read under a page's budget, as `resolveFor` and `describe_place` read it.
  const ctx = useSpecContext(node, "page");
  const elsewhere = useDefaultElsewhere();
  const resolved = resolveBlocks(blocks, ctx);
  const said = whatBlocksSay(blocks, resolved);
  // Elsewhere, the record page's own heading is the record's name: a page title saying it again is not drawn under it.
  // Here, the page's title is the record's head (`RecordHeadContext`).
  const titled = said.title !== undefined && (!elsewhere || said.title === labelOf(ctx.schema?.tryDefinition(node.kind), node));
  const body = (
    <div className="graview-spec graview-spec-page" data-graview-spec="page" data-graview-kind={node.kind}>
      <Viewed blocks={titled ? resolved.slice(1) : resolved} ctx={ctx} view={`${node.kind}.page`} />
    </div>
  );
  if (elsewhere) return body;
  return (
    <RecordHeadContext.Provider value={{ nodeId: node.id, ...(said.title !== undefined ? { title: said.title } : {}), body, fields: said.fields, records: said.records }}>
      <DefaultView<S> {...props} />
    </RecordHeadContext.Provider>
  );
}

/** A view that can say, without drawing, what it says about a record: a kind's declared page. */
type SaysWhat = { says?: (node: AnyGraphNode, graph: GraphReader) => BlocksSaid };

/**
 * WHAT A RECORD'S OWN PAGE VIEW ALREADY SAYS (FR-141), for a surface that
 * draws the framework's record under it — the pages face's record page —
 * to leave out the facts and the related records the page said. Nothing
 * for a view that is no declared page.
 */
export function pageSays(view: unknown, node: AnyGraphNode, graph: GraphReader): BlocksSaid | undefined {
  return typeof view === "function" ? (view as SaysWhat).says?.(node, graph) : undefined;
}

/**
 * A row: one line, named for assistive technology by the record's own label —
 * and led by it, drawn, where its blocks name it nowhere (`blocksName`): a row
 * of `{severity} · {status}` alone was a link to a record nobody could tell.
 */
function SpecRow({ blocks, node, selected }: { readonly blocks: readonly SpecBlock[]; readonly node: AnyGraphNode; readonly selected: boolean }) {
  const { store } = useGraview();
  const label = labelOf(store.schema.tryDefinition(node.kind), node);
  const ctx = useSpecContext(node, "row");
  const resolved = resolveBlocks(blocks, ctx);
  const linked = useContext(NamedByItsLink);
  return (
    <div title={label} style={{ minWidth: 0, maxWidth: "100%" }}>
      <div
        className="graview-spec graview-spec-row"
        data-graview-spec="row"
        data-graview-kind={node.kind}
        // A row that lists records or says a figure is more than one line, and is drawn as a block rather than a pill.
        {...(blocks.some(isTallBlock) ? { "data-graview-tall": "" } : {})}
        {...(selected ? { "data-selected": "" } : {})}
      >
        {blocksName(resolved, label) ? null : (
          <strong className="graview-spec-title" data-graview-row-name="" {...(linked !== null && sameWords(linked, label) ? { "aria-hidden": true } : {})}>
            {label}
          </strong>
        )}
        <Viewed blocks={resolved} ctx={ctx} view={`${node.kind}.row`} />
      </div>
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
      // What the row says, so a list that draws it can add the glance's other facts and not repeat its own.
      (Row as SaysWhat).says = (node, graph) => whatBlocksSay(blocks, resolveBlocks(blocks, blockContextFor({ graph, schema }, null, node, { slot: "row" })));
      registry.register(at, { cardinality: "one", fidelity: "glyph" }, Row);
    }
    if (slots.page) {
      const blocks = compileBlocks(slots.page);
      const Page: ViewComponent<S> = (props: ViewProps<S>) => (props.node ? <SpecPage<S> blocks={blocks} props={props} /> : null);
      (Page as SaysWhat).says = (node, graph) => whatBlocksSay(blocks, resolveBlocks(blocks, blockContextFor({ graph, schema }, null, node)));
      registry.register(at, { cardinality: "one", fidelity: "full" }, Page);
    }
  }
  return registry;
}
