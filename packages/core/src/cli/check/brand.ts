import { checkBrandContrast } from "../../theme/derive.js";
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
   * THE APP'S MONEY (FR-100). A currency or a locale the runtime cannot
   * format with is said as a plain number everywhere — a brand decision
   * that looks applied and is not — so it is refused here by name.
   */
  const { currency, locale } = app.brand ?? {};
  const formats = (options: Intl.NumberFormatOptions, at?: string) => {
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
    add({ severity: "error", code: "brand-locale", where: "brand.locale", message: `"${locale}" is not a locale, so money could not be written for it.`, fix: 'Use a language tag, like "en-US" or "de-DE".' });
  }
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
      add({
        severity: "error",
        code: "theme-contrast-below-aa",
        where: `brand.schemes.${finding.scheme}: ${finding.ink} on ${finding.on}`,
        message: `${finding.ratio}:1 where ${finding.requires}:1 is required — ${finding.where}.`,
        fix: `Darken or lighten "${finding.ink}", or change the ground it sits on.`,
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
