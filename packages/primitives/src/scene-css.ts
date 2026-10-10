import type { IsoFace, IsoWash, Scheme } from "@graview/core";
import { isoShade, layer, SCENE_LAYERS } from "@graview/core";
import { MARQUEE_GAP, MARQUEE_NAME_FLOOR, MARQUEE_WIDTH } from "@graview/layout/view";
import { baseSheet, GRAVIEW_BRAND, withinTheBox, type Brand, type ThemeCssOptions } from "./theme.js";
import { SPEC_VIEW_CSS } from "./spec-css.js";

/*
 * THE SCENE'S OWN RULES (FR-104).
 *
 * The districts from altitude, their plots, the village and the roads, the
 * billboards and their rails, the bands and what they could not hold, the
 * kind's tag, the zoom: everything here names an element only the scene
 * draws. They were a third of the one theme sheet, and the sheet is drawn
 * by the frame of every face, so a page that opened on the pages face —
 * a phone, a chat's widget, Graview Cloud's hosted page — carried them up
 * front and parsed them into its <style>. They are the scene face's now:
 * it draws them beside the frame's sheet, after it, which is where they
 * stand in `themeCss`. The rules are where theme.ts had them, in its
 * order, and each still carries its note.
 */

const face = (f: IsoFace): string => `${f.saturation}% ${f.lightness}%`;
const wash = (f: IsoWash): string => `${face(f)} / ${f.alpha}`;

