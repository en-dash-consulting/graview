import { checkKitContrast, resolveKit, type KitOverrides, type Principal } from "@graview/core";
import { mount, mountWhenNear, type EmbedFace, type EmbedHandle } from "@graview/embed";
import { rotaApp } from "@graview/rota";
import { rotaViews } from "@graview/rota/views";
import rotaSeed from "../../rota/src/data/example.json";
import { seedbedBrand as SEEDBED_BRAND } from "./domain/brand.js";
import { CHAPTERS, type Chapter } from "./domain/chapters.js";
import { seedbedDesign } from "./ui/design.js";
import { seedbedPages } from "./ui/pages.js";
import { seedbedViews } from "./ui/views.js";

/**
 * THE CHAPTERS, LIVE, ON THE PAGE THAT EXPLAINS THIS THING.
 *
 * `docs/site/index.html` used to show a photograph per chapter. This is the
 * bundle that replaces each with the chapter itself: the same declaration,
 * the same seed, opened at the same stop the photograph was taken at, with
 * the three faces a click away. Built by `vite build --config
 * vite.site.config.ts` into `docs/site/chapters.js`; the page's own copy
 * loads it by name and the artifact build inlines it.
 */
declare global {
  interface Window {
    graviewChapters?: {
      mount: typeof mountChapter;
      mountRota: typeof mountRota;
      mountAll: typeof mountAll;
      chapters: readonly Chapter[];
      /** Every embed the page has mounted, by its element, so the page can re-dress or re-seat one. */
      handles: Map<HTMLElement, EmbedHandle>;
      /** Dress one mounted chapter in a kit: the chapter's own brand with the kit laid over it. */
      dress: typeof dress;
      /** What `graview check` would say about a kit's colours against this chapter's grounds. */
      kitFindings: typeof kitFindings;
    };
  }
}

/** The embeds the page holds, so a control on the page can reach the one it stands next to. */
export const handles = new Map<HTMLElement, EmbedHandle>();

export function mountChapter(element: HTMLElement, n: number, face?: EmbedFace, label?: string, stop?: string): EmbedHandle {
  const chapter = CHAPTERS[n - 1];
  if (!chapter) throw new Error(`No chapter ${n}; there are ${CHAPTERS.length}.`);
  const schema = chapter.app.schema;
  const handle = mount(element, {
    app: chapter.app,
    seed: chapter.seed,
    // The page's own say first, then the chapter's face (a pages chapter
    // opens on its pages), else the stop decides — altitude or the scene.
    ...(face ? { face } : chapter.face === "pages" ? { face: "pages" as const } : {}),
    ...(stop ?? chapter.stop ? { stop: (stop ?? chapter.stop)! } : {}),
    path: (chapter.path ?? "/pages").replace(/^\/pages/, "") || "/",
    ...(chapter.principal ? { principal: chapter.principal } : {}),
    ...(chapter.seats ? { seats: chapter.seats } : {}),
    /*
     * The cast here is the CHAPTER MODEL's, not the embed's: a chapter holds
     * a different schema per chapter, so `chapter.app` is a
     * `GraviewApp<AnySchema>` and `s` arrives erased. An app with one
     * declaration passes its own typed registry with no cast at all — see
     * the `src/embed.tsx` every scaffolded project now starts with.
     */
    /*
     * EVERY FLAG THE VIEWS TAKE. The season and the rotation were declared
     * on the chapters and never handed over, so on the page that explains
     * this thing a focused rotation drew the default roster of chips and
     * the calendar the chapter is about never appeared.
     */
    views: (s) => seedbedViews(s as never, { lens: chapter.lens, board: chapter.board, map: chapter.map ?? false, reach: chapter.reach ?? false, season: chapter.season ?? false, rotation: chapter.rotation ?? false, ...(chapter.studioOf ? { studio: chapter.studioOf } : {}) }) as never,
    ...(chapter.pages ? { pages: (chapter.design ? seedbedDesign(schema) : seedbedPages(schema)) as never } : {}),
    standing: chapter.studioOf ? "The declaration holds up" : "The garden keeps its agreements",
    // The page may name an embed itself: the opener carries chapter one
    // too, and two regions called "Chapter 1" is one landmark said twice.
    label: label ?? `Chapter ${chapter.n}`,
  });
  handles.set(element, handle);
  // The page hears that its embed is up, and can wire its controls to it.
  element.dispatchEvent(new CustomEvent("graview:mounted", { bubbles: true, detail: { chapter: chapter.n, handle } }));
  return handle;
}

