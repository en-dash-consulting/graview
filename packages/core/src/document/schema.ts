import * as z from "../schema/zod.js";
import { LINKED_TARGET } from "../schema/linked.js";

/*
 * THE GRAVIEW DECLARATION DOCUMENT, v1 — as data a stranger can hand us.
 *
 * docs/declaration-document.md is the prose; this is the shape. Every key is
 * closed (`strict`): an unknown key is a finding, not something quietly
 * ignored, because a model that misspells `requires` for `require` should be
 * told, not given an app whose rule holds nothing.
 *
 * Written in zod/mini (schema/zod.ts): a hosted page reads a document in the
 * browser, and the shape costs it what it calls, not all of zod (FR-57).
 */

export const FORMAT = "graview-document";
export const FORMAT_VERSION = 1;
export const MAX_DOCUMENT_BYTES = 256 * 1024;
/** The most a brand's logo or page icon may be, written inline (FR-124). */
const MARK_MAX = 64 * 1024;

/** kebab-case: kinds, acts, rules, edges, roles, modules. */
export const NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
/** Field names are identifiers so a rule can say them bare: `quote != null`. */
export const FIELD_NAME = /^[a-z][A-Za-z0-9]*$/;
const RESERVED_FIELDS = new Set(["id", "kind"]);

/**
 * A RELATION'S NAME may be kebab-case or one camelCase word. camelCase is
 * recommended: a rule can then walk it bare (`tendedBy.name`), where
 * `tended-by.name` would read as a subtraction.
 */
export const EDGE_NAME = /^(?:[a-z][a-z0-9]*(?:-[a-z0-9]+)*|[a-z][A-Za-z0-9]*)$/;

/**
 * `image` and `file` hold what the host stored (FR-162): a `FileValue`, its
 * `href` a path on the host. `phone` and `place` are words drawn as a link to
 * call and to a map; `duration` is a whole number of minutes, said "1 h 30 min".
 */
