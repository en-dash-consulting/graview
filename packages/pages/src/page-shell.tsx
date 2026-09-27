import { LadderSetting, useMarkup } from "@graview/primitives";
import type { AnySchema } from "@graview/core";
import { Link, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { kindMap } from "./facts.js";
import { pluralSlug } from "./registry.js";
import { type PageContext, StartFreshLink, useStoreTick } from "./page-context.js";
import { placesOf } from "./page-places.js";
import { DISPLAY, WIDE, column, liveKinds, plain, pluralOf, quiet } from "./page-typography.js";


/**
 * The shell: the installation's masthead, one row of navigation, the way to
 * the scene. The pictures are the home, so they are not also a row of the
 * nav — the row is the kinds, the map and the standing, and on a phone it
 * scrolls sideways inside itself rather than wrapping to three rows over
 * the page.
 */
export function DefaultShell<S extends AnySchema>({
  context,
  children,
}: {
  context: PageContext<S>;
  children: ReactNode;
}) {
  const { store, brand, sceneHref = "/", invariantContext } = context;
  useStoreTick(store);
  const logo = useMarkup(brand?.logo);
  const location = useLocation();
  const problems = store.violations(invariantContext).length;
  const current = (path: string) =>
    path === "/"
      ? location.pathname === "/" || location.pathname === "/places" || location.pathname.startsWith("/places/")
      : location.pathname === path || location.pathname.startsWith(`${path}/`);
  const navLink = (path: string): React.CSSProperties => ({
    ...plain,
    fontSize: "0.9375rem",
    padding: "8px 0",
    flexShrink: 0,
    color: current(path) ? "var(--graview-ink)" : "var(--graview-ink-muted)",
    borderBottom: current(path) ? "2px solid var(--graview-accent)" : "2px solid transparent",
  });
  const tab = (path: string, label: ReactNode, extra?: React.CSSProperties) => (
    <Link key={path} to={path} style={{ ...navLink(path), ...extra }} {...(current(path) ? { "aria-current": "page" as const } : {})}>
      {label}
    </Link>
  );
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--graview-ground)",
        color: "var(--graview-ink)",
        fontFamily: "var(--graview-font-body, system-ui)",
        fontSize: "1.0625rem",
        lineHeight: 1.6,
      }}
    >
      <header style={{ borderBottom: "1px solid var(--graview-edge)", background: "var(--graview-bar)" }}>
        <div
          style={{
            maxWidth: WIDE,
            margin: "0 auto",
            padding: "14px 20px 0",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            {/* The masthead: the installation's mark and name, the way home. */}
            <Link
              to="/"
              data-testid="masthead"
              style={{
                ...plain,
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                fontFamily: DISPLAY,
                fontSize: "1.3125rem",
                fontWeight: 600,
                letterSpacing: "-0.01em",
                minHeight: 32,
              }}
            >
              {brand?.logo ? (
                <span
                  aria-hidden="true"
                  style={{ display: "inline-flex", color: "var(--graview-accent)" }}
                  // The logo is the brand's own markup, declared by the
                  // installation — not supplied by a user.
                  dangerouslySetInnerHTML={logo}
                />
              ) : null}
              {brand?.name ?? "Graview"}
            </Link>
            <a
              href={sceneHref}
              style={{ ...plain, ...quiet, marginLeft: "auto", whiteSpace: "nowrap" }}
              title="The same thing, as a scene"
            >
              Open the scene ↗
            </a>
          </div>
          {/*
            * ONE ROW. The home first — it is the pictures, when the face has
            * any — then the kinds, the map, and the standing at the end. On
            * a phone the row scrolls inside itself; `verify-pages` tells a
            * row that scrolls on purpose from a page that scrolls by accident.
            */}
          <nav
            aria-label="Pages"
            data-testid="shell-nav"
            style={{
              display: "flex",
              gap: 18,
              alignItems: "baseline",
              overflowX: "auto",
              whiteSpace: "nowrap",
              scrollbarWidth: "thin",
              minWidth: 0,
            }}
          >
            {tab("/", placesOf(context).length > 0 ? "Pictures" : "Home")}
            {liveKinds(store, context.principal).map((kind) => tab(`/${pluralSlug(store.schema, kind)}`, pluralOf(store, kind)))}
            {kindMap(store).relations.length > 0 ? tab("/map", "Map") : null}
            {tab(
              "/problems",
              <>
                Problems
                {problems > 0 ? (
                  <span
                    data-testid="problems-count"
                    style={{
                      fontSize: "0.8125rem",
                      lineHeight: 1,
                      padding: "3px 7px",
                      borderRadius: 999,
                      color: "var(--graview-warn)",
                      border: "1px solid var(--graview-warn)",
                    }}
                  >
                    {problems}
                  </span>
                ) : null}
              </>,
              // At the end of the row, set apart from the sections: the standing.
              { display: "inline-flex", alignItems: "center", gap: 6, marginLeft: "auto" },
            )}
          </nav>
        </div>
      </header>
      <div style={{ flex: 1 }}>{children}</div>
      <footer
        style={{
          borderTop: "1px solid var(--graview-edge)",
          padding: "18px 20px 28px",
          ...quiet,
          fontSize: "0.875rem",
        }}
      >
        <div style={{ maxWidth: WIDE, margin: "0 auto", display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <span>{brand?.name ?? "Graview"}</span>
          {/* Which rung answers, chosen here as it is in the scene's profile: the reader's own setting. */}
          {context.views ? <LadderSetting /> : null}
          {context.remembers ? (
            <span data-testid="remembered" style={{ marginLeft: "auto" }}>
              Remembered in this browser · <StartFreshLink />
            </span>
          ) : null}
        </div>
      </footer>
    </div>
  );
}

/**
 * A page's outer element: <main> when the face owns the document, a plain
 * section when it is embedded in a page that has its own — `main` allows no
 * other role, so the tag itself has to change.
 */
export function PageMain<S extends AnySchema>({
  context,
  style,
  children,
  ...rest
}: { context: PageContext<S>; style?: React.CSSProperties; children?: React.ReactNode } & Record<`data-${string}`, string>) {
  // Somebody above owns the landmark: the host page, or the app's own shell.
  const Tag = (context.embedded || context.framed ? "section" : "main") as "main";
  return (
    <Tag style={{ ...column, ...style }} {...rest}>
      {children}
    </Tag>
  );
}
