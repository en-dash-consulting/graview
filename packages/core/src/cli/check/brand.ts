import { checkBrandContrast, crowdedHues, HUE_CROWDING } from "../../theme/derive.js";
import { emojiProblem, isInlineSvg, markHref, svgProblem } from "../../theme/marks.js";
import { EMOJI_FIX, emojiSentence, LOGO_FALLBACK_UNUSED } from "../../document/brand-check.js";
import { capitalize } from "../../capital.js";
import { TIME_ZONE_FIX, timeZoneProblem } from "../../days.js";
import { passingShade, ratioWords } from "../../theme/accent.js";
import { TEXT_PAIRS } from "../../theme/types.js";
import { checkKitContrast, resolveKit } from "../../theme/kit.js";
import type { Scheme } from "../../theme/types.js";
import type { AnySchema } from "../../schema/schema.js";

/**
 * `note` is a QUESTION ASKED OUT LOUD, not a problem.
 *
 * Some things a checker can see are legitimate designs that the author
 * should nonetheless have looked at once: a lens written for this app and
 * never proved against another domain, a role name two vocabularies both
 * use, a kind unreachable on an empty graph. Filed as warnings they would
 * be warnings that can only ever be acknowledged, and those are the ones
 * people learn to scroll past — which costs the checker its authority on
 * the warnings that matter. So they have their own voice: counted, printed,
 * and never a failure.
 */
import type { CheckContext } from "./context.js";

/*
 * A DECLARED APP'S LOGO: a string, or one for each scheme (`BrandLogo`).
 * Its shape is refused by name, since TypeScript stops only a literal — a
 * logo read from a file or a config is checked here or nowhere — and each
 * mark as a document's is: one that could act is never drawn.
 */
function checkLogo(logo: unknown, add: CheckContext<AnySchema>["add"]): void {
  if (logo === undefined) return;
  const marks: [string, unknown][] = [];
  if (typeof logo === "string") marks.push(["brand.logo", logo]);
  else if (typeof logo !== "object" || logo === null) {
    add({ severity: "error", code: "brand-logo", where: "brand.logo", message: "The logo is neither a mark nor one for each scheme.", fix: 'Give inline SVG or a path, or { light: "/logo.svg", dark: "/logo-dark.svg" }.' });
    return;
  } else {
    const { light, dark, darkFallback } = logo as Record<string, unknown>;
    if (typeof light !== "string" || light === "") add({ severity: "error", code: "brand-logo", where: "brand.logo.light", message: "A logo for each scheme has no light one, and the light one is what every scheme without its own draws.", fix: 'Give { light: "/logo.svg" }, and dark beside it if the dark scheme has one of its own.' });
    else marks.push(["brand.logo.light", light]);
    if (dark !== undefined) marks.push(["brand.logo.dark", dark]);
    if (darkFallback !== undefined && darkFallback !== "invert") add({ severity: "error", code: "brand-logo", where: "brand.logo.darkFallback", message: `${JSON.stringify(darkFallback)} is not a fallback a logo can have.`, fix: 'Say darkFallback: "invert" to draw the light logo inverted in the dark scheme, or give a dark one.' });
    else if (darkFallback !== undefined && dark !== undefined) add({ severity: "warning", code: "brand-logo", where: "brand.logo.darkFallback", message: `${capitalize(LOGO_FALLBACK_UNUSED)}.`, fix: 'Remove darkFallback, or remove dark to draw the light logo inverted.' });
  }
  for (const [where, mark] of marks) {
    // A declared app may keep its logo anywhere an image can be drawn from (a document, only on its own host): what is refused is a mark that could act.
    const problem = typeof mark !== "string" || mark === "" ? "it is not a mark" : isInlineSvg(mark) ? svgProblem(mark) : markHref(mark) ? null : "it is neither inline SVG nor an address an image is drawn from";
    if (problem) add({ severity: "error", code: "brand-mark", where, message: `The logo cannot be drawn as given, because ${problem}.`, fix: "Graview draws an image exactly as it is given, never rewritten: remove that and give it again." });
  }
}

