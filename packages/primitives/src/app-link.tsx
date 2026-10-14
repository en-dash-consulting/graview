import { LOCAL_LAYERS, safeFileHref, type AppResolution, type LinkedApp, type ResolveApp } from "@graview/core";
import { useEditableFields } from "@graview/react/drawing";
import { useGraviewIfAny } from "@graview/react/provider";
import { useContext, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { EditableValue } from "./editable.js";
import { ResolveAppContext } from "./resolve-app-context.js";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/*
 * ANOTHER APP, ON A RECORD (FR-171).
 *
 * An app-link field keeps another app's address; the host's `resolveApp`
 * says what that app is called for this viewer. Drawn here: its icon, its
 * name and — on a record — its home's headline, linked to where it opens.
 * Where the host says this viewer may not open it, "linked app (no access)"
 * and nothing of it. Where there is no resolver, or the host knows no such
 * app, the address plainly — a link only when it is an absolute http(s)
 * address. Fetched with the first app-link drawn, never in the first paint.
 */

export interface AppLinkProps {
  /** The address the record keeps. */
  readonly address: string;
  /** `record`: the name and the home's headline under it; `chip`: the name alone, on a row or a card. */
  readonly as?: "record" | "chip";
  /**
   * The record and field it is the value of, where it may be changed in
   * place: the control that changes it stands beside the link, never
   * around it, and only where an act may write it.
   */
  readonly nodeId?: string;
  readonly field?: string;
  readonly style?: CSSProperties;
}

type Viewer = Parameters<ResolveApp>[1];
type Answer = AppResolution | "asking";

/*
 * ASKED ONCE PER ADDRESS AND VIEWER, for every field that draws it: a list
 * of forty scenarios that each link the same house asks the host once.
 * Kept per resolver, so a host that hands a new one is asked afresh.
 */
const ASKED = new WeakMap<ResolveApp, Map<string, Promise<AppResolution>>>();
const ANSWERED = new WeakMap<ResolveApp, Map<string, AppResolution>>();
const keyOf = (address: string, viewer: Viewer) => `${viewer.kind}\u0000${viewer.id ?? ""}\u0000${address}`;

function ask(resolve: ResolveApp, address: string, viewer: Viewer): Promise<AppResolution> {
  const key = keyOf(address, viewer);
  let asked = ASKED.get(resolve);
  if (!asked) ASKED.set(resolve, (asked = new Map()));
  let answer = asked.get(key);
  if (!answer) {
    // A host that throws, or answers what is no answer, knows no such app as far as this field can tell: the address is drawn.
    answer = Promise.resolve()
      .then(() => resolve(address, viewer))
      .then(
        (app) => (isAnswer(app) ? app : null),
        () => null,
      )
      .then((app) => {
        let answered = ANSWERED.get(resolve);
        if (!answered) ANSWERED.set(resolve, (answered = new Map()));
        answered.set(key, app);
        return app;
      });
    asked.set(key, answer);
  }
  return answer;
}

/** Whether the host's answer is one this field can draw: an app with a name and an address, a refusal, or nothing. */
function isAnswer(app: unknown): app is AppResolution {
  if (app === null) return true;
  if (typeof app !== "object" || app === undefined) return false;
  if ((app as { denied?: unknown }).denied === true) return true;
  const found = app as Partial<LinkedApp>;
  return typeof found.name === "string" && found.name.trim() !== "" && typeof found.href === "string";
}

/** The address as a link a page may follow by itself — only an absolute http(s) address — else undefined. */
function plainAppHref(address: string): string | undefined {
  if (!/^https?:\/\//i.test(address)) return undefined;
  try {
    return new URL(address).href;
  } catch {
    return undefined;
  }
}

/** Where the app opens, if a page may follow it: a path on the host or an http(s) address. */
const openable = (href: string): string | undefined => plainAppHref(href) ?? (safeFileHref(href) ? href : undefined);

/** An icon that is a picture: a path on the host or an http(s) address. Else it is a glyph — an emoji, a letter or two. */
const pictured = (icon: string): string | undefined => plainAppHref(icon) ?? (icon.startsWith("/") && safeFileHref(icon) ? icon : undefined);

const NOBODY: Viewer = { kind: "human" };
const MUTED: CSSProperties = { color: "var(--graview-ink-muted)" };

function Icon({ icon }: { readonly icon: string | undefined }): ReactNode {
  if (!icon) return null;
  const src = pictured(icon);
  if (src) return <img src={src} alt="" width={20} height={20} data-graview-app-icon="" style={{ width: 20, height: 20, borderRadius: 5, objectFit: "cover", flex: "0 0 auto" }} />;
  const glyph = [...icon.trim()].slice(0, 2).join("");
  return glyph ? (
    <span aria-hidden="true" data-graview-app-icon="" style={{ flex: "0 0 auto", lineHeight: "20px" }}>
      {glyph}
    </span>
  ) : null;
}

/** The app the address names, as the host says it to this viewer. */
function useLinkedApp(address: string): Answer {
  const context = useGraviewIfAny();
  // The Shell's own resolver first, where a host handed it one; the provider's otherwise.
  const resolve = useContext(ResolveAppContext) ?? context?.resolveApp;
  const viewer: Viewer = context?.principal ?? NOBODY;
  const known = (): Answer => (resolve ? (ANSWERED.get(resolve)?.get(keyOf(address, viewer)) ?? "asking") : null);
  const [answer, setAnswer] = useState<Answer>(known);
  useEffect(() => {
    const now = known();
    setAnswer(now);
    if (now !== "asking" || !resolve) return;
    let live = true;
    void ask(resolve, address, viewer).then((app) => live && setAnswer(app));
    return () => {
      live = false;
    };
  }, [resolve, address, viewer.kind, viewer.id]);
  return answer;
}

export function AppLink({ address, as = "chip", nodeId, field, style }: AppLinkProps): ReactNode {
  const app = useLinkedApp(address);
  // Above the link a listed card is, so a press on the app opens the app (`.graview-spec-item-link`).
  const base: CSSProperties = { position: "relative", zIndex: LOCAL_LAYERS.raised, overflowWrap: "anywhere", minWidth: 0, maxWidth: "100%", ...style };
  let drawn: ReactNode;
  if (app === "asking") {
    drawn = (
      <span data-graview-app-link="" data-graview-app-state="asking" aria-busy="true" style={{ ...MUTED, ...base }}>
        Linked app
      </span>
    );
  } else if (app && "denied" in app) {
    // Not theirs to open: said, and nothing of the app — not its name, not its headline, not where it is.
    drawn = (
      <span data-graview-app-link="" data-graview-app-state="denied" style={{ ...MUTED, fontStyle: "italic", ...base }}>
        linked app (no access)
      </span>
    );
  } else if (!app) {
    // No host to ask, or one that knows no such app: the address, plainly.
    const href = plainAppHref(address);
    drawn = href ? (
      <a data-graview-app-link="" data-graview-app-state="plain" href={href} rel="noopener noreferrer" target="_blank" style={{ color: "var(--graview-accent)", display: "inline-flex", alignItems: "center", minHeight: 24, ...base }}>
        {address}
      </a>
    ) : (
      <span data-graview-app-link="" data-graview-app-state="plain" style={base}>
        {address}
      </span>
    );
  } else {
    const href = openable(app.href);
    const headline = as === "record" ? app.headline?.trim() : undefined;
    const Box = href ? "a" : "span";
    drawn = (
      <Box
        data-graview-app-link=""
        data-graview-app-state="found"
        {...(href ? { href } : {})}
        {...(!headline && app.headline ? { title: app.headline } : {})}
        style={{ display: "inline-flex", alignItems: headline ? "flex-start" : "center", minHeight: 24, gap: 8, color: "inherit", textUnderlineOffset: 3, ...base }}
      >
        <Icon icon={app.icon} />
        <span style={{ display: "grid", minWidth: 0 }}>
          <span data-graview-app-name="" style={{ fontWeight: 600 }}>
            {app.name}
          </span>
          {headline ? (
            <span data-graview-app-headline="" style={{ ...MUTED, fontSize: "0.8125em", fontWeight: 400 }}>
              {headline}
            </span>
          ) : null}
        </span>
      </Box>
    );
  }
  return nodeId && field ? <InPlace nodeId={nodeId} field={field} address={address} drawn={drawn} /> : drawn;
}

/** The app, and beside it the control that changes the address — where an act may write it. */
function InPlace({ nodeId, field, address, drawn }: { readonly nodeId: string; readonly field: string; readonly address: string; readonly drawn: ReactNode }) {
  const writable = useEditableFields(nodeId).fields.some((one) => one.field === field);
  if (!writable) return drawn;
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "baseline", gap: "4px 12px", maxWidth: "100%", minWidth: 0 }}>
      {drawn}
      <span style={{ fontSize: "0.8125rem" }}>
        <EditableValue nodeId={nodeId} field={field} value="Change" stored={address} />
      </span>
    </span>
  );
}

/** The part the door draws. */
export const drawAppLink = (props: AppLinkProps): ReactNode => <AppLink {...props} />;
