import { EMBED_ORIGINS, EMBED_WORDS, embedKey, embedLink, embedPlays, embedSrc, embedTitle, namedEmbed, type EmbedHost, type NamedEmbed } from "./embeds.js";

/*
 * A VIDEO ON YOUTUBE OR VIMEO, PLAYED WHERE A VIEW PLACED IT (HQ
 * f-view-video-embeds). The host draws all of it, in the shadow root of the
 * view's `<graview-video>`: a poster and a play button, the player once the
 * person presses it, and a link to the provider's own page throughout.
 *
 * NOTHING IS ASKED OF THE PROVIDER BEFORE THE PRESS: the poster is the
 * host's own, or a picture the view was already allowed to draw (`poster`,
 * judged as any image of its is). The player is a frame whose address the
 * host built from a checked id (embeds.ts), sandboxed to its scripts and its
 * own storage — it opens no window and never moves this page; the link is
 * how a person goes to the provider — and told this page's origin alone,
 * which YouTube's player answers an error without.
 *
 * IT STOPS WHEN IT IS NO LONGER THERE TO SEE: taken off the page, hidden
 * with the place it was on, or another one played, it goes back to its
 * poster. A view's redraw is none of those: while the video it names is the
 * same, what is drawn in the element is kept.
 */

export interface EmbedPlayers {
  /** Draw (or keep) what the element names; why nothing was, as the rest of a sentence about it. */
  draw(element: Element, shadow: ShadowRoot): string | undefined;
  /** The element names no video on a provider any longer: what was drawn for one is let go. */
  forget(element: Element): void;
  /** Stop whatever plays. */
  dispose(): void;
}

export interface EmbedPlayerOptions {
  readonly embeds?: EmbedHost;
  /** The page's own policy refused the player: why, as the rest of a sentence about it. */
  readonly onRefused: (why: string) => void;
}

interface Drawn {
  readonly key: string;
  readonly says: (title: string, poster: string | null, embed: NamedEmbed) => void;
  readonly stop: () => void;
}

const CSS = `
:host { display: block; min-width: 0; }
figure { margin: 0; display: grid; gap: 6px; color: var(--graview-ink, CanvasText); font-family: var(--graview-font-body, system-ui, sans-serif); line-height: 1.4; text-align: start; }
[data-frame] { position: relative; overflow: hidden; width: 100%; container-type: inline-size; border-radius: var(--graview-radius, 8px); background: #17191d; color: #fff; }
[data-frame] > * { position: absolute; inset: 0; width: 100%; height: 100%; box-sizing: border-box; border: 0; margin: 0; }
img { display: block; object-fit: cover; }
[data-words] { display: grid; place-content: center; padding: 16px; text-align: center; overflow-wrap: anywhere; }
button { display: grid; place-content: center; justify-items: center; gap: 10px; padding: 16px; background: rgb(0 0 0 / 0.6); color: #fff; font: inherit; font-weight: 600; text-align: center; cursor: pointer; border-radius: inherit; touch-action: manipulation; }
button > span { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; }
button > svg { width: min(64px, 30cqw); height: auto; }
button:hover { background: rgb(0 0 0 / 0.55); }
:focus-visible { outline: 2px solid var(--graview-ring-color, Highlight); outline-offset: 2px; }
button:focus-visible { outline: 3px solid #fff; outline-offset: -6px; box-shadow: inset 0 0 0 3px #000; }
figcaption { font-size: 0.875rem; overflow-wrap: anywhere; }
a { color: var(--graview-accent, LinkText); display: inline-block; padding-block: 3px; }
[data-address] { display: none; }
@media print { iframe { opacity: 0; } svg, img ~ button { display: none; } [data-frame] { background: none; color: inherit; outline: 1px solid; outline-offset: -1px; } button { background: none; color: inherit; } [data-address] { display: inline; } }
`;

/* One plays at a time, whichever view it is in: the last one's way back to its poster. */
let playing: (() => void) | undefined;

