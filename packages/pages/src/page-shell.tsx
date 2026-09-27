import { LadderSetting, useMarkup } from "@graview/primitives";
import type { AnySchema } from "@graview/core";
import { Link, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { kindMap } from "./facts.js";
import { placePath, pluralSlug } from "./registry.js";
import { type PageContext, StartFreshLink, useStoreTick } from "./page-context.js";
import { placesOf } from "./page-places.js";
import { DISPLAY, column, liveKinds, plain, pluralOf, quiet } from "./page-typography.js";


/** The shell: the installation's masthead, the kinds as its sections, the way to the scene. */
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
    location.pathname === path || location.pathname.startsWith(`${path}/`);
  const navLink = (path: string): React.CSSProperties => ({
    ...plain,
    fontSize: "0.9375rem",
    padding: "6px 0",
    color: current(path) ? "var(--graview-ink)" : "var(--graview-ink-muted)",
    borderBottom: current(path) ? "2px solid var(--graview-accent)" : "2px solid transparent",
  });
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
            maxWidth: 760,
            margin: "0 auto",
            padding: "14px 20px 0",
            display: "flex",
            flexDirection: "column",
            gap: 4,
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
          {/* THE SCENE'S BAR, MIRRORED: the app's pictures first, in its own words, then the kinds. */}
          {placesOf(context).length > 0 ? (
            <nav aria-label="Pictures" style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "baseline" }}>
              {placesOf(context).map((place) => {
                const path = placePath(place.as);
                return (
                  <Link key={place.as} to={path} style={navLink(path)} {...(current(path) ? { "aria-current": "page" as const } : {})}>
                    {place.title}
                  </Link>
                );
              })}
            </nav>
          ) : null}
          <nav
            aria-label="Kinds"
            style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "baseline" }}
          >
            {liveKinds(store, context.principal).map((kind) => {
              const path = `/${pluralSlug(store.schema, kind)}`;
              return (
                <Link
                  key={kind}
                  to={path}
                  style={navLink(path)}
                  {...(current(path) ? { "aria-current": "page" as const } : {})}
                >
                  {pluralOf(store, kind)}
                </Link>
              );
            })}
            {kindMap(store).relations.length > 0 ? (
              <Link to="/map" style={navLink("/map")} {...(current("/map") ? { "aria-current": "page" as const } : {})}>
                Map
              </Link>
            ) : null}
            <Link
              to="/problems"
              // At the end of the row, and at the end of the last row when
              // the kinds wrap: the standing, set apart from the sections.
              style={{ ...navLink("/problems"), display: "inline-flex", alignItems: "center", gap: 6, marginLeft: "auto" }}
              {...(current("/problems") ? { "aria-current": "page" as const } : {})}
            >
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
            </Link>
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
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
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
