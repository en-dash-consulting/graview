import type { ProposeChangeHost } from "@graview/react";
import { themeCss, type Scheme } from "@graview/primitives";
import { applySettings, useTidiedViews } from "@graview/react";
import { createRoot } from "react-dom/client";
import { useMemo, useState, type ReactNode } from "react";
import type { DevApp, DevAppChanges } from "./dev-change.js";
import { PagesApp } from "@graview/pages";
import { lendViewPressing } from "@graview/guest/host/pressing";

// A draft's controls are pressed before anybody sees it: a page that draws PagesApp itself, not the embed, lends the headless run as the embed does.
lendViewPressing(() => import("@graview/guest/headless/pressed-here"));
import { aiThroughDevServer, type HostAi } from "@graview/tools";
import { filesAt } from "@graview/ship/browser";
import { memorySubscriptions, type SubscriptionMatch, type SupportDeclaration } from "@graview/core";
import { memorySupport } from "@graview/core/rooms";
import type { HistoryHost } from "@graview/core/history";
import { open } from "./open.js";
import { todoApp } from "./domain/app.js";
import { thingsBrand } from "./domain/brand.js";
import { today, TodoApp, todoSeat, todoStudio } from "./ui/app.js";
import { thingsDesign } from "./ui/design.js";
import { todoViews } from "./ui/views.js";

/*
 * ONE FACE. Things is one `PagesApp` at `/`: every page stands over the
 * Scene's own city, and one control at the window's foot moves the page
 * itself from Page to Nearby to Map. `?scene=off` reads the pages as the
 * routed face alone (`sceneUnderPages: false`).
 *
 * `/scene/` is not part of the example. It draws the Scene's own face
 * (`Shell`, in `ui/app.tsx`) only so the harnesses of the Scene's own hand
 * — its districts, its drive-in, its bar — keep driving it until they are
 * moved onto the one face. Nothing links a person there.
 */
const sceneOwnFace = window.location.pathname === "/scene" || window.location.pathname.startsWith("/scene/");

const sheet = new CSSStyleSheet();
document.adoptedStyleSheets = [sheet];

const STORED = "graview:scheme";