export function createEmbedPlayers(window: Window & typeof globalThis, options: EmbedPlayerOptions): EmbedPlayers {
  const document = window.document;
  const drawn = new Map<Element, Drawn>();
  const part = <K extends keyof HTMLElementTagNameMap>(name: K, mark?: string): HTMLElementTagNameMap[K] => {
    const element = document.createElement(name);
    if (mark) element.setAttribute(mark, "");
    return element;
  };

  const make = (element: Element, shadow: ShadowRoot, first: NamedEmbed, offered: boolean, preview: boolean, key: string): Drawn => {
    const provider = EMBED_WORDS[first.provider];
    const origin = EMBED_ORIGINS[first.provider];
    let embed = first;
    let title = "";
    shadow.replaceChildren();
    const style = part("style");
    style.textContent = CSS;
    const figure = part("figure");
    figure.setAttribute("role", "group");
    const frame = part("div", "data-frame");
    const image = part("img");
    image.alt = "";
    image.referrerPolicy = "no-referrer";
    const words = part("div", "data-words");
    const button = part("button", "data-graview-embed-play");
    button.type = "button";
    button.innerHTML = '<svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true"><circle cx="32" cy="32" r="31" fill="#000" fill-opacity=".72" stroke="#fff" stroke-width="2"/><path d="M26 20v24l20-12z" fill="#fff"/></svg>';
    const name = part("span");
    button.append(name);
    const caption = part("figcaption");
    const link = part("a");
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.referrerPolicy = "no-referrer";
    const address = part("span", "data-address");
    caption.append(link, address);
    if (offered) figure.append(frame);
    figure.append(caption);
    shadow.append(style, figure);
    /* A press on the player is the player's: the card around it is not opened, and the view is told nothing. */
    const own = (event: Event) => {
      const pressed = (event as KeyboardEvent).key;
      if (event.type !== "keydown" || pressed === "Enter" || pressed === " ") event.stopPropagation();
    };
    for (const type of ["click", "dblclick", "keydown"]) figure.addEventListener(type, own);
    /* Once the page's policy refused it, the video is its link. */
    let refused = false;
    let end = () => {};

    const refuse = () => {
      const had = shadow.activeElement !== null;
      refused = true;
      end();
      button.remove();
      words.textContent = `${provider} videos do not play on this page. The link below opens this one.`;
      words.style.background = "rgb(0 0 0 / 0.72)";
      words.setAttribute("role", "status");
      frame.append(words);
      if (had) link.focus({ preventScroll: true });
      options.onRefused(`names a ${provider} video, and the page's policy allows no frame from ${origin} (frame-src): its link stands alone`);
    };

    const play = () => {
      if (refused) return;
      playing?.();
      const player = part("iframe");
      player.setAttribute("data-graview-embed", first.provider);
      player.title = `${title} (${provider} player)`;
      player.setAttribute("sandbox", "allow-scripts allow-same-origin");
      player.setAttribute("allow", "autoplay; encrypted-media; fullscreen; picture-in-picture");
      player.setAttribute("allowfullscreen", "");
      player.setAttribute("loading", "lazy");
      /* The page's origin and nothing more of it: YouTube's player plays for no page that says none. */
      player.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      player.setAttribute("src", embedSrc(embed));
      /* Where the page's own policy refuses the frame: the link and why, never an empty box. */
      const violated = (event: SecurityPolicyViolationEvent) => {
        if (event.disposition !== "report" && /^(frame|child|default)-src/.test(event.effectiveDirective) && `${event.blockedURI}/`.startsWith(`${origin}/`)) refuse();
      };
      /* Off the page, or hidden with the place it was on. */
      const gone = () => {
        if (!player.isConnected || player.getClientRects().length === 0 || player.checkVisibility?.({ visibilityProperty: true }) === false) end();
      };
      /* Moved, or taken out and put back: its frame would start over where it stands, so it goes back to its poster at once. Watched in every root it stands in, only while it plays. */
      const moves = new window.MutationObserver((records) => {
        for (const record of records) for (const removed of record.removedNodes) for (let at: Node | null = element; at; at = at.parentNode ?? (at as Partial<ShadowRoot>).host ?? null) if (at === removed) return end();
      });
      for (let root: Node = element.getRootNode(); ; root = (root as ShadowRoot).host.getRootNode()) {
        moves.observe(root, { childList: true, subtree: true });
        if (!(root as Partial<ShadowRoot>).host) break;
      }
      /* Whether the keyboard is in the player, kept as the page moves it: a frame taken off the page takes it away unsaid. */
      let keyboard = true;
      const keyboardMoved = () => (keyboard = shadow.activeElement === player);
      document.addEventListener("focusin", keyboardMoved);
      /* A press on the page itself takes it out with no focus of its own to say so. */
      const pressedElsewhere = () => void (keyboard = false);
      document.addEventListener("pointerdown", pressedElsewhere, true);
      const watch = typeof window.ResizeObserver === "function" ? new window.ResizeObserver(gone) : undefined;
      const timer = window.setInterval(gone, 1_000);
      const stop = () => {
        if (playing === stop) playing = undefined;
        end = () => {};
        document.removeEventListener("securitypolicyviolation", violated);
        watch?.disconnect();
        window.clearInterval(timer);
        moves.disconnect();
        document.removeEventListener("focusin", keyboardMoved);
        document.removeEventListener("pointerdown", pressedElsewhere, true);
        const nowhere = document.activeElement === null || document.activeElement === document.body;
        const had = shadow.activeElement === player || (keyboard && nowhere);
        player.remove();
        frame.append(button);
        if (had) button.focus({ preventScroll: true });
      };
      end = stop;
      playing = stop;
      document.addEventListener("securitypolicyviolation", violated);
      frame.append(player);
      player.focus({ preventScroll: true });
      button.remove();
      watch?.observe(player);
    };
    button.addEventListener("click", play);
    if (offered && !preview) frame.append(button);

    return {
      key,
      stop: () => end(),
      says(saidTitle, poster, saidEmbed) {
        embed = saidEmbed;
        title = saidTitle;
        const [wide, tall] = embed.shape.split(":");
        frame.style.aspectRatio = `${wide} / ${tall}`;
        /* A tall one is held to a height a person sees whole. */
        frame.style.maxWidth = embed.shape === "9:16" ? "min(100%, 45vh)" : "";
        figure.setAttribute("aria-label", title);
        button.setAttribute("aria-label", `Play: ${title}`);
        name.textContent = title;
        const href = embedLink(embed);
        link.setAttribute("href", href);
        link.textContent = offered ? `Watch on ${provider} ↗` : `${title}: watch on ${provider} ↗`;
        link.setAttribute("aria-label", `${offered ? `Watch on ${provider}: ${title}` : `${title}: watch on ${provider}`} (opens in a new tab)`);
        address.textContent = ` ${title}: ${href}`;
        const player = frame.querySelector("iframe");
        if (player) player.title = `${title} (${provider} player)`;
        if (poster) {
          if (image.getAttribute("src") !== poster) image.setAttribute("src", poster);
          if (!image.isConnected) frame.prepend(image);
        } else image.remove();
        /* Pictured in the Scene with no picture of its own, it says its title on the host's plain ground. */
        if (preview && !refused) {
          words.textContent = title;
          if (poster) words.remove();
          else frame.append(words);
        }
      },
    };
  };

  const forget = (element: Element) => {
    drawn.get(element)?.stop();
    drawn.delete(element);
  };
  return {
    forget,
    draw(element, shadow) {
      const said = (name: string) => element.getAttribute(name);
      const named = namedEmbed(said);
      /* What a view no longer draws is stopped and let go. */
      for (const one of [...drawn.keys()]) if (!one.isConnected) forget(one);
      if ("why" in named) {
        forget(element);
        shadow.replaceChildren();
        element.setAttribute("data-graview-player", "");
        return named.why;
      }
      /* In the Scene's card a place is pictured, not used: the poster and the link, and no player on the plane. */
      const root = element.getRootNode() as Partial<ShadowRoot>;
      const preview = (root.host ?? element).closest("[data-graview-preview]") !== null;
      const offered = embedPlays(named.embed.provider, options.embeds);
      const key = `${embedKey(named.embed)} ${offered} ${preview}`;
      let held = drawn.get(element);
      let keyboardIn: ShadowRoot | undefined;
      if (held?.key !== key) {
        const had = shadow.activeElement !== null;
        held?.stop();
        held = make(element, shadow, named.embed, offered, preview, key);
        drawn.set(element, held);
        /* Another video in its place keeps the keyboard there. */
        if (had) keyboardIn = shadow;
      }
      /* The room the region kept for it while its player was on its way is its own now (REGION_CSS). */
      element.setAttribute("data-graview-player", "");
      held!.says(embedTitle(said, named.embed), said("poster") || null, named.embed);
      keyboardIn?.querySelector<HTMLElement>("button, a")?.focus({ preventScroll: true });
      return undefined;
    },
    dispose() {
      for (const one of drawn.values()) one.stop();
      drawn.clear();
    },
  };
}