function sceneSheet(scheme: Scheme): string {
  const iso = isoShade(scheme);
  return `
${/* What theme.ts drew for the scene alone, before FR-104's own rules and
   in the order it drew them: the altitude control, the kind's card, its
   drive-in, the others in the city, the district's block, and the seat's
   marks. */ ""}
${/*
 * The altitude control rides the SAME number the scene rides — its own copy,
 * because it sits beside the ground rather than inside it — on the same
 * curve. So the mark morphs exactly as long as the scene does, and where an
 * engine cannot register the property, both cut together: one mechanism,
 * and no way for the control and the picture to disagree about the change.
 */ ""}
.graview-altitude-control {
  --graview-altitude: 0;
  transition:
    --graview-altitude 640ms cubic-bezier(0.33, 0, 0.2, 1),
    color 240ms ease,
    border-color 240ms ease;
}
.graview-altitude-mark * {
  transform-box: fill-box;
  transform-origin: center;
}
${/* The ring of three kinds tightens to one ring around one node. */ ""}
.graview-altitude-mark-ring {
  transform: scaleX(calc(1 - 0.48 * var(--graview-altitude)));
  opacity: calc(0.55 + 0.4 * var(--graview-altitude));
}
.graview-altitude-mark-apex {
  transform: translateY(calc(2.6px * var(--graview-altitude)));
}
${/* The two wings gather into the center and give their ink to the apex. */ ""}
.graview-altitude-mark-wing {
  opacity: calc(0.75 * (1 - var(--graview-altitude)));
}
.graview-altitude-mark-wing[data-side="left"] {
  transform: translate(calc(4.4px * var(--graview-altitude)), calc(-0.8px * var(--graview-altitude)));
}
.graview-altitude-mark-wing[data-side="right"] {
  transform: translate(calc(-4.4px * var(--graview-altitude)), calc(-0.8px * var(--graview-altitude)));
}

${/* A card on the kinds plane.
 *
 * Title and count only at rest — a strip of ten cards each showing three
 * truncated member names is ten unreadable things, and the members are not
 * what you are asking the strip. Hovering lifts one and reveals the kind's
 * own description, which the declaration has always carried and nothing has
 * ever shown. */ ""}
.graview-kind-card {
  height: 100%;
  transition: transform 170ms cubic-bezier(0.22, 1, 0.36, 1), height 170ms ease,
    box-shadow 170ms ease;
  ${/* IN THE STACK NOTHING HANGS BELOW A CARD. The iso block rests eighteen
     pixels low there, invisible, ready to rise — and an invisible box that
     pokes under the bottom row still made the stage scroll by nine pixels
     with nowhere to scroll. Clipped (not hidden: no scroll container, no
     scrollable overflow), and let out again from altitude, where the plate
     floats above the card and the block stands up out of it. */ ""}
  overflow: clip;
}
.graview-kind-card:hover,
.graview-kind-card:focus-within {
  height: auto;
  transform: translateY(-4px) scale(1.05);
  box-shadow: var(--graview-lift-high);
  position: relative;
  z-index: ${SCENE_LAYERS.lines};
}

${/* The district-open control and its roster: altitude-only chrome. Inside
   the stack expanding dissolves a card, so the control does not exist
   there. A full fingertip even though the glyph is small — the audit holds
   every control to 24px. */ ""}
.graview-kind-open { display: none; }
${/* The roster reads as a LIST, one member a row — chips wrapping at their
   own widths read as spilled tiles, and a district's population is a roll
   call, not a mosaic. */ ""}

${/* A DRIVE-IN: a dark screen standing on the plot, and the showings under
   it as a marquee of real buttons. Only from altitude; the same list the
   places tabs carry, drawn where the pictures live. */ ""}
.graview-drive-in {
  ${/* Its own block under the nameplate, never a row inside the pill: the
     pill is one line of name and count, and a marquee flattened into it
     read as "12 • shown above The month The week". On a box the pill sits
     on the roof at the top of the card, so the marquee hangs under it; on
     a landmark the pill floats above the card, so the marquee takes the
     card's own top edge. */ ""}
  position: absolute;
  left: 50%;
  top: 42px;
  transform: translateX(-50%);
  z-index: ${SCENE_LAYERS.lines};
  display: grid;
  justify-items: center;
  gap: 4px;
  animation: graview-settle 240ms ease backwards;
}
[data-graview-landmark] .graview-drive-in {
  top: 4px;
}
${/* THE SHOWINGS, BY NAME (FR-118): a column of names hanging off the
   signpost's post, each whole and wrapped rather than cut, the one showing
   now marked by the post's rule in the accent. Words on the ground, haloed
   in the ground's color like the district's own name — no capsules, no
   pictures drawn too small to read. */ ""}
.graview-drive-in-marquee {
  display: grid;
  gap: ${MARQUEE_GAP}px;
  width: ${MARQUEE_WIDTH}px;
  justify-items: stretch;
}
.graview-drive-in-thumb {
  position: relative;
  display: grid;
  align-content: center;
  box-sizing: border-box;
  min-height: max(${MARQUEE_NAME_FLOOR / 16}rem, ${MARQUEE_NAME_FLOOR}px);
  padding: 3px 6px 3px 10px;
  border-left: 2px solid var(--graview-edge-bright, var(--graview-edge));
  color: var(--graview-ink);
  font: inherit;
  text-align: left;
}
.graview-drive-in-thumb[data-graview-pressed] {
  border-left-color: var(--graview-accent);
  color: var(--graview-accent);
}
${/* The press: the whole name, laid over it. */ ""}
.graview-drive-in-thumb-press {
  position: absolute;
  inset: 0;
  min-height: max(${MARQUEE_NAME_FLOOR / 16}rem, ${MARQUEE_NAME_FLOOR}px);
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 0 4px 4px 0;
  background: transparent;
  box-shadow: none;
  cursor: pointer;
}
.graview-drive-in-thumb-press:hover {
  background: color-mix(in srgb, var(--graview-accent) 8%, transparent);
}
.graview-drive-in-thumb-press:focus-visible {
  outline: 2px solid var(--graview-accent);
  outline-offset: 1px;
}
.graview-drive-in-thumb-title {
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.25;
  overflow-wrap: anywhere;
  text-shadow: 0 0 3px var(--graview-ground), 0 0 6px var(--graview-ground);
}
.graview-drive-in-thumb[data-graview-pressed] .graview-drive-in-thumb-title {
  font-weight: 600;
}

${/* THE OTHERS: people and their agents in the city, each a small figure in
   the scene's own line vocabulary with a name under it. They move by a
   transition on transform — one number, the layout tween's curve — so a
   quiet city runs nothing. This tab's own seat is not drawn here: the
   ask field is where it speaks. */ ""}
.graview-occupants {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: ${SCENE_LAYERS.occupants};
}
.graview-figure {
  position: absolute;
  left: 0;
  top: 0;
  width: 0;
  height: 0;
  pointer-events: none;
  transition: transform 420ms cubic-bezier(0.33, 0, 0.2, 1);
  will-change: transform;
}
.graview-figure-body {
  position: absolute;
  left: -16px;
  top: -38px;
  width: 32px;
  height: 38px;
  min-height: max(1.5rem, 24px);
  padding: 0;
  border: 0;
  background: transparent;
  color: hsl(var(--graview-hue, 200) 50% 48%);
  cursor: pointer;
  pointer-events: auto;
  border-radius: 6px;
}
.graview-figure-body:focus-visible {
  outline: 2px solid var(--graview-accent);
  outline-offset: 2px;
}
.graview-figure-body svg {
  display: block;
  width: 32px;
  height: 38px;
  overflow: visible;
}
.graview-figure[data-graview-mode="following"] .graview-figure-body {
  color: var(--graview-accent);
}
.graview-figure[data-graview-mode="refused"] .graview-figure-body {
  color: var(--graview-warn);
}
.graview-figure-name {
  position: absolute;
  left: 50%;
  top: 2px;
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--graview-ink-muted);
  pointer-events: none;
}
${/* ANOTHER PERSON, on your map: a head and shoulders in their own hue, at
   the plot their stop names or in the audience row of the showing they are
   watching. Press to follow them; their name is under them like a robot's. */ ""}
.graview-figure[data-graview-person] .graview-figure-body {
  left: -11px;
  top: -24px;
  width: 22px;
  height: 24px;
  min-height: 0;
}
.graview-figure[data-graview-person] .graview-figure-body svg {
  width: 22px;
  height: 24px;
}
.graview-figure[data-graview-person][data-graview-followed] .graview-figure-body {
  color: var(--graview-accent);
}
${/* Their robot, beside them, captioned as theirs. */ ""}
.graview-figure[data-graview-theirs] .graview-figure-body {
  opacity: 0.85;
}
${/* More than a row can hold, and the anonymous: a number where they stand. */ ""}
.graview-figure-count {
  position: absolute;
  transform: translate(-50%, -100%);
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid var(--graview-edge);
  background: var(--graview-float);
  color: var(--graview-ink-muted);
  font-size: 0.75rem;
  white-space: nowrap;
  pointer-events: auto;
}
${/* What somebody else is pointing at, outlined in their color. */ ""}
.graview-presence-over {
  position: absolute;
  border: 2px solid hsl(var(--graview-hue, 200) 55% 52%);
  border-radius: 8px;
  pointer-events: none;
  opacity: 0.75;
  transition: left 200ms ease, top 200ms ease, width 200ms ease, height 200ms ease;
}
${/* Off the visible ground: an indicator at the border, pointing at it. */ ""}
.graview-figure-edge {
  position: absolute;
  min-height: max(1.5rem, 24px);
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid var(--graview-edge);
  background: var(--graview-float);
  color: var(--graview-ink-muted);
  font-size: 0.75rem;
  white-space: nowrap;
  pointer-events: auto;
  cursor: pointer;
}

.graview-kind-members {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 3px;
  margin-top: 7px;
  animation: graview-settle 240ms ease backwards;
}

${/* The way into the archive, on the card that fed it: quiet, but a real
   control at a real size. */ ""}
.graview-kind-past {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  ${/* The same floor as the disclosure beside it — see .graview-kind-open. */ ""}
  min-height: max(1.5rem, 24px);
  padding: 1px 8px;
  margin: -3px 0;
  border-radius: 999px;
  border: 1px dashed var(--graview-edge);
  background: none;
  box-shadow: none;
  color: var(--graview-ink-faint);
  cursor: pointer;
  font-size: 0.75rem;
  white-space: nowrap;
}
.graview-kind-past:hover {
  color: var(--graview-accent);
  border-color: var(--graview-accent-dim);
}

${/* A SEARCH OVER THE CITY. The districts the words found are lit and say how
   many; the rest recede — the same dimming a selection's reach has always
   used, so a search reads as "where the thing is", not as a new mode. The
   count is the way in: a real control, the words carried down. */ ""}
.graview-kind-card[data-graview-emphasis="dimmed"] {
  opacity: 0.42;
  transition: opacity 160ms ease;
}
.graview-kind-card[data-graview-emphasis="lit"] {
  z-index: ${SCENE_LAYERS.stage};
}
.graview-kind-card[data-graview-emphasis="lit"] .graview-kind-face {
  border-color: var(--graview-accent) !important;
  box-shadow: 0 0 0 1px var(--graview-accent-dim);
}
.graview-kind-hits {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  min-height: max(1.5rem, 24px);
  padding: 1px 8px;
  margin: -3px 0;
  border-radius: 999px;
  border: 1px solid var(--graview-accent);
  background: none;
  box-shadow: none;
  color: var(--graview-accent);
  cursor: pointer;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
@media (prefers-reduced-motion: reduce) {
  .graview-kind-card[data-graview-emphasis="dimmed"] { transition: none; }
}

${/* A district STANDS: an isometric block — roof, two shaded walls — whose
   height is its population. Always in the tree, faded and settled by the
   altitude number: rising, each block grows up out of its card while the
   card flies to its ring stop — a morph, not a cut. At altitude zero it is
   fully transparent and costs nothing. */ ""}
.graview-kind-block {
  display: block;
  ${/* Architecture, not a control: clicks fall through to the card, and an
     invisible in-stack block must never sit over a neighbor's tuck. */ ""}
  pointer-events: none;
  position: absolute;
  left: 8%;
  bottom: 2px;
  width: 84%;
  height: auto;
  ${/* Under a marquee the block keeps out of its band: the drawing scales down inside the box. */ ""}
  max-height: calc(100% - var(--graview-marquee-room, 0px));
  opacity: var(--graview-altitude);
  transform: translateY(calc((1 - var(--graview-altitude)) * 18px));
  filter: drop-shadow(${
    scheme === "light" ? "10px 7px 14px rgba(20,30,32,0.28)" : "12px 8px 18px rgba(0,0,0,0.6)"
  });
}

${/* WHERE THE KIND HAS ITS OWN DRAWING, the drawing is the building.
   Same footprint as the block, same ground line, same cast shadow — the
   difference is that the district is now a person, a plot or a vehicle
   rather than one more box. Size carries the population the box's height
   used to: the rise the card computed, in a channel a drawing can use.

   Stroke weight is set HERE rather than in the art, because the art is
   drawn to read at twenty pixels and a 1.4-unit stroke on a 24-unit box
   becomes a six-pixel marker line at a hundred. Thinned to a drafting
   line, which is what a blueprint of a thing looks like. */ ""}
.graview-kind-landmark {
  display: block;
  left: 50%;
  ${/* The block's own two pixels of ground clearance, kept: at altitude zero
     every block is pushed eighteen pixels down as part of the morph, and
     without them the drawing hangs two pixels past the bottom of the scene
     and gives the whole page a scrollbar's worth of overflow. */ ""}
  bottom: 2px;
  aspect-ratio: 1;
  ${/* Sized by the card's HEIGHT, not its width: a district card is wider
     than it is tall, and a square drawing at 96% of the width stood a third
     of itself above the card and back through the nameplate. Population is
     in the drawing's size either way — the same rise the box's height
     carried, 10 for a district of one and 46 for the largest. */ ""}
  height: calc((100% - var(--graview-marquee-room, 0px)) * (0.72 + var(--graview-rise, 24) * 0.008));
  width: auto;
  ${/* AND IT KEEPS UP WITH THE WORDS. The card is laid out in pixels off the
     stage and the nameplate is sized in rem, so a reader on Largest doubled
     every name in the city while every drawing under one stayed exactly the
     size it was — a postage stamp under a headline. A floor in em ties the
     drawing to the same number the names follow; at the browser's own size
     it is below what the card already gives and nothing moves.

     Capped at the card, because a floor alone overflowed it: the drawings
     grew past the box they stand in and were sliced off at the bottom
     edge — a plot that reads as a V rather than a bed. The card's own
     height is what the picture can actually show, and the CARD is the thing
     that still does not follow the reader's size (see below).

     (No back ticks in here: this whole stylesheet is a template literal,
     and one of them ends it.) */ ""}
  min-height: min(5em, calc(96% - var(--graview-marquee-room, 0px)));
  ${/* The morph is a GROWTH from the ground line, not a drop: a block slides
     eighteen pixels down at altitude zero and grows up out of the card, and
     a drawing given the same treatment hangs below the card it belongs to —
     two pixels past the bottom of the scene on the lowest row, which is a
     scrollbar on every ground-level screen in the app. Scaling from the
     drawing's own feet is the same reading and costs nothing below. */ ""}
  transform-origin: bottom center;
  transform: translateX(-50%) scale(calc(0.55 + var(--graview-altitude) * 0.45));
  ${/* A cast shadow belongs to a solid; on a line drawing it is a blurred
     second copy of every stroke. The drawing keeps a hint of one so it
     still stands on the lattice rather than floating over it. */ ""}
  filter: drop-shadow(${
    scheme === "light" ? "6px 5px 7px rgba(20,30,32,0.16)" : "7px 6px 9px rgba(0,0,0,0.45)"
  });
}
${/* The nameplate floats ABOVE a drawing rather than standing on it. On a box
   the pill sits on the roof, which is what a label does over a building; on
   a figure the same 2% put it across the head. */ ""}

.graview-kind-landmark [data-graview-figure] {
  width: 100% !important;
  height: 100% !important;
  color: hsl(var(--graview-hue, 200) ${scheme === "light" ? "42% 44%" : "45% 62%"}) !important;
}
.graview-kind-landmark svg {
  width: 100%;
  height: 100%;
  stroke-width: 0.85;
}

${/* From altitude the card's face becomes the district's NAMEPLATE: an
   upright pill standing on the roof, the way a label floats over a building
   in any city view — the block carries the architecture, the pill carries
   the words. Inline styles drew the in-stack card, so the pill overrides
   must outrank them. */ ""}
.graview-kind-face {
  transition: border-radius 640ms cubic-bezier(0.33, 0, 0.2, 1),
    padding 640ms cubic-bezier(0.33, 0, 0.2, 1),
    box-shadow 640ms ease;
}

${/* THE SEAT'S MARK on what it just wrote: its own glyph, in its own hue, at
   the thing's top-right corner. It arrives with the change and fades with
   it. */ ""}
.graview-seat-marks {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: ${SCENE_LAYERS.seatMarks};
}
.graview-seat-mark {
  position: absolute;
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  margin: -8px 0 0 -8px;
  border-radius: 999px;
  border: 1px solid var(--graview-edge);
  background: var(--graview-float);
  color: oklch(0.62 0.16 var(--graview-hue, 250));
  font-size: 0.6875rem;
  line-height: 1;
  box-shadow: var(--graview-lift-low);
  animation: graview-seat-mark 4000ms ease-out forwards;
}
${/* A QUESTION THE SEAT ASKED, standing at the node it is about: it says
   itself and waits, because a dot nobody can read is a question nobody
   answers. It does not fade — an unanswered question is still open. */ ""}
.graview-seat-asking {
  position: absolute;
  transform: translate(-50%, -100%);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 260px;
  padding: 3px 9px 3px 6px;
  border-radius: 999px;
  border: 1px solid var(--graview-accent);
  background: var(--graview-float);
  color: var(--graview-ink);
  font-size: 0.75rem;
  line-height: 1.3;
  box-shadow: var(--graview-lift-low);
  pointer-events: auto;
}
.graview-seat-asking > [aria-hidden] {
  display: grid;
  place-items: center;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: var(--graview-accent);
  color: var(--graview-panel);
  font-size: 0.6875rem;
}
.graview-seat-asking-said {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes graview-seat-mark {
  0% { opacity: 0; transform: translateY(3px) scale(0.8); }
  8% { opacity: 1; transform: none; }
  80% { opacity: 1; }
  100% { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .graview-figure { transition: none; }
}

[data-graview-altitude] .graview-kind-card {
  overflow: visible;
}
${/* From altitude a district is a village on its plot, not a card: hovering
   it must not raise a white panel over the buildings. The lift stays in
   the stack, where the card is a card. */ ""}
[data-graview-altitude] .graview-kind-card:hover,
[data-graview-altitude] .graview-kind-card:focus-within {
  transform: none;
  box-shadow: none;
  background: transparent;
}

${/* THE GROUND UNDER A DISTRICT: its plot, drawn. Four lattice corners in
   the kind's hue, a curb, a cast shadow toward the light — the arithmetic
   the layout already did, made visible, so a district stands on land
   rather than floating on a hatch. Fades in with the altitude number the
   lattice fades in with; a hand-placed district's curb is dashed, which is
   the pinned mark on the ground rather than a box over the drawing. */ ""}
.graview-plots {
  z-index: ${SCENE_LAYERS.plots};
  opacity: var(--graview-altitude);
  transition: opacity 640ms cubic-bezier(0.33, 0, 0.2, 1);
}
.graview-plot-tile {
  fill: hsl(var(--graview-hue, 200) ${wash(iso.plot)});
  stroke: hsl(var(--graview-hue, 200) ${wash(iso.plotEdge)});
  stroke-width: 1;
  stroke-linejoin: round;
  pointer-events: auto;
  cursor: pointer;
  filter: drop-shadow(${scheme === "light" ? "5px 4px 6px rgba(20,30,32,0.14)" : "6px 5px 8px rgba(0,0,0,0.4)"});
  transition: fill 170ms ease;
}
.graview-plot-tile:hover {
  fill: hsl(var(--graview-hue, 200) 45% ${scheme === "light" ? "58%" : "48%"} / ${scheme === "light" ? "0.2" : "0.3"});
}
.graview-plot[data-graview-pinned] .graview-plot-tile {
  stroke-dasharray: 4 3;
}
${/* THE VILLAGE on the tile: one small iso building per member in the kind's
   own faces (the same roof and walls the block had), a flagged member's roof
   in the warning color, a selected member's building lit in the accent.
   Architecture, not controls: the tile under them takes the click. */ ""}
.graview-village { pointer-events: none; }
.graview-building polygon { stroke-width: 0.8; }
.graview-building[data-graview-flagged] .graview-iso-roof { fill: var(--graview-warn); stroke: var(--graview-warn); }
.graview-building[data-graview-selected] polygon { stroke: var(--graview-accent); stroke-width: 1.4; }
.graview-building[data-graview-selected] .graview-iso-roof { fill: color-mix(in oklab, var(--graview-accent) 45%, var(--graview-panel)); }
.graview-village-rest {
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  fill: var(--graview-ink-muted);
}
${/* THE ROADS between plots: the lattice's own two legs from curb to curb, a
   bed between two edges in the ground's ink. Under the tiles and the
   buildings, over the fields. A road the legend is asking about comes up
   in the accent. */ ""}
.graview-road-edge {
  fill: none;
  stroke: var(--graview-ink);
  stroke-opacity: ${scheme === "light" ? "0.28" : "0.4"};
  stroke-width: 7;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.graview-road-bed {
  fill: none;
  stroke: var(--graview-ground);
  stroke-width: 5;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.graview-road[data-graview-lit] .graview-road-edge {
  stroke: var(--graview-accent);
  stroke-opacity: 0.9;
}
${/* FIELDS. From altitude the ground darkens a shade toward the near edge and
   fades to the page at the horizon, so the lattice is land with a distance
   rather than paper with a pattern. */ ""}
.graview-ground[data-graview-altitude] {
  background:
    linear-gradient(to top, color-mix(in oklab, var(--graview-ground) ${scheme === "light" ? "93%" : "88%"}, var(--graview-ink)) 0%, var(--graview-ground) 78%),
    var(--graview-ground);
}

${/* THE OPEN CHEVRON APPEARS WHEN REACHED FOR. Drawn on every plate at
   altitude it was noise times the number of districts; it shows on hover,
   on keyboard focus, and while the district is open — and stays a real
   button in between, so Tab still finds it and Enter still opens. */ ""}
[data-graview-altitude] .graview-kind-open {
  opacity: 0.5;
  transition: opacity 150ms ease;
}
${/* Quiet: the chevron alone until reached for. Never opacity zero — a
   button nobody can see is a button a driven browser cannot press either,
   and Tab must land on something that looks like something. */ ""}
[data-graview-altitude] .graview-kind-open-word {
  display: none;
}
[data-graview-altitude] .graview-kind-card:hover .graview-kind-open,
[data-graview-altitude] .graview-kind-card:focus-within .graview-kind-open,
[data-graview-altitude] .graview-kind-open[aria-expanded="true"] {
  opacity: 1;
}
[data-graview-altitude] .graview-kind-card:hover .graview-kind-open-word,
[data-graview-altitude] .graview-kind-card:focus-within .graview-kind-open-word,
[data-graview-altitude] .graview-kind-open[aria-expanded="true"] .graview-kind-open-word {
  display: inline;
}
[data-graview-altitude] .graview-kind-open {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  ${/* A FINGERTIP, AND THE READER'S FINGERTIP IF IT IS BIGGER. 24px is the
     floor audit-ui holds every control to; 1.5rem is the same 24 at the
     default text size and grows with a reader who asked for more, so the
     control never drifts under the words it sits beside. A max() rather than
     either one alone: rem alone drops below the fingertip at a smaller
     setting, px alone ignores the setting altogether. */ ""}
  min-height: max(1.5rem, 24px);
  ${/* And as wide: at rest it is the chevron alone, 21px across without this. */ ""}
  min-width: max(1.5rem, 24px);
  padding: 1px 6px;
  margin: -3px 0;
  ${/* A QUIET BUTTON (FR-117): the chevron and, reached for, its word —
     never a capsule beside a name that is no longer one. */ ""}
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  box-shadow: none;
  color: var(--graview-ink-muted);
  cursor: pointer;
  ${/* IN REM, LIKE EVERY OTHER SIZE HERE. At 10px this control's words were
     the one piece of text in the framework that ignored the reader's text
     size completely: set to Largest, every name on the screen doubled and
     "open" stayed ten pixels tall. A size a person chose and a control that
     will not take it is the accessibility setting failing on its own
     surface. */ ""}
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  line-height: 1;
  white-space: nowrap;
}
[data-graview-altitude] .graview-kind-open:hover {
  color: var(--graview-accent);
  text-decoration: underline;
}
${/* THE BILLBOARD'S FULL-SCREEN CONTROL: the one way down from a picture. */ ""}
${/* THE RAIL A BILLBOARD IS MOVED BY: a title bar, in the board's own frame
   ink, along its top edge. Positioned like the full-screen control beside
   it — the host wraps its children, so the rail is a grandchild of the
   screen box and a child selector never reaches it. Wide enough to be an
   easy target, short enough that the picture underneath is still what you
   see, and present only at altitude, because only up there is the board
   standing on a plot it could be moved around. */ ""}
.graview-screen-grip {
  display: none;
}
[data-graview-altitude] [data-graview-screen] .graview-screen-grip {
  display: flex;
  align-items: center;
  gap: 8px;
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  ${/* Drawn height, not CSS height: a district's plane is scaled down at
     altitude, and 14 here reached the screen as an eight-pixel strip that
     took three attempts to catch. */ ""}
  height: 32px;
  padding: 0 6px 0 12px;
  box-sizing: border-box;
  cursor: grab;
  ${/* A title bar in the panel's own colors, not a gray strip: the board is
     a window onto the picture, and its bar reads as the window's. */ ""}
  background: var(--graview-panel-muted);
  border-bottom: 1px solid var(--graview-edge);
  z-index: ${SCENE_LAYERS.lines};
}
[data-graview-altitude] [data-graview-screen] .graview-screen-title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--graview-ink);
}
[data-graview-altitude] [data-graview-screen] .graview-screen-grip:active {
  cursor: grabbing;
}
.graview-screen-fullscreen {
  flex: 0 0 auto;
  min-height: max(1.5rem, 24px);
  padding: 1px 10px;
  border-radius: 999px;
  border: 1px solid var(--graview-edge);
  background: var(--graview-panel);
  color: var(--graview-accent);
  font-size: 0.8125rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: none;
}
.graview-screen-fullscreen:hover:not(:disabled) {
  border-color: var(--graview-accent);
}
[data-graview-altitude] .graview-kind-members > [data-graview-pick] {
  width: 100%;
  box-sizing: border-box;
  justify-content: flex-start;
  max-width: none;
}
${/* An OPENED district is a PANEL, not a pill with a list stuffed in it:
   name and count share the header line, the roster sits under a hairline,
   and the block behind fades — the plate IS the district while it is
   open, so no roof pokes out above the roster. */ ""}
[data-graview-altitude] .graview-kind-face[data-graview-opened] {
  ${/* A header that WRAPS rather than a grid that squeezes: the name's column
     was minmax(0, 1fr) beside the count's auto, so "VEHICLES" beside
     "291 · +29 past · close" got 25 pixels and the count was drawn over it. */ ""}
  display: flex !important;
  flex-wrap: wrap;
  justify-content: flex-start !important;
  align-items: baseline !important;
  column-gap: 10px;
  row-gap: 2px;
  border-radius: var(--graview-radius) !important;
  ${/* Open, the name is a panel's header again: the panel's own ground and edge. */ ""}
  background: var(--graview-panel) !important;
  border-color: var(--graview-edge) !important;
  text-shadow: none;
  padding: 10px 12px 11px !important;
  width: 236px;
  max-width: 236px;
  box-shadow: var(--graview-lift-high) !important;
}
[data-graview-altitude] .graview-kind-face[data-graview-opened] .graview-kind-members {
  flex: 1 0 100%;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--graview-edge);
}
[data-graview-altitude] .graview-kind-block[data-graview-opened] {
  opacity: calc(var(--graview-altitude) * 0.22);
}

${/* WHAT KIND OF THING THIS IS, astride the focus panel's top-right edge —
   the kind's dot and its name, the same thread the chips and the legend
   carry. Scene chrome, so no view has to remember to say it. */ ""}
.graview-kind-tag {
  position: absolute;
  top: -9px;
  right: 14px;
  z-index: ${SCENE_LAYERS.tag};
  display: var(--graview-kit-tags, inline-flex);
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  ${/* A label, not a choice: a tab's corners rather than a capsule (FR-117). */ ""}
  border-radius: 4px;
  ${/* The kind's own hue on the border and the words, so the tag and the
     district it belongs to read as one thread. */ ""}
  border: 1px solid hsl(var(--graview-hue, 200) 45% var(--graview-tint-lightness) / 0.55);
  color: hsl(var(--graview-hue, 200) 45% calc(var(--graview-tint-lightness) + ${scheme === "light" ? "-32%" : "28%"}));
  background: var(--graview-float);
  box-shadow: var(--graview-lift-low);
  font-size: 0.6875rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--graview-ink-faint);
  pointer-events: none;
}

${/* A LINE UNDER THE POINTER says it will take the press: the invisible hit
   run ghosts in, so editability is discoverable by hovering the relation
   itself rather than by rumor. */ ""}
.graview-edge-hit:hover {
  stroke: var(--graview-accent);
  opacity: 0.3;
}

${/* THE DISTRICTS THE ROW COULD NOT HOLD.
   Not a district: no figure, no count, no tint of its own. A card that is
   one control — how many more, and a press — and, open, a panel above the
   row naming every district with what it holds. Solid rather than dashed
   and faded: a dashed, translucent card read as a placeholder, and the only
   way to five districts should not look like something that failed to load. */ ""}
${/* A RELATION THE BAND COULD NOT HOLD: a group with its count and first names,
   or the door to the rest. A card like the others, never the kind's lens small. */ ""}
.graview-band-group {
  display: grid;
  align-content: center;
  gap: 2px;
  height: 100%;
  ${/* A card you press, held to the floor every pressable piece of chrome keeps. */ ""}
  min-height: max(1.75rem, 28px);
  box-sizing: border-box;
  padding: 6px 10px;
  border-radius: var(--graview-radius-sm, 8px);
  border: 1px solid var(--graview-edge);
  background: var(--graview-panel);
  color: var(--graview-ink);
  overflow: hidden;
  cursor: pointer;
}
.graview-band-group[data-graview-band="picture"] {
  border-style: dashed;
}
.graview-band-group[data-graview-emphasis="lit"] {
  border-color: var(--graview-accent);
}
.graview-band-group[data-graview-emphasis="dimmed"] {
  opacity: 0.5;
}
.graview-band-group-head {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}
.graview-band-group-name {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  font-size: 0.9375rem;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.graview-band-group-open {
  font-size: 0.75rem;
  color: var(--graview-accent);
}
.graview-band-group-names {
  font-size: 0.8125rem;
  line-height: 1.3;
  color: var(--graview-ink-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.graview-band-group-count {
  color: var(--graview-ink);
  font-variant-numeric: tabular-nums;
}
.graview-beyond {
  position: relative;
  height: 100%;
  box-sizing: border-box;
  border-radius: var(--graview-radius-sm, 8px);
  border: 1px solid var(--graview-edge);
  background: var(--graview-panel);
}
.graview-beyond-more {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  height: 100%;
  min-height: max(1.75rem, 28px);
  padding: var(--graview-pad-sm, 8px);
  box-sizing: border-box;
  border: none;
  border-radius: inherit;
  background: none;
  color: var(--graview-ink-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.875rem;
  text-align: left;
}
.graview-beyond-more:hover,
.graview-beyond[data-graview-beyond-open] .graview-beyond-more {
  color: var(--graview-accent);
  background: var(--graview-wash);
}
.graview-beyond-count {
  font-family: var(--graview-font-display);
  font-size: 1.1875rem;
  line-height: 1;
  color: inherit;
}
.graview-beyond-word {
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.graview-beyond-chevron {
  margin-left: auto;
  font-size: 0.8125rem;
}
${/* The panel stands above the card, inside the scene, and never clips: the
   card's box is a district's height, which holds a count and not a list. */ ""}
.graview-beyond-list {
  position: absolute;
  left: 0;
  bottom: calc(100% + 6px);
  ${/* On the ground, over every plane — the focused card on plane zero
     painted over a panel drawn on plane two, and a menu under a card is
     no menu. Above the zoom control too, which is the only other thing
     that stands on the ground. */ ""}
  z-index: ${layer("popover")};
  margin: 0;
  padding: 6px;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 1px;
  ${/* Its own width, not the ground's: portaled, a percentage here is the
     whole scene. */ ""}
  min-width: 200px;
  max-width: min(280px, 92%);
  max-height: 60vh;
  overflow: auto;
  border-radius: var(--graview-radius-sm, 8px);
  border: 1px solid var(--graview-edge);
  background: var(--graview-panel);
  box-shadow: 0 18px 44px -18px rgba(0, 0, 0, 0.45);
}
.graview-beyond-list button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  ${/* A FINGERTIP WHERE IT IS ACTUALLY DRAWN, not where it was designed.
     Every other control in this sheet is floored at 24 and the audit divides
     by the plane's scale before judging it, which is right for a control
     that sits ON a large target: the chip's disclosure is small, and the
     card behind it is the size of a card. These names are not that. They are
     the ONLY way to the districts the row could not hold, and plane two is
     drawn at 0.90 — so a designed 24 meets a finger as 21.7. Designed at 28
     it is drawn at 25, which is the number the floor was always about. */ ""}
  min-height: max(1.75rem, 28px);
  padding: 0 8px;
  border: none;
  border-radius: var(--graview-radius-sm, 6px);
  background: none;
  color: var(--graview-ink);
  cursor: pointer;
  font: inherit;
  font-size: 0.875rem;
  text-align: left;
  overflow-wrap: anywhere;
  white-space: nowrap;
}
.graview-beyond-list button:hover {
  color: var(--graview-accent);
  background: var(--graview-wash);
}
.graview-beyond-list button[aria-current] {
  color: var(--graview-ink-muted);
  cursor: default;
}
.graview-beyond-tally {
  margin-left: auto;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: var(--graview-ink-faint);
}
.graview-iso-roof {
  fill: hsl(var(--graview-hue, 200) ${face(iso.roof)});
  stroke: ${iso.roofEdge};
  stroke-width: 1;
}
.graview-iso-right {
  fill: hsl(var(--graview-hue, 200) ${face(iso.right)});
}
.graview-iso-left {
  fill: hsl(var(--graview-hue, 200) ${face(iso.left)});
}
${/* A SIGNPOST at the plot's front corner. From altitude the nameplate stood
   at the top of the card — over the back row of the village — and the
   screen had to clear it. It is planted at the front vertex of the tile
   now, on a short post, where a sign stands at the entrance to a place;
   the scene says where that vertex is in --graview-front-y. */ ""}
[data-graview-altitude] .graview-kind-face {
  position: absolute !important;
  left: 50% !important;
  top: 2% !important;
  transform: translateX(-50%);
  width: max-content;
  ${/* Wider than the block when the name is: a label overflows its building
     the way a map label does. "REQUIRE / MENTS" on two lines does not. */ ""}
  max-width: none;
  white-space: nowrap;
  height: auto !important;
  flex-direction: row !important;
  align-items: baseline !important;
  gap: 7px !important;
  padding: 3px 4px !important;
  ${/* TEXT ON THE PLOT, NOT A CAPSULE (FR-117). Every district's name stood
     in a pill — "PEOPLE 2 ◆ open ▾" — so the city read as a row of buttons
     and the one capsule that meant "press" did not stand out. A map writes
     a district's name on the ground: the words, haloed in the ground's own
     color so a lattice line or a roof under them never cuts a letter. */ ""}
  border-color: transparent !important;
  border-radius: 0 !important;
  background: none !important;
  box-shadow: none !important;
  text-shadow: 0 0 3px var(--graview-ground), 0 0 6px var(--graview-ground), 0 0 10px var(--graview-ground);
  z-index: ${SCENE_LAYERS.tag};
}
${/* How much of it is in trouble, as the name's baseline rather than a bar over a capsule. */ ""}
[data-graview-altitude] .graview-kind-face > [data-graview-tally] {
  top: auto !important;
  bottom: 0;
  height: 2px !important;
}
[data-graview-altitude] .graview-kind-face > [data-graview-tally]:not([data-graview-broken]) {
  opacity: 0;
}
[data-graview-altitude] [data-graview-plot] .graview-kind-face {
  top: calc(var(--graview-front-y) - 22px) !important;
}
[data-graview-altitude] [data-graview-plot] .graview-kind-face::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 100%;
  width: 1px;
  height: 10px;
  background: var(--graview-ink-faint);
}
${/* A landmark WITHOUT a plot — a nested card — keeps its plate floating
   above the drawing rather than across its head; one on a plot stands at
   the signpost like every other district (the rule above). */ ""}
[data-graview-altitude] [data-graview-landmark]:not([data-graview-plot] *) .graview-kind-face {
  top: 0 !important;
  transform: translate(-50%, calc(-100% - 7px));
}
${/* The drive-in's board hangs UNDER the signpost, in the ground the layout
   reserved for it below the tile's front corner, not over the village. */ ""}
[data-graview-altitude] .graview-drive-in {
  top: calc(var(--graview-front-y, 42px) + 12px);
}
${/* An OPENED district's listing takes the ground under the signpost; the
   board steps up over the village, which the listing covers anyway. */ ""}
[data-graview-altitude] .graview-kind-face[data-graview-opened] ~ .graview-drive-in {
  top: calc(var(--graview-front-y, 42px) - 22px - var(--graview-marquee-room, 0px) + 8px);
}
${/* THE LANDMARK STANDS IN THE SQUARE: its feet at the plot's center, among
   the buildings, rather than at the card's bottom edge — which, once the
   card grew for a board, was out in the road in front of the village. */ ""}
[data-graview-altitude] [data-graview-plot] .graview-kind-landmark {
  bottom: auto;
  top: calc(var(--graview-center-y, 50%) + 10px);
  transform: translate(-50%, -100%) scale(calc(0.55 + var(--graview-altitude) * 0.45));
}
${/* ZOOM, in the ground's corner: the way a map carries its own. Two
   fingertip-sized buttons and the level between them, shown from altitude. */ ""}
.graview-zoom {
  position: absolute;
  right: 16px;
  bottom: 16px;
  ${/* Above the occupants: a robot walking past a control must not cover it. */ ""}
  z-index: ${SCENE_LAYERS.zoom};
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  ${/* Quiet, as a map's own zoom is: a plain float, not a capsule (FR-117). */ ""}
  border-radius: 8px;
  border: 1px solid transparent;
  background: var(--graview-float, var(--graview-panel));
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}
.graview-zoom-button {
  min-width: 32px;
  min-height: 32px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--graview-ink);
  font: inherit;
  font-size: 1.0625rem;
  line-height: 1;
  cursor: pointer;
}
.graview-zoom-button:hover:not(:disabled) {
  background: var(--graview-edge);
}
.graview-zoom-button:disabled {
  opacity: 0.35;
  cursor: default;
}
.graview-zoom-level {
  min-width: 3.2em;
  text-align: center;
  font-size: 0.8125rem;
  color: var(--graview-ink-faint);
  font-variant-numeric: tabular-nums;
}

${/* THE SCREEN IS A BILLBOARD at the back of the village: a frame, and two
   posts into the ground at its foot. */ ""}
${/* On the NATURAL BOX, which is the picture now: the layout cuts the
   billboard to what the lens drew (measured by the scene), never shorter
   than a screen's worth — so the box is the picture, and an empty lens is a
   header over an empty screen rather than a strip floating over the
   village. The frame used to sit on the drawing itself, from the days the
   box was as tall as the window with the picture in its top third. It
   carries the panel's own ground so the empty part of a screen is a screen
   and not the field showing through a frame. */ ""}
[data-graview-altitude] [data-graview-screen] > [data-graview-natural],
[data-graview-altitude] [data-graview-screen] > :not([data-graview-natural]):not(.graview-kind-tag) {
  outline: 2px solid color-mix(in oklab, var(--graview-ink) 60%, var(--graview-panel));
  outline-offset: 0;
  background: var(--graview-panel);
}
[data-graview-altitude] [data-graview-screen] > :not([data-graview-natural]):not(.graview-kind-tag) {
  position: relative;
}
[data-graview-altitude] [data-graview-screen] > [data-graview-natural]::before,
[data-graview-altitude] [data-graview-screen] > [data-graview-natural]::after,
[data-graview-altitude] [data-graview-screen] > :not([data-graview-natural]):not(.graview-kind-tag)::before,
[data-graview-altitude] [data-graview-screen] > :not([data-graview-natural]):not(.graview-kind-tag)::after {
  content: "";
  position: absolute;
  top: 100%;
  width: 3px;
  height: 16px;
  background: color-mix(in oklab, var(--graview-ink) 60%, var(--graview-panel));
}
[data-graview-altitude] [data-graview-screen] > [data-graview-natural]::before,
[data-graview-altitude] [data-graview-screen] > :not([data-graview-natural]):not(.graview-kind-tag)::before { left: 22%; }
[data-graview-altitude] [data-graview-screen] > [data-graview-natural]::after,
[data-graview-altitude] [data-graview-screen] > :not([data-graview-natural]):not(.graview-kind-tag)::after { right: 22%; }

${/* A thing inside a view that is itself a thing: an event in a calendar, a
   person in a list. It has to look reachable, and it has to SHOW focus —
   these are the primary way anyone moves through the graph, so a keyboard
   user who cannot see where they are is stuck. */ ""}
${/* A card someone dragged into place. Marked, not decorated: a dotted tie to
   say this position is held rather than computed. */ ""}
${/* On the CHILD, not the host: the host is the layout's box, and a view
   that sizes to its content (a zoomed record, a fit panel) fills only part
   of it — a dashed box around the empty remainder read as a drawing
   mistake, not a mark. */ ""}
${/* And never on the natural box either — a view drawn scaled sits inside a
   box the size of the whole scene, and the mark belongs on the drawing, not
   on the box; nor on the kind tag, which is a label and not the thing. */ ""}
[data-graview-pinned] > :not([data-graview-natural]):not(.graview-kind-tag),
[data-graview-pinned] > [data-graview-natural] > * {
  outline: 1px dashed var(--graview-edge-bright);
  outline-offset: 3px;
  border-radius: var(--graview-radius);
}
${/* AND NOT FROM ALTITUDE, where a district is a village on a plot and its
   card is a box with nothing drawn in it: the dashed outline was the only
   visible part, so a hand-placed district read as an empty rounded
   rectangle sitting on the ground — several of them, in a picture that had
   no rectangles in it. The plot's own curb goes dashed up here, which is
   the same fact said where the district actually is. */ ""}
[data-graview-altitude] [data-graview-pinned] > :not([data-graview-natural]):not(.graview-kind-tag),
[data-graview-altitude] [data-graview-pinned] > [data-graview-natural] > * {
  outline: none;
}
[data-graview-stage="dom"] [data-graview-view] > :not([data-graview-natural]),
[data-graview-stage="dom"] [data-graview-view] > [data-graview-natural] > * {
  pointer-events: auto;
}
${/* THE RECORD IN FOCUS KEEPS TO ITS BOX (FR-141). Whatever draws it — the
   framework's record, a declared page at its head, a worker view — is held
   to the box the layout gave it: no taller than the box, scrolling inside
   when it is taller, from its top. A view centered on a box it outgrew
   spilled under the bar and over the cards it is tied to. A frame that
   scrolls its own body (a Panel) keeps doing so; the kind tag astride the
   frame's edge is not held. */ ""}
[data-graview-record-focus] > :not(.graview-kind-tag) {
  min-height: 0;
  max-height: 100%;
  overflow-y: auto;
  flex-shrink: 1;
}
[data-graview-view][data-graview-selected] {
  filter: drop-shadow(0 0 14px var(--graview-accent-dim));
}
[data-graview-touched] > * {
  animation: graview-touched 1100ms cubic-bezier(0.22, 1, 0.36, 1);
  border-radius: 10px;
}

${/* ------------------------------------------------------------ watching
 *
 * From outside the plane stack, activity has somewhere to HAPPEN: a kind
 * lights where an edit landed, an edge pulses where a relation was made or
 * broken, and a flag appears where a rule started failing. All of it is
 * derived from the op log — author, intent, reads and writes — and all of it
 * is drawn by these rules rather than by a frame loop, which is why watching
 * costs nothing while nothing is happening.
 *
 * Who moved is carried in HUE, not in a badge. A person is the accent the
 * whole interface already uses for "you did this"; an agent is a colder cast,
 * so a turn it took on its own is distinguishable at a glance from one you
 * directed; both at once takes both.
 */ ""}
[data-graview-activity] {
  --graview-activity: var(--graview-accent);
}
[data-graview-activity="autonomous"] {
  --graview-activity: hsl(212 72% 62%);
}
[data-graview-activity="co-edited"] {
  --graview-activity: hsl(280 60% 66%);
}
[data-graview-activity="rule"] {
  --graview-activity: var(--graview-warn);
}
[data-graview-view][data-graview-wrote] > * {
  animation: graview-landed 900ms cubic-bezier(0.22, 1, 0.36, 1);
  border-radius: 10px;
}
[data-graview-view][data-graview-read] > :not([data-graview-natural]):not(.graview-kind-tag),
[data-graview-view][data-graview-read] > [data-graview-natural] > * {
  outline: 1px dashed transparent;
  outline-offset: 3px;
  border-radius: 10px;
  animation: graview-considered 1800ms ease-out;
}

${/* A rule that has just begun to fail. It outlives the edit that caused it,
   because the problem does. */ ""}
[data-graview-view][data-graview-broke] > * {
  box-shadow: 0 0 0 1px var(--graview-warn), 0 0 22px -6px var(--graview-warn);
  border-radius: 10px;
}
[data-graview-connector][data-graview-activity] {
  animation: graview-relation 1200ms cubic-bezier(0.22, 1, 0.36, 1);
}`;
}

/** The scene's rules, scoped as the frame's sheet is: what the scene face draws beside `themeBaseCss`. */
export function sceneCss(scheme: Scheme = "dark", options: ThemeCssOptions = {}): string {
  const css = sceneSheet(scheme);
  return options.scope === undefined ? css : withinTheBox(css, options.scope);
}

/**
 * The whole theme as one stylesheet — the variables every primitive reads,
 * the rules every face draws on, and the scene's own after them — for a
 * page that draws the Shell. Everything the primitives reference is a
 * custom property, so a host can override a single token without forking a
 * component, and switching scheme is one `replaceSync`, not a re-render.
 */
export function themeCss(scheme: Scheme = "dark", brand: Brand = GRAVIEW_BRAND, options: ThemeCssOptions = {}): string {
  const css = `${baseSheet(scheme, brand, options)}\n${SPEC_VIEW_CSS}\n${sceneSheet(scheme)}`;
  return options.scope === undefined ? css : withinTheBox(css, options.scope);
}
