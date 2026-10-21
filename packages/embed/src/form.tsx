import type { AnySchema, Brand, GraviewApp, Principal, Scheme, Store } from "@graview/core";
import { formVisitor } from "@graview/core/forms";
import { themeBaseCss } from "@graview/primitives/pages";
import { VisitorFormPage } from "@graview/pages/visitor-form";
import { useEffect, useId, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { fontsLink } from "./fonts.js";
import { storeOf, useHostScheme } from "./frame-light.js";

/**
 * `@graview/embed/form` — A FORM FOR A VISITOR, AND NOTHING ELSE (Roadmap
 * f-public-forms).
 *
 * An RSVP or a sign-up link opens on one act's form — the declaration's
 * `forms.<name>` — for somebody who never joins the workspace: no app bar,
 * no lists, no other records, no seat, no scene. The host mints a visitor
 * for each submission and hands its id (`principal: "form:<token>"`); the
 * form runs as that visitor, named for the form ("a visitor via the RSVP
 * form"), with the form's role and nothing else, over the store as the
 * visitor is served it (`remote`, opened as the same principal). On
 * submit it says the answer was received and what happens next, in the
 * declaration's words.
 *
 *   import { mount } from "@graview/embed/form";
 *   mount(el, { app, form: "rsvp", principal: "form:<token>", remote });
 *
 * Its own entry, and none of the frame the other faces share — no bar, no
 * notices, no first look — so the page carries the form and the theme
 * (`scripts/lib/bundle-budget.mjs`, "a visitor's form alone").
 */
export interface FormEmbedOptions<S extends AnySchema = AnySchema> {
  readonly app: GraviewApp<S>;
  /** The form's name in the declaration's `forms`. */
  readonly form: string;
  /**
   * WHO IS ANSWERING: the id the host minted for this submission
   * (`"form:<token>"`), made the form's visitor here (`formVisitor`) — or
   * that visitor whole, as the host minted it for its own store.
   */
  readonly principal: string | Principal;
  /** The store the visitor is served, opened as the same principal (`openRemote`). Or `store`; or, for a page that holds its own, a `seed`. */
  readonly remote?: { readonly store: Store<S> };
  readonly store?: Store<S>;
  readonly seed?: { readonly nodes: readonly unknown[]; readonly edges: readonly unknown[] };
  /** `"auto"` (the default) follows the host page's `data-theme`, then the brand's scheme, then the system's. */
  readonly scheme?: Scheme | "auto";
  /** The look it wears: the app's brand, unsaid. */
  readonly brand?: Brand;
  /** Fetch the brand's typefaces (the default), or leave them to the host. */
  readonly fonts?: boolean;
  /** The least height it takes: none (the default), or a CSS length — `"100dvh"` when the page is the form. */
  readonly height?: number | (string & {});
  /** Its accessible name: the form's title, unsaid. */
  readonly label?: string;
  /** The level the form's title is said at: `1` (the default) when the page is the form. */
  readonly heading?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Told once the answer is received; a host that allows another answer mounts again with a new visitor. */
  readonly onSubmitted?: (form: string) => void;
}

export function FormEmbed<S extends AnySchema>(props: FormEmbedOptions<S>) {
  const { app, form, principal: said, scheme: asked = "auto", brand = app.brand, fonts = true, height } = props;
  // A form the app has not got is said on the page ("There is no form here."), its visitor holding no role at all.
  const principal = useMemo<Principal>(() => (typeof said !== "string" ? said : app.forms?.[form] ? formVisitor(app, form, said) : { kind: "human", id: said, roles: [] }), [app, form, said]);
  const store = useMemo(() => props.store ?? props.remote?.store ?? storeOf(app, props.seed), [props.store, props.remote, app, props.seed]);
  const followed = useHostScheme(asked === "auto", brand?.scheme);
  const scheme: Scheme = asked === "auto" ? followed : asked;
  const scope = `graview-form-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const css = useMemo(() => themeBaseCss(scheme, brand, { scope: `.${scope}` }), [scheme, brand, scope]);
  // The brand's typefaces, fetched once per family set, without the host's help.
  useEffect(() => {
    if (!fonts || typeof document === "undefined") return;
    const href = fontsLink(brand);
    if (!href || document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }, [brand, fonts]);
  return (
    <section
      className={scope}
      aria-label={props.label ?? app.forms?.[form]?.title ?? app.name}
      data-graview-embed="form"
      data-graview-scheme={scheme}
      style={{ position: "relative", isolation: "isolate", ...(height === undefined ? {} : { minHeight: height }), background: "var(--graview-ground)", color: "var(--graview-ink)", fontFamily: "var(--graview-font-body, system-ui)" }}
    >
      <style>{css}</style>
      <VisitorFormPage<S> app={app} store={store} form={form} principal={principal} heading={props.heading ?? 1} {...(props.onSubmitted ? { onSubmitted: props.onSubmitted } : {})} />
    </section>
  );
}

export interface FormEmbedHandle {
  setScheme(scheme: Scheme | "auto"): void;
  readonly store: Store<AnySchema>;
  unmount(): void;
}

/**
 * Mounts a visitor's form into an element. The first render is
 * synchronous, so the form is on the page when this returns. A form the
 * declaration has not got is refused here, by its name.
 */
export function mount<S extends AnySchema>(element: HTMLElement, options: FormEmbedOptions<S>): FormEmbedHandle {
  if (!options.app.forms?.[options.form]) formVisitor(options.app, options.form, "form:");
  const store = options.store ?? options.remote?.store ?? storeOf(options.app, options.seed);
  let setScheme: ((scheme: Scheme | "auto") => void) | null = null;
  function Host() {
    const [scheme, set] = useState<Scheme | "auto">(options.scheme ?? "auto");
    setScheme = set;
    return <FormEmbed<S> {...options} store={store} scheme={scheme} />;
  }
  const root: Root = createRoot(element);
  flushSync(() => root.render(<Host />));
  return {
    store: store as never,
    setScheme: (scheme) => flushSync(() => setScheme?.(scheme)),
    unmount: () => root.unmount(),
  };
}