export function checkAccents<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, kinds, add } = ctx;
  /*
   * A declared kind accent must name a declared kind. A typo here would not
   * fail — it would quietly fall back to the hash, which is the worst kind
   * of wrong: a brand decision that looks applied and is not.
   */
  for (const [kind, hue] of Object.entries(app.brand?.accents ?? {})) {
    if (!kinds.has(kind)) {
      add({
        severity: "error",
        code: "brand-accent-unknown-kind",
        where: `brand.accents["${kind}"]`,
        message: `An accent is declared for "${kind}", which no defineNode declares.`,
        fix: `Fix the kind name, or remove the entry. Declared: ${[...kinds].join(", ")}.`,
      });
    }
    if (typeof hue !== "number" || !Number.isFinite(hue)) {
      add({
        severity: "error",
        code: "brand-accent-not-a-hue",
        where: `brand.accents["${kind}"]`,
        message: `The accent must be a hue in degrees (a number), got ${JSON.stringify(hue)}.`,
        fix: `Use a number 0–360, e.g. 152 for a green.`,
      });
    }
  }
  /*
   * KINDS THAT READ AS ONE COLOR. The same answer `graview describe` says
   * (`crowdedHues`), so describe never flags a clash the check passed.
   * A note, not a warning: a kind with no accent takes a hue from its
   * name, and six names land two within 12° more often than not — a
   * question worth one look, which an accent answers.
   */
  const { hues, crowded } = crowdedHues([...kinds], app.brand?.accents);
  if (crowded.length > 1) {
    const at = (kind: string) => hues.find((entry) => entry.kind === kind)!.hue;
    add({
      severity: "note",
      code: "brand-hues-crowded",
      where: "brand.accents",
      message: `${crowded.map((kind) => `${kind} (${at(kind)}°)`).join(", ")} are within ${HUE_CROWDING}° of each other on the color wheel and will read as one color.`,
      fix: `Give ${crowded.slice(1).map((kind) => `"${kind}"`).join(", ")} an accent in brand.accents at least ${HUE_CROWDING}° from the others, e.g. "${crowded[1]}": ${(at(crowded[0]!) + 180) % 360}.`,
    });
  }
  /*
   * THE APP'S MONEY (FR-100). A currency or a locale the runtime cannot
   * format with is said as a plain number everywhere — a brand decision
   * that looks applied and is not — so it is refused here by name.
   */
  /* AN EMOJI AS THE APP'S ICON: exactly one standard emoji, or every face would draw something other than what was meant. */
  const favicon = app.brand?.favicon;
  if (typeof favicon === "object" && favicon !== null) {
    const problem = emojiProblem(favicon.emoji);
    if (problem) add({ severity: "error", code: "brand-emoji", where: "brand.favicon.emoji", message: `${capitalize(emojiSentence(favicon.emoji, problem))}.`, fix: `${capitalize(EMOJI_FIX)}.` });
  }
  checkLogo(app.brand?.logo, add);
  const { currency, locale } = app.brand ?? {};
  const formats =(options: Intl.NumberFormatOptions, at?: string) => {
    try {
      new Intl.NumberFormat(at ?? "en-US", options);
      return true;
    } catch {
      return false;
    }
  };
  if (currency !== undefined && (!/^[A-Z]{3}$/.test(currency) || !formats({ style: "currency", currency }))) {
    add({ severity: "error", code: "brand-currency", where: "brand.currency", message: `"${currency}" is not a currency's three-letter code, so money would be said with no symbol.`, fix: 'Use an ISO 4217 code, like "USD", "EUR" or "GBP".' });
  }
  if (locale !== undefined && !formats({}, locale)) {
    add({ severity: "error", code: "brand-locale", where: "brand.locale", message: `"${locale}" is not a locale, so its days, times, numbers and money could not be written for it.`, fix: 'Use a language tag, like "en-US" or "de-DE".' });
  }
  // A zone the runtime cannot say a time in would be said on each reader's clock: the bug the zone is declared to end (Roadmap f-app-time-zone).
  const timeZone = app.brand?.timeZone;
  const unzoned = timeZone === undefined ? undefined : timeZoneProblem(timeZone);
  if (unzoned) add({ severity: "error", code: "brand-time-zone", where: "brand.timeZone", message: unzoned, fix: TIME_ZONE_FIX });

}

