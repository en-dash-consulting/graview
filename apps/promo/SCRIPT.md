# Graview intro — timed VO / on-screen script

Silent title cards stand in for VO until a voice file lands.
Composition: **~46s @ 30fps = 1380 frames** (36s story + ~10s outro @ 1.6×). Tagline spine: *Declare the domain. The application follows.*

**Pitch:** Graview is a **developer kit / SDK** — declare entities and relationships (a typed context graph), and it auto-builds an AI-ready full application (UI, navigation, mutations, agent tools, history) from that one declaration.

| Time | Frames | Beat | Line (VO / card) |
|------|--------|------|------------------|
| 0–~3.7s | 0–110 | Open brand | En Dash mark · *presents* · **GRAVIEW** |
| ~1–6s | 30–195 | Glyphs → constellation | `defineNode` types out · card: **Declare entities. Get the app.** |
| ~5.5–11s | 165–320 | Graph interface | Center Graview iso (lists → zoomed) + peripheral plates · **The graph is the interface.** → **UI, nav, tools — from one model.** (crossfade, fixed size) |
| ~10–14s | 290–420 | City altitude | Wordmark **GRAVIEW** + subtitle **A developer kit** (~4.3s) |
| ~13–28s | 400–850 | Relations demo | Schema (Person / Event / Step / Part) → **calendar · instructions · tools** bloom; Step “Replace filter” ↔ Part “HEPA cartridge”; agent tools rail |
| ~28–32s | 830–940 | En Dash bridge | Brief **En Dash** mark + wordmark lockup (no ToDo) |
| ~32–36s | 960–1080 | Settle lockup | “GRAVIEW · En Dash · @graview/*” + tagline |
| 36–~46s | 1080–1380 | Outro bumper | En Dash outro @ **1.6×** (~10s / 300 frames) |

## On-screen copy (story)

1. **En Dash presents GRAVIEW**
2. **Declare entities. Get the app.**
3. **The graph is the interface.**
4. **UI, nav, tools — from one model.**
5. **GRAVIEW** / **A developer kit**
6. **Entities + relationships.**
7. **Calendar · instructions · tools — same graph.**
8. **A step linked to its part.**
9. **AI-ready from the same graph.**
10. **En Dash** (brief bridge)
11. Tagline: *Declare the domain. The application follows.*

Supporting chrome (not hero titles): `typed context graph` · `owns` / `routes` / `covers` / `units` · `calendar · week` · `instructions · procedure` · `linked part · HEPA cartridge` · `agent tools · same graph`

## Optional VO takes (full read)

1. Declare the domain. The application follows.
2. Define the nodes — Person, Event, Step, Part — and the edges between them.
3. From that graph, Graview builds the application: UI, navigation, mutations, agent tools.
4. The graph is the interface — surfaces auto-derived from one model.
5. Graview is a developer kit.
6. Calendar, instructions, tools — same graph. A step linked to its part. AI-ready.
7. En Dash.
8. Graview. En Dash. At graview slash star.

## Notes

- No audio asset wired yet; cards are optional and can be muted by removing TitleCard / BigTitle usages.
- Prefer a dry, confident read; leave ~0.4s breath between beats.
- Product UI plates lean on **the household example / the coaching example / proposal** survey stills (diverse surfaces), not a ToDo-app cut.
- GraphInterface center uses **todo-graview-dark** → **todo-zoomed-dark** iso plates (legible context graph), not a featureless mint orb.
- BigTitle keeps fixed type size (no shrink-on-dock); prefer crossfade between lines.
- BrandMorph is a brief **En Dash** lockup only — ToDo sample→morph removed.
- Mid-story teaches **one graph → many surfaces** (calendar + procedure step↔part + agent tools), not calendar-only.
- Outro: `OffthreadVideo` `playbackRate={1.6}`; `OUTRO_FRAMES = 300`; dip-to-white → white bumper stitch preserved.
- RelationsDemo: center **todo-graview** iso behind calendar + procedure panels; removed errant dashed step→part SVG; “typed context graph” pill sits upper-third and fades before mid titles; agent rail cleared above title band.
- No “house brand” copy — BrandMorph is **En Dash** only.

---

# GraviewFeed — square social promo

Mute-first **1:1** cut for LinkedIn / Instagram feed (also works cropped to Stories).
Composition: **15s @ 30fps = 450 frames**, **1080×1080**. No En Dash outro bumper.
Render: `pnpm render:feed` → `out/graview-feed.mp4`.

**Pitch:** Graview is a **development kit from En Dash**. Declare entities + relationships (typed context graph) → kit auto-builds the AI-ready app (spatial UI / city, routed pages, forms, permissions, checks, agent tools).

**Tagline:** *Declare the domain. The application follows.*
**CTA:** `npm create graview@latest` · graview.dev

| Time | Frames | Beat | On-screen / visual |
|------|--------|------|--------------------|
| 0–2.0s | 0–60 | Magic hook | Typed chips (Plot · Person · Rule · Action) snap + mint edges → glass UI plate erupts from graph · micro: **One declaration.** |
| 2.0–5.0s | 60–150 | Tagline payoff | **Declare the domain.** → **The application follows.** (huge type, mint underline / flash) |
| 5.0–11.0s | 150–330 | Story montage | Graph / zoom → week (**Calendar from the graph.**) → selected (**Same buttons for you and your agent.**) → coverage (**Lenses that rebind.**) · Declare/Derive/Ship ticks as chrome |
| 11.0–13.2s | 330–396 | Identity lock | **GRAVIEW** · *A development kit from En Dash* |
| 13.2–15.0s | 396–450 | CTA | `npm create graview@latest` · graview.dev |

## Feed notes

- Magic first, teach second — open on the product transforming, not a pain slogan.
- Captions are the VO — assume silent scroll; safe margins ~56px (LinkedIn/IG crop).
- Punch-in every UI plate (object-fit cover + scale ~1.7–2.3) so it reads on a phone in square.
- Declare → Derive → Ship lives inside motion as chrome ticks, never as three static pitch cards.
- CTA ≤2s; no 10s En Dash outro.
- Assets: `public/survey/` + `public/site/` dark harness stills.
- Landscape `GraviewIntro` remains unchanged.
