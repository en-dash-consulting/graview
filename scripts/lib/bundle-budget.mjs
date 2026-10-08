/**
 * WHAT A FACE COSTS A HOST'S PAGE (FR-19).
 *
 * The whole embed (every face, the studio, the lenses) bundled to over a
 * megabyte, and a chat's widget that only ever shows the pages paid for
 * all of it. `@graview/embed/pages` is the routed face alone; each entry
 * here is bundled the way a product's bundler would (minified, for the
 * browser, React left to the host) from the workspace's sources, and held
 * to a budget. `scripts/inspect-pack.mjs` fails CI when one is over.
 *
 * A budget is the size it was when it was set, with room for ordinary
 * growth. Raising one is a decision, said in the changeset that raises it.
 *
 * WHAT A PAGE LOADS FIRST, AND WHAT IT LOADS IN ALL. The bundle is split
 * where the code says `import()`, as a product's bundler splits it: `load:
 * "first"` measures the chunks a page loads before anything is turned on
 * (the entry and what it imports outright), `load: "all"` every chunk. A
 * budget that `lacks` a package fails when any module of it is in what it
 * measures — so "the studio is not in a page that does not turn it on" is
 * a claim CI holds, not a size that happens to be small.
 */
import { createRequire } from "node:module";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";
import { graviewSources } from "./graview-sources.mjs";

