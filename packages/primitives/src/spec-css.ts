import { LOCAL_LAYERS } from "@graview/core";

/** The stylesheet the blocks are drawn with: classes over the theme's tokens, and nothing a spec can reach. */
export const SPEC_VIEW_CSS = `
.graview-spec{display:flex;flex-direction:column;gap:6px;min-width:0;color:var(--graview-ink)}
${/* A ROW IS A LINE OF A LIST, NOT A CAPSULE (FR-113, FR-117). It was a
   pill holding a title, a badge and a progress block on one line, every one
   of them cut with an ellipsis: at a phone's width "Lv 3" drew as "L…" and
   "3 of 5" as "3 of". Now the small blocks keep their own width, the title
   takes what is left and wraps, and a row too narrow for all of it wraps
   onto a second line before anything is cut. */ ""}
.graview-spec-row{flex-direction:row;flex-wrap:wrap;align-items:center;gap:4px 10px;box-sizing:border-box;max-width:100%;padding:5px 10px;border:1px solid var(--graview-edge);border-radius:var(--graview-radius-sm,8px);background:var(--graview-panel);font-size:.875rem}
.graview-spec-row[data-selected]{border-color:var(--graview-accent)}
.graview-spec-row>*{flex:0 0 auto;min-width:0;max-width:100%}
.graview-spec-row>.graview-spec-title,.graview-spec-row>.graview-spec-text{flex:1 1 9rem;overflow-wrap:anywhere}
.graview-spec-row>.graview-spec-title{font-size:.9375rem}
.graview-spec-row>.graview-spec-progress{grid-template-columns:auto minmax(3rem,5rem) auto;align-items:center;column-gap:6px}
.graview-spec-list[data-as="row"] .graview-spec-row{border-width:0 0 1px;border-radius:0;background:transparent;min-height:2.75rem;padding:var(--graview-space-2,8px) 0}
[data-graview-rows] .graview-spec-row{border-width:0;border-radius:0;background:transparent;padding:2px 0}
[data-graview-rows] .graview-spec-row>.graview-spec-title{font-size:var(--graview-text-body);font-weight:500}
${/* A RECORD'S NAME IN A LIST IS READ, NOT DISPLAYED (one type scale). A
   row said its name in the display face at 600, tight — heavy for a list
   of seventy and louder than the page's own title. A row's name and a
   card's are the text face, medium on a row and semibold on a card, at
   normal tracking; the display face is the page's title and its sections'. */ ""}
.graview-spec-row :is(.graview-spec-headline,.graview-spec-title),.graview-spec-card .graview-spec-headline{font-family:var(--graview-font-body);letter-spacing:normal;line-height:1.3}
.graview-spec-row .graview-spec-headline[data-level]{font-size:.9375rem;font-weight:500}
.graview-spec-row>.graview-spec-title{font-weight:500}
.graview-spec-card .graview-spec-headline[data-level]{font-size:1rem;font-weight:600}
[data-graview-page-main] .graview-spec-row :is(.graview-spec-headline[data-level],.graview-spec-title){font-size:var(--graview-text-body)}
${/* A LINE OF FACTS WITH A CHOICE IN IT (\`runs\`): the choices as small
   chips, the rest quiet words after them, in the order written — so
   "high" no longer reads like the date beside it. A chip is a tint of the
   ink, never a color the declaration did not give, and its words are the
   ink itself, so it holds its contrast in either scheme. Two runs of words
   keep the dot between them. */ ""}
.graview-spec-meta{display:flex;flex-wrap:wrap;align-items:center;gap:var(--graview-space-1,4px) var(--graview-space-2,8px);color:var(--graview-ink-muted);font-size:.8125rem;line-height:1.4}
.graview-spec-row .graview-spec-text.graview-spec-meta,.graview-spec-card .graview-spec-text.graview-spec-meta{display:flex;flex:1 1 auto;-webkit-line-clamp:none;line-clamp:none;max-height:none;overflow:visible}
[data-graview-page-main] .graview-spec-meta{font-size:var(--graview-text-small)}
.graview-spec-chip{display:inline-flex;align-items:center;box-sizing:border-box;min-height:1.375rem;padding:0 var(--graview-space-2,8px);border-radius:var(--graview-radius-sm,6px);background:color-mix(in srgb,var(--graview-ink) 7%,transparent);color:var(--graview-ink);font-weight:500;white-space:nowrap}
.graview-spec-page{padding-bottom:14px;margin-bottom:14px;border-bottom:1px solid var(--graview-edge)}
.graview-spec-title{font-family:var(--graview-font-display,inherit);font-weight:600;font-size:1rem;line-height:1.3;overflow-wrap:anywhere}
.graview-spec-text{margin:0;font-size:.875rem;line-height:1.45;overflow-wrap:anywhere}
.graview-spec-text[data-graview-tone]{color:var(--graview-spec-tone)}
${/* A STATE BADGE, the one pill a record wears (FR-117), and never cut
   (FR-118): it is as wide as its words, and only words longer than the
   whole line they stand in wrap. */ ""}
.graview-spec-badge{align-self:flex-start;display:inline-block;max-width:100%;box-sizing:border-box;padding:1px 8px;border:1px solid currentColor;border-radius:999px;background:var(--graview-panel);color:var(--graview-spec-tone,var(--graview-ink-muted));font-size:.8125rem;font-weight:600;line-height:1.5;overflow-wrap:anywhere}
.graview-spec-row .graview-spec-badge,.graview-spec-group[data-direction="row"] .graview-spec-badge{align-self:center}
.graview-spec [data-graview-tone="good"]{--graview-spec-tone:var(--graview-good)}
.graview-spec [data-graview-tone="bad"]{--graview-spec-tone:var(--graview-bad)}
.graview-spec [data-graview-tone="warn"]{--graview-spec-tone:var(--graview-warn)}
.graview-spec [data-graview-tone="accent"]{--graview-spec-tone:var(--graview-accent)}
.graview-spec [data-graview-tone="neutral"]{--graview-spec-tone:var(--graview-ink-muted)}
.graview-spec-field{display:flex;flex-wrap:wrap;gap:2px 8px;align-items:baseline;min-width:0;font-size:.875rem;line-height:1.4}
.graview-spec-label{color:var(--graview-ink-muted)}
.graview-spec-value{min-width:0;color:var(--graview-ink);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.graview-spec-link { position: relative; z-index: ${LOCAL_LAYERS.raised}; color: var(--graview-accent); text-decoration: underline; display: inline-flex; align-items: center; min-height: 24px; }
.graview-spec-progress{display:grid;gap:4px;font-size:.8125rem}
.graview-spec-progress>.graview-spec-label,.graview-spec-progress>.graview-spec-value{white-space:nowrap}
.graview-spec-track{display:block;height:6px;border-radius:999px;background:var(--graview-edge);overflow:hidden}
.graview-spec-fill{display:block;height:100%;background:var(--graview-accent)}
.graview-spec-group{display:flex;flex-direction:column;gap:6px;min-width:0}
${/* A ROW GROUP LAYS ANY BLOCK SIDE BY SIDE. Four figures sat in a row,
   but four lines of text, or two columns of meters, each took the whole
   width and stacked: a paragraph's natural width is the line it is in.
   Each block in a row takes a share of it — a figure a narrower one, a
   badge and a picture only their own — and wraps onto the next line on a
   phone, before anything is squeezed past reading. */ ""}
.graview-spec-group[data-direction="row"]{flex-direction:row;flex-wrap:wrap;align-items:flex-start;gap:10px 16px}
.graview-spec-group[data-direction="row"]>*{flex:1 1 12rem;min-width:0}
.graview-spec-group[data-direction="row"]>.graview-spec-number{flex-basis:7rem}
.graview-spec-group[data-direction="row"]>:is(.graview-spec-badge,.graview-spec-badges,.graview-spec-figure,.graview-spec-link){flex:0 1 auto}
.graview-spec-group[data-direction="row"]>:is(.graview-spec-headline,.graview-spec-divider){flex-basis:100%}
.graview-spec-row .graview-spec-group{flex:1 1 9rem}
${/* BADGES THAT FOLLOW ONE ANOTHER FLOW AS CHIPS DO, wrapping when the line is full. */ ""}
.graview-spec-badges{display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;min-width:0}
.graview-spec-badges:empty{display:none}
.graview-spec-badges>.graview-spec-badge{align-self:center}
.graview-spec-divider{width:100%;margin:2px 0;border:0;border-top:1px solid var(--graview-edge)}
.graview-spec-figure{display:inline-flex;width:22px;height:22px}
.graview-spec-row[data-graview-tall]{flex-direction:column;flex-wrap:nowrap;align-items:stretch;border-radius:10px;padding:8px 12px}
.graview-spec-row[data-graview-tall] .graview-spec-badge{align-self:flex-start}
${/* A tall row in a list is still a line of the list: its name on the list's own edge, no inset or corner of a card. */ ""}
.graview-spec-list[data-as="row"] .graview-spec-row[data-graview-tall]{padding:var(--graview-space-2,8px) 0;border-radius:0}
[data-graview-rows] .graview-spec-row[data-graview-tall]{padding:2px 0;border-radius:0}
.graview-spec-home,.graview-spec-place{gap:var(--graview-space-4,16px)}
${/* A PLACE ON ITS PAGE IS THE PAGE'S COLUMN, on the page's scale: its words
   at the reading size, its sections' headings at the heading step and
   never above the page's own title. */ ""}
[data-graview-page-main] .graview-spec-place>.graview-spec-text{font-size:var(--graview-text-body);line-height:1.5;max-width:65ch}
[data-graview-page-main] .graview-spec-place>:is(.graview-spec-title,.graview-spec-headline){font-family:var(--graview-font-display,inherit);font-size:var(--graview-text-heading);line-height:1.3;margin-top:var(--graview-space-4,16px)}
.graview-spec-headline{margin:0;font-family:var(--graview-font-display,inherit);font-weight:600;letter-spacing:-0.01em;line-height:1.15;overflow-wrap:anywhere;font-size:1.125rem}
.graview-spec-headline[data-level="1"]{font-size:clamp(1.75rem,5vw,2.75rem);line-height:1.05;text-wrap:balance}
.graview-spec-headline[data-level="2"]{font-size:clamp(1.25rem,3vw,1.625rem);margin-top:8px}
.graview-spec-headline[data-long][data-level]{font-size:1.125rem;line-height:1.3;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:4;overflow:hidden}
.graview-spec-number{display:grid;gap:2px;justify-items:start}
.graview-spec-number-value{font-family:var(--graview-font-display,inherit);font-weight:600;font-size:1.75rem;line-height:1.05;letter-spacing:-0.015em;font-variant-numeric:tabular-nums}
.graview-spec-card .graview-spec-number-value,.graview-spec-row .graview-spec-number-value{font-size:1.25rem}
.graview-spec-number .graview-spec-label{font-size:.8125rem}
${/* A FIGURE SAID LARGE ("emphasis": "large"): a stat tile's number at the
   size of the home's own heading, in its display face. */ ""}
.graview-spec-number[data-emphasis="large"] .graview-spec-number-value{font-size:clamp(2.25rem,6vw,3.25rem);line-height:1}
.graview-spec-card .graview-spec-number[data-emphasis="large"] .graview-spec-number-value,.graview-spec-row .graview-spec-number[data-emphasis="large"] .graview-spec-number-value{font-size:1.75rem}
.graview-spec-listing { display: grid; gap: var(--graview-space-5,24px); min-width: 0; position: relative; z-index: ${LOCAL_LAYERS.raised}; }
.graview-spec-list-group{display:grid;gap:var(--graview-space-2,8px);min-width:0}
${/* A GROUP'S HEADING IS A LABEL AND ITS COUNT, as a kind's list says one:
   the text face, small and semibold, the count muted beside it, room
   above. It stood on a rule of its own in a brighter edge, under the label
   alone; the rows' own hairline is the only line now. */ ""}
.graview-spec-list-heading{display:flex;gap:.5em;align-items:baseline;margin:0;font-family:var(--graview-font-body);font-size:.8125rem;font-weight:var(--graview-weight-label,600);letter-spacing:.02em;line-height:1.3}
[data-graview-page-main] .graview-spec-list-heading{font-size:var(--graview-text-small)}
.graview-spec-list-count{color:var(--graview-ink-muted);font-weight:var(--graview-weight-body,400)}
.graview-spec-list-group:has(>.graview-spec-list[data-as="row"])>.graview-spec-list-heading{margin-bottom:calc(-1 * var(--graview-space-1,4px))}
.graview-spec-list{list-style:none;margin:0;padding:0;display:grid;gap:6px;min-width:0}
.graview-spec-list[data-as="row"]{gap:0;border-top:1px solid var(--graview-edge)}
${/* CARDS IN ONE ROW KEEP THEIR OWN HEIGHT: a card with a long summary
   stretched every card beside it to its height. */ ""}
.graview-spec-list[data-as="card"]{grid-template-columns:repeat(auto-fill,minmax(min(100%,15rem),1fr));gap:10px;align-items:start}
.graview-spec-list[data-as="names"]{display:flex;flex-wrap:wrap;gap:4px 12px}
.graview-spec-item{position:relative;min-width:0}
.graview-spec-item[data-graview-flagged] > .graview-spec-row > .graview-spec-title{color:var(--graview-warn)}
.graview-spec-item-name{font-size:.875rem;font-weight:600}
.graview-spec-item-link{all:unset;position:absolute;inset:0;z-index:${LOCAL_LAYERS.raised};min-height:24px;border-radius:10px;cursor:pointer}
.graview-spec-item-link:hover{background:color-mix(in srgb,var(--graview-accent) 6%,transparent)}
.graview-spec-item-link:focus-visible{outline:2px solid var(--graview-accent);outline-offset:2px}
.graview-spec-item .graview-spec-listing { z-index: ${LOCAL_LAYERS.raised}; }
.graview-spec-empty,.graview-spec-more{color:var(--graview-ink-muted)}
.graview-spec-see-all{position:static;font-weight:600}
.graview-spec-show-more{font:inherit;font-weight:600;color:var(--graview-accent);background:none;border:1px solid var(--graview-edge);border-radius:var(--graview-radius,8px);min-height:32px;padding:4px 12px;cursor:pointer}
.graview-spec-show-more:focus-visible{outline:2px solid var(--graview-accent);outline-offset:2px}
${/* A LONG TEXT IS READ AT A GLANCE ON A CARD AND A ROW: three lines on a
   card, one on a row, cut with an ellipsis; the record's page says it whole.
   A card that printed a thirty-line summary made a row of cards a wall of
   text (\`{summary|excerpt}\` says a sentence on purpose). */ ""}
.graview-spec-card .graview-spec-text,.graview-spec-card .graview-spec-value{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;line-clamp:3;overflow:hidden;max-height:4.35em}
.graview-spec-row .graview-spec-text,.graview-spec-row .graview-spec-value{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1;line-clamp:1;overflow:hidden;max-height:1.45em}
.graview-spec-card .graview-spec-text>*,.graview-spec-row .graview-spec-text>*{margin-block:0}
.graview-spec-row .graview-spec-value,.graview-spec-row .graview-spec-text{white-space:normal !important}
${/* A PROGRESS'S FIGURE IS NO PROSE: "3 of 5" under its bar is said whole.
   The clamp's height is in the value's own ems, and a progress's line is
   taller than 1.45 of them, so a row cut the figure's foot (19 of 21 px). */ ""}
.graview-spec-progress>.graview-spec-value{display:inline;-webkit-line-clamp:none;line-clamp:none;max-height:none;overflow:visible;white-space:nowrap !important}
`;
