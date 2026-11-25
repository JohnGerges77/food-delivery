import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { normalizeStorefrontAccent, storefrontAccentStyle, themeDefaultAccent } from "../src/lib/storefront-accent.ts";

const root = new URL("../src/", import.meta.url);
const css = await readFile(new URL("app/globals.css", root), "utf8");

test("all four storefronts have one scoped palette and explicit color scheme", () => {
  for (const [id, scheme] of [
    ["savora-classic", "dark"], ["savora-aqua", "light"],
    ["savora-cafe", "light"], ["savora-luxury", "light"],
  ]) {
    const block = css.match(new RegExp(`\\[data-storefront-theme="${id}"\\] \\{([^}]+)\\}`))?.[1];
    assert.ok(block, `${id} palette exists`);
    for (const token of ["background", "surface", "surface-alt", "text", "text-muted",
      "primary", "primary-hover", "on-primary", "accent", "border", "highlight"]) {
      assert.match(block, new RegExp(`--sf-${token}:`), `${id} ${token}`);
    }
    assert.match(block, new RegExp(`color-scheme: ${scheme};`));
    assert.ok(block.includes("--sf-primary: " + themeDefaultAccent[id] + ";"));
  }
  assert.equal(css.includes("prefers-color-scheme"), false);
  assert.match(css, /:not\(\[data-storefront-theme\] \*\)/);
});

const luminance = (hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
  .map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  .reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
function ratio(first, second) {
  const pair = [luminance(first), luminance(second)].sort((a, b) => a - b);
  return (pair[1] + .05) / (pair[0] + .05);
}

test("custom accents use their exact fill with contrast-safe foregrounds and interaction states", () => {
  assert.equal(normalizeStorefrontAccent(" #AbC "), "#aabbcc");
  for (const theme of Object.keys(themeDefaultAccent)) {
    assert.equal(storefrontAccentStyle(theme, ""), undefined);
    assert.equal(storefrontAccentStyle(theme, "var(--red)"), undefined);
    for (const accent of ["#89CFF0", "#FFFFFF", "#000000", "#777777", "#FF0000"]) {
      const style = storefrontAccentStyle(theme, accent);
      assert.equal(style["--sf-primary"], accent.toLowerCase());
      for (const state of ["--sf-primary", "--sf-primary-hover", "--sf-primary-active"]) {
        assert.ok(ratio(style[state], style["--sf-on-primary"]) >= 4.5, `${theme} ${accent} ${state}`);
      }
      assert.equal(new Set(["--sf-primary", "--sf-primary-hover", "--sf-primary-active"].map((key) => style[key])).size, 3);
      assert.ok(ratio(style["--sf-accent-ink"], theme === "savora-classic" ? "#49433f" : "#d7c7b6") >= 4.5);
      assert.ok(ratio(style["--sf-photo-ink"], "#49433f") >= 4.5);
    }
  }
});

test("theme modules consume only tokens defined in the central palette", async () => {
  const definitions = new Set([...css.matchAll(/(--sf-[\w-]+):/g)].map((match) => match[1]));
  for (const theme of ["aqua", "cafe", "luxury"]) {
    const cssModule = await readFile(new URL(`components/features/storefront/${theme}/${theme[0].toUpperCase()}${theme.slice(1)}Storefront.module.css`, root), "utf8");
    assert.equal(/#[0-9a-f]{3,8}\b/i.test(cssModule), false, `${theme} palette stays central`);
    for (const match of cssModule.matchAll(/var\((--sf-[\w-]+)\)/g)) {
      assert.ok(definitions.has(match[1]), `${theme} references defined token ${match[1]}`);
    }
  }
});

test("public Classic navigation has no appearance switch", async () => {
  const navbar = await readFile(new URL("components/layout/PublicNavbar.tsx", root), "utf8");
  assert.equal(navbar.includes("ThemeToggle"), false);
});