function initialScheme(): Scheme {
  const asked = new URLSearchParams(window.location.search).get("theme");
  if (asked === "light" || asked === "dark") return asked;
  try {
    const stored = localStorage.getItem(STORED);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // A scheme that cannot be remembered still applies for this visit.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyScheme(scheme: Scheme): void {
  // The declared brand, not the framework's own — `themeCss` takes one.
  sheet.replaceSync(themeCss(scheme, thingsBrand));
  document.documentElement.dataset["graviewScheme"] = scheme;
  try {
    localStorage.setItem(STORED, scheme);
  } catch {
    // Same again: not being able to remember is not a reason to fail.
  }
}

const scheme = initialScheme();
applyScheme(scheme);

/*
 * THE READER'S OWN SETTINGS, APPLIED BEFORE ANYTHING RENDERS.
 *
 * Here rather than in a component, for the same reason the scheme is here:
 * it is a fact about the person and their browser, it belongs to the
 * document, and this app has two faces on two paths that must not disagree
 * about how big the words are.
 */
applySettings(todoApp.settings ?? []);

const root = document.getElementById("root");
if (!root) throw new Error("no #root");

/*
 * THE APP REMEMBERS. Persistence is the op log, and `openStore` is the
 * lifecycle every deployment repeats — here with the browser adapter, so an
 * edit survives a reload, attributed and undoable, and the example is the
 * FIRST load rather than every load. `?fresh=1` (the "Start fresh" control)
 * returns to the example; a driven browser starts fresh unless it asks to
 * remember, so the harnesses keep specifying the example rather than their
 * own residue.
 */
/*
 * THE SAME WAY IT OPENS ANYWHERE. `open()` is what the launcher mounts
 * through too, so "Things remembers" is one fact rather than one fact here
 * and a different one on the desk.
 */
const { opened, principal, remembers, presence } = await open();

/*
 * THE AI IS THE HOST'S TO GIVE. Things ships with none: the graph answers
 * what is here, what is wrong and what a task says, and an open question
 * is told AI isn't on. A host with a model passes it as `ai` — Graview
 * Cloud passes its own — and a reader is never asked which. The harnesses
 * hand this example one the same way, before it loads.
 */
/*
 * A MODEL IN DEVELOPMENT. Started with `ANTHROPIC_API_KEY=… pnpm dev`, the
 * dev server lends the seat one through its door (`aiDevProxy`), holding
 * the key itself; without a key the seat says how to turn it on. Only in a
 * dev build: a built page asks no door and says what any product says.
 */
/*
 * THE INLINE AI, BY STUB (Roadmap f-ai-candidate-catalog). `?ai=stub` in a
 * dev build fills the Fast and Thinking slots with stubs that answer from
 * the catalog alone, with no network and no key, so the context menu's
 * suggestions, a ghost and a drawn panel can be seen and driven
 * (`verify-inline-ai`). `?ai=off` is a host saying AI is off: every AI
 * part, on both faces, is not drawn.
 */
const askedAi = new URLSearchParams(window.location.search).get("ai");
async function stubbedAi(): Promise<HostAi> {
  const { stubFast, stubThinking } = await import("@graview/tools/inline-ai");
  return { name: "stub", fast: stubFast({ model: "stub-fast", prefer: [/Finish it/, /second quote/, /Book the van/] }), thinking: stubThinking({ model: "stub-thinking" }) };
}
const dev = (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;
const ai =
  (window as unknown as { __todoAi?: HostAi }).__todoAi ??
  (askedAi === "off" ? { off: true } : dev && askedAi === "stub" ? await stubbedAi() : dev ? { ...(await aiThroughDevServer()), hoverChips: true } : undefined);

/*
 * WHERE A TASK'S ATTACHMENTS GO (FR-163). In development, the dev server's
 * door (`devFiles` in vite.config.ts), which keeps them in memory; a built
 * page has no door, hands no `files`, and the editor says this host takes
 * none.
 */
const files = (import.meta as { env?: { DEV?: boolean } }).env?.DEV ? filesAt("/__graview/files", { maxBytes: 10_000_000, kinds: ["image/*", "application/pdf", "text/plain"] }) : undefined;

/*
 * NOTIFY ME (Roadmap f-notify-subscriptions). Things keeps a reader's
 * subscriptions in this page and is its own host's hook: each batch
 * somebody else commits that a subscription asked about — judged as its
 * subscriber may see it — is said once, here in the console, where Graview
 * Cloud sends an email or a push. A served app gives the hook to its server
 * instead (`createStoreHandler`'s `onSubscriptionMatch`). The matcher is
 * fetched once the page is up; a harness reads what it was told as
 * `__notified`.
 */
const subscriptions = memorySubscriptions();
void import("@graview/core/subscriptions").then(({ watchSubscriptions }) =>
  watchSubscriptions(opened.store, {
    subscriptions,
    app: todoApp.name,
    onSubscriptionMatch: (match) => {
      ((window as unknown as { __notified?: SubscriptionMatch[] }).__notified ??= []).push(match);
      console.info(`Notify ${match.subscription.who.name ?? match.subscription.who.id}: ${match.said}`);
    },
  }),
);

/*
 * CHAT WITH THE PEOPLE WHO KEEP THINGS (Graview HQ feature:f-support-chat).
 * In development the person's menu offers "Chat with Things support", its
 * thread kept in this page by `memorySupport`, which answers a while later
 * as staff would; Graview Cloud hands its own staff transport instead. A
 * harness hands its own as `__todoSupport` before the page loads, and a
 * built page or a driven browser is offered none.
 */
const support = (window as unknown as { __todoSupport?: SupportDeclaration }).__todoSupport ?? (dev && !navigator.webdriver ? { title: "Things support", transport: memorySupport({ staffName: "Ada at Things", delayMs: 1500 }) } : undefined);

/*
 * WHAT THE HOST KEEPS OUTSIDE THE LOG (Roadmap f-playback): Things keeps
 * nothing, so a harness that compacts the store hands the archive it made
 * (`HistoryHost.archived`, FR-196) as `__todoHistory` before the page loads.
 */
const history = (window as unknown as { __todoHistory?: HistoryHost }).__todoHistory;
/*
 * WHERE A CHANGE TO THE APP THE SEAT PROPOSED IS APPLIED (Roadmap
 * f-seat-reshape): Things keeps its declaration in code, so it has no path
 * to apply one; a harness hands a stub host as `__todoProposeChange` before
 * the page loads, and without one the seat never offers the change.
 */
const onProposeChange = (window as unknown as { __todoProposeChange?: ProposeChangeHost }).__todoProposeChange;
/* The seat proposes a change to a document, and Things is code: with a host to apply one, it remembers itself as the document it would be. */
if (onProposeChange) {
  const { rememberDocument, toDocument } = await import("@graview/core/document");
  rememberDocument(todoApp, toDocument(todoApp).document);
}
/*
 * YES CHANGES THE APP, IN DEVELOPMENT (Roadmap f-menu-type-anything): on
 * `pnpm dev` — never a build, never a driven browser, never beside a
 * harness's own host — the quick ask's plan for something the app lacks
 * is composed over this code app and, on Yes, laid over it in place with
 * its records, the store kept beside it and one undo taking both back
 * (`dev-change.ts`). Nothing is written to the checkout; it is kept until
 * the page reloads.
 */
// A harness that means to press Yes says so (`__todoDevHost`): a driven browser has none otherwise.
const devChanges = dev && !onProposeChange && (!navigator.webdriver || (window as unknown as { __todoDevHost?: boolean }).__todoDevHost === true) ? await import("./dev-change.js") : undefined;

/*
 * MAKE THIS SECTION BETTER, IN DEVELOPMENT (Roadmap
 * f-make-this-section-better): on `pnpm dev` — never a build, never a
 * driven browser — a worker view of Things' own, "At a glance", with three
 * named sections a right-click can make better, kept in memory until the
 * page reloads (`dev-section.ts`).
 */
const devSection = dev && !navigator.webdriver ? await import("./dev-section.js") : undefined;
const keptViews = devSection?.devKeptViews();

/*
 * The routed face's views: Things' own over the app as it stands (a change
 * to its view spec in development draws), in development "At a glance" and
 * the pages made views of their own (Roadmap f-make-any-page-better), tidied
 * as the dev page's views host says.
 */
function usePagesViews(app: DevApp["app"]) {
  const own = useMemo(() => (devSection ? devSection.withAtAGlance(todoViews(app)) : todoViews(app)), [app]);
  const forked = devSection ? devSection.useForked(own, keptViews!) : own;
  return useTidiedViews(forked, keptViews);
}

/** The app and its store as they stand — changed in place by a plan in development — handed to the face. */
function Changing({ children }: { readonly children: (shown: DevApp, host: DevAppChanges | undefined, pagesViews: () => ReturnType<typeof todoViews>) => ReactNode }) {
  const start = useMemo<DevApp>(() => ({ app: todoApp as never, store: opened.store as never }), []);
  const [shown, setShown] = useState<DevApp>(start);
  const views = usePagesViews(shown.app);
  const host = useMemo(() => devChanges?.devAppChanges(start, setShown, { principal }), [start]);
  return <>{children(shown, host, () => views)}</>;
}
// `?scene=off`: the routed face alone, with its switch to the Scene's own face (the fixture at `/scene/`).
const sceneOff = new URLSearchParams(window.location.search).get("scene") === "off";
if (!sceneOwnFace) {
  createRoot(root).render(
    <Changing>
      {(shown, host, pagesViews) => (
    <PagesApp
      context={{
        store: shown.store as typeof opened.store,
        brand: thingsBrand,
        signature: true,
        /*
         * ONE FACE, unsaid: the Scene's own city under every page, one
         * camera moving the same page from Page to Nearby (a panel beside
         * its record's building) to Map (the whole city). `?scene=off`
         * reads the pages as the routed face alone.
         */
        ...(sceneOff ? { sceneUnderPages: false, sceneHref: "/scene/?scene=off" } : {}),
        invariantContext: { today: today() },
        /*
         * THE SEAT. The pages list the kinds this seat may see and withhold
         * the acts it may not, from the app's own policy, and the city under
         * them narrows by the same — `?as=user-sam` sits somebody down.
         */
        principal,
        remembers,
        /*
         * THE APP'S PICTURES: the registry the city draws from, so every
         * named lens is a page and a view on its district, and the nav is the bar.
         */
        views: pagesViews(),
        ...(keptViews ? { keptViews } : {}),
        settings: todoApp.settings ?? [],
        app: shown.app as typeof todoApp,
        ...(presence ? { presence } : {}),
        ...(ai ? { ai } : {}),
        ...(files ? { files } : {}),
        subscriptions,
        ...(support ? { support } : {}),
        ...(history ? { history } : {}),
        ...(onProposeChange ? { onProposeChange } : host ? { onProposeChange: host.onProposeChange, composeChange: host.composeChange, onDraftChange: host.onDraftChange } : {}),
        /*
         * THE SEAT AND THE STUDIO, on the one bar: the seat in the bell's
         * Activity, the studio in the person's menu under "Keeping this app".
         */
        seat: todoSeat,
        studio: todoStudio,
      }}
      /*
       * THE APP'S OWN FACE, over the same derivations. Every surface is
       * replaced; nothing here reaches past the framework. The routes it
       * does not register — the not-found page, which has no kind to
       * register on — render the framework's own inside this shell.
       */
      registry={thingsDesign(todoApp.schema)}
    />
      )}
    </Changing>,
  );
} else {
  createRoot(root).render(
    <Changing>
      {(shown, host) => (
    <TodoApp
      store={shown.store as typeof opened.store}
      app={shown.app}
      principal={principal}
      remembers={remembers}
      presence={presence}
      {...(ai ? { ai } : {})}
      {...(files ? { files } : {})}
      subscriptions={subscriptions}
      {...(history ? { history } : {})}
      {...(onProposeChange ? { onProposeChange } : host ? { onProposeChange: host.onProposeChange, composeChange: host.composeChange } : {})}
      {...(devSection ? { moreViews: devSection.withAtAGlance } : {})}
      {...(keptViews ? { keptViews } : {})}
      syncUrl
      renderer="auto"
      initialScheme={scheme}
      onSchemeChange={applyScheme}
    />
      )}
    </Changing>,
  );
}

// A flag a harness can wait for, rather than a timer and a hope.
(window as unknown as Record<string, unknown>)["__todoReady"] = { renderer: "auto", scheme };