/** Bytes, minified and gzipped. */
export const BUDGETS = [
  {
    name: "the pages face alone",
    entry: `import { mount } from "@graview/embed/pages"; globalThis.mount = mount;`,
    /*
     * Raised from 765_000 / 205_000 when the pages alone took the app's
     * views (FR-35 over FR-19): the framework's default views and the
     * declaration's view specs, which the pages now draw their cards, rows
     * and record pages from — about 48 kB minified, 15.5 kB gzipped.
     *
     * Raised again from 815_000 / 220_000 when the workspace moved to zod
     * 4.6, the zod a consumer resolves from the published ranges: 4.6 gives
     * every schema type its own JSON-schema processor, so zod no longer
     * shakes down to what the pages use — about 130 kB minified, 30 kB
     * gzipped, of zod's, which a host already paid on 4.6.
     *
     * Lowered from 950_000 / 252_000 when the framework built its own
     * schemas in zod/mini and the routed face stopped reaching the workbench
     * through its imports (FR-57): measured at 500_379 / 163_300.
     *
     * Measured at 504_624 / 168_114 once the open kit (FR-90–FR-96) met
     * main's declared lenses, home view, language and describe (FR-79–FR-89);
     * the budget just above it.
     *
     * Raised when a form came to name its parts (#80): its look moved from
     * style attributes to rules an app's own selector outranks, a few hundred
     * bytes of stylesheet. Measured at 508_120 / 169_327.
     *
     * Lowered when the scene's own rules came to be drawn by the scene face
     * and the frame's measures moved to a file of their own (FR-104): a
     * page on the pages face carries neither. Measured at 495_604 / 167_798.
     *
     * With an address for a host's page (FR-106), fitted thumbnails (FR-107) and named steps (FR-108): measured at 497_188 / 168_599.
     *
     * Raised when a coverage cell came to be chosen where it is (FR-111) and a coverage grid to be described (FR-112): the describer the page's assistant reaches says a grid row by row, about 3.4 kB minified. Measured at 500_990 / 169_958.
     *
     * Measured at 502_168 / 170_317 with the pull requests of this round together.
     *
     * Lowered when what only a drawn view uses left the entries the frame
     * imports (`@graview/react/drawing`, `@graview/tools/edit`,
     * `@graview/core/arrange`) and the describer came to be fetched when the
     * assistant is first asked about a place: measured at 487_223 / 165_379.
     *
     * Raised when the assistant's tools came to say why a call was refused
     * (FR-119): the page's agent runtime reads a refusal with `refusalOf`,
     * about 0.5 kB minified. Measured at 488_176 / 165_609.
     *
     * Raised again when every act came to refuse an argument it does not
     * take (FR-121): the page's store holds a call to its act's shape before
     * the input parses, about 0.4 kB. Measured at 488_607 / 165_764.
     *
     * Raised when a search hit came to say its address and search to judge
     * sight record by record (FR-129): the Find box on every page is that
     * search, about 0.6 kB. Measured at 489_185 / 166_114.
     *
     * Raised when the document came to hold the whole brand (FR-124–FR-126):
     * the app's mark, name and the line under it drawn by one component
     * (`AppTitle`), a mark judged before it is put in the page, the faces a
     * document names resolved to their stacks, the page's icon. Measured at 492_055 / 167_339.
     *
     * Measured at 492_993 / 167_725 with the pull requests of this round together.
     *
     * Raised when notices came to float over the page (FR-133): the way
     * back is drawn as a notice in the top layer, and every notice is
     * placed at the foot clear of what stands there, about 2.6 kB minified,
     * 1 kB gzipped. Measured at 491_172 / 166_746.
     *
     * Measured at 495_633 / 168_648 with the pull requests of this round together.
     *
     * Raised when one app bar came to stand on every face (FR-131, FR-132):
     * the app, its places as tabs with "More" for what the row cannot hold,
     * and three tools of one size, in place of the strip and the routed
     * face's masthead; a page's title said under the app's name. About
     * 5 kB minified. Measured at 500_664 / 171_557.
     */
    // Raised when a brand's mark came to be read element by element as the browser reads it before it is drawn
    // (the review after 0.1.15: the rules that searched the string could be talked past), about 4 kB minified,
    // drawn with the bar. Measured at 505_406 / 173_425.
    // Raised when the scene and the pages became two things on the bar and the places left it (FR-137, FR-138): the switch, the
    // place control and its grouped list with their marks, the phone's place line, 2_047 / 595 more. Measured at 507_453 / 174_021.
    // Raised when the bar came to fit its box (it lays itself out by its own width; Find a small box that says its shortcut,
    // the switch's marks alone when its words do not fit): about 2.4 kB minified, all of it the bar. Measured at 510_795 / 175_163.
    // Raised when the scene came to have its places in the bar (FR-144) and the places to stand on the row where they fit (FR-145):
    // the places drawn as words with "More", weighing which fit, the scene's places; 4_719 / 1_618 more. Measured at 515_740 / 176_863.
    minified: 516_700,
    gzipped: 177_350,
    load: "first",
  },
  {
    name: "embed without the studio",
    entry: `import { mount } from "@graview/embed"; globalThis.mount = mount;`,
    /*
     * Every face, as a page with `studio: false` loads it: the studio is
     * imported when it is turned on, and not before (it was about 104 kB
     * minified of every embed, whether it was offered or not). Set at
     * 1_175_514 / 329_683 measured, on zod 4.6.
     *
     * Lowered from 1_200_000 / 337_000 when each face came to be fetched as
     * it is first drawn, with the framework's own views (FR-57): what a page
     * loads first is the frame — measured at 747_000 / 190_229 — and the
     * faces are their own chunks.
     *
     * Gzipped raised from 200_000 when a declared lens came to draw (FR-79)
     * and the arrangement to be honored (FR-80): the frame registers each
     * titled lens as a place and reads where the app opens, which is
     * `declaredLenses` and `openingOf` in what a page loads first — the
     * factories themselves are a chunk fetched when a lens is first drawn.
     * Measured at 773_663 / 200_080.
     *
     * Raised again when the rule language came to compute what pages need
     * (FR-83): computed fields, worked out for the seat a record is drawn
     * for, and the words, and and plural formatters. With both, measured at
     * 791_069 / 206_781.
     *
     * Raised again when the home and a view came to be written from blocks
     * (FR-81, FR-82): the document's vocabulary for headlines, figures and
     * lists (what the frame checks a document it compiles against) and the
     * blocks' stylesheet, in what a page loads first. Measured at
     * 802_562 / 209_988.
     *
     * Measured at 803_922 / 210_422 once the open kit (FR-90–FR-96) met
     * main's declared lenses, home view, language and describe (FR-79–FR-89);
     * the budget just above it.
     *
     * Raised when a label became a template (FR-99), money came to be said
     * in the app's currency (FR-100), a walk came to start from a set
     * (FR-101) and the check came to read what an act reads (FR-105): the
     * frame compiles a document with the checker, so its new questions
     * (`act-reads-hidden-kind`, the brand's money, braces in plain words)
     * load with it. Measured at 809_880 / 212_418.
     *
     * Lowered when the scene's own rules moved out of the frame's sheet into
     * the scene face, and the frame stopped reaching the primitives' index
     * and the scene's way back (FR-104). Measured at 787_572 / 207_729.
     *
     * Lowered when what only a fetched face, an agent's seat or the checker
     * uses left `@graview/core`'s barrels for subpaths of their own
     * (`/blocks`, `/check`, `/scene`, `/figures`). The frame never compiled
     * with the checker: the studio, fetched only when it is drawn, asked for
     * `checkApp` through `@graview/core`, which the frame imports up front,
     * and a bundler places a whole module in every chunk that can reach it —
     * so the checker (41 kB) and the document compiler it reaches (47 kB)
     * rode in what the page loads first. Measured at 692_174 / 176_515.
     *
     * Raised when a host whose page is the app came to hand the routed face
     * the address bar (FR-106): the face follows the address, and a place's
     * address is spelled under a base path, up front because a face is
     * chosen by it before one is fetched. The scene's fragment sync moved to
     * a module of its own, fetched with the scene. Measured at 694_569 /
     * 177_383.
     *
     * Raised when a new declaration came to keep the reader's place (FR-116):
     * the handle reads where the reader is and swaps the app in place; the
     * rules for what falls back to what are a chunk fetched on the first
     * swap. Measured at 696_428 / 178_422.
     *
     * Measured at 696_668 / 178_474 with the pull requests of this round together.
     *
     * Raised when an act's refusal became a type a host can show (FR-110:
     * `ActRefusal`, read by `refusalOf`, and an argument an act does not
     * take said with those it does) and a number's range came to be asked
     * for with its step (FR-114), all in `@graview/core`'s index, which the
     * frame imports up front. Measured at 695_208 / 177_613.
     *
     * Measured at 697_235 / 178_688 with the pull requests of this round together.
     *
     * Gzipped raised when a pill came to mean a choice or a state (FR-117)
     * and a name to be said whole (FR-118): a kind's mark is its plot in
     * miniature, clipped to an iso tile, in the chip and the figure the
     * frame's profile draws. Measured at 696_582 / 178_525 over FR-116.
     *
     * Measured at 697_149 / 178_706 with the pull requests of this round together.
     *
     * Lowered when what only a drawn view uses — the measured text, the
     * kit's connector, the boundary, the emphasis sets, the fields edited in
     * place, the reader's pins, a label's fit and the arranging of a list —
     * left the entries the frame imports up front for `@graview/react/drawing`,
     * `@graview/tools/edit` and `@graview/core/arrange`: a bundler places a
     * whole file in the first chunk when the first chunk can reach it and any
     * chunk uses it. Measured at 681_770 / 172_990.
     *
     * Measured at 682_731 / 173_310 with the pull requests of this round together.
     *
     * Gzipped raised when a refusal came to say whether the act's own rule
     * said no (FR-119) and every act to refuse an argument it does not take
     * (FR-121), in `@graview/core`'s index and the agent runtime the frame
     * imports up front. Measured at 683_560 / 173_530.
     *
     * Raised when the document came to hold the whole brand (FR-124–FR-126):
     * the app's mark, name and the line under it drawn by one component
     * (`AppTitle`), a mark judged before it is put in the page, the faces a
     * document names resolved to their stacks, the page's icon. Measured at 690_993 / 177_026.
     *
     * Measured at 691_831 / 177_426 with the pull requests of this round together.
     *
     * Gzipped raised when notices came to float over the page (FR-133):
     * every notice is placed at the foot clear of what stands there, about
     * 0.7 kB gzipped. Measured at 685_141 / 174_211.
     *
     * Measured at 693_389 / 177_979 with the pull requests of this round together.
     *
     * Lowered when one app bar came to stand on every face (FR-131): what is
     * behind the person and the problems' rows are fetched when first
     * reached for, and the blocks a view is drawn with come with the face
     * that draws one. Measured at 687_871 / 177_160.
     */
    // Raised when a brand's mark came to be read element by element as the browser reads it before it is drawn
    // (the review after 0.1.15: the rules that searched the string could be talked past), about 4 kB minified,
    // drawn with the bar. Measured at 693_248 / 179_214.
    // Raised when the scene and the pages became two things on the bar and the places left it (FR-137, FR-138), and an app with a
    // home view came to open on it (FR-136): the bar's switch and place list, and the embed's opening, 3_369 / 992 more.
    // Measured at 696_617 / 180_207.
    // Raised when the bar came to fit its box (it lays itself out by its own width; Find a small box that says its shortcut,
    // the switch's marks alone when its words do not fit): about 2.4 kB minified, all of it the bar. Measured at 699_612 / 181_352.
    // Raised when the scene came to have its places in the bar (FR-144) and the places to stand on the row where they fit (FR-145):
    // the places drawn as words with "More", weighing which fit, the scene's places; 4_762 / 1_637 more. Measured at 704_501 / 183_039.
    minified: 705_700,
    gzipped: 183_550,
    load: "first",
    lacks: ["@graview/studio"],
  },
  {
    name: "every face",
    entry: `import { mount } from "@graview/embed"; globalThis.mount = mount;`,
    /*
     * Raised from 1_100_000 / 315_000 when the studio learned to hand a host
     * back a document (FR-54): its changes are `editDocument`'s own ops, so
     * the studio every face carries now carries the editor and the document
     * schema it checks against — about 43 kB minified, 13 kB gzipped.
     *
     * Raised again from 1_150_000 / 330_000 with zod 4.6, for the same reason
     * as the pages face: about 130 kB minified, 30 kB gzipped, of zod's.
     *
     * And again when a studio opened on a document came to be judged by
     * compiling it (FR-54): the studio now carries `compileDocument`, about
     * 26 kB minified and 9 kB gzipped; and since the studio became a chunk of
     * its own, loaded when it is turned on, its chunk is gzipped on its own —
     * about 2 kB and 3 kB more. Measured at 1_285_784 / 365_101 (from
     * 1_259_216 / 354_049 before), so raised from 1_290_000 / 362_000. What
     * a page without the studio loads fell by about 110 kB: the budget above.
     *
     * Gzipped raised from 373_000 when each face became a chunk of its own,
     * fetched as it is drawn (FR-57): every face is about 11 kB smaller
     * minified (1_289_095 from 1_300_584), and about 2.5 kB larger gzipped
     * (372_654 from 370_200), because six chunks are each gzipped alone.
     *
     * Raised from 1_310_000 / 380_000 when a declared lens came to draw
     * (FR-79): the six shipped factories — timeline, calendar, coverage,
     * board, plan and reach — were shaken out of every embed while only an
     * app's own views could draw them, and now a document's lenses draw
     * through them. They are a chunk of their own, fetched when the first
     * lens is drawn, so no face loads them before it needs one. Measured at
     * 1_388_501 / 407_629.
     *
     * Raised again when the rule language came to compute what pages need
     * (FR-83): with both, measured at 1_399_742 / 412_177.
     *
     * Raised again when the home and a view came to be written from blocks
     * (FR-81, FR-82): headlines, figures and lists of records drawn by their
     * own cards, the home's landing over the scene, and the vocabulary that
     * checks them. Measured at 1_420_964 / 418_572.
     *
     * Raised again when every part of a document came to have an edit
     * (FR-84) and a place came to be described without a browser (FR-89):
     * the studio's editDocument rewrites lenses, the home, pages and
     * computed fields, and the chat seat's tools carry describePlace.
     * Measured at 1_450_367 / 427_424.
     *
     * Measured at 1_450_743 / 427_673 once the open kit (FR-90–FR-96) met
     * main's declared lenses, home view, language and describe (FR-79–FR-89);
     * the budget just above it.
     *
     * Raised when a status board came to draw (FR-97): the columns factory
     * in the lenses' chunk, the board's columns and moves in core, and the
     * studio's add-lens holding its bindings. Measured at 1_466_613 /
     * 433_321, from 1_454_397 / 429_026.
     *
     * Raised with the embed's own for FR-99, FR-100, FR-101 and FR-105, and
     * the studio's set-brand that sets the money apart from the colors:
     * measured at 1_461_953 / 431_507.
     *
     * With both, measured at 1_474_169 / 435_839.
     *
     * Gzipped raised with the address bar (FR-106), its sync a chunk of
     * its own: measured at 1_478_987 / 438_466.
     *
     * With FR-106, FR-107 and FR-108 together: measured at 1_480_900 / 439_089.
     *
     * With a coverage cell drawn to what it joins (FR-111) and a coverage grid described (FR-112): measured at 1_488_256 / 441_710.
     *
     * Gzipped raised when a new declaration came to keep the reader's place
     * (FR-116), its rules a chunk of their own: measured at 1_484_982 / 441_299.
     *
     * Measured at 1_492_342 / 443_906 with the pull requests of this round together.
     *
     * Raised when acts came to say what they set (FR-110, FR-114, FR-115):
     * a typed act refusal and a number's range in core, the document
     * compiler's other end of a link, the studio's kept range. Measured at
     * 1_488_359 / 441_473.
     *
     * Measured at 1_500_408 / 446_644 with the pull requests of this round together.
     *
     * Measured at 1_501_142 / 448_675 with the pull requests of this round together.
     *
     * Raised when the document came to hold the whole brand (FR-124–FR-126):
     * the app's mark, name and the line under it drawn by one component
     * (`AppTitle`), a mark judged before it is put in the page, the faces a
     * document names resolved to their stacks, the page's icon. Measured at 1_517_860 / 455_408.
     *
     * Measured at 1_518_689 / 455_813 with the pull requests of this round together.
     *
     * Raised when notices came to float over the page (FR-133): the way back
     * drawn as a notice, every notice placed at the foot clear of what
     * stands there. Measured at 1_507_037 / 450_941.
     *
     * Measured at 1_521_447 / 456_817 with the pull requests of this round together.
     *
     * Raised when one app bar came to stand on every face (FR-131, FR-132):
     * the bar itself, about 10 kB, and Find on the scene's face — the box
     * the whole-page Shell always had, which the embed's scene had none of —
     * drawn in the bar's place for it, about 8 kB. Measured at 1_541_263 / 464_618.
     */
    // Raised when a brand's mark came to be read element by element as the browser reads it before it is drawn
    // (the review after 0.1.15: the rules that searched the string could be talked past), about 4 kB minified,
    // drawn with the bar. Measured at 1_548_449 / 467_201.
    // Raised with every face's for the switch, the place list and the home view first (FR-136–FR-138), less the scene's landing
    // the home view no longer is: 1_680 / 623 more. Measured at 1_550_975 / 468_183.
    // Raised with the review after 0.1.16: the profile's choices drawn by one style rather than three, the app's line under
    // a home's own headline, the narrow embed's way back to the pages. Measured at 1_551_385 / 468_484.
    // Raised when the bar came to fit its box: about 2.7 kB minified, all of it the bar and the scene's Find hung from it.
    // Measured at 1_554_099 / 469_514.
    // Raised for the scene's places in the bar and the places standing on the row (FR-144, FR-145): 4_762 / 1_639 more.
    // Measured at 1_559_211 / 471_261.
    minified: 1_560_000,
    gzipped: 471_750,
    load: "all",
  },
  {
    name: "embed with the studio handed in",
    /*
     * A HOST WHOSE PAGE IS THE STUDIO (FR-63) hands `StudioPlace` in and
     * pays no round trip for it: the studio is in what the page loads
     * first, and `lazyLacks` fails the bundle if any module of it is left
     * in a chunk fetched later. Set at every face's budget: it is every
     * face, loaded at once.
     *
     * Gzipped raised from 373_000 to every face's 380_000, the budget it
     * is set at, when the embed's chrome became one family (FR-72, FR-75 –
     * FR-78: the popover family, the host's actions and notices, the seat
     * put away): measured at 1_297_634 / 373_048, with every face at
     * 1_302_133 / 377_358.
     *
     * Raised with every face when the rule language came to compute what
     * pages need (FR-83) and a declared lens came to draw (FR-79).
     *
     * Measured at 1_444_037 / 422_721 once the open kit (FR-90–FR-96) met
     * main's declared lenses, home view, language and describe (FR-79–FR-89);
     * the budget just above it.
     *
     * With FR-106, FR-107 and FR-108 together: measured at 1_465_563 / 430_201.
     *
     * Gzipped raised when a new declaration came to keep the reader's place
     * (FR-116): measured at 1_467_894 / 433_401.
     */
    entry: `import { mount } from "@graview/embed"; import { StudioPlace } from "@graview/studio"; globalThis.mount = (element, options) => mount(element, { ...options, studio: { onApply() {}, place: StudioPlace } });`,
    // Raised with every face's when a declared lens came to draw (FR-79) and the rule language came to compute what pages need (FR-83): the studio reaches the lenses through `@graview/primitives`, so here they load with it. With both, measured at 1_393_930 / 407_048.
    // Raised with every face's again when the home and a view came to be written from blocks (FR-81, FR-82): measured at 1_414_220 / 413_619.
    // And with every face's when every part of a document came to have an edit (FR-84) and a place a description (FR-89): measured at 1_443_642 / 422_491.
    // And with every face's when a status board came to draw (FR-97): measured at 1_451_370 / 425_210, from 1_447_691 / 424_068.
    // And with every face's for FR-99, FR-100, FR-101 and FR-105: measured at 1_455_251 / 426_587.
    // With both, measured at 1_458_930 / 427_760.
    // And with every face's when a coverage cell came to draw to what it joins (FR-111) and a coverage grid to be described (FR-112): measured at 1_472_916 / 432_823.
    // And when acts came to say what they set (FR-110, FR-114, FR-115: writes read off an act, a number's range, the other end of a link): the document compiler loads with the studio. Measured at 1_473_024 / 432_613.
    // Lowered when what only a drawn view uses left the frame's entries and the describer came to be fetched when first asked for: measured at 1_471_243 / 435_726.
    // Raised when the document came to hold the whole brand (FR-124–FR-126): the app's mark, name and subtitle in one component, a mark judged before it is drawn, the page's icon. Measured at 1_488_861 / 442_563.
    // Raised with every face's when one app bar came to stand on every face (FR-131, FR-132): the bar, and Find on the scene's face. Measured at 1_506_675 / 449_629.
    // Raised when a brand's mark came to be read element by element as the browser reads it before it is drawn
    // (the review after 0.1.15: the rules that searched the string could be talked past), about 4 kB minified,
    // drawn with the bar. Measured at 1_513_861 / 452_251.
    // Raised with every face's for the switch, the place list and the home view first (FR-136–FR-138): 1_695 / 613 more.
    // Measured at 1_516_402 / 453_220.
    // Raised with every face's for the review after 0.1.16, and the document's own part of it the studio loads: arrange-pages
    // reading the scene's old word, and the check's warning for a switch that says one word twice. Measured at 1_517_351 / 453_603.
    // Raised when the bar came to fit its box: about 2.7 kB minified, all of it the bar and the scene's Find hung from it.
    // Measured at 1_520_065 / 454_627.
    // Raised with every face's for the scene's places in the bar and the places standing on the row (FR-144, FR-145): 4_762 / 1_634 more.
    // Measured at 1_525_177 / 456_381.
    minified: 1_526_000,
    gzipped: 456_850,
    load: "first",
    lazyLacks: ["@graview/studio"],
  },
  {
    name: "a guest view in a frame",
    /*
     * The guest half a frame guest bundles (FR-04): the protocol and the
     * channel, nothing of the framework, and none of Remote DOM, which only
     * a worker guest needs (FR-68). Measured at 1_578 / 845.
     *
     * Measured at 1_677 / 876 once the open kit (FR-90–FR-96) met
     * main's declared lenses, home view, language and describe (FR-79–FR-89);
     * the budget just above it.
     */
    entry: `import { connectGuest } from "@graview/guest"; globalThis.connect = connectGuest;`,
    minified: 2_000,
    gzipped: 1_000,
    load: "all",
    lacks: ["@graview/core", "@remote-dom/core", "@remote-dom/polyfill"],
  },
  {
    name: "a guest view in a worker",
    /*
     * The worker entry (FR-68–FR-71): Remote DOM's polyfill and remote
     * elements, the component kit, the hardening and the channel. Graview
     * Cloud's spike measured the polyfill and elements alone at 46.9 kB
     * minified, 15.5 kB gzipped. Measured at 55_935 / 18_726, with the hardening.
     *
     * Measured at 57_832 / 19_463 once the open kit (FR-90–FR-96) met
     * main's declared lenses, home view, language and describe (FR-79–FR-89);
     * the budget just above it.
     */
    entry: `import { connectGuest } from "@graview/guest/worker"; globalThis.connect = connectGuest;`,
    minified: 59_000,
    gzipped: 20_000,
    load: "all",
    lacks: ["@graview/core"],
  },
  {
    name: "the guest host, before a worker is drawn",
    /*
     * What a host page loads first to draw guest views (FR-04, FR-68): the
     * frame's host, the session, and `guestView`. The worker's host and
     * the kit's renderer are `@graview/guest/host/worker`, a chunk fetched
     * when a worker view is drawn — while `@graview/guest/host` re-exported
     * them, esbuild put them in what the page loads first (16_898 / 6_652).
     * Remote DOM is in neither. Measured at 6_482 / 3_118.
     *
     * Measured at 7_443 / 3_546 once a worker view became a place (FR-91):
     * registering and judging one is `@graview/guest/host/views`, apart, so
     * a page that draws only frames carries none of it — the next budget.
     *
     * Measured at 7_443 / 3_545 once the open kit (FR-90–FR-96) met
     * main's declared lenses, home view, language and describe (FR-79–FR-89);
     * the budget just above it.
     *
     * Measured at 10_520 / 4_871 once a frame guest reads across kinds
     * (FR-85, `readAcross`), is handed the app's look and pushed again on
     * its toggle (FR-86, host/theme.ts: 1_037 B), and goes where the face
     * goes (FR-87, `useGoTo`: 1_268 B of @graview/react a page drawing the
     * app carries already); the budget just above it.
     *
     * Measured at 11_931 / 5_544 once a guest is handed the brand's name
     * and logo (FR-127): the host makes the logo into a URL the guest can
     * show without loading anything (host/theme.ts, `createGuestLogo`).
     */
    entry: `import { guestView, mountGuestView } from "@graview/guest/host"; globalThis.host = { guestView, mountGuestView };`,
    // Raised when a brand's mark came to be read element by element as the browser reads it before it is drawn
    // (the review after 0.1.15: the rules that searched the string could be talked past), about 4 kB minified,
    // the guest host judging an inline logo before it makes an image of the host page from it. Measured at 16_358 / 7_540.
    minified: 16_600,
    gzipped: 7_750,
    load: "first",
    lacks: ["@remote-dom/core", "@remote-dom/polyfill"],
  },
  {
    name: "the guest host, registering a worker view",
    /*
     * `@graview/guest/host/views` (FR-91, FR-92, FR-96): registering a worker
     * view for its kind or the home, and judging with no worker what it may
     * be handed, ask and run (`checkManifest`, `workerViewProps`,
     * `judgeCodeAct`, `checkViewSource`), with the frame's host it shares a
     * session with. The worker's host and the open kit are fetched when a
     * view is drawn. Measured at 11_181 / 4_945.
     *
     * Measured at 11_797 / 5_125 once the open kit (FR-90–FR-96) met
     * main's declared lenses, home view, language and describe (FR-79–FR-89);
     * the budget just above it. At 11_870 / 5_156 once a home view registers
     * as the home's own view (FR-81) on both faces. At 12_442 / 5_350 once
     * what a view reads across kinds is one rule for frames and worker
     * views alike (`readAcross`, FR-85) and the session it shares with a
     * frame pushes a frame's theme and places (FR-86, FR-87).
     */
    entry: `import { registerWorkerView, workerHome } from "@graview/guest/host/views"; globalThis.views = { registerWorkerView, workerHome };`,
    // Raised when a brand's mark came to be read element by element as the browser reads it before it is drawn
    // (the review after 0.1.15: the rules that searched the string could be talked past), about 4 kB minified,
    // the guest host judging an inline logo before it makes an image of the host page from it. Measured at 16_857 / 7_266.
    minified: 17_100,
    gzipped: 7_500,
    load: "first",
    lacks: ["@remote-dom/core", "@remote-dom/polyfill"],
  },
  {
    name: "the guest host, drawing a worker",
    /*
     * `@graview/guest/host/worker` (FR-68, FR-69): the worker's host and the
     * kit's renderer, which read Remote DOM's records without Remote DOM.
     * Measured at 13_578 / 5_097.
     *
     * What a page loads first, since the open kit (FR-90): the open kit's
     * sanitizer and renderer are a chunk of their own, fetched the first
     * time a worker view draws — the next budget — so a page that draws only
     * the kit's guests carries none of them. Measured at 15_229 / 5_727, with
     * `mountWorkerView`'s own few lines and the start the two share.
     *
     * Gzipped raised from 6_000 when `mountWorkerView` learned its manifest,
     * write rules, links and limits (FR-91–FR-94): measured at 15_950 / 6_304.
     *
     * Measured at 16_215 / 6_438 once the open kit (FR-90–FR-96) met
     * main's declared lenses, home view, language and describe (FR-79–FR-89);
     * the budget just above it.
     *
     * Gzipped raised from 6_500 at 16_870 / 6_688, once the session it
     * shares with a frame reads across kinds and pushes a frame's theme and
     * places (FR-85–FR-87), and the app's look is read and watched by one
     * module both hosts use (host/theme.ts).
     *
     * Raised from 17_000 / 6_750 at 18_305 / 7_358 when a worker that does
     * not start says `start` (FR-102): the page's policy violation heard,
     * the directive it lacks named, the page's console told once.
     */
    entry: `import { mountGuestWorker } from "@graview/guest/host/worker"; globalThis.mount = mountGuestWorker;`,
    minified: 18_750,
    gzipped: 7_500,
    load: "first",
    lacks: ["@remote-dom/core", "@remote-dom/polyfill"],
  },
  {
    name: "the guest host, drawing a worker view on the open kit",
    /*
     * `mountWorkerView` (FR-90) and everything it fetches when a view first
     * draws: the open kit's tables, the CSS Syntax tokenizer, parser and
     * sanitizer, the element and attribute judge, and the renderer into a
     * shadow root. Measured at 41_547 / 14_294.
     *
     * Raised from 46_000 / 16_000 when a view needed no build (FR-96): the
     * host now holds the view's runtime as text — Remote DOM's polyfill, the
     * hardening, the channel, the `graview` global, about 62 kB and 21 kB
     * gzipped — fetched only when it first starts a view from its source,
     * and the press reader and links (FR-92, FR-93). Measured at
     * 116_242 / 41_276.
     *
     * Measured at 118_250 / 41_953 once the open kit (FR-90–FR-96) met
     * main's declared lenses, home view, language and describe (FR-79–FR-89);
     * the budget just above it.
     *
     * Measured at 119_352 / 42_411 once the view's runtime makes its global
     * over a way out it is handed (worker/view-global.ts, shared with a
     * headless run, FR-95) and a guest may navigate to a place (FR-87),
     * and the host reads the app's look from one module (FR-86); the budget
     * just above it.
     *
     * Raised at 120_766 / 42_999 when a view that does not start says
     * `start` (FR-102), with the directive its page lacks; the budget just
     * above it.
     *
     * Raised at 122_122 / 43_558 when a view is handed the brand's name and
     * logo (FR-127), the logo made a `blob:` of the page or, where its
     * policy refuses one, a `data:` image; the budget just above it.
     */
    entry: `import { mountWorkerView } from "@graview/guest/host/worker"; globalThis.mount = mountWorkerView;`,
    // Raised when a brand's mark came to be read element by element as the browser reads it before it is drawn
    // (the review after 0.1.15: the rules that searched the string could be talked past), about 4 kB minified,
    // the guest host judging an inline logo before it makes an image of the host page from it. Measured at 126_521 / 45_488.
    minified: 127_000,
    gzipped: 45_750,
    load: "all",
    lacks: ["@remote-dom/core", "@remote-dom/polyfill"],
  },
  {
    name: "a worker view's runtime",
    /*
     * `@graview/guest/worker/view` (FR-90): Remote DOM's polyfill, the
     * hardening, the channel, the `graview` global with its morphing render,
     * and the open kit's tables for telling an author what will not be
     * drawn — no components. Measured at 59_440 / 20_322.
     *
     * Measured at 59_541 / 20_383 once the open kit (FR-90–FR-96) met
     * main's declared lenses, home view, language and describe (FR-79–FR-89);
     * the budget just above it.
     *
     * Measured at 59_926 / 20_596 once the global was made over a way out
     * the runtime hands it (worker/view-global.ts), so a headless run
     * (FR-95) hands a view the same global over a transcript: the budget
     * just above it.
     */
    entry: `import { graview } from "@graview/guest/worker/view"; globalThis.graview = graview;`,
    minified: 60_500,
    gzipped: 20_750,
    load: "all",
    lacks: ["@graview/core"],
  },
];

