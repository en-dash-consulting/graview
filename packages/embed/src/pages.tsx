import type { AnySchema, Brand, Person, Principal, Store } from "@graview/core";
import { createViews, GraviewProvider, type Scheme } from "@graview/react";
import { useMemo, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { PagesContent, providerProps, storeOf, Strip, useFrame, useIntrinsicHeight, type EmbedHostContext, type FrameOptions } from "./frame.js";

/**
 * THE PAGES AND NOTHING ELSE (FR-19). `@graview/embed/pages` mounts the
 * routed face alone: no scene, no Graview, no studio, no lenses it would
 * never draw. A chat's widget or a phone's page that only ever shows the
 * pages bundles this, and a size budget in CI holds it to that
 * (`scripts/lib/bundle-budget.mjs`).
 *
 * It takes what the whole embed takes except what only the scene has (a
 * face, a stop, views, the studio), and its handle is the same less the
 * faces.
 */
export type PagesEmbedOptions<S extends AnySchema = AnySchema> = FrameOptions<S>;

export interface PagesEmbedProps<S extends AnySchema = AnySchema> extends PagesEmbedOptions<S> {
  /** Called when a seat on the strip is pressed; the host decides who sits. */
  readonly onSeat?: (principal: Principal) => void;
}

export function PagesEmbed<S extends AnySchema>(props: PagesEmbedProps<S>) {
  const { app, toggle = true, standing = "Everything is in order" } = props;
  const { rootRef, scope, css, scheme, store, presence, brand, auto, height } = useFrame(props);
  // The provider asks for a registry; the pages draw none of it.
  const views = useMemo(() => createViews(app.schema), [app.schema]);
  useIntrinsicHeight(rootRef, "pages", props.onIntrinsicHeight);
  return (
    <section
      ref={rootRef}
      className={scope}
      aria-label={props.label ?? app.name}
      data-graview-embed="pages"
      data-graview-scheme={scheme}
      style={{ position: "relative", height, minHeight: auto ? 0 : 320, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "var(--graview-radius, 12px)" }}
    >
      <style>{css}</style>
      <GraviewProvider store={store} views={views} scheme={scheme} {...providerProps(props, presence, brand)}>
        {toggle ? <Strip standing={standing} seats={props.seats} principal={props.principal} onSeat={props.onSeat} /> : null}
        <PagesContent<S> store={store} auto={auto} brand={brand} props={props} />
      </GraviewProvider>
    </section>
  );
}

export interface PagesEmbedHandle {
  setScheme(scheme: Scheme): void;
  /** Put another principal at the keyboard; the store and its history stay. */
  setSeat(principal: Principal): void;
  /** Offer other seats, or none: a seat switcher is drawn only for two or more. */
  setSeats(seats: PagesEmbedOptions["seats"]): void;
  /** Name other people: an agent who first acts after the page opened is named from the next render. */
  setPeople(people: readonly Person[]): void;
  /** What the host now says about its frame: the chat's theme changed, say. */
  setHostContext(context: EmbedHostContext): void;
  /** Re-dress the embed: another brand, or the same brand with a different kit. */
  setBrand(brand: Brand | undefined): void;
  readonly store: Store<AnySchema>;
  unmount(): void;
}

/**
 * Mounts the pages of an app into an element and hands back the controls.
 * The first render is synchronous, so what comes back is already on the page.
 */
export function mount<S extends AnySchema>(element: HTMLElement, options: PagesEmbedOptions<S>): PagesEmbedHandle {
  const store = options.store ?? options.remote?.store ?? storeOf(options.app, options.seed);
  let set: {
    scheme(scheme: Scheme): void;
    seat(principal: Principal): void;
    seats(seats: PagesEmbedOptions["seats"]): void;
    people(people: readonly Person[]): void;
    hostContext(context: EmbedHostContext): void;
    brand(brand: Brand | undefined): void;
  } | null = null;
  function Host() {
    const [scheme, setScheme] = useState<Scheme | "auto">(options.scheme ?? "auto");
    const [principal, setSeat] = useState<Principal | undefined>(options.principal);
    const [seats, setSeats] = useState<PagesEmbedOptions["seats"]>(options.seats);
    const [people, setPeople] = useState<readonly Person[] | undefined>(options.people);
    const [hostContext, setHostContext] = useState<EmbedHostContext | undefined>(options.hostContext);
    const [brand, setBrand] = useState<Brand | undefined>(options.brand);
    set = { scheme: setScheme, seat: setSeat, seats: setSeats, people: setPeople, hostContext: setHostContext, brand: setBrand };
    return (
      <PagesEmbed<S>
        {...options}
        store={store as never}
        {...(principal ? { principal } : {})}
        {...(seats ? { seats } : {})}
        {...(people ? { people } : {})}
        {...(hostContext ? { hostContext } : {})}
        {...(brand ? { brand } : {})}
        scheme={scheme}
        onSeat={setSeat}
      />
    );
  }
  const root: Root = createRoot(element);
  flushSync(() => root.render(<Host />));
  return {
    store: store as never,
    setScheme: (scheme) => flushSync(() => set?.scheme(scheme)),
    setSeat: (principal) => flushSync(() => set?.seat(principal)),
    setSeats: (seats) => flushSync(() => set?.seats(seats)),
    setPeople: (people) => flushSync(() => set?.people(people)),
    setHostContext: (context) => flushSync(() => set?.hostContext(context)),
    setBrand: (brand) => flushSync(() => set?.brand(brand)),
    unmount: () => root.unmount(),
  };
}

export { hostScheme } from "./frame.js";
export type { EmbedHostContext, EmbedRemote } from "./frame.js";