export function checkPalette<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, kinds, add } = ctx;
  /*
   * A palette that cannot be read.
   *
   * The two shipped schemes are not inversions of each other, and a brand
   * that supplies one color and lets the rest be derived can end up with
   * text that clears AA in the dark and fails badly on paper. Contrast is
   * measurable, so it is checked rather than trusted — and the failure names
   * the exact token PAIR and where it is drawn, because "your theme has a
   * contrast problem" is not something anyone can act on.
   */
  if (app.brand) {
    for (const finding of checkBrandContrast(app.brand.schemes)) {
      if (finding.unreadable !== undefined) {
        add({
          severity: "warning",
          code: "theme-token-unreadable",
          where: `brand.schemes.${finding.scheme}.${finding.on === finding.ink ? finding.ink : finding.on}`,
          message: `Could not read "${finding.unreadable}" as a color, so the pair ${finding.ink} on ${finding.on} was not checked.`,
          fix: "Use a hex, rgb() or hsl() value, or a gradient built from them.",
        });
        continue;
      }
      // The pair as colors, its ratio, and a shade that would pass (FR-126): a sentence somebody can act on.
      const tokens = app.brand.schemes[finding.scheme] as unknown as Record<string, string>;
      const pair = TEXT_PAIRS.find((one) => one.ink === finding.ink && one.on === finding.on);
      const shade = passingShade(String(tokens[finding.ink]), String(tokens[finding.on]), finding.requires, pair?.over ? String(tokens[pair.over]) : undefined);
      add({
        severity: "error",
        code: "theme-contrast-below-aa",
        where: `brand.schemes.${finding.scheme}: ${finding.ink} on ${finding.on}`,
        message: `${tokens[finding.ink]} text (${finding.ink}) on ${tokens[finding.on]} (${finding.on}) is ${ratioWords(finding.ratio)}; ${finding.requires}:1 is needed — ${finding.where}.`,
        fix: shade ? `${shade} would pass as "${finding.ink}".` : `Darken or lighten "${finding.ink}", or change the ground it sits on.`,
      });
    }
    /*
     * The kit's colors are held to the same standard as the text's, at the
     * graphics floor: a line a brand paints explicitly must be told from
     * the ground it crosses, on both grounds, in both schemes.
     */
    if (app.brand.kit) {
      const kit = resolveKit(app.brand.kit);
      const unreadable = new Set<string>();
      for (const scheme of Object.keys(app.brand.schemes) as Scheme[]) {
        for (const finding of checkKitContrast(kit, app.brand.schemes[scheme])) {
          const where = `brand.kit.connectors.${finding.edgeKind === "*" ? "all" : `byEdge.${finding.edgeKind}`}.color`;
          if (finding.unreadable !== undefined) {
            if (unreadable.has(where)) continue;
            unreadable.add(where);
            add({
              severity: "warning",
              code: "kit-color-unreadable",
              where,
              message: `Could not read "${finding.unreadable}" as a color, so the line was not checked against the ground.`,
              fix: "Use a hex, rgb() or hsl() value.",
            });
            continue;
          }
          add({
            severity: "error",
            code: "kit-contrast-below-aa",
            where: `${where} in ${scheme}`,
            // WHICH ground: the same line fails the scene's ground and the deeper one under a district, and two errors saying "the ground" read as one said twice.
            message: `${finding.ratio}:1 against the ${finding.ground ?? "ground"} of the ${scheme} scheme, where ${finding.requires}:1 is required for a line to be seen.`,
            fix: `Darken or lighten "${finding.color}", or drop it and let the kind's own hue paint the line.`,
          });
        }
      }
    }
    if (app.brand.name.trim().length === 0) {
      add({
        severity: "warning",
        code: "brand-unnamed",
        where: "brand.name",
        message: "An installation with no name shows the framework's wordmark instead of yours.",
        fix: "Set brand.name to the product name.",
      });
    }
  }

  // A node kind whose declaration demands an invariant nobody wrote will
  // silently skip at runtime. That is the right default for evaluation but
  // the wrong default for a build.
  for (const definition of app.schema.definitions) {
    if (!definition.requiresInvariant) continue;
    const covered = new Set(
      (app.invariants ?? [])
        .filter((i) => i.scope !== "graph" && i.scope.kind === definition.kind)
        .map((i) => i.name),
    );
    if (covered.size === 0) {
      add({
        severity: "warning",
        code: "required-invariant-unregistered",
        where: `defineNode("${definition.kind}").requiresInvariant`,
        message: `"${definition.kind}" declares that its nodes require an invariant, but none is registered for that kind.`,
        fix: `Add a defineInvariant scoped to "${definition.kind}", or drop requiresInvariant.`,
      });
    }
  }

  if (app.views) {
    const withViews = new Set(app.views.kindsWithViews());
    for (const kind of kinds) {
      if (!withViews.has(kind)) {
        add({
          severity: "warning",
          code: "kind-without-view",
          where: `defineNode("${kind}")`,
          message: `No view is registered for "${kind}" — it will fall back to a primitive.`,
          fix: `Register a view with views.register("${kind}", { cardinality, fidelity }, Component), or accept the primitive fallback.`,
        });
      }
    }
    for (const registration of app.views.all()) {
      if (!kinds.has(registration.kind)) {
        add({
          severity: "error",
          code: "view-for-undeclared-kind",
          where: `views.register("${registration.kind}", ...)`,
          message: `A view is registered for "${registration.kind}", which no defineNode declares.`,
          fix: `Declare the kind, or remove the view registration.`,
        });
      }
    }
  }
}