/** The host's own: a page has one React, and the embed is not it. */
const HOSTS_OWN = ["react", "react-dom", "react/jsx-runtime", "react-dom/client"];

/** One entry, bundled and split as a product would bundle it: its size, and the packages in it. */
export async function bundleSize(repo, entry, load = "all") {
  const require = createRequire(join(repo, "package.json"));
  const esbuild = require("esbuild");
  const result = await esbuild.build({
    stdin: { contents: entry, resolveDir: join(repo, "packages", "embed"), loader: "js" },
    bundle: true,
    splitting: true,
    outdir: "out",
    minify: true,
    format: "esm",
    platform: "browser",
    external: HOSTS_OWN,
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [graviewSources(repo)],
    metafile: true,
    write: false,
    logLevel: "silent",
  });
  const outputs = result.metafile.outputs;
  const name = (path) => relative(join(repo, "out"), join(repo, path));
  /*
   * THE PAGE'S OWN ENTRY, by name. Every chunk fetched by `import()` is an
   * entry point to esbuild too, and the first output carrying one was taken
   * for the page's: a new door (the declared lenses, FR-79) moved the
   * studio's chunk to the front of the list, and the page was measured as
   * though it began there.
   */
  const entryChunk = Object.keys(outputs).find((path) => outputs[path].entryPoint === "<stdin>");
  // What a page loads first: the entry, and every chunk it imports outright, never one it imports when asked.
  const loaded = new Set();
  const visit = (path) => {
    if (loaded.has(path)) return;
    loaded.add(path);
    for (const one of outputs[path].imports) if (one.kind === "import-statement" && outputs[one.path]) visit(one.path);
  };
  if (load === "first") visit(entryChunk);
  else for (const path of Object.keys(outputs)) loaded.add(path);
  const files = result.outputFiles.filter((file) => [...loaded].some((path) => name(path) === relative(join(repo, "out"), file.path)));
  const packagesIn = (paths) => {
    const packages = new Set();
    for (const path of paths) {
      for (const input of Object.keys(outputs[path].inputs)) {
        const found = input.match(/(?:^|\/)packages\/([^/]+)\/src\//);
        if (found) packages.add(`@graview/${found[1]}`);
      }
    }
    return [...packages].sort();
  };
  /* The third-party packages in some paths, by name, for a budget that must not carry one (`@remote-dom/core`). */
  const vendorsIn = (paths) => {
    const vendors = new Set();
    for (const path of paths) {
      for (const input of Object.keys(outputs[path].inputs)) {
        const found = input.match(/.*node_modules\/((?:@[^/]+\/)?[^/]+)\//);
        if (found) vendors.add(found[1]);
      }
    }
    return [...vendors].sort();
  };
  // What the page fetches only when it is asked for: every chunk the entry does not import outright.
  const statically = new Set();
  const reach = (path) => {
    if (statically.has(path)) return;
    statically.add(path);
    for (const one of outputs[path].imports) if (one.kind === "import-statement" && outputs[one.path]) reach(one.path);
  };
  reach(entryChunk);
  return {
    minified: files.reduce((sum, file) => sum + file.contents.length, 0),
    gzipped: files.reduce((sum, file) => sum + gzipSync(file.contents).length, 0),
    chunks: files.length,
    packages: packagesIn(loaded),
    vendors: vendorsIn(loaded),
    lazy: packagesIn(Object.keys(outputs).filter((path) => !statically.has(path))),
  };
}

/** Every budget, measured: what it is, what it may be, what it carries that it must not, and whether it is over. */
export async function measureBudgets(repo, budgets = BUDGETS) {
  const measured = [];
  for (const budget of budgets) {
    const { packages, vendors, lazy, ...size } = await bundleSize(repo, budget.entry, budget.load ?? "all");
    const carries = (budget.lacks ?? []).filter((name) => packages.includes(name) || vendors.includes(name));
    // A package that must not wait for a chunk of its own: any module of it fetched later fails the budget.
    const defers = (budget.lazyLacks ?? []).filter((name) => lazy.includes(name));
    const over = size.minified > budget.minified || size.gzipped > budget.gzipped || carries.length > 0 || defers.length > 0;
    measured.push({ name: budget.name, load: budget.load ?? "all", ...size, budget: { minified: budget.minified, gzipped: budget.gzipped }, carries, defers, lazy, over });
  }
  return measured;
}