/** The chapter's brand with a kit laid over it, on the embed in this element. */
export function dress(element: HTMLElement, n: number, kit: KitOverrides): void {
  const chapter = CHAPTERS[n - 1];
  const handle = handles.get(element);
  if (!chapter || !handle) return;
  const brand = chapter.app.brand ?? SEEDBED_BRAND;
  handle.setBrand({ ...brand, kit });
}

/** The kit's colours judged against the chapter's grounds, as `graview check` judges them. */
export function kitFindings(n: number, kit: KitOverrides): readonly { readonly edgeKind: string; readonly scheme: "light" | "dark"; readonly ratio: number; readonly requires: number; readonly unreadable?: string }[] {
  const chapter = CHAPTERS[n - 1];
  const brand = chapter?.app.brand ?? SEEDBED_BRAND;
  const resolved = resolveKit(kit);
  return (["light", "dark"] as const).flatMap((scheme) =>
    checkKitContrast(resolved, brand.schemes[scheme]).map((finding) => ({
      edgeKind: finding.edgeKind,
      scheme,
      ratio: finding.ratio,
      requires: finding.requires,
      ...(finding.unreadable !== undefined ? { unreadable: finding.unreadable } : {}),
    })),
  );
}

/*
 * THE ROTA, LIVE, BESIDE THE GARDEN.
 *
 * The lenses section claims one calendar over two domains: written for
 * the rota, unchanged over the garden. The page made the first half with
 * a photograph, because this bundle carried the garden's chapters alone.
 * The rota is the other product in the tree — a shift roster with a
 * policy, three seats and the same calendar lens — so it mounts here the
 * way a chapter does: its declaration, its example week, its own pictures,
 * its seats on the strip. The seats are the rota's own, restated rather
 * than imported, because importing its `ui` entry would bring the whole
 * app's interface into a bundle that only needs its declaration.
 */
const ROTA_SEATS: readonly { readonly label: string; readonly principal: Principal }[] = [
  { label: "Jo, coordinator", principal: { kind: "human", id: "user-jo", roles: ["coordinator"] } },
  { label: "Ada, volunteer", principal: { kind: "human", id: "user-ada", roles: ["volunteer"] } },
  { label: "Sam, viewer", principal: { kind: "human", id: "user-sam", roles: ["viewer"] } },
];
/** The rota's example week: the seed's shifts fall in it, so the calendar opens on something. */
const ROTA_WEEK = "2026-09-14";

export function mountRota(element: HTMLElement, stop?: string, label?: string, face?: EmbedFace): EmbedHandle {
  const handle = mount(element, {
    app: rotaApp as never,
    seed: rotaSeed as never,
    ...(face ? { face } : {}),
    stop: stop ?? `#view=the-week&in.at=${ROTA_WEEK}`,
    principal: ROTA_SEATS[0]!.principal,
    seats: ROTA_SEATS,
    views: () => rotaViews() as never,
    standing: "Every shift is covered",
    label: label ?? "The rota",
  });
  handles.set(element, handle);
  element.dispatchEvent(new CustomEvent("graview:mounted", { bubbles: true, detail: { app: "rota", handle } }));
  return handle;
}

/** Every `[data-graview-chapter]` and `[data-graview-app]` on the page, mounted as the reader comes near. */
export function mountAll(root: ParentNode = document): void {
  mountWhenNear([...root.querySelectorAll<HTMLElement>("[data-graview-chapter], [data-graview-app]")], (element) => {
    element.replaceChildren();
    if (element.dataset["graviewApp"] === "rota") {
      mountRota(element, element.dataset["stop"], element.dataset["label"], element.dataset["face"] as EmbedFace | undefined);
      return;
    }
    mountChapter(element, Number(element.dataset["graviewChapter"]), element.dataset["face"] as EmbedFace | undefined, element.dataset["label"], element.dataset["stop"]);
  });
}

window.graviewChapters = { mount: mountChapter, mountRota, mountAll, chapters: CHAPTERS, handles, dress, kitFindings };
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => mountAll());
else mountAll();