export const FIELD_TYPES = ["string", "text", "number", "integer", "boolean", "date", "datetime", "enum", "list", "url", "email", "image", "video", "file", "app-link", "phone", "place", "duration"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/*
 * THE SHAPES ARE BUILT ON FIRST USE. Some hundred and fifty zod schemas make
 * up the document's shape, and building them is work a Worker's cold isolate
 * or a page would do the moment it imported `@graview/core/document`, whether
 * or not it ever read a document. Each exported shape is `z.lazy` over the one
 * set `build` makes the first time any of them parses: the same names, the
 * same parse, the same issues, and nothing done at import.
 */
function build() {
  /**
   * What every object already answers to — `constructor`, `toString` and the
   * rest of `Object.prototype` — is no field's or relation's name: a record's
   * fields and a kind's relations are looked up by name, and one of these is
   * "there" on every record whether it was declared or not.
   */
  const inherited = (n: string) => n in Object.prototype;
  const notInherited = z.refine<string>((n: string) => !inherited(n), "every object already has this name — choose another");

  /** At least `min` and at most `max` long: a string's characters, a list's items. */
  const sized = (min?: number, max?: number) => [...(min === undefined ? [] : [z.minLength(min)]), ...(max === undefined ? [] : [z.maxLength(max)])];
  const str = (min?: number, max?: number) => z.string().check(...sized(min, max));
  const some = <T extends z.ZodMiniType>(of: T, min?: number, max?: number) => z.array(of).check(...sized(min, max));

  const name = (what: string) => z.string().check(z.regex(NAME, `${what} names are kebab-case, lower-case words joined by hyphens like "tool-note" (field and relation names are camelCase, like "supersededBy")`));
  const edgeName = z.string().check(z.regex(EDGE_NAME, 'relation names are one camelCase word, like "supersededBy" (kind names are kebab-case, like "tool-note")'), notInherited);
  const fieldName = z
    .string()
    .check(
      z.regex(FIELD_NAME, 'field names are one word or camelCase, like "dueDate", so rules say them bare (kind names are kebab-case, like "tool-note")'),
      z.refine((n: string) => !RESERVED_FIELDS.has(n), 'a field cannot be called "id" or "kind" — the framework keeps those; try "type" or "category"'),
      notInherited,
    );
  const sentence = str(1, 500);
  const expression = str(1, 2000);
  const template = str(1, 300);

  const FieldSpec = z
    .strictObject({
      type: z.enum(FIELD_TYPES),
      required: z.optional(z.boolean()),
      description: z.optional(sentence),
      /** What the field is called on screen, where its name does not say it. */
      label: z.optional(str(1, 60)),
      options: z.optional(some(str(1, 80), 1, 100)),
      of: z.optional(z.enum(["string", "number", "date", "image", "video", "file"])),
      default: z.optional(z.unknown()),
      unit: z.optional(str(undefined, 12)),
      /** How a number is shown (`money`, `percent`, `duration`), or that a `text` field is written in Markdown (FR-180; the checker's `field-format` says which goes where). */
      format: z.optional(z.enum(["money", "percent", "duration", "markdown"])),
      /** A number's range (FR-114): the least and the most it may be, and the step its values are whole multiples of (JSON Schema's `multipleOf`). */
      min: z.optional(z.number()),
      max: z.optional(z.number()),
      step: z.optional(z.number()),
      /** The name this field had in the previous version: its values move instead of being dropped. */
      renamedFrom: z.optional(z.string().check(z.regex(FIELD_NAME))),
      /**
       * A date that repeats (`repeat.ts`): a record may keep, beside the date
       * (its first occurrence), how it repeats under the date's name and
       * `Repeat` — `"startsAtRepeat": { "every": "week", "on": ["tue"] }`.
       */
      repeats: z.optional(z.boolean()),
      /**
       * Whether two people may type into it at once, each keeping their
       * words (Roadmap f-collab-text): a `text` field is by default, a
       * `string` is not. Only a text or string field says it (the checker's
       * `field-collaborative`).
       */
      collaborative: z.optional(z.boolean()),
    })
    .check(
      z.superRefine((f, ctx) => {
        if (f.type === "enum" && !f.options) ctx.addIssue({ code: "custom", message: 'an enum field lists its "options"', path: ["options"] });
        if (f.type !== "enum" && f.options) ctx.addIssue({ code: "custom", message: '"options" belongs only on an enum field', path: ["options"] });
        if (f.type !== "list" && f.of) ctx.addIssue({ code: "custom", message: '"of" belongs only on a list field', path: ["of"] });
        if (f.repeats && f.type !== "date" && f.type !== "datetime") ctx.addIssue({ code: "custom", message: '"repeats" belongs only on a date or datetime field', path: ["repeats"] });
      }),
    );

  /**
   * WHERE A RELATION GOES: a kind of this document (`"house"`), or a kind in
   * ANOTHER APP the viewer can open (FR-171) — `@` + the app's address + `/`
   * + its kind: `"@nick/house/house"`, `"@app_kf5eydr9z58jzf/house"`. A link
   * to another app's record picks one there and leaves that app untouched.
   */
  const edgeTarget = z.string().check(z.regex(new RegExp(`${NAME.source}|${LINKED_TARGET.source}`), 'a relation goes to a kind of this document, like "house", or of another app, like "@nick/house/house"'));

  const EdgeSpec = z.strictObject({
    to: z.union([some(edgeTarget, 1), z.literal("*")]),
    cardinality: z.optional(z.enum(["one", "many"])),
    description: z.optional(sentence),
    inverse: z.optional(str(1, 80)),
    appendOnly: z.optional(z.boolean()),
    /** The name this relation had in the previous version: its links move. */
    renamedFrom: z.optional(z.string()),
    /** `"never"`: no automated author makes or breaks this relation on its own (`@graview/core/tidying`). */
    tidying: z.optional(z.literal("never")),
  });

  /** A computed field: its expression, or the expression with the words it is shown by (FR-83). */
  const ComputedSpec = z.union([expression, z.strictObject({ expr: expression, label: z.optional(str(1, 60)), description: z.optional(sentence) })]);

  const KindSpec = z.strictObject({
    noun: z.optional(str(1, 40)),
    plural: z.optional(str(1, 40)),
    description: z.optional(sentence),
    fields: z.record(fieldName, FieldSpec).check(z.refine((f: Record<string, unknown>) => Object.keys(f).length > 0, "a kind has at least one field")),
    label: z.optional(template),
    describe: z.optional(template),
    lifecycle: z.optional(z.strictObject({ field: fieldName, retired: some(z.union([z.string(), z.number(), z.boolean()]), 1) })),
    figure: z.optional(str(undefined, 20_000)),
    /** What a glance at one says — a card, a row, a hit in Find — first, in this order: the definition's `display.glance` (FR-39). */
    glance: z.optional(some(fieldName, 1, 20)),
    /**
     * How a record's page orders and groups its facts (FR-148): `fields`
     * first, in this order, then each group under its title; the rest follow
     * in declared order, under "Details" when there are groups. The
     * definition's `display.page`.
     */
    page: z.optional(
      z.strictObject({
        fields: z.optional(some(fieldName, 1, 40)),
        groups: z.optional(some(z.strictObject({ title: str(1, 60), fields: some(fieldName, 1, 40) }), 1, 12)),
      }),
    ),
    edges: z.optional(z.record(edgeName, EdgeSpec)),
    /**
     * Values worked out, not stored (FR-83): a name and a rule-language
     * expression read like a field — `"net": "sum(out('includes'), list * units)"` —
     * or `{ expr, label?, description? }`. Never written by an act.
     */
    computed: z.optional(z.record(z.string(), ComputedSpec).check(z.refine((c: Record<string, unknown>) => Object.keys(c).length <= 20, "a kind works out at most 20 computed fields"))),
    /**
     * Which field fills which role (the definition's `fieldRoles`): `when`, a
     * record's natural time, which lists open newest first by and a timeline
     * or calendar draws at when its lens binds no start; `who`, its author,
     * which a glance says; and any a lens binds by name (`start`, `end`,
     * `column`, `order`).
     */
    fieldRoles: z.optional(z.record(z.string(), z.string())),
    /** The name this kind had in the previous version: its records move. */
    renamedFrom: z.optional(z.string().check(z.regex(NAME))),
    /** This kind stands for the people: a record of it whose id is a member's principal id is that member (`$me`, `self`, `own`, `via`, `ownEnd`). */
    people: z.optional(z.boolean()),
    /** `false`: its records are kept or removed, never archived — the kind is given no `archive-`, `unarchive-` or `merge-<kind>` (FR-173). */
    archives: z.optional(z.literal(false)),
    /** What the app's own actor may do to its records on its own: `"never"` nothing, `"no-links"` all but link and unlink them (`@graview/core/tidying`). */
    tidying: z.optional(z.enum(["never", "no-links"])),
  });

  /** A value an effect writes: a literal, `$arg`, `$subject`, `$new`, `$now`, `$today`, or `{ expr }`. */
  const ValueSpec = z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.unknown()), z.strictObject({ expr: expression })]);

  const ref = z.string().check(z.regex(/^\$[A-Za-z][A-Za-z0-9]*$/, 'a reference is "$" and a name, like "$subject" or "$new"'));

  const EffectSpec = z.union([
    z.strictObject({ create: name("kind"), as: z.optional(z.string().check(z.regex(FIELD_NAME))), set: z.optional(z.record(fieldName, ValueSpec)) }),
    z.strictObject({ set: z.record(fieldName, ValueSpec), target: z.optional(ref) }),
    z.strictObject({ connect: edgeName, from: ref, to: ref }),
    z.strictObject({ sever: edgeName, from: ref, to: ref }),
    z.strictObject({ remove: ref }),
  ]);

  const ActSpec = z.strictObject({
    title: z.optional(str(1, 80)),
    description: z.optional(sentence),
    /** How the act reads standing on the far end of the relation it makes or breaks. */
    fromTheOtherEnd: z.optional(str(1, 80)),
    on: z.optional(z.union([name("kind"), some(name("kind"), 1)])),
    creates: z.optional(name("kind")),
    sets: z.optional(z.record(fieldName, ValueSpec)),
    writes: z.optional(some(fieldName, 1)),
    connects: z.optional(edgeName),
    severs: z.optional(edgeName),
    /**
     * Fields set on the record at the OTHER end of what the act connects or
     * severs — its `$to` (FR-115): `"setsOther": { "ownership": "shared" }`.
     * Values as `sets` takes them; an expression reads that record's fields.
     */
    setsOther: z.optional(z.record(fieldName, ValueSpec)),
    /**
     * The subject's links severed before it connects (FR-115): `true`, those
     * of the relation it connects; or the relations named, each at the
     * subject's own end. The link being made is kept.
     */
    replaces: z.optional(z.union([z.literal(true), some(edgeName, 1, 10)])),
    removes: z.optional(z.literal(true)),
    args: z.optional(z.record(fieldName, FieldSpec)),
    effects: z.optional(some(EffectSpec, 1, 20)),
    allowedWhen: z.optional(expression),
    refusal: z.optional(template),
    destructive: z.optional(z.boolean()),
  });

  const RepairSpec = z.strictObject({
    act: name("act"),
    label: z.optional(str(1, 80)),
    args: z.optional(z.record(z.string(), ValueSpec)),
  });

  const RuleSpec = z.strictObject({
    title: z.optional(str(1, 120)),
    description: z.optional(sentence),
    over: z.union([z.literal("graph"), name("kind")]),
    when: z.optional(expression),
    require: expression,
    says: z.optional(template),
    repairs: z.optional(some(RepairSpec, undefined, 10)),
  });

  const GrantSpec = z.strictObject({
    roles: z.union([some(name("role"), 1), z.literal("*")]),
    mutations: z.union([some(name("act"), 1), z.literal("*")]),
    kinds: z.optional(z.union([z.array(name("kind")), z.literal("*")])),
    describe: z.optional(sentence),
    self: z.optional(z.boolean()),
    /** Only on the principal's own end of the link the act connects or severs. */
    ownEnd: z.optional(z.boolean()),
  });

  /**
   * Who sees which kinds — the framework's `Sight`, one meaning (FR-02).
   * Absent: everyone sees everything. Present: a kind no sight names is seen
   * by nobody but the system (a host that gives its owners everything serves
   * them as the system, or names them in a sight).
   */
  const fieldNames = z.optional(some(name("field"), 1));
  const SightSpec = z.strictObject({
    roles: z.union([some(name("role"), 1), z.literal("*")]),
    kinds: some(name("kind"), 1),
    /** Only the principal's own records: the ones they made, their own record, and what an edge joins to it. */
    own: z.optional(z.boolean()),
    /** Only the records this relation joins to the principal's own record of the people kind. */
    via: z.optional(edgeName),
    /** Only these fields of the records it shows (Roadmap f-field-sight); sights add up. */
    fields: fieldNames,
    /** Every field but these of the records it shows: kept from the roles, on every surface, and not theirs to write. */
    hide: fieldNames,
  });

  const PolicySpec = z.strictObject({
    grants: z.array(GrantSpec),
    sees: z.optional(z.array(SightSpec)),
  });

  /**
   * The installation's look and its money: an accent color the palette is
   * derived from, and the currency and locale a sum is said in wherever a
   * block names none (FR-100) — the locale its days, times and numbers are
   * said in too (FR-178), "en-US" when absent — and the time zone its
   * instants are said in (Roadmap f-app-time-zone), each reader's own clock
   * when absent. Any of them may stand alone.
   */
  const BrandSpec = z.strictObject({
    accent: z.optional(z.string().check(z.regex(/^#[0-9a-fA-F]{6}$/, 'an accent is a color like "#c2577a"'))),
    name: z.optional(str(1, 60)),
    currency: z.optional(z.string().check(z.regex(/^[A-Z]{3}$/, 'a currency is its three-letter code, like "USD" or "EUR"'))),
    // A language tag ("en-US", "de-DE"); `graview check` says when it is none (`brand-locale`).
    locale: z.optional(str(2, 35)),
    // An IANA time zone ("America/New_York"); `graview check` says when it is none (`brand-time-zone`).
    timeZone: z.optional(str(1, 64)),

    /*
     * THE REST OF THE BRAND (FR-124), each optional and each checked by
     * `graview check` (`brand-mark`, `brand-font`): a logo and a page icon —
     * inline SVG, or a path on the app's own host — the faces words are set
     * in, how round and how roomy, a hue per kind, and the scheme it prefers.
     */
    logo: z.optional(
    z.union([
      str(1, MARK_MAX),
      z.strictObject({ src: str(1, MARK_MAX), alt: z.optional(str(1, 120)) }),
      // One for each scheme: the dark one drawn in the dark; with none, `darkFallback: "invert"` asks for the light one inverted there (never guessed).
      z.strictObject({ light: str(1, MARK_MAX), dark: z.optional(str(1, MARK_MAX)), alt: z.optional(str(1, 120)), darkFallback: z.optional(z.literal("invert")) }),
    ]),
  ),
    // A page icon: a mark as the logo is one, or `{ "emoji": "🏡" }` — one standard emoji, the app's mark where it has no logo (`brand-emoji`).
    favicon: z.optional(z.union([str(1, MARK_MAX), z.strictObject({ emoji: z.string() })])),
    typography: z.optional(z.strictObject({ display: z.optional(str(1, 200)), body: z.optional(str(1, 200)), mono: z.optional(str(1, 200)) })),
    shape: z.optional(
      z.strictObject({
        radius: z.optional(z.number().check(z.minimum(0), z.maximum(32))),
        density: z.optional(z.number().check(z.minimum(0.75), z.maximum(1.5))),
      }),
    ),
    accents: z.optional(z.record(z.string(), z.number().check(z.minimum(0), z.maximum(360)))),
    scheme: z.optional(z.enum(["light", "dark", "auto"])),
    /*
     * THE LINE UNDER THE NAME, KEPT OFF THE HOME (Roadmap
     * f-home-subtitle-separate): `false` and the home draws no line from the
     * `description` — a home view with its own hero says it already — while
     * the description stays the app's, in listings and on the name's hover.
     */
    subtitle: z.optional(z.literal(false)),
  });

  const loose = z.record(z.string(), z.unknown());

  /** A grid lens's order (`grid-sort.ts`): a field, or { by, direction }. */
  const GridSortSpec = z.union([str(1, 120), z.strictObject({ by: str(1, 120), direction: z.optional(z.enum(["asc", "desc"])) })]);
  const Year = z.number().check(z.int(), z.minimum(1), z.maximum(9999));

  /**
   * A lens: checked by `graview check` against the lenses the framework ships
   * (`declaredLenses`), so loose here but for what its page is: `create`,
   * false where the place's page leaves off the forms that begin its kind —
   * and the options whose shape is the same on every lens that takes them:
   * a coverage's `sort` and `columnSort` and a status board's `sort` (the
   * order of its rows, columns or cards), and a calendar's `horizon` (its
   * span of years, reaching its records' first and last unless `from` and
   * `to` pin it). `search` and `filters` are fields, here only as lists of
   * names: which ones the kind has is the checker's to say, as is a status
   * board's `collapsed` and `hidden` columns.
   */
  const LensSpec = z.looseObject({
    create: z.optional(z.boolean()),
    options: z.optional(
      z.looseObject({
        sort: z.optional(GridSortSpec),
        columnSort: z.optional(GridSortSpec),
        search: z.optional(some(str(1, 120), undefined, 40)),
        filters: z.optional(some(str(1, 120), undefined, 40)),
        horizon: z.optional(z.union([z.number().check(z.int(), z.minimum(1), z.maximum(200)), z.looseObject({ years: z.number().check(z.int(), z.minimum(1), z.maximum(200)), title: str(1, 80), from: z.optional(Year), to: z.optional(Year) })])),
      }),
    ),
  });

  /** A kind's view specs: which slots it fills. The blocks are checked in views.ts, sentence by sentence. */
  const ViewSpecsSpec = z.strictObject({
    card: z.optional(z.array(z.unknown())),
    row: z.optional(z.array(z.unknown())),
    page: z.optional(z.array(z.unknown())),
  });

  /** A kind's list's declared order (`pages.lists.<kind>.sort`): a key, or a key with a direction and a tiebreak. */
  const ListSortSpec = () => {
    const direction = z.optional(z.enum(["asc", "desc"]));
    return z.union([
      str(1, 120),
      z.strictObject({ by: str(1, 120), direction, then: z.optional(z.union([str(1, 120), z.strictObject({ by: str(1, 120), direction })])) }),
    ]);
  };
  /** A kind's list's declared grouping (`pages.lists.<kind>.group`): a field, or a field with its groups' order and the closed ones. */
  const ListGroupSpec = () =>
    z.union([str(1, 120), z.strictObject({ by: str(1, 120), order: z.optional(some(str(1, 80), undefined, 40)), closed: z.optional(some(str(1, 80), undefined, 40)) })]);

  /**
   * THE ARRANGEMENT (FR-80): the kinds in order, the kinds the home leaves
   * off, the place the app opens on. Loose enough that a document which
   * carried anything else under `pages` before FR-80 — when it was accepted
   * and ignored — still parses; `graview check` says what it cannot honor.
   */
  const PagesSpec = z.looseObject({
    order: z.optional(z.array(z.string())),
    hide: z.optional(z.array(z.string())),
    first: z.optional(z.string()),
    /* The places that stand on the bar beside Home (FR-145, ranked): kinds by name or plural, pictures by title. */
    primary: z.optional(some(str(1, 80), undefined, 40)),
    /*
     * What the bar's switch calls the scene and the pages (FR-137); "Scene" and "Pages" when unsaid.
     * At most 40 characters, as `pages.overview` was (FR-132), which a stored document says for `scene`
     * (RESPELLED): a respelling never narrows what the key may hold. The bar cuts a long word, whole on hover.
     */
    scene: z.optional(str(1, 40)),
    pages: z.optional(str(1, 40)),
    /*
     * What each kind's list offers to filter by, by kind (`pages.lists.request.filters`): fields, relations,
     * `is`, and `<relation>.<field>` for a choice at a relation's far end. Its choice fields stand as chips.
     */
    lists: z.optional(
      z.record(
        z.string(),
        z.strictObject({
          filters: z.optional(some(str(1, 120), undefined, 40)),
          /* The order it opens in: a field, a computed field or `label`, lowest first — or { by, direction, then }. */
          sort: z.optional(ListSortSpec()),
          /* How it opens grouped: a choice or yes-or-no field — or { by, order, closed }, the closed groups last and shut. */
          group: z.optional(ListGroupSpec()),
          /* False where the list offers nobody "Export CSV" (Roadmap f-view-export-csv): on when unsaid. */
          export: z.optional(z.boolean()),
        }),
      ),
    ),
  });

  /*
   * A FORM FOR A VISITOR (Roadmap f-public-forms): one act, drawn alone for somebody with no account and run as a
   * visitor the host mints per submission. What the visitor may do and see is the policy's: grant the role its act.
   */
  const FormSpec = z.strictObject({
    act: name("act"),
    title: z.optional(str(1, 80)),
    intro: z.optional(sentence),
    fields: z.optional(some(fieldName, 1, 40)),
    say: z.optional(sentence),
    submit: z.optional(str(1, 80)),
    role: z.optional(name("role")),
  });

  const DocumentSpec = z.strictObject({
    /* Where an editor finds this shape as JSON Schema (`@graview/core/document.schema.json`); the compiler reads past it. */
    $schema: z.optional(z.string()),
    format: z.literal(FORMAT),
    formatVersion: z.literal(FORMAT_VERSION),
    name: str(1, 80),
    description: z.optional(sentence),
    version: z.optional(z.number().check(z.int(), z.minimum(1))),
    kinds: z
      .record(name("kind"), KindSpec)
      .check(
        z.refine((k: Record<string, unknown>) => Object.keys(k).length > 0, "a document declares at least one kind"),
        z.refine((k: Record<string, unknown>) => Object.keys(k).length <= 40, "a document declares at most 40 kinds"),
      ),
    /**
     * FACTS OF THE WHOLE GRAPH: a name and a rule-language expression with no
     * record as its subject — `"mapProposed": "every(all('area'), proposed)"`
     * — or `{ expr, label?, description? }`. Read anywhere the language is, as
     * `fact('mapProposed')`; worked out on demand under the language's budget.
     */
    computed: z.optional(z.record(z.string(), ComputedSpec)),
    acts: z.optional(z.record(name("act"), ActSpec)),
    rules: z.optional(z.record(name("rule"), RuleSpec)),
    roles: z.optional(z.array(name("role"))),
    policy: z.optional(PolicySpec),
    modules: z.optional(loose),
    lenses: z.optional(z.array(LensSpec)),
    pages: z.optional(PagesSpec),
    /** Each kind's views by kind, and `home`: the home view, a list of blocks about no one record (FR-81). */
    views: z.optional(z.record(z.string(), z.union([ViewSpecsSpec, z.array(z.unknown())]))),
    brand: z.optional(BrandSpec),
    settings: z.optional(z.array(loose)),
    migrations: z.optional(z.array(loose)),
    /**
     * Other systems this app is kept in step with, by name: today, Google
     * calendars. Read loosely here, as a page that draws the app never runs
     * one; their shape (`ConnectionSpec`, `./connection-spec.ts`) is the
     * checker's to judge, and the JSON schema says it to an editor.
     */
    connections: z.optional(z.record(name("connection"), loose)),
    /** Forms for visitors, by name: each one act, its fields, and what the visitor is told once it is received. */
    forms: z.optional(z.record(name("form"), FormSpec)),
    /**
     * When edits reach readers (Roadmap f-publishing-lifecycle): `"live"` (absent, the same) as they are made;
     * `"on-publish"` when a publisher publishes, the `working` roles editing the head meanwhile.
     */
    publishing: z.optional(
      z.strictObject({
        mode: z.enum(["live", "on-publish"]),
        working: some(name("role"), undefined, 40),
        publishers: z.optional(some(name("role"), 1, 40)),
      }),
    ),
  });
  return { FieldSpec, EdgeSpec, ComputedSpec, KindSpec, ValueSpec, EffectSpec, ActSpec, RepairSpec, RuleSpec, GrantSpec, SightSpec, PolicySpec, BrandSpec, PagesSpec, DocumentSpec };
}

let built: ReturnType<typeof build> | undefined;
/** The document's shapes, built once, the first time one is read. */
const shapes = () => (built ??= build());

export const FieldSpec = z.lazy(() => shapes().FieldSpec);
export const EdgeSpec = z.lazy(() => shapes().EdgeSpec);
export const ComputedSpec = z.lazy(() => shapes().ComputedSpec);
export const KindSpec = z.lazy(() => shapes().KindSpec);
export const ValueSpec = z.lazy(() => shapes().ValueSpec);
export const EffectSpec = z.lazy(() => shapes().EffectSpec);
export const ActSpec = z.lazy(() => shapes().ActSpec);
export const RepairSpec = z.lazy(() => shapes().RepairSpec);
export const RuleSpec = z.lazy(() => shapes().RuleSpec);
export const GrantSpec = z.lazy(() => shapes().GrantSpec);
export const SightSpec = z.lazy(() => shapes().SightSpec);
export const PolicySpec = z.lazy(() => shapes().PolicySpec);
export const BrandSpec = z.lazy(() => shapes().BrandSpec);
export const PagesSpec = z.lazy(() => shapes().PagesSpec);
export const DocumentSpec = z.lazy(() => shapes().DocumentSpec);

export type FieldSpec = z.infer<typeof FieldSpec>;
export type EdgeSpec = z.infer<typeof EdgeSpec>;
export type ComputedSpec = z.infer<typeof ComputedSpec>;
export type KindSpec = z.infer<typeof KindSpec>;
export type ValueSpec = z.infer<typeof ValueSpec>;
export type EffectSpec = z.infer<typeof EffectSpec>;
export type ActSpec = z.infer<typeof ActSpec>;
export type RuleSpec = z.infer<typeof RuleSpec>;
export type SightSpec = z.infer<typeof SightSpec>;
export type PolicySpec = z.infer<typeof PolicySpec>;
export type BrandSpec = z.infer<typeof BrandSpec>;
export type GraviewDocument = z.infer<typeof DocumentSpec>;
